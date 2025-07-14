import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { onSnapshot, 
  getFirestore, serverTimestamp, addDoc, limit, doc, getDoc, updateDoc, collection, query, where, getDocs,orderBy, arrayUnion, increment 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app, db, auth  } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';
import { sendNotification, NOTIFICATION_TEMPLATES, checkAndAwardTasks, markAllNotificationsRead, rewardTasks } from "https://rw-501.github.io/contenthub/includes/notifications.js";

const storage = getStorage(app, "gs://content-hub-11923.firebasestorage.app");

// Profile View Logic
let currentUser, viewingUserId, userData;

onAuthStateChanged(auth, async user => {
  currentUser = auth.currentUser;

  const params = new URLSearchParams(location.search);
  viewingUserId = params.get('uid') || currentUser.uid;

const userDoc = await getDoc(doc(db, "users", viewingUserId));
const userData = userDoc.data();

    
console.log("userData ", userData)




  let actingAsUser = user;
  let currentUserData;

  if (currentUser && viewingUserId !== currentUser.uid && userData?.role === "demo") {
    const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
    currentUserData = currentUserDoc.data();
    if (currentUserData?.role === "admin") {
      console.warn("Acting as demo user:", viewingUserId);
      actingAsUser = { ...user, uid: viewingUserId };
    }
  }

  if (currentUser && actingAsUser && actingAsUser.uid !== currentUser.uid) {
    document.getElementById("impersonationBanner").classList.remove("d-none");
    currentUser = actingAsUser;
  }

  setTimeout(() => {
    const avatar = document.getElementById("userAvatar");
    if (!avatar) return console.warn("⚠️ Avatar element not found.");

    avatar.dataset.role = userData.role || "";
    avatar.dataset.displayName = userData.displayName || "";
    avatar.dataset.photo = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
    avatar.dataset.username = userData.username || "";
    avatar.dataset.email = userData.email || "";
    avatar.dataset.location = userData.userLocation?.city || "";
    avatar.dataset.niches = (userData.niches || []).join(",");
    avatar.dataset.pronouns = userData.pronouns || "";

    const avatarImg = document.getElementById("avatarImg");
    if (avatarImg) avatarImg.src = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
  }, 300);

  // Profile Info
  document.getElementById("displayName").innerText = userData.displayName || 'Anonymous';
  document.getElementById("usernameText").textContent = userData.username || "";
  document.getElementById("pronounsText").innerHTML = userData.pronouns ? `<i class="bi bi-person"></i> ${userData.pronouns}` : "";
  document.getElementById("availabilityText").innerHTML = userData.availability ? `<i class="bi bi-clock-history"></i> ${userData.availability}` : "";
  document.getElementById("bioText").innerText = userData.bio || '';

  const locationText = document.getElementById("locationText");
  if (userData.userLocation?.country) {
    const { city, state, country } = userData.userLocation;
    const parts = [city, state, country].filter(Boolean);
    const locationStr = parts.join(", ");
    const locationParam = encodeURIComponent(parts.join("-").toLowerCase());
    locationText.innerHTML = `<a href="/pages/creators.html?location=${locationParam}" class="text-decoration-none">${locationStr}</a>`;
  } else {
    locationText.innerHTML = '';
  }

  // Badges
  const contentTypesHTML = (userData.contentTypes || []).map(ct => `<a href="/pages/creators.html?type=${encodeURIComponent(ct.toLowerCase())}" class="badge bg-secondary text-light me-1 mb-1">${ct}</a>`).join("");
  const nichesHTML = (userData.niches || []).map(n => `<a href="/pages/creators.html?niche=${encodeURIComponent(n.toLowerCase())}" class="badge bg-light text-dark border me-1 mb-1">${n}</a>`).join("");

  document.getElementById("contentTypeText").innerHTML = contentTypesHTML;
  document.getElementById("nicheText").innerHTML = nichesHTML;

  document.getElementById("profilePhoto").src = userData.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png';
  document.getElementById("userPointsBadge").textContent = `⭐ ${userData.points || 0} pts`;
  document.getElementById("userPointsBadge").onclick = () => loadRewardModal();

  // Social Links
  const socialContainer = document.getElementById("socialLinks");
  socialContainer.innerHTML = "";
  const icons = {
    instagram: "bi bi-instagram", tiktok: "bi bi-tiktok", youtube: "bi bi-youtube",
    facebook: "bi bi-facebook", twitter: "bi bi-twitter", linkedin: "bi bi-linkedin",
    twitch: "bi bi-twitch", threads: "bi bi-threads", snapchat: "bi bi-snapchat",
    pinterest: "bi bi-pinterest", reddit: "bi bi-reddit", other: "bi bi-link-45deg"
  };

  (userData.links || []).forEach(({ platform, url }) => {
    const icon = icons[platform?.toLowerCase()] || icons.other;
    const verified = userData.verifiedPlatforms?.[platform.toLowerCase()] === true;
    const a = document.createElement("a");
    a.href = url.trim();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "btn btn-sm btn-outline-secondary me-1";
    a.innerHTML = `<i class="${icon}"></i>${verified ? '<i class="bi bi-patch-check-fill text-primary ms-1" title="Verified"></i>' : ''}`;
    socialContainer.appendChild(a);
  });

  // Profile Actions
  const isOwnerView = currentUser && !viewingUserId || currentUser && viewingUserId === currentUser.uid;
  const collabBtn = document.getElementById("collabBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const analyticsBtn = document.getElementById("analyticsBtn");
  const openReviewModalBtn = document.getElementById("openReviewModalBtn");
  const postComposer = document.getElementById("postComposer");

  if (!isOwnerView) {
    collabBtn.style.display = "inline-block";
    collabBtn.onclick = () => {
      collabBtn.dataset.viewingUserId = viewingUserId;
      collabBtn.dataset.username = userData.username;
      collabBtn.dataset.displayName = userData.displayName;
    };
    editProfileBtn?.remove();
    analyticsBtn?.remove();
    postComposer.style.display = "none";
    openReviewModalBtn?.remove();
  } else {
    collabBtn?.remove();
    editProfileBtn.style.display = "inline-block";
    analyticsBtn.style.display = "inline-block";
  }

  document.querySelectorAll(".userBtns").forEach(btn => {
    if (!isOwnerView) btn.remove();
  });

  const followBtn = document.getElementById("followBtn");
  if (!isOwnerView) {
    followBtn.style.display = "inline-block";
    if ((userData.followers || []).includes(currentUser ? currentUser.uid : '')) {
      followBtn.innerText = "Unfollow";
      followBtn.onclick = () => unfollowUser(viewingUserId);
    } else {
      followBtn.innerText = "Follow";
      followBtn.onclick = () => followUser(viewingUserId);
    }
  } else {
    followBtn?.remove();
  }

  const currentPageID = currentUser ? currentUser.uid : viewingUserId;
  if(!currentPageID){

    console.warn("⚠️ Current PageID not found.");
    return;
  }

  loadUserReviews(currentPageID);
  checkNameChangeEligibility(userData);
  loadUserPosts(currentPageID, userData.displayName, userData.photoURL);
  loadUserCollabs(viewingUserId);
  loadFollowingList(userData);
  loadFollowersList(userData);
  loadAnalytics(currentPageID);
  loadProjectHistory(currentPageID);
  loadPublicBadges(userData);

  setTimeout(async () => {
    if (isOwnerView || userData.role == 'demo') return;

    const avatar = document.getElementById("userAvatar");
    if (!avatar) return console.warn("⚠️ Avatar element not found.");

    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayName;
    const viewerRole = avatar.dataset.role;
    const viewerUsername = avatar.dataset.username;
    const viewerUserPhotoURL = avatar.dataset.photo;

    if (!viewerUserId || !viewerDisplayName || !viewerUserPhotoURL) return;
    if (typeof viewingUserId !== "string") return;

    await sendNotification({
      toUid: viewingUserId,
      fromUid: viewerUserId,
      fromDisplayName: viewerDisplayName,
      fromuserAvatar: viewerUserPhotoURL,
      message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
      type: "profileView",
    });

    await updateDoc(doc(db, "users", viewingUserId), { profileViews: increment(1) });
    await updateDoc(doc(db, "users", viewerUserId), { profilesViewed: increment(1) });

    const [viewedSnap, viewerSnap] = await Promise.all([
      getDoc(doc(db, "users", viewingUserId)),
      getDoc(doc(db, "users", viewerUserId))
    ]);

    if (viewedSnap.exists()) await checkAndAwardTasks(viewingUserId, viewedSnap.data());
    if (viewerSnap.exists()) await checkAndAwardTasks(viewerUserId, viewerSnap.data());
  }, 2000);
});

// Review Modal trigger
document.getElementById("openReviewModal")?.addEventListener("click", () => {
  document.getElementById("toUserId").value = viewingUserId;
  new bootstrap.Modal(document.getElementById("reviewModal")).show();
});

const userCache = {};

async function getUserFromCache(uid) {
  if (!userCache[uid]) {
    const docSnap = await getDoc(doc(db, "users", uid));
    if (docSnap.exists()) {
      userCache[uid] = { uid, ...docSnap.data() };
    } else {
      userCache[uid] = null; // Optionally mark as not found
    }
  }
  return userCache[uid];
}


async function loadFollowingList(data) {
  const list = document.getElementById("followingList");
  list.innerHTML = `<small class="text-muted">${data.following?.length || 0} Following</small>`;

  if (!data.following || data.following.length === 0) {
    list.innerHTML += `<li class='alert alert-info text-center'>Not following anyone yet.       
     <br>
        <a href="https://rw-501.github.io/contenthub/pages/explore.html" class="btn btn-outline-primary btn-sm mt-2">
          🤝 Follow some creators 
        </a>
      </li>`;
    return;
  }

  let start = 0;
  const limit = 10;

  const renderNext = async () => {
    const slice = data.following.slice(start, start + limit);
    const userDocs = await Promise.all(slice.map(uid => getUserFromCache(uid)));
userDocs.forEach(u => {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex align-items-center justify-content-between";

  const profileLink = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.uid}`;
  const niches = Array.isArray(u.niches) ? u.niches : [];

  // Convert niches to linked badges
  const badges = niches.map(niche =>
    `<a href="https://rw-501.github.io/contenthub/pages/creators.html?niche=${encodeURIComponent(niche)}"
        class="badge bg-primary text-decoration-none me-1">
      ${niche}
    </a>`
  ).join("");

  li.innerHTML = `
    <div class="d-flex align-items-center flex-wrap">
      <img src="${u.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
      <a href="${profileLink}" class="btn btn-link p-0 m-0 text-decoration-none">
        <strong>${u.displayName || "Unnamed"}</strong>
      </a>
      <div class="ms-3 d-flex flex-wrap">
        ${badges}
      </div>
    </div>
  `;

  list.appendChild(li);
});


    start += limit;

    if (start < data.following.length) {
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.className = "btn btn-link w-100 mt-2";
      loadMoreBtn.textContent = "Load more";
      loadMoreBtn.onclick = () => {
        loadMoreBtn.remove();
        renderNext();
      };
      list.appendChild(loadMoreBtn);
    }
  };

  renderNext();
}

async function loadFollowersList(data) {
  const list = document.getElementById("followersList");
  list.innerHTML = `<small class="text-muted">${data.followers?.length || 0} Followers</small>`;

  if (!data.followers || data.followers.length === 0) {
    list.innerHTML += "<li class='alert alert-info text-center'>No followers yet.</li>";
    return;
  }

  let start = 0;
  const limit = 10;

  const renderNext = async () => {
    const slice = data.followers.slice(start, start + limit);
    const userDocs = await Promise.all(slice.map(uid => getUserFromCache(uid)));

userDocs.forEach(u => {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex align-items-center justify-content-between";

  const profileLink = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.uid}`;
  const niches = Array.isArray(u.niches) ? u.niches : [];

  // Convert niches to linked badges
  const badges = niches.map(niche =>
    `<a href="https://rw-501.github.io/contenthub/pages/creators.html?niche=${encodeURIComponent(niche)}"
        class="badge bg-primary text-decoration-none me-1">
      ${niche}
    </a>`
  ).join("");

  li.innerHTML = `
    <div class="d-flex align-items-center flex-wrap">
      <img src="${u.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
      <a href="${profileLink}" class="btn btn-link p-0 m-0 text-decoration-none">
        <strong>${u.displayName || "Unnamed"}</strong>
      </a>
      <div class="ms-3 d-flex flex-wrap">
        ${badges}
      </div>
    </div>
  `;

  list.appendChild(li);
});



    start += limit;

    if (start < data.followers.length) {
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.className = "btn btn-link w-100 mt-2";
      loadMoreBtn.textContent = "Load more";
      loadMoreBtn.onclick = () => {
        loadMoreBtn.remove();
        renderNext();
      };
      list.appendChild(loadMoreBtn);
    }
  };

  renderNext();
}

// Unfollow user
async function unfollowUser(uid) {
    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    following: arrayRemove(uid)
  });
  showModal({ title: "Success!", message: "Unfollowed!", autoClose: 3000 });
  location.reload();
}

// Follow user
async function followUser(uid) {
    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    following: arrayUnion(uid)
  });
  showModal({ title: "Success!", message: "Followed!", autoClose: 3000 });
  location.reload();
}

function encodeData(obj) {
  const json = JSON.stringify(obj);
  return btoa(encodeURIComponent(json));
}
function decodeData(str) {
  const decoded = decodeURIComponent(atob(str));
  return JSON.parse(decoded);
}

async function loadUserPosts(uid, displayName, photoURL) {
  const postGrid = document.getElementById("postsGrid");
  postGrid.innerHTML = "";

const q = query(
  collection(db, "posts"),
  where("owner", "==", uid),
  orderBy("createdAt", "desc")
);
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    postGrid.innerHTML = `
      <div class="alert alert-info text-center">
        <p>No posts yet, 🚀 Create your first post</p>
      </div>`;
    return;
  }

  const now = new Date();

  for (const docSnap of snapshot.docs) {
    const post = docSnap.data();

    // ✅ Skip if scheduled in the future
    if (post.scheduledAt && post.scheduledAt.toDate() > now) continue;

const status = (post.status ?? "").toLowerCase();
if (status === "removed") continue;

    const card = document.createElement("div");
    card.className = "card mb-3 shadow-sm";

    const mediaUrl = post.media?.[0]?.url || "";
    const mediaType = post.media?.[0]?.type || "";
    let mediaHTML = "";

    // Media rendering (same as your original code)
    if (mediaUrl) {
      if (/youtube\.com|youtu\.be/.test(mediaUrl)) {
        const embed = mediaUrl.includes("watch?v=")
          ? mediaUrl.replace("watch?v=", "embed/")
          : mediaUrl.replace("youtu.be/", "youtube.com/embed/");
        mediaHTML = `<iframe width="100%" height="200" src="${embed}" frameborder="0" allowfullscreen></iframe>`;
      } else if (/vimeo\.com/.test(mediaUrl)) {
        const id = mediaUrl.split("/").pop();
        mediaHTML = `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/dailymotion\.com/.test(mediaUrl)) {
        const id = mediaUrl.split("/").pop();
        mediaHTML = `<iframe src="https://www.dailymotion.com/embed/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/twitch\.tv/.test(mediaUrl)) {
        const id = mediaUrl.split("/").pop();
        mediaHTML = `<iframe src="https://player.twitch.tv/?video=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/facebook\.com/.test(mediaUrl)) {
        const id = mediaUrl.split("/").pop();
        mediaHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/video.php?v=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/instagram\.com/.test(mediaUrl)) {
        const id = mediaUrl.split("/p/").pop().split("/")[0];
        mediaHTML = `<iframe src="https://www.instagram.com/p/${id}/embed" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/twitter\.com/.test(mediaUrl)) {
        mediaHTML = `<iframe src="https://twitframe.com/show?url=${encodeURIComponent(mediaUrl)}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (/tiktok\.com/.test(mediaUrl)) {
        const id = mediaUrl.split("/video/").pop();
        mediaHTML = `<iframe src="https://www.tiktok.com/embed/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (
        mediaUrl.includes("firebasestorage.googleapis.com") ||
        /\.(mp4|webm|ogg)$/i.test(mediaUrl)
      ) {
        mediaHTML = `<video src="${mediaUrl}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
      } else {
        mediaHTML = `<img src="${mediaUrl}" alt="Post media" style="width:100%; max-height:200px; object-fit:cover;" />`;
      }
    }

    const createdAt = post.createdAt?.toDate?.() || new Date();
    const timeAgo = timeSince(createdAt.getTime());

const encodedUser = encodeData(JSON.stringify(docSnap.id));
const encodedPost = encodeData(JSON.stringify(post));

  let joinButton = "";
  if (["collab", "help"].includes(post.type)) {
    joinButton = `
    <button 
  class="btn btn-sm btn-outline-primary mt-2"
    data-user="${encodedUser}"
    data-post="${encodedPost}"
  onclick="requestToJoin(this)"
>
  Request to Join
</button>

    `;
  }
card.innerHTML = `
  ${mediaHTML}
  <div class="PostCard card-body">
    <div class="d-flex align-items-center mb-2">
      <img src="${photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
           class="creator-avata rounded-circle me-2"
           width="40" height="40" />
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${uid}"
         class="fw-bold text-decoration-none">${displayName}</a>
    </div>

    <p class="card-text">${linkify(sanitize(post.caption || ""))}</p>

    <small class="text-muted d-block mb-2">
      ${timeAgo} • 
      <span id="like-count-${docSnap.id}">${post.likes || 0}</span> Likes
      <span id="helpful-count-${docSnap.id}">${post.helpful || 0}</span> Helpful
      <span id="interested-count-${docSnap.id}">${post.interested || 0}</span> Interested
    </small>

    <div class="d-flex gap-2  mb-2">
      <button class="btn btn-sm btn-outline-danger" id="like-btn-${docSnap.id}">❤️ Like</button>
      <button class="btn btn-sm btn-outline-success" id="helpful-btn-${docSnap.id}">🙌 Helpful</button>
      <button class="btn btn-sm btn-outline-info" id="interested-btn-${docSnap.id}">⭐ Interested</button>
    </div>

    <div class="d-flex gap-2 mb-2">
      ${joinButton}
    </div>

    <button class="btn btn-sm btn-outline-primary mb-2"
      data-post-id="${docSnap.id}"
      data-post-owner="${post.owner}"
      onclick="openComments('${docSnap.id}', '${post.owner}')">
      💬 Comments
    </button>

    ${currentUser?.uid === post.owner ? `
      <button class="btn btn-sm btn-outline-danger mb-2 removeBtn"
        onclick="removePost('${docSnap.id}')">
        🗑️ Remove
      </button>
    ` : ""}
  </div>
`;


// Get buttons
const likeBtn = card.querySelector(`#like-btn-${docSnap.id}`);
const likeCountEl = card.querySelector(`#like-count-${docSnap.id}`);
const helpfulBtn = card.querySelector(`#helpful-btn-${docSnap.id}`);
const helpfulCountEl = card.querySelector(`#helpful-count-${docSnap.id}`);
const interestedBtn = card.querySelector(`#interested-btn-${docSnap.id}`);
const interestedCountEl = card.querySelector(`#interested-count-${docSnap.id}`);

// ❤️ Like Button
if (likeBtn) {
  likeBtn.addEventListener("click", () => {
    console.log("❤️ Like clicked");
    likeBtn.classList.toggle("active");

    likeBtn.classList.add("animate__animated", "animate__bounce");
    setTimeout(() => likeBtn.classList.remove("animate__animated", "animate__bounce"), 800);

    // ✅ Update count visually
    if (likeCountEl) {
      const current = parseInt(likeCountEl.innerText) || 0;
      likeCountEl.innerText = current + 1;
    }

    reactToPost(docSnap.id, "like", post.owner, post.caption);
  });
}

// 🙌 Helpful Button
if (helpfulBtn) {
  helpfulBtn.addEventListener("click", () => {
    console.log("🙌 Helpful clicked");
    helpfulBtn.classList.toggle("active");

    helpfulBtn.classList.add("animate__animated", "animate__pulse");
    setTimeout(() => helpfulBtn.classList.remove("animate__animated", "animate__pulse"), 800);

    // ✅ Update count visually
    if (helpfulCountEl) {
      const current = parseInt(helpfulCountEl.innerText) || 0;
      helpfulCountEl.innerText = current + 1;
    }

    reactToPost(docSnap.id, "helpful", post.owner, post.caption);
  });
}

// ⭐ Interested Button
if (interestedBtn) {
  interestedBtn.addEventListener("click", () => {
    console.log("⭐ Interested clicked");
    interestedBtn.classList.toggle("active");

    interestedBtn.classList.add("animate__animated", "animate__tada");
    setTimeout(() => interestedBtn.classList.remove("animate__animated", "animate__tada"), 800);

    // ✅ Update count visually
    if (interestedCountEl) {
      const current = parseInt(interestedCountEl.innerText) || 0;
      interestedCountEl.innerText = current + 1;
    }

    reactToPost(docSnap.id, "interested", post.owner, post.caption);
  });
}

}


  
}


async function reactToPost(postId, type, ownerId, caption) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }

  const postRef = doc(db, "posts", postId);
  const userRef = doc(db, "users", ownerId);

  // ✅ Increment the correct field on post and user
  await updateDoc(postRef, { [`${type}Count`]: increment(1) });
  await updateDoc(userRef, {
    [`receivedReactions.${type}`]: increment(1)
  });

  const emojiMap = {
    helpful: "🙌",
    interested: "⭐",
    like: "❤️"
  };
  const emoji = emojiMap[type] || "✨";

  const avatar = document.getElementById("userAvatar");

  const viewerUserId = avatar?.dataset.uid || currentUser.uid;
  const viewerDisplayName = avatar?.dataset.displayName || currentUser.displayName || "Someone";
  const viewerUsername = avatar?.dataset.username || currentUser.email?.split('@')[0] || "user";
  const viewerUserPhotoURL = avatar?.dataset.photo || currentUser.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png';

  await sendNotification({
    toUid: ownerId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerUsername} marked your post as ${type} ${emoji}: "${caption}"`,
    type: `${type}Post`
  });

  // 🎯 Optionally check for reward
  const updatedSnap = await getDoc(userRef);
  await checkAndAwardTasks(ownerId, updatedSnap.data());
}

function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((new Date() - date) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count > 0) return rtf.format(-count, unit);
  }

  return "just now";
}
async function removePost(postId) {
  if (!confirm("Are you sure you want to remove this post?")) return;
  try {
    await updateDoc(doc(db, "posts", postId), { status: "removed" });
    // Optionally hide or reload the post
    document.getElementById(`post-${postId}`)?.remove();
  } catch (err) {
    console.error("Failed to remove post:", err);
    alert("Something went wrong removing the post.");
  }
}
window.removePost = removePost;

let currentPostId = null;
let currentPostOwnerId = null;

async function openComments(postId, postOwnerId) {
    const avatar = document.getElementById("userAvatar");
  const viewerUserId = avatar.dataset.uid;
  currentPostId = postId;
  currentPostOwnerId = postOwnerId;

  document.getElementById("commentsList").innerHTML = "Loading...";
  document.getElementById("newCommentText").value = "";

  const modal = new bootstrap.Modal(document.getElementById("commentModal"));
  modal.show();

  const commentsRef = collection(db, "posts", postId, "comments");
 const snap = await getDocs(query(commentsRef, orderBy("timestamp", "asc")));
const comments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

const commentMap = {};
comments.forEach(c => {
  if (!c.parentId) {
    commentMap[c.id] = { ...c, replies: [] };
  } else {
    if (commentMap[c.parentId]) {
      commentMap[c.parentId].replies.push(c);
    } else {
      commentMap[c.parentId] = { replies: [c] }; // fallback if parent not rendered yet
    }
  }
});

let html = "";
for (const id in commentMap) {
  const c = commentMap[id];

const status = (c.status ?? "").toLowerCase();
if (c.parentId || status === "removed") continue;

html += `
  <div class="border-bottom pb-2 mb-2 d-flex">
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${c.commenteduId}">
    <img src="${c.commenteduPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" 
         alt="${c.commenteduName}" 
         class="rounded-circle me-2 flex-shrink-0" 
         width="50" height="50" 
         style="object-fit: cover;" />
    <div class='w-100'>
      <strong>${c.commenteduName}:</strong></a>
       ${c.text}
      <div class="small">${timeAgo(c.timestamp?.toDate?.())}</div>
      <button class="btn btn-sm text-primary p-0 mt-1" onclick="showReplyBox('${id}')">↪️ Reply</button>
      <div id="replyBox-${id}" class="mt-2" style="display: none;">
        <textarea class="form-control" rows="1" placeholder="Write a reply..." id="replyText-${id}"></textarea>
        <button class="btn btn-sm btn-secondary mt-1" onclick="addReply('${id}','${c.commenteduId}','${currentPostId}')">Reply</button>
      </div>
    </div>
    ${c.commenteduId === viewerUserId 
  ? `<button class="btn btn-sm btn-danger position-absolute end-0 top-0 me-2 mb-1 removeBtn" onclick="removeComment('${id}')">Remove</button>` 
  : ""}

  </div>
`;

if (c.replies?.length) {
  html += `<div class="ms-4 mt-2">`;
  for (const reply of c.replies) {

const status = (reply.status ?? "").toLowerCase();
if (status === "removed") continue;

    html += `
      <div class="border-start ps-2 mb-2 d-flex">
            <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${reply.replyerUid}">
        <img src="${reply.replyerUserPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
             alt="${reply.replyerUname}"
             class="rounded-circle me-2 flex-shrink-0"
             width="40" height="40"
             style="object-fit: cover;" />
        <div>
          <strong>${reply.replyerUname}:</strong></a>
          ${reply.text}
          <div class="small text-muted">${timeAgo(reply.timestamp?.toDate?.())}</div>
        </div>
        ${reply.replyerUid === viewerUserId 
  ? `<button class="btn btn-sm btn-danger position-absolute end-0 top-0 me-2 mb-1 removeBtn" onclick="removeComment('${reply.id}')">Remove</button>` 
  : ""}

      </div>
    `;
  }
  html += `</div>`;
}


  html += `</div>`; // close comment div
}


  document.getElementById("commentsList").innerHTML = html || "<p>No comments yet.</p>";
}
window.openComments = openComments;

async function removeComment(commentId) {
  if (!commentId || !currentPostId) return;

  try {
    await updateDoc(doc(db, "posts", currentPostId, "comments", commentId), {
      status: "removed"
    });
    openComments(currentPostId); // Refresh after removal
  } catch (err) {
    console.error("Failed to remove comment:", err);
    alert("Failed to remove the comment. Please try again.");
  }
}
window.removeComment = removeComment;

async function addComments() {
    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const text = document.getElementById("newCommentText").value.trim();
  if (!text) return;
    const avatar = document.getElementById("userAvatar");
    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayName;
    const viewerUsername = avatar.dataset.username;
    const viewerUserPhotoURL = avatar.dataset.photo;

  const comment = {
    text,
    currentPostOwnerId,
    status: "active",
    commenteduId: viewerUserId,
    commenteduPhoto: viewerUserPhotoURL,
    commenteduName: viewerDisplayName || "Anonymous",
    timestamp: serverTimestamp(),
  };



await sendNotification({
  toUid: currentPostOwnerId,
  fromUid: viewerUserId,
  fromDisplayName: viewerDisplayName,
  fromuserAvatar: viewerUserPhotoURL,
  message: `${viewerUsername} left a comment on your <a href="https://rw-501.github.io/contenthub/pages/post.html?p=${currentPostId}">post</a>: "${sanitizeText(text)}"`,
  type: "commented"
});


await updateDoc(doc(db, "users", viewerUserId), {
  commentMade: increment(1)
});

  await addDoc(collection(db, "posts", currentPostId, "comments"), comment);
  openComments(currentPostId); // Reload comments
}
window.addComments = addComments;


function showReplyBox(commentId) {
  document.getElementById(`replyBox-${commentId}`).style.display = "block";
}
window.showReplyBox = showReplyBox;

async function addReply(parentCommentId, commenteruId, currentPostId, currentPostOwnerId) {
    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const replyInput = document.getElementById(`replyText-${parentCommentId}`);
  const replyText = replyInput?.value?.trim();
  if (!replyText) return;

  const avatar = document.getElementById("userAvatar");
  const viewerUserId = avatar.dataset.uid;
  const viewerDisplayName = avatar.dataset.displayName;
  const viewerUsername = avatar.dataset.username;
  const viewerUserPhotoURL = avatar.dataset.photo;

  const reply = {
    text: replyText,
    commenterUid: commenteruId,
    status: "active",
    replyerUid: viewerUserId,
    replyerUserPhoto: viewerUserPhotoURL,
    replyerUname: viewerDisplayName || "Anonymous",
    parentId: parentCommentId,
    timestamp: serverTimestamp(),
  };

  // Save the reply to Firestore
  await addDoc(collection(db, "posts", currentPostId, "comments"), reply);

  // Send a notification to the original commenter
  await sendNotification({
    toUid: commenteruId, // fixed: this should go to the person who got replied to, not the post owner
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerUsername} replied to your comment on the <a href="https://rw-501.github.io/contenthub/contenthub/pages/post.html?p=${currentPostId}">post</a>: "${sanitizeText(replyText)}"`,
    type: "reply"
  });

  // Optional: reload comments section
  openComments(currentPostId);
}
window.addReply = addReply;

function sanitizeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// Load Collabs
async function loadUserCollabs(uid) {
  const list = document.getElementById("collabList");
  const currentUserId = uid;
  list.innerHTML = `<li class="list-group-item text-muted">Loading collaborations...</li>`;

  try {
    const q = query(collection(db, "collaborations"), where("participants", "array-contains", uid));
    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `
        <li class="alert alert-info text-center">
          No collaborations yet.
          <br>
          <a href="https://rw-501.github.io/contenthub/pages/explore.html" class="btn btn-outline-primary btn-sm mt-2">
            🤝 Find creators to collaborate with
          </a>
        </li>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const isPublic = data.isPublic === true;
      const alreadyJoined = data.participants.includes(currentUserId);
      const progress = data.progress || 0;
      const status = data.status || "active";
      const title = data.title || "Untitled Collaboration";

const encodedUser = encodeData(JSON.stringify(data));
const encodedPost = encodeData(JSON.stringify(id));

      const item = document.createElement("li");
      item.className = "list-group-item";

      item.innerHTML = `
        <strong>${title}</strong>
        ${isPublic ? `<span class="badge bg-info ms-2">Public</span>` : ""}
        <div class="small text-muted">Status: ${status}</div>
        <div class="progress my-2" style="height: 16px;">
          <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%;" 
            aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
            ${progress}%
          </div>
        </div>
        ${isPublic && !alreadyJoined && currentUserId !== uid
          ? `<button 
  class="btn btn-sm btn-outline-primary mt-2"
    data-user="${encodedUser}"
    data-post="${encodedPost}"
  onclick="requestToJoin(this)"
>
  Request to Join
</button>`
          : ""
        }
      `;

      list.appendChild(item);
    });
  } catch (error) {
    console.error("[loadUserCollabs] Error:", error);
    list.innerHTML = `<li class="list-group-item text-danger">Failed to load collaborations.</li>`;
  }
}



document.getElementById("collabBtn").addEventListener("click", async (e) => {
  e.preventDefault(); // Stop default behavior

  const currentUser = auth.currentUser;
  if (!currentUser) {
    document.getElementById("auth-login")?.classList.remove("d-none");
    return;
  }

  // Open modal manually if logged in
  const collabModal = new bootstrap.Modal(document.getElementById("collabRequestModal"));
  collabModal.show();
});


async function requestToJoin(btn) {
    const ownerData = JSON.parse(decodeData(btn.dataset.user));
    const collabId = JSON.parse(decodeData(btn.dataset.post));


  console.log("User:", ownerData, "Post:", collabId);


    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
    const avatar = document.getElementById("userAvatar");

    const viewerUserId = avatar.dataset.uid;
    
  if (!viewerUserId) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  try {
  console.log("ownerData", {
      ownerData
    });

const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

    if (requestId == ownerData.owner) return alert("⚠️ You are the owner of this post");

    const requestsRef = collection(db, "collabRequests");

    // Check if request already exists
    const existingSnap = await getDocs(query(
      requestsRef,
      where("toUid", "==", ownerData.owner),
      where("fromUid", "==", collabId),
      where("status", "in", ["pending", "approved"])
    ));

    if (!existingSnap.empty) {
      showModal({
        title: "Already Requested",
        message: "You've already requested to join this collaboration.",
        autoClose: 3000
      });
      return;
    }


  await sendNotification({
    toUid: ownerData.owner,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "collabRequest",
  });
    // Create the request

await addDoc(requestsRef, {
  fromUid: viewerUserId,
  fromDisplayName: viewerDisplayName,
  fromPhotoURL: viewerUserPhotoURL,  // Make sure this is defined

  toUid: ownerData.owner,
  toDisplayName: ownerData.ownerName,
  toUserPhoto: ownerData.ownerPhoto,  // Ensure it's a URL

  message: `${viewerDisplayName} sent you a request to collaborate.`,
  title: `Collaboration Request`,
  description: `${viewerDisplayName} requested to join this collaboration. From: ${postInfo?.title || "Unknown Project"}`,
  
  status: "pending",
  timestamp: serverTimestamp()
});

    
    console.log("[requestToJoin] Request successfully submitted");

    showModal({
      title: "Request Sent",
      message: "Your request to join has been sent.",
      autoClose: 3000
    });

  } catch (error) {
    console.error("[requestToJoin] Error:", error);
    alert("❌ Failed to send join request. Please try again.");
  }
}

window.requestToJoin = requestToJoin;

// Load Analytics
async function loadAnalytics(uid) {
  const list = document.getElementById("analyticsList");
  list.innerHTML = `<div class="alert alert-info text-center">Loading...</div>`;

  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    list.innerHTML = `<div class="alert alert-info text-center">No posts yet.</div>`;
    return;
  }

  const posts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Sort by total engagement (likes + helpful + interested)
  const sorted = posts.sort((a, b) =>
    ((b.likes || 0) + (b.helpful || 0) + (b.interested || 0)) -
    ((a.likes || 0) + (a.helpful || 0) + (a.interested || 0))
  );

  list.innerHTML = ""; // Clear before render

  sorted.slice(0, 5).forEach(post => {
    const { caption = "", likes = 0, helpful = 0, interested = 0 } = post;

    const item = document.createElement("li");
    item.className = "list-group-item d-flex justify-content-between align-items-start";

    const displayCaption = caption.length > 60 ? caption.slice(0, 60) + "…" : caption;

    item.innerHTML = `
      <div class="me-auto">
        <div class="fw-bold">${displayCaption || "Untitled Post"}</div>
        <small class="text-muted">Post ID: ${post.id}</small>
      </div>
      <div class="text-end">
        <span class="badge bg-danger me-1">❤️ ${likes}</span>
        <span class="badge bg-success me-1">🙌 ${helpful}</span>
        <span class="badge bg-info text-dark">⭐ ${interested}</span>
      </div>
    `;

    list.appendChild(item);
  });
}

let lastNameChange = null; // Fetched from Firestore user metadata

async function checkNameChangeEligibility(userData) {
  const nameInput = document.getElementById("editUsername");
  const note = document.getElementById("nameChangeNote");

  // Handle new users with no lastNameChange
  if (!userData.lastNameChange) {
    nameInput.disabled = false;
    note.textContent = "You can update your display name.";
    return;
  }

  // Convert Firestore Timestamp to Date
  lastNameChange = userData.lastNameChange.toDate();
  const now = new Date();
  const diffDays = Math.floor((now - lastNameChange) / (1000 * 60 * 60 * 24));
  const canChange = diffDays >= 90;

  if (canChange) {
    nameInput.disabled = false;
    note.textContent = "You can update your display name.";
  } else {
    nameInput.disabled = true;
    note.innerHTML = `You can change your name again in <strong>${90 - diffDays}</strong> days or <a href="#" onclick="openSupportTicket('name_change')">submit a ticket</a>.`;
  }
}


  // Preview photo
  document.getElementById("editPhoto").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.getElementById("photoPreview");
        img.src = reader.result;
        img.classList.remove("d-none");
      };
      reader.readAsDataURL(file);
    }
  });


  function openSupportTicket(type) {
    // placeholder logic for now
window.location("https://rw-501.github.io/contenthub/pages/support.html");    // You'd actually write this to a Firestore collection like `tickets`
  }

window.openSupportTicket = openSupportTicket;

// Store selected content types
const selectedContentTypes = new Set();

const contentTypeInput = document.getElementById("contentTypeInput");
const contentTypeWrapper = document.getElementById("contentTypeWrapper");

contentTypeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && contentTypeInput.value.trim() !== "") {
    e.preventDefault();
    const value = contentTypeInput.value.trim();
    if (!selectedContentTypes.has(value)) {
      selectedContentTypes.add(value);
      const tag = document.createElement("span");
      tag.className = "badge bg-secondary me-2 mb-1";
      tag.textContent = value;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-close btn-close-white btn-sm ms-2";
      removeBtn.style.fontSize = "0.6rem";
      removeBtn.onclick = () => {
        selectedContentTypes.delete(value);
        contentTypeWrapper.removeChild(tagWrapper);
      };

      const tagWrapper = document.createElement("div");
      tagWrapper.className = "d-flex align-items-center bg-dark text-white rounded px-2 py-1 me-2 mb-1";
      tagWrapper.appendChild(tag);
      tagWrapper.appendChild(removeBtn);

      contentTypeWrapper.insertBefore(tagWrapper, contentTypeInput);
      contentTypeInput.value = "";
    }
  }
});

const selectedNiches = new Set();

  const nicheInput = document.getElementById("nicheInput");
  const nicheTagWrapper = document.getElementById("nicheTagWrapper");


  nicheInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && nicheInput.value.trim() !== "") {
    e.preventDefault();
    const value = nicheInput.value.trim();
    if (!selectedNiches.has(value)) {
      selectedNiches.add(value);
      const tag = document.createElement("span");
      tag.className = "badge bg-secondary me-2 mb-1";
      tag.textContent = value;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-close btn-close-white btn-sm ms-2";
      removeBtn.style.fontSize = "0.6rem";
      removeBtn.onclick = () => {
        selectedNiches.delete(value);
        nicheTagWrapper.removeChild(tagWrapper);
      };

      const tagWrapper = document.createElement("div");
      tagWrapper.className = "d-flex align-items-center bg-dark text-white rounded px-2 py-1 me-2 mb-1";
      tagWrapper.appendChild(tag);
      tagWrapper.appendChild(removeBtn);

      nicheTagWrapper.insertBefore(tagWrapper, nicheInput);
      nicheInput.value = "";
    }
  }
});







  // Save profile changes
  document.getElementById("editProfileForm").addEventListener("submit", async e => {
    e.preventDefault();

    const displayName = document.getElementById("editName").value.trim();
    let username = document.getElementById("editUsername").value.trim();
if (username && !username.startsWith("@")) {
  username = "@" + username;
}
    const bio = document.getElementById("editBio").value.trim();
    const pronouns = document.getElementById("editPronouns").value;
    const availability = document.getElementById("editAvailability").value;

    const countrySelect = document.getElementById("countrySelect");
    const stateSelect = document.getElementById("stateSelect");
    const citySelect = document.getElementById("citySelect");
    const userLocation = {
  country: countrySelect.value,
  state: stateSelect.value,
  city: citySelect.value
};

const contentTypes = Array.from(selectedContentTypes);
const niches = Array.from(selectedNiches);

const rawLinks = [ 
  { platform: "instagram", url: document.getElementById("editLink1").value.trim() },
  { platform: "tiktok", url: document.getElementById("editLink2").value.trim() },
  { platform: "youtube", url: document.getElementById("editLink3").value.trim() },
  { platform: "facebook", url: document.getElementById("editLink4").value.trim() },
  { platform: "twitch", url: document.getElementById("editLink5").value.trim() },
  { platform: "threads", url: document.getElementById("editLink6").value.trim() },
  { platform: "snapchat", url: document.getElementById("editLink7").value.trim() },
  { platform: "pinterest", url: document.getElementById("editLink8").value.trim() },
  { platform: "reddit", url: document.getElementById("editLink9").value.trim() }
].filter(link => link.url !== "");

const links = rawLinks.filter(link => link.url !== "");


    const file = document.getElementById("editPhoto").files[0];

    const userRef = doc(db, "users", currentUser.uid);
    const updates = { bio, contentTypes, niches, links, userLocation, displayName, username, pronouns, availability };

    if (!document.getElementById("editUsername").disabled) {
      updates.username = username;
      updates.lastNameChange = new Date(); // Track the name change
    }

    if (file) {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updates.photoURL = url;
    }

    
    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: currentUser.uid,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "profileUpdate",
  });

// After updating Firestore...
await updateDoc(userRef, updates);

// ⬇️ Fetch the updated user data for reward checks
const snap = await getDoc(userRef);
const newUserData = snap.data();

// Track task-related conditions
newUserData.avatarUploaded = !!updates.photoURL;
newUserData.socialLinksCount = links.length;
newUserData.nicheCount = niches.length;
newUserData.profileUpdated = true;

newUserData.profileComplete = Boolean(
  updates.bio &&
  updates.displayName &&
  updates.username &&
  updates.contentTypes?.length &&
  updates.niches?.length &&
  updates.userLocation?.country
);

// Call reward checker
await checkAndAwardTasks(currentUser.uid, newUserData);


    
const modalEl = document.getElementById("editModal");
const modal = new bootstrap.Modal(modalEl);
modal.hide();


    showModal({
  title: "Success!",
  message: "Profile updated!",
  autoClose: 3000
});

modalEl.style.display = "none";

// Optionally reload user profile UI after 2 seconds
setTimeout(() => {
 // location.reload();
}, 2000);


  });

const socialPlatforms = {
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/",
  facebook: "https://facebook.com/",
  twitch: "https://twitch.tv/",
  threads: "https://threads.net/",
  snapchat: "https://snapchat.com/add/",
  pinterest: "https://pinterest.com/",
  reddit: "https://reddit.com/u/"
};

  const verifyBtn = document.getElementById("verifyProfileBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const linkValidity = {}; // Store validity per platform

 const verifyUrls = false; // ⛔ Set to false to skip link validation check

function updateVerifyBtnState() {
  const allValid = Object.values(linkValidity).every(v => v !== false); // allow true or undefined
  verifyBtn.disabled = !allValid;
  editProfileBtn.disabled = !allValid;
}

Object.keys(socialPlatforms).forEach((platform, index) => {
  const input = document.getElementById(`editLink${index + 1}`);
  if (!input) return;

  const base = socialPlatforms[platform];

  const errorMsg = document.createElement("div");
  errorMsg.className = "text-danger small mt-1 d-none";
  input.insertAdjacentElement("afterend", errorMsg);

  input.addEventListener("change", async () => {
    let value = input.value.trim();
    linkValidity[platform] = undefined;

    if (!value) {
      input.classList.remove("is-invalid");
      errorMsg.classList.add("d-none");
      updateVerifyBtnState();
      return;
    }

    if (!value.startsWith("http")) {
      value = base + value.replace(/^@/, "");
    }

    input.value = value;

    try {
      const url = new URL(value);
      if (!url.hostname.includes(new URL(base).hostname)) {
        throw new Error("Domain mismatch");
      }

      errorMsg.textContent = "Checking link...";
      errorMsg.classList.remove("d-none");
      input.classList.remove("is-invalid");

      if (!verifyUrls) {
        // ✅ Skip fetch check if turned off
        linkValidity[platform] = true;
        errorMsg.classList.add("d-none");
        input.classList.remove("is-invalid");
        updateVerifyBtnState();
        return;
      }

      try {
        const response = await fetch(value, { method: "HEAD", mode: "no-cors" });

        // ⚠️ no-cors doesn't allow checking status, so assume success unless an error is thrown
        linkValidity[platform] = true;
        errorMsg.classList.add("d-none");
        input.classList.remove("is-invalid");

        // Optional: if you want to be extra defensive, you can do a false fallback here
        // if (response && !response.ok) { ... }
      } catch {
        linkValidity[platform] = false;
        errorMsg.textContent = `Unable to verify your ${platform} link. Please check the URL.`;
        errorMsg.classList.remove("d-none");
        input.classList.add("is-invalid");
      }

    } catch (err) {
      linkValidity[platform] = false;
      errorMsg.textContent = `Please enter a valid ${platform} URL`;
      errorMsg.classList.remove("d-none");
      input.classList.add("is-invalid");
    }

    updateVerifyBtnState();
  });
});

updateVerifyBtnState();



    // Request verification
document.getElementById("verifyProfileBtn").addEventListener("click", async () => {
  const rawLinks = [ 
    { platform: "instagram", url: document.getElementById("editLink1").value.trim() },
    { platform: "tiktok", url: document.getElementById("editLink2").value.trim() },
    { platform: "youtube", url: document.getElementById("editLink3").value.trim() },
    { platform: "facebook", url: document.getElementById("editLink4").value.trim() },
    { platform: "twitch", url: document.getElementById("editLink5").value.trim() },
    { platform: "threads", url: document.getElementById("editLink6").value.trim() },
    { platform: "snapchat", url: document.getElementById("editLink7").value.trim() },
    { platform: "pinterest", url: document.getElementById("editLink8").value.trim() },
    { platform: "reddit", url: document.getElementById("editLink9").value.trim() }
  ].filter(link => link.url !== "");

  const verifiedPlatforms = {};

  // ✅ Very basic verification method: check if username appears in the URL
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.data();
const username = userData.username?.toLowerCase().replace(/^@/, "").replace(/\s/g, "");

  rawLinks.forEach(link => {
    const usernameMatch = link.url.toLowerCase().includes(username);
    if (usernameMatch) {
      verifiedPlatforms[link.platform] = true;
    }
  });

  await updateDoc(doc(db, "users", currentUser.uid), {
    links: rawLinks,
    verifiedPlatforms: verifiedPlatforms
  });


      updateVerifyBtnState();

  showModal({
    title: "Verification Requested",
    message: `
      <p class="mb-2">The system attempted automatic verification.</p>
      <p class="text-success">Verified: ${Object.keys(verifiedPlatforms).join(", ") || "None"}.</p>
    `,
    autoClose: 4000
  });

});




  // Load existing data into modal (call this when modal is opened)
  async function populateEditProfileModal() {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.data();

  // Initialize location dropdowns
  const countriesAndStates = {
  "United States": {
    "Alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville"],
    "Alaska": ["Anchorage", "Juneau", "Fairbanks"],
    "Arizona": ["Phoenix", "Tucson", "Mesa", "Scottsdale"],
    "Arkansas": ["Little Rock", "Fayetteville", "Fort Smith", "Springdale"],
    "California": ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Sacramento"],
    "Colorado": ["Denver", "Colorado Springs", "Aurora", "Boulder"],
    "Connecticut": ["Bridgeport", "New Haven", "Hartford", "Stamford"],
    "Delaware": ["Wilmington", "Dover", "Newark"],
    "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville"],
    "Georgia": ["Atlanta", "Savannah", "Augusta", "Columbus"],
    "Hawaii": ["Honolulu", "Hilo", "Kailua"],
    "Idaho": ["Boise", "Idaho Falls", "Meridian"],
    "Illinois": ["Chicago", "Springfield", "Naperville", "Peoria"],
    "Indiana": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend"],
    "Iowa": ["Des Moines", "Cedar Rapids", "Davenport"],
    "Kansas": ["Wichita", "Topeka", "Overland Park"],
    "Kentucky": ["Louisville", "Lexington", "Bowling Green"],
    "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
    "Maine": ["Portland", "Augusta", "Bangor"],
    "Maryland": ["Baltimore", "Annapolis", "Silver Spring"],
    "Massachusetts": ["Boston", "Worcester", "Springfield", "Cambridge"],
    "Michigan": ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"],
    "Minnesota": ["Minneapolis", "Saint Paul", "Duluth"],
    "Mississippi": ["Jackson", "Gulfport", "Hattiesburg"],
    "Missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia"],
    "Montana": ["Billings", "Missoula", "Bozeman"],
    "Nebraska": ["Omaha", "Lincoln", "Bellevue"],
    "Nevada": ["Las Vegas", "Reno", "Henderson", "Carson City"],
    "New Hampshire": ["Manchester", "Nashua", "Concord"],
    "New Jersey": ["Newark", "Jersey City", "Paterson", "Trenton"],
    "New Mexico": ["Albuquerque", "Santa Fe", "Las Cruces"],
    "New York": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"],
    "North Carolina": ["Charlotte", "Raleigh", "Durham", "Greensboro"],
    "North Dakota": ["Fargo", "Bismarck", "Grand Forks"],
    "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo"],
    "Oklahoma": ["Oklahoma City", "Tulsa", "Norman"],
    "Oregon": ["Portland", "Eugene", "Salem", "Beaverton"],
    "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Harrisburg"],
    "Rhode Island": ["Providence", "Warwick", "Cranston"],
    "South Carolina": ["Columbia", "Charleston", "Greenville"],
    "South Dakota": ["Sioux Falls", "Rapid City", "Pierre"],
    "Tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
    "Texas": ["Dallas", "Houston", "Austin", "San Antonio", "Fort Worth"],
    "Utah": ["Salt Lake City", "Provo", "Ogden", "St. George"],
    "Vermont": ["Burlington", "Montpelier", "Rutland"],
    "Virginia": ["Virginia Beach", "Richmond", "Norfolk", "Arlington"],
    "Washington": ["Seattle", "Spokane", "Tacoma", "Bellevue"],
    "West Virginia": ["Charleston", "Huntington", "Morgantown"],
    "Wisconsin": ["Milwaukee", "Madison", "Green Bay", "Kenosha"],
    "Wyoming": ["Cheyenne", "Casper", "Laramie"]
  },
  "Canada": {
    "Ontario": ["Toronto", "Ottawa", "Hamilton", "London"],
    "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau"],
    "British Columbia": ["Vancouver", "Victoria", "Surrey"],
    "Alberta": ["Calgary", "Edmonton", "Red Deer"],
    "Manitoba": ["Winnipeg", "Brandon"],
    "Nova Scotia": ["Halifax", "Sydney"]
  },
  "United Kingdom": {
    "England": ["London", "Manchester", "Birmingham", "Leeds"],
    "Scotland": ["Edinburgh", "Glasgow", "Aberdeen"],
    "Wales": ["Cardiff", "Swansea", "Newport"],
    "Northern Ireland": ["Belfast", "Derry"]
  },
  "Australia": {
    "New South Wales": ["Sydney", "Newcastle", "Wollongong"],
    "Victoria": ["Melbourne", "Geelong", "Ballarat"],
    "Queensland": ["Brisbane", "Gold Coast", "Cairns"],
    "Western Australia": ["Perth", "Fremantle"],
    "South Australia": ["Adelaide", "Mount Gambier"],
    "Tasmania": ["Hobart", "Launceston"]
  },
  "India": {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
    "Delhi": ["New Delhi"],
    "Karnataka": ["Bangalore", "Mysore"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "West Bengal": ["Kolkata", "Howrah"],
    "Gujarat": ["Ahmedabad", "Surat"]
  }
};

const countrySelect = document.getElementById("countrySelect");
const stateSelect = document.getElementById("stateSelect");
const citySelect = document.getElementById("citySelect");
const locationStatus = document.getElementById("locationStatus");


// Populate countries dropdown
Object.keys(countriesAndStates).forEach(country => {
  const option = document.createElement("option");
  option.value = country;
  option.textContent = country;
  countrySelect.appendChild(option);
});

// When country changes, populate states/provinces
countrySelect.addEventListener("change", () => {
  const country = countrySelect.value;
  stateSelect.innerHTML = `<option value="">Select State/Province</option>`;
  citySelect.innerHTML = `<option value="">Select City</option>`;

  if (countriesAndStates[country]) {
    Object.keys(countriesAndStates[country]).forEach(state => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });
  }
});


  



// When state changes, populate cities
stateSelect.addEventListener("change", () => {
  const country = countrySelect.value;
  const state = stateSelect.value;
  citySelect.innerHTML = `<option value="">Select City</option>`;

  if (country && state && countriesAndStates[country] && countriesAndStates[country][state]) {
    countriesAndStates[country][state].forEach(city => {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
  }
});


  



document.getElementById("detectLocationBtn").addEventListener("click", () => {
  locationStatus.textContent = "Detecting location...";
  navigator.geolocation.getCurrentPosition(async position => {
    const { latitude, longitude } = position.coords;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const data = await res.json();

      const city = data.address.city || data.address.town || data.address.village || "";
      const state = data.address.state || "";
      const country = data.address.country || "";

      if (country) {
        countrySelect.value = country;
        countrySelect.dispatchEvent(new Event("change"));

        setTimeout(() => {
          if (state) {
            // Select state if it exists in dropdown
            let foundState = false;
            [...stateSelect.options].forEach(option => {
              if (option.value.toLowerCase() === state.toLowerCase()) {
                stateSelect.value = option.value;
                foundState = true;
              }
            });

            if (!foundState && state !== "") {
              const opt = document.createElement("option");
              opt.value = state;
              opt.textContent = state;
              stateSelect.appendChild(opt);
              stateSelect.value = state;
            }
            stateSelect.dispatchEvent(new Event("change"));

            setTimeout(() => {
              // Select city if in dropdown
              let foundCity = false;
              [...citySelect.options].forEach(option => {
                if (option.value.toLowerCase() === city.toLowerCase()) {
                  citySelect.value = option.value;
                  foundCity = true;
                }
              });

              if (!foundCity && city !== "") {
                const opt = document.createElement("option");
                opt.value = city;
                opt.textContent = city;
                citySelect.appendChild(opt);
                citySelect.value = city;
              }

              locationStatus.textContent = `Detected: ${city}, ${state}, ${country}`;
            }, 200);
          } else {
            locationStatus.textContent = `Detected: ${country}`;
          }
        }, 200);
      } else {
        locationStatus.textContent = "Could not auto-detect location.";
      }
    } catch (err) {
      console.error(err);
      locationStatus.textContent = "Error retrieving location.";
    }
  }, err => {
    console.warn(err);
    locationStatus.textContent = "Location permission denied.";
  });
});


const contentTypeInput = document.getElementById("contentTypeInput");
const nicheInput = document.getElementById("nicheInput");

if (userData.contentTypes && Array.isArray(userData.contentTypes)) {
  userData.contentTypes.forEach(type => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    contentTypeInput.value = type;
    contentTypeInput.dispatchEvent(event);
  });
}else{
  contentTypeInput.value = userData.contentTypes || "";
}

if (userData.niches && Array.isArray(userData.niches)) {
  userData.niches.forEach(type => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    nicheInput.value = type;
    nicheInput.dispatchEvent(event);
  });
}else{
  nicheInput.value = userData.niches || "";
}

  // Fill other profile fields
  document.getElementById("editName").value = userData.displayName || "";
  document.getElementById("editBio").value = userData.bio || "";

  
  document.getElementById("editUsername").value = userData.username || "";
document.getElementById("editPronouns").value = userData.pronouns || "";
document.getElementById("editAvailability").value = userData.availability || "";



const platforms = [
  "instagram", "tiktok", "youtube", "facebook",
  "twitch", "threads", "snapchat", "pinterest", "reddit"
];

const linkIds = [
  "editLink1", "editLink2", "editLink3", "editLink4",
  "editLink5", "editLink6", "editLink7", "editLink8", "editLink9"
];

// ✅ Create a mapping from platform to link
const linkMap = {};
(userData.links || []).forEach(link => {
  linkMap[link.platform] = link.url;
});

// ✅ Populate the inputs
linkIds.forEach((id, i) => {
  const el = document.getElementById(id);
  if (el) el.value = linkMap[platforms[i]] || "";
});



  if (userData.photoURL) {
    const preview = document.getElementById("photoPreview");
    preview.src = userData.photoURL;
    preview.classList.remove("d-none");
  }

  // ✅ Set location if already stored
 if (userData.userLocation) {
  if (userData.userLocation.country) {
    countrySelect.value = userData.userLocation.country;
    countrySelect.dispatchEvent(new Event("change"));
  }

  setTimeout(() => {
    if (userData.userLocation.state) {
      // Add state option if missing
      if (![...stateSelect.options].some(o => o.value === userData.userLocation.state)) {
        const opt = document.createElement("option");
        opt.value = userData.userLocation.state;
        opt.textContent = userData.userLocation.state;
        stateSelect.appendChild(opt);
      }
      stateSelect.value = userData.userLocation.state;
      stateSelect.dispatchEvent(new Event("change"));
    }

    setTimeout(() => {
      if (userData.userLocation.city) {
        // Add city option if missing
        if (![...citySelect.options].some(o => o.value === userData.userLocation.city)) {
          const opt = document.createElement("option");
          opt.value = userData.userLocation.city;
          opt.textContent = userData.userLocation.city;
          citySelect.appendChild(opt);
        }
        citySelect.value = userData.userLocation.city;
      }
    }, 100);
  }, 100);
}


  }

  // Optional: hook into modal show event
const modalEl = document.getElementById("editModal");

modalEl.addEventListener('shown.bs.modal', () => {
  populateEditProfileModal(); // Your function that sets input values
});



function timeSince(timestamp) {
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  // Show full date for anything older than a week
  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
function linkify(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, function (url) {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}

function sanitize(input) {
  const div = document.createElement("div");
  div.textContent = input;
  return div.innerHTML;
}



// HTML (you can place this inside your profile or modal area)
const reviewModalHTML = `
<div class="modal fade" id="reviewModal" tabindex="-1">
  <div class="modal-dialog">
    <div class="modal-content">
      <form id="collabReviewForm">
        <div class="modal-header">
          <h5 class="modal-title">Leave a Collab Review</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <input type="hidden" id="toUserId">
          <div class="mb-2">
            <label>Rating (1-5)</label>
            <input type="number" id="reviewRating" min="1" max="5" class="form-control" required>
          </div>
          <div class="mb-2">
            <label>Type of Collab</label>
            <input type="text" id="collabType" class="form-control" placeholder="e.g. Podcast Guest, Video Edit" required>
          </div>
          <div class="mb-2">
            <label>Review</label>
            <textarea id="reviewText" class="form-control" rows="3" placeholder="Share your experience..." required></textarea>
          </div>
          <div class="mb-2">
            <label>Project Link (optional)</label>
            <input type="url" id="projectLink" class="form-control" placeholder="https://">
          </div>
        </div>
        <div class="modal-footer">
          <button type="submit" class="btn btn-primary">Submit Review</button>
        </div>
      </form>
    </div>
  </div>
</div>`;

document.body.insertAdjacentHTML("beforeend", reviewModalHTML);

// Submit review form
const form = document.getElementById("collabReviewForm");
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const toUserId = document.getElementById("toUserId").value;
  const reviewerId = currentUser.uid;

  // Check for recent review
  const q = query(
    collection(db, `users/${toUserId}/reviews`),
    where("fromUserId", "==", reviewerId),
    orderBy("submittedAt", "desc"),
    limit(1)
  );
  const recentSnap = await getDocs(q);
  if (!recentSnap.empty) {
    const lastReview = recentSnap.docs[0].data();
    const lastDate = lastReview.submittedAt?.toDate?.();
    const now = new Date();
    const days = (now - lastDate) / (1000 * 60 * 60 * 24);

    if (days < 30) {
      alert("You can only leave one review per user every 30 days.");
      return;
    }
  }

  const rating = parseInt(document.getElementById("reviewRating").value);
  const collabType = document.getElementById("collabType").value.trim();
  const reviewText = document.getElementById("reviewText").value.trim();
  const projectLink = document.getElementById("projectLink").value.trim();


    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  const reviewData = {
    fromUserId: currentUser.uid,
    toUserId,
    fromUserDisplayName: viewerDisplayName,
    fromUserPhotoURL: viewerUserPhotoURL,
    rating,
    review: reviewText,
    collabType,
    projectLink,
    submittedAt: Timestamp.now(),
    confirmedByTarget: false,
    approved: false
  };
  await sendNotification({
    toUid: toUserId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "feedback",
  });
  
// Inside your existing event listener for review submission
await addDoc(collection(db, `users/${toUserId}/reviews`), reviewData);

// 🔥 Update feedback count
const userRef = doc(db, "users", currentUser.uid);
await updateDoc(userRef, {
  feedbackCount: increment(1)
});





  bootstrap.Modal.getInstance(document.getElementById("reviewModal")).hide();
});


// Display reviews on profile
async function loadUserReviews(toUserId) {
  const container = document.getElementById("collabReviewsContainer");
  const repScore = document.getElementById("reputationScore");

  container.innerHTML = "";
  repScore.innerHTML = "";

  const q = query(collection(db, `users/${toUserId}/reviews`), where("approved", "==", true));
  const snap = await getDocs(q);


 const ratingText = document.getElementById("userRatingyText");
  ratingText.innerHTML = ""; // Clear old content
  const reviews = snap.docs.map(doc => doc.data());

  
  if (!reviews || !reviews.length) {
    ratingText.innerHTML = `<span class="badge bg-secondary">No ratings yet</span>`;
        container.innerHTML = `
      <div class="alert alert-info text-center">
        No reviews yet. Invite someone you've collaborated with to leave feedback.
      </div>`;
    return;
  }

let totalRatingTop = 0;
let totalRating = 0;

reviews.forEach(r => {
    totalRatingTop += r.rating || 0;
  });

  const avgRatingTop = (totalRatingTop / reviews.length).toFixed(1);

  ratingText.innerHTML = `
    <span class="badge bg-warning text-dark">⭐ ${avgRatingTop} (${reviews.length})</span>
  `;


  snap.forEach(doc => {
    const r = doc.data();
    totalRating += r.rating || 0;


    
container.innerHTML += `
  <div class="border rounded p-3 mb-3">
    <div class="d-flex align-items-center mb-2">
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${r.fromUserId}" class="d-flex align-items-center text-decoration-none">
        <img src="${r.fromUserPhotoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" 
             width="50" height="50" class="rounded-circle me-2" alt="${r.fromUserDisplayName}" />
        <strong>${r.fromUserDisplayName || "Anonymous"}</strong>
      </a>
    </div>

    <div class="fw-bold">⭐ ${r.rating} – ${r.collabType}</div>
    <p>${r.review}</p>
    ${r.projectLink ? `<a href="${r.projectLink}" target="_blank">🔗 Project</a>` : ""}
    <div class="text-muted small">
      Submitted on ${r.submittedAt?.toDate().toLocaleDateString() || "Unknown"}
    </div>
  </div>
`;

  });

  const avgRating = (totalRating / snap.size).toFixed(1);
  repScore.textContent = `⭐ Reputation Score: ${avgRating} / 5`;
}

window.loadUserReviews = loadUserReviews;





// Generate embed HTML based on platform
function getVideoEmbedHTML(videoUrl) {
  if (!videoUrl) return "";
if (videoUrl.includes("firebasestorage.googleapis.com") || videoUrl.match(/\.(mp4|webm|ogg)$/i)) {
  const ext = videoUrl.split('.').pop().toLowerCase();
  let type = "video/mp4";
  if (ext === "webm") type = "video/webm";
  else if (ext === "ogg") type = "video/ogg";

  return `<video width="100%" controls>
            <source src="${videoUrl}" type="${type}">
            Your browser does not support the video tag.
          </video>`;
}
 else if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
    const youtubeEmbed = videoUrl.includes("youtube.com")
      ? videoUrl.replace("watch?v=", "embed/")
      : videoUrl.replace("youtu.be/", "youtube.com/embed/");
    return `<iframe width="100%" height="315" src="${youtubeEmbed}" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("vimeo.com")) {
    const vimeoId = videoUrl.split("/").pop();
    return `<iframe src="https://player.vimeo.com/video/${vimeoId}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("dailymotion.com")) {
    const id = videoUrl.split("/").pop();
    return `<iframe src="https://www.dailymotion.com/embed/video/${id}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("twitch.tv")) {
    const id = videoUrl.split("/").pop();
    return `<iframe src="https://player.twitch.tv/?video=${id}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("facebook.com")) {
    return `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(videoUrl)}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("instagram.com")) {
    const id = videoUrl.split("/p/").pop().split("/")[0];
    return `<iframe src="https://www.instagram.com/p/${id}/embed" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("twitter.com")) {
    return `<iframe src="https://twitframe.com/show?url=${encodeURIComponent(videoUrl)}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  } else if (videoUrl.includes("tiktok.com")) {
    const id = videoUrl.split("/video/").pop();
    return `<iframe src="https://www.tiktok.com/embed/${id}" width="100%" height="315" frameborder="0" allowfullscreen></iframe>`;
  }

  return `<a href="${videoUrl}" target="_blank">${videoUrl}</a>`;
}




let mentionList; 

document.addEventListener("DOMContentLoaded", () => {

  // Open modal
window.openProjectModal = () => {
  document.getElementById("projectHistoryForm").reset();
  document.getElementById("videoPreviewContainer").innerHTML = "";
  new bootstrap.Modal(document.getElementById("projectModal")).show();
};

// Live video preview on URL change
document.getElementById("projectLink").addEventListener("input", () => {
  const url = document.getElementById("projectLink").value;
  const preview = document.getElementById("videoPreviewContainer");
  preview.innerHTML = getVideoEmbedHTML(url);
});


document.getElementById("openReviewModalBtn").addEventListener("click", () => {
  openReviewModal();
});


  const descInput = document.getElementById("projectDescription");
  if (!descInput) return;

  descInput.addEventListener("input", (e) => {


    const cursorPos = descInput.selectionStart;
    const textBeforeCursor = descInput.value.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex !== -1) {
      const query = textBeforeCursor.slice(atIndex + 1);
      if (query.length >= 1) {
        // Calculate caret position for dropdown (basic approximation)
        const rect = descInput.getBoundingClientRect();
        showMentionDropdown(query, { left: rect.left + 10, bottom: rect.bottom + 10 });
        return;
      }
    }
    hideMentionDropdown();
  });


// Submit project form
document.getElementById("projectHistoryForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const title = document.getElementById("projectTitle").value.trim();


const url = document.getElementById("projectUrl").value.trim();

const description = document.getElementById("projectDescription").value.trim();
const projectDate = document.getElementById("projectDate").value;
const taggedUserIds = extractTaggedUserIds(description);

// Save project with taggedUserIds field
await addDoc(collection(db, `users/${currentUser.uid}/projectHistory`), {
  title,
  description,
  url,
  taggedUserIds,
  projectDate,
  createdAt: serverTimestamp()
});
    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: viewerUserId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "updateProjectHistory",
  });

  bootstrap.Modal.getInstance(document.getElementById("projectModal")).hide();
  loadProjectHistory(currentUser.uid);
});
});

// Load and display projects
async function loadProjectHistory(userId) {
  const container = document.getElementById("projectHistoryContainer");
  container.innerHTML = "";

  await loadMentionList(); // ⏳ Ensure mentionList is loaded first

  const q = query(
    collection(db, `users/${userId}/projectHistory`),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    container.innerHTML = `
      <div class="alert alert-info text-center">
        <strong>No projects added yet.</strong><br>
        Invite or encourage them to share project links!
      </div>`;
    return;
  }

  snap.forEach(doc => {
    const p = doc.data();
    const videoEmbed = getVideoEmbedHTML(p.url);
    const taggedHtml = renderTaggedUsers(p.taggedUserIds);

    const card = `
      <div class="card mb-4">
        <div class="card-body">
          <h5 class="card-title">${p.title}</h5>
          <p class="card-text">${p.description}</p>
          <div>${taggedHtml}</div>
          <div class="ratio ratio-16x9">${videoEmbed}</div>
        </div>
      </div>`;
      
    container.insertAdjacentHTML("beforeend", card);
  });
}


window.loadProjectHistory = loadProjectHistory;



  
async function loadMentionList() {
  const usersSnap = await getDocs(collection(db, "users"));
  mentionList = usersSnap.docs.map(doc => {
    const data = doc.data();
    return { uid: doc.id, displayName: data.displayName || "Unknown" };
  });
}
window.loadMentionList = loadMentionList;

function showMentionDropdown(query, caretRect) {
  const dropdown = document.getElementById("mentionsDropdown");
  const matches = mentionList.filter(u => u.displayName.toLowerCase().startsWith(query.toLowerCase()));

  if (!matches.length) return hideMentionDropdown();

  dropdown.innerHTML = matches.map(user =>
    `<button type="button" class="dropdown-item" data-uid="${user.uid}" data-name="${user.displayName}">${user.displayName}</button>`
  ).join("");

  dropdown.style.left = `${caretRect.left}px`;
  dropdown.style.top = `${caretRect.bottom}px`;
  dropdown.style.display = "block";
}

function hideMentionDropdown() {
  document.getElementById("mentionsDropdown").style.display = "none";
}


function extractTaggedUserIds(text) {
  const regex = /@([\w\s]+)/g;  // Matches @username (you can tweak if needed)
  let match;
  let taggedUsers = [];

  while ((match = regex.exec(text)) !== null) {
    const name = match[1].trim().toLowerCase();
    const user = mentionList.find(u => u.displayName.toLowerCase() === name);
    if (user) taggedUsers.push(user.uid);
  }
  return [...new Set(taggedUsers)]; // unique
}


function renderTaggedUsers(taggedUserIds) {
  if (!Array.isArray(taggedUserIds) || !taggedUserIds.length) return "";
  if (!Array.isArray(mentionList) || !mentionList.length) return "";

  return taggedUserIds.map(uid => {
    const user = mentionList.find(u => u.uid === uid);
    if (!user) return "";
    return `<a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${uid}" class="badge bg-primary me-1">@${user.displayName}</a>`;
  }).join("");
}






async function loadPublicBadges(userData) {
  const badgeList = document.getElementById("badgeList");
  if (!badgeList) {
    console.warn("❌ badgeList element not found");
    return;
  }

  badgeList.innerHTML = "";

  try {


    const completed = Array.isArray(userData.rewardsCompleted) ? userData.rewardsCompleted : [];

    const completedMap = {};

    rewardTasks.forEach(task => {
      if (completed.includes(task.id)) {
        const rawDate = userData.badges?.[task.type]?.lastEarned;
        const date = rawDate?.toDate?.();
        if (date) {
          completedMap[task.id] = date;
        }
        //console.log(`📅 Badge for ${task.id}:`, date);
      }
    });

    const completedTasks = rewardTasks.filter(task => completed.includes(task.id));
    console.log("🧩 Matched completed tasks:", completedTasks);

    if (completedTasks.length === 0) {
      badgeList.innerHTML = `<div class="w-100 alert alert-info text-center">No badges have been earned yet.</div>`;
      return;
    }

    completedTasks.forEach(task => {
      const badgeEl = renderBadgeTile(task, true, completedMap);
      badgeList.appendChild(badgeEl);
    });

  } catch (error) {
    console.error("❌ Failed to load public badges:", error);
    badgeList.innerHTML = `<div class="w-100 alert alert-danger text-center">Error loading badges.</div>`;
  }
}


const badgeIcons = { 
  post: "📝",
  feedback: "💬",
  referral: "🔗",
  collab: "🤝",
  dailyLogin: "📅",
  profile: "👤",
  viewsGiven: "🔍",
  viewsReceived: "👁️",
  reaction: "⭐",
  special: "🌟"
};

 function renderBadgeTile(task, isDone, completedMap = {}) {
  const icon = isDone ? "🏅" : "🔓";
  const badgeType = `badge-type-${task.type}`;
  const earnedClass = isDone ? "earned" : "";

  const completedDate = isDone && completedMap[task.id]
    ? `<div class="badge-date text-success small">Earned: ${new Date(completedMap[task.id]).toLocaleDateString()}</div>`
    : "";

  const div = document.createElement("div");
  div.className = `col badge-tile ${badgeType} ${earnedClass} mx-auto`;
  div.setAttribute("data-task-id", task.id);
  div.innerHTML = `
    <div class="badge-icon">${badgeIcons[task.type] || "🎖️"}</div>
    <div class="badge-name">${task.reward.badge}</div>
    <div class="badge-type">${task.type}</div>
    <div class="badge-points small">${task.reward.points} pts</div>
    ${completedDate}
  `;

 

  return div; // return the actual DOM node
}

