// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where, addDoc, 
  arrayUnion, increment, serverTimestamp, 
  startAfter, 
  getDocs,
  orderBy,   // ✅ add this
  limit      // ✅ and this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Your config import (must expose the initialized app)
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
import { sendNotification, NOTIFICATION_TEMPLATES, checkAndAwardTasks} from "https://rw-501.github.io/contenthub/includes/notifications.js";

// Firebase instances
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// UI Elements
const postGrid = document.getElementById("postGrid");
const suggestedCreatorsDiv = document.getElementById("suggestedCreators");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const collabZoneToggle = document.getElementById("collabZoneToggle");

// App State
let lastVisiblePost = null;
let loadingMore = false;
let currentUser = null;
  let q;
 

// Auth check
onAuthStateChanged(auth, user => {
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    loadSuggestedCreators();
    loadPosts();
  }  else {
    currentUser = user;
    loadSuggestedCreators();
    loadPosts();
  }
});



// Load Posts based on filters
async function loadPosts(reset = true) {
  if (loadingMore) return console.warn("[loadPosts] Already loading, aborting...");
  loadingMore = true;
  if (reset) resetPostGrid();

  const collabZone = collabZoneToggle.checked;
  const filter = filterSelect.value;
  const search = searchInput.value.trim().toLowerCase();

  console.log("[loadPosts] collabZone:", collabZone, "| filter:", filter, "| search:", search);

  if (collabZone) {
    await loadCollabPosts();
  } else {
    await loadRegularPosts(filter, search);
  }

  loadingMore = false;
}


function resetPostGrid() {
  postGrid.innerHTML = "";
  lastVisiblePost = null;
}

async function loadCollabPosts() {
  try {
    const q = query(
      collection(db, "collaborations"),
      where("isPublic", "==", true),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    if (snap.empty) return console.log("[loadCollabPosts] No collab posts found.");

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const card = createCollabCard(data, docSnap.id);
      postGrid.appendChild(card);
    });
  } catch (error) {
    console.error("[loadCollabPosts] Error:", error);
  }
}


function createCollabCard(data, collabId) {
  const card = document.createElement("div");
  card.className = "card p-3 mb-3";
  const progress = data.progress || 0;
  const totalTasks = data.totalTasks || 0;

  card.innerHTML = `
    <strong>${data.title || "Untitled Collab"}</strong><br/>
    <small>Requested by <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${data.owner}">Creator</a></small><br/>
    <p>${data.description || ""}</p>
    <div class="progress my-2" style="height: 20px;">
      <div class="progress-bar" role="progressbar" style="width: ${progress}%">${progress}%</div>
    </div>
    <p class="mb-2 text-muted">🧩 Total Tasks: ${totalTasks}</p>
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-outline-primary" onclick="requestToJoin('${collabId}', '${data.owner}')">Request to Join</button>
      <button class="btn btn-sm btn-outline-secondary" onclick="followUser('${data.owner}')">Follow Creator</button>
    </div>
  `;
  return card;
}


async function requestToJoin(collabId, ownerId) {
    console.log("[requestToJoin] collabId:", collabId);
    console.log("[requestToJoin] ownerId:", ownerId);

  try {
    if (!collabId || !ownerId) return alert("⚠️ Please log in to request to join.");

    const requestsRef = collection(db, "collabJoinRequests");
    const existingSnap = await getDocs(query(requestsRef,
      where("userId", "==", ownerId),
      where("collabId", "==", collabId),
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

    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayname;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;
/*
  await sendNotification({
    toUid: ownerId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "collabRequest",
  });

  */
     console.log("??????????????????????????");

/*
    // Create the request
    await addDoc(requestsRef, {
      userId: collabId,
      userPhotoUrl: viewerUserPhotoURL,
      userDisplayName: viewerDisplayName,
      collabId,
      ownerId,
      status: "pending",
      timestamp: serverTimestamp()
    });


    // ✅ Increment collabRequestsSent on user
    const userRef = doc(db, "users", viewerUsername);
    await updateDoc(userRef, {
      collabRequestsSent: increment(1)
    });

    // ✅ Re-check reward task progress
    const updatedSnap = await getDoc(userRef);
    const updatedUser = updatedSnap.data();
    await checkAndAwardTasks(viewerUsername, updatedUser);
    showModal({
      title: "Request Sent",
      message: "Your request to join has been sent.",
      autoClose: 3000
    });
    */
  } catch (error) {
    console.error("[requestToJoin] Error:", error);
    alert("❌ Failed to send join request. Please try again.");
  }
}
window.requestToJoin = requestToJoin;





async function loadRegularPosts(filter, search) {
  let q;
  const postsCol = collection(db, "posts");


switch (filter) {
  case "trending":
    q = query(postsCol, orderBy("likes", "desc"), limit(10));
    break;
  case "new":
    q = query(postsCol, orderBy("createdAt", "desc"), limit(10));
    break;
  case "music":
  case "art":
  case "film":
  case "audio":
    q = query(postsCol, where("tags", "array-contains", filter), orderBy("createdAt", "desc"), limit(10));
    break;
  default:
    // 🔥 Default to newest posts
    q = query(postsCol, orderBy("createdAt", "desc"), limit(10));
}

if (lastVisiblePost) {
  q = query(q, startAfter(lastVisiblePost));
}
  console.log("[loadRegularPosts] q:", q, "| filter:", filter);

const snap = await getDocs(q);

if (!snap.empty) lastVisiblePost = snap.docs[snap.docs.length - 1];

const now = new Date();

for (const docSnap of snap.docs) {
  const post = docSnap.data();

  // ⛔ Skip if scheduled in the future
  if (post.scheduledAt && post.scheduledAt.toDate() > now) continue;

  // ⛔ Skip if should be filtered
  if (shouldSkipPost(post, search)) continue;

  // ✅ Skip if status is removed
  const status = (post.status ?? "").toLowerCase();
  if (status === "removed") continue;

  const card = await createPostCard(post, docSnap.id);
  postGrid.appendChild(card);
}


}





function shouldSkipPost(post, search) {
  const caption = post.caption?.toLowerCase() || "";
  const tags = post.tags?.join(" ") || "";
  return search && !caption.includes(search) && !tags.includes(search);
}






const platformIcons = {
  instagram: "bi bi-instagram",
  tiktok: "bi bi-tiktok",
  youtube: "bi bi-youtube",
  facebook: "bi bi-facebook",
  twitter: "bi bi-twitter",
  linkedin: "bi bi-linkedin",
  twitch: "bi bi-twitch",
  threads: "bi bi-threads",
  snapchat: "bi bi-snapchat",
  pinterest: "bi bi-pinterest",
  reddit: "bi bi-reddit",
  other: "bi bi-link-45deg"
};


async function createPostCard(post, postId) {
  const card = document.createElement("div");
  card.className = "card mb-3";

  const mediaHTML = renderMedia(post.media?.[0]);
  const createdAt = post.createdAt?.toDate?.() || new Date();
  const timeAgo = timeSince(createdAt.getTime());

  const userSnap = await getDoc(doc(db, "users", post.owner));
  const userData = userSnap.exists() ? userSnap.data() : {};

  let typeBadge = "";
  if (post.type === "collab") {
    typeBadge = `<span class="badge bg-primary me-2">🤝 Collab Request</span>`;
  } else if (post.type === "help") {
    typeBadge = `<span class="badge bg-warning text-dark me-2">🆘 Help Wanted</span>`;
  }

  let joinButton = "";
  if (["collab", "help"].includes(post.type)) {
    joinButton = `
      <button class="btn btn-sm btn-outline-primary mt-2" onclick="requestToJoin('${postId}', '${post.owner}')">
        Request to Join
      </button>
    `;
  }

const likeBtnId = `like-btn-${postId}`;
const helpfulBtnId = `helpful-btn-${postId}`;
const interestedBtnId = `interested-btn-${postId}`;
const likeCountId = `like-count-${postId}`;

// Set the card content first (this creates the social-links div)
card.innerHTML = `
  ${mediaHTML}
  <div class="PostCard card-body">
    <div class="d-flex align-items-center mb-2">
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${post.owner}"
         class="fw-bold text-decoration-none">
        <img src="${userData.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
             class="creator-avata rounded-circle me-2"
             width="40" height="40" />
      </a>
      <div >
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${post.owner}"
           class="fw-bold text-decoration-none">
          <p>${userData.displayName || 'Unknown User'}</p>
        </a>
        <p>${userData.availability ? `<i class="bi bi-clock-history"></i> ${userData.availability}` : ""}</p>
        <br/>
        ${typeBadge}
        <div class="mt-1" id="social-links-${postId}"></div>
      </div>
    </div>

    <p class="card-text">${linkify(sanitize(post.caption || ""))}</p>

    <small class="d-block mb-2">
      ${timeAgo} • <span id="${likeCountId}">${post.likes || 0}</span> Likes 
    </small>

    <div class="d-flex gap-2 mb-2">
      <button class="btn btn-sm btn-outline-danger btn-like" id="${likeBtnId}">❤️ Like</button>
      <button class="btn btn-sm btn-outline-success btn-helpful" id="${helpfulBtnId}">🙌 Helpful</button>
      <button class="btn btn-sm btn-outline-info btn-interested" id="${interestedBtnId}">⭐ Interested</button>
    </div>

    <div class="d-flex gap-2 mb-2">
      ${joinButton}
    </div>

    <button class="btn btn-sm btn-outline-primary mb-2"
      data-post-id="${postId}"
      data-post-owner="${post.owner}"
      onclick="openComments('${postId}', '${post.owner}')">
      💬 Comments
    </button>

    ${
      currentUser?.uid === post.owner
        ? `<button class="btn btn-sm btn-outline-danger mb-2 removeBtn" onclick="removePost('${postId}')">🗑️ Remove</button>`
        : ""
    }
  </div>
`;


// Now safely access and populate social links
const socialContainer = document.getElementById(`social-links-${postId}`);
if (socialContainer && Array.isArray(userData.links)) {
  userData.links.forEach(linkObj => {
    const { platform, url } = linkObj;
    const icon = platformIcons[platform?.toLowerCase()] || platformIcons.other;
    const isVerified = userData.verifiedPlatforms?.[platform?.toLowerCase()] === true;

    const a = document.createElement("a");
    a.href = url.trim();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "btn btn-sm btn-outline-secondary me-1";
    a.innerHTML = `
      <i class="${icon}"></i>
      ${isVerified ? '<i class="bi bi-patch-check-fill text-primary ms-1" title="Verified"></i>' : ''}
    `;
    socialContainer.appendChild(a);
  });
}


const likeBtn = card.querySelector(`#${likeBtnId}`);
const likeCountEl = card.querySelector(`#${likeCountId}`);
const helpfulBtn = card.querySelector(`#${helpfulBtnId}`);
const interestedBtn = card.querySelector(`#${interestedBtnId}`);

// ❤️ Like Button
if (likeBtn) {
  likeBtn.addEventListener("click", () => {
    console.log("❤️ Like clicked");
    likeBtn.classList.toggle("active");

    // Animate
    likeBtn.classList.add("animate__animated", "animate__bounce");
    setTimeout(() => likeBtn.classList.remove("animate__animated", "animate__bounce"), 800);

    // Increment like count
    if (likeCountEl) {
      const current = parseInt(likeCountEl.innerText) || 0;
      likeCountEl.innerText = current + 1;
    }

    // Trigger post reaction
    reactToPost(postId, "like", post.owner, post.caption);
  });
}

// 🙌 Helpful Button
if (helpfulBtn) {
  helpfulBtn.addEventListener("click", () => {
    console.log("🙌 Helpful clicked");
    helpfulBtn.classList.toggle("active");

    // Animate
    helpfulBtn.classList.add("animate__animated", "animate__pulse");
    setTimeout(() => helpfulBtn.classList.remove("animate__animated", "animate__pulse"), 800);

    reactToPost(postId, "helpful", post.owner, post.caption);
  });
}

// ⭐ Interested Button
if (interestedBtn) {
  interestedBtn.addEventListener("click", () => {
    console.log("⭐ Interested clicked");
    interestedBtn.classList.toggle("active");

    // Animate
    interestedBtn.classList.add("animate__animated", "animate__tada");
    setTimeout(() => interestedBtn.classList.remove("animate__animated", "animate__tada"), 800);

    reactToPost(postId, "interested", post.owner, post.caption);
  });
}

  return card;
}


async function reactToPost(postId, type, ownerId, caption) {
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const postRef = doc(db, "posts", postId);
  const userRef = doc(db, "users", ownerId);

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
    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayname;
    const viewerUsername = avatar.dataset.username;
    const viewerUserPhotoURL = avatar.dataset.photo;

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








function renderMedia(media) {
  if (!media || !media.url) return "";

  const url = media.url;
  const lowerUrl = url.toLowerCase();

  let mediaHTML = "";

  // YouTube
  if (/youtube\.com|youtu\.be/.test(lowerUrl)) {
    const embedUrl = lowerUrl.includes("watch?v=")
      ? lowerUrl.replace("watch?v=", "embed/")
      : lowerUrl.replace("youtu.be/", "youtube.com/embed/");
    mediaHTML = `<iframe width="100%" height="200" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Vimeo
  else if (/vimeo\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Dailymotion
  else if (/dailymotion\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://www.dailymotion.com/embed/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitch
  else if (/twitch\.tv/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://player.twitch.tv/?video=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Facebook
  else if (/facebook\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    const encodedUrl = encodeURIComponent(`https://www.facebook.com/video.php?v=${id}`);
    mediaHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodedUrl}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Instagram
  else if (/instagram\.com/.test(lowerUrl)) {
    const id = url.split("/p/").pop()?.split("/")[0];
    mediaHTML = `<iframe src="https://www.instagram.com/p/${id}/embed" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitter
  else if (/twitter\.com/.test(lowerUrl)) {
    const encodedUrl = encodeURIComponent(url);
    mediaHTML = `<iframe src="https://twitframe.com/show?url=${encodedUrl}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // TikTok
  else if (/tiktok\.com/.test(lowerUrl)) {
    const id = url.split("/video/").pop()?.split("?")[0];
    mediaHTML = `<iframe src="https://www.tiktok.com/embed/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Firebase Storage or direct video links
  else if (
    url.includes("firebasestorage.googleapis.com") ||
    /\.(mp4|webm|ogg)$/i.test(url)
  ) {
    mediaHTML = `<video src="${url}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
  }

  // Fallback to image
  else {
    mediaHTML = `<img src="${url}" alt="Post media" style="width:100%; max-height:200px; object-fit:cover;" />`;
  }

  return mediaHTML;
}

function sanitize(text) {
  return String(text || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function linkify(text) {
  return text.replace(/(https?:\/\/[\w\.-\/?=&%#]+)/gi, '<a href="$1" target="_blank">$1</a>')
             .replace(/@([\w]+)/g, '<span class="text-primary">@$1</span>')
             .replace(/#([\w]+)/g, '<span class="text-info">#$1</span>');
}

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

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
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

// Infinite scroll handler
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadPosts(false);
  }
});

// Suggested creators
async function loadSuggestedCreators() {
  const usersCol = collection(db, "users");
  const q = query(usersCol, limit(20)); // Grab more for randomness
  const snap = await getDocs(q);
  suggestedCreatorsDiv.innerHTML = "";

  let users = [];
  snap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.uid !== currentUser?.uid) {
      users.push({ id: docSnap.id, ...u });
    }
  });

  // Shuffle array
  users = users.sort(() => 0.5 - Math.random());

  // Take first 5 after shuffle
  users.slice(0, 5).forEach(u => {
    const div = document.createElement("div");
    div.className = "creator-suggest";
    div.innerHTML = `
      <img src="${u.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" alt="avatar" class="creator-avatar" />
      <div>
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.id}">${u.displayName || 'Unknown'}</a><br/>
        <small>${u.niches || ''}</small>
      </div>
      <button class="btn btn-sm btn-outline-primary ms-auto" onclick="followUser('${u.id}')">Follow</button>
    `;
    suggestedCreatorsDiv.appendChild(div);
  });
}


// Follow user
window.followUser = async (uid) => {
  if (!currentUser) return showModal({ title: "Login Required", message: "Please log in to follow users." });

  const userRef = doc(db, "users", currentUser.uid); // Current user
  const targetRef = doc(db, "users", uid); // Profile being viewed

      
    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayname;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: uid,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `@${user} follows you`,
    type: "following"
  });

  await updateDoc(userRef, {
    following: arrayUnion(uid)
  });

  await updateDoc(targetRef, {
    followers: arrayUnion(currentUser.uid)
  });

  showModal({
    title: "Followed!",
    message: "You are now following this creator.",
    autoClose: 3000
  });
};

filterSelect.addEventListener("change", () => loadPosts(true));
searchInput.addEventListener("input", () => loadPosts(true));
collabZoneToggle.addEventListener("change", () => loadPosts(true));


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
    <div class="border-bottom pb-2 mb-2 d-flex position-relative">
    
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${c.commenteduId}">
      <img src="${c.commenteduPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
           alt="${c.commenteduName}"
           class="rounded-circle me-2 flex-shrink-0"
           width="50" height="50" style="object-fit: cover;" />
      <div>
        <strong>${c.commenteduName}:</strong></a>
        <div class="w-100"> ${c.text}             
         ${c.commenteduId === viewerUserId
        ? `<button class="btn btn-sm btn-danger position-absolute end-0 bottom-0 me-2 mb-1 removeBtn"
                   onclick="removeComment('${id}')">Remove</button>`
        : ""}</div>
        <div class="small">${timeAgo(c.timestamp?.toDate?.())}</div>

        <button class="btn btn-sm text-primary p-0 mt-2" onclick="showReplyBox('${id}')">↪️ Reply</button>
        <div id="replyBox-${id}" class="mt-2" style="display: none;">
          <textarea class="form-control" rows="1" placeholder="Write a reply..." id="replyText-${id}"></textarea>
          <button class="btn btn-sm btn-secondary mt-1" onclick="addReply('${id}','${c.commenteduId}','${currentPostId}')">Reply</button>
        </div>
      </div>

    </div>
  `;

  if (c.replies?.length) {
    html += `<div class="ms-4 mt-2">`;
    for (const reply of c.replies) {

const status = (reply.status ?? "").toLowerCase();
if (status === "removed") continue;

html += `
        <div class="border-start ps-2 mb-2 d-flex position-relative">
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${reply.replyerUid}">
          <img src="${reply.replyerUserPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
               alt="${reply.replyerUname}"
               class="rounded-circle me-2 flex-shrink-0"
               width="40" height="40"
               style="object-fit: cover;" />
          <div>
            <strong>${reply.replyerUname}:</strong></a>
             <div class="w-100"> 
             ${reply.text}          
             ${reply.replyerUid === viewerUserId
            ? `<button class="btn btn-sm btn-danger position-absolute end-0 bottom-0 me-2 mb-1 removeBtn"
                       onclick="removeComment('${reply.id}')">Remove</button>`
            : ""}<</div>
            <div class="small">${timeAgo(reply.timestamp?.toDate?.())}</div>
          </div>

        </div>
      `;
    }
   html += `</div>`; // close comment div
}

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
    openComments(currentPostId); // Refresh UI
  } catch (err) {
    console.error("Failed to remove comment:", err);
    alert("Failed to remove the comment. Please try again.");
  }
}
window.removeComment = removeComment;

async function addComments() {
    if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const text = document.getElementById("newCommentText").value.trim();
  if (!text) return;

    const avatar = document.getElementById("userAvatar");
    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayname;
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

function sanitizeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showReplyBox(commentId) {
  document.getElementById(`replyBox-${commentId}`).style.display = "block";
}
window.showReplyBox = showReplyBox;

async function addReply(parentCommentId, commenteruId, currentPostId, currentPostOwnerId) {
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
  const viewerDisplayName = avatar.dataset.displayname;
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
    message: `${viewerUsername} replied to your comment on the <a href="/contenthub/pages/post.html?p=${currentPostId}">post</a>: "${sanitizeText(replyText)}"`,
    type: "reply"
  });

  // Optional: reload comments section
  openComments(currentPostId);
}
window.addReply = addReply;


