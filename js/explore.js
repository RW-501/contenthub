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
  where,
  arrayUnion, 
  startAfter, 
  getDocs,
  orderBy,   // ✅ add this
  limit      // ✅ and this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Your config import (must expose the initialized app)
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
import { sendNotification, NOTIFICATION_TEMPLATES } from "https://rw-501.github.io/contenthub/includes/notifications.js";

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
    <small>Requested by <a href="/pages/profile.html?uid=${data.owner}">Creator</a></small><br/>
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
  try {
    if (!user || !user.uid) return alert("⚠️ Please log in to request to join.");

    const requestsRef = collection(db, "collabJoinRequests");
    const existingSnap = await getDocs(query(
      requestsRef,
      where("userId", "==", user.uid),
      where("collabId", "==", collabId),
      where("status", "in", ["pending", "approved"])
    ));

    if (!existingSnap.empty) {
      return showModal({
        title: "Already Requested",
        message: "You've already requested to join this collaboration.",
        autoClose: 3000
      });
    }

    const viewer = getViewerData();
    await sendNotification({
      toUid: ownerId,
      fromUid: viewer.uid,
      fromDisplayName: viewer.name,
      fromuserAvatar: viewer.photo,
      message: NOTIFICATION_TEMPLATES.profileView(viewer.name),
      type: "collabRequest",
    });

    await addDoc(requestsRef, {
      userId: viewer.uid,
      userPhotoUrl: viewer.photo,
      userDisplayName: viewer.name,
      collabId,
      ownerId,
      status: "pending",
      timestamp: serverTimestamp()
    });

    showModal({
      title: "Request Sent",
      message: "Your request to join has been sent.",
      autoClose: 3000
    });
  } catch (error) {
    alert("❌ Failed to send join request. Please try again.");
  }
}
window.requestToJoin = requestToJoin;


function getViewerData() {
  const avatar = document.getElementById("userAvatar");
  return {
    uid: avatar.dataset.uid,
    name: avatar.dataset.displayname,
    role: avatar.dataset.role,
    username: avatar.dataset.username,
    photo: avatar.dataset.photo
  };
}


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
      q = query(postsCol, orderBy("createdAt", "desc"), limit(10));
  }

  if (lastVisiblePost) {
    q = query(q, startAfter(lastVisiblePost));
  }

  const snap = await getDocs(q);
  if (!snap.empty) lastVisiblePost = snap.docs[snap.docs.length - 1];

  for (const docSnap of snap.docs) {
    const post = docSnap.data();
    if (shouldSkipPost(post, search)) continue;
    const card = await createPostCard(post, docSnap.id);
    postGrid.appendChild(card);
  }
}




function shouldSkipPost(post, search) {
  const caption = post.caption?.toLowerCase() || "";
  const tags = post.tags?.join(" ") || "";
  return search && !caption.includes(search) && !tags.includes(search);
}

async function createPostCard(post, postId) {
  const card = document.createElement("div");
  card.className = "card mb-3";

  const mediaHTML = renderMedia(post.media?.[0]);
  const createdAt = post.createdAt?.toDate?.() || new Date();
  const timeAgo = timeSince(createdAt.getTime());

  const userSnap = await getDoc(doc(db, "users", post.owner));
  const userData = userSnap.exists() ? userSnap.data() : {};

  card.innerHTML = `
    ${mediaHTML}
    <div class="card-body">
      <div class="d-flex align-items-center mb-2">
        <img src="${userData.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" class="creator-avata rounded-circle me-2" width="40" height="40" />
        <a href="/pages/profile.html?uid=${post.owner}" class="fw-bold text-decoration-none">${userData.displayName || 'Unknown User'}</a>
      </div>
      <p class="card-text">${linkify(sanitize(post.caption || ""))}</p>
      <small class="text-muted d-block mb-2">${timeAgo} • <span id="like-count-${postId}">${post.likes || 0}</span> Likes • ${post.views || 0} Views</small>
      <button class="btn btn-sm btn-outline-danger" id="like-btn-${postId}">❤️ Like</button>
    </div>
  `;

  const likeBtn = card.querySelector(`#like-btn-${postId}`);
  const likeCountEl = card.querySelector(`#like-count-${postId}`);
  likeBtn.addEventListener("click", () => likePost(postId, likeCountEl, post.owner, post.caption));

  return card;
}

async function likePost(postId, likeCountEl, ownerId, caption) {
  const postRef = doc(db, "posts", postId);
  await updateDoc(postRef, { likes: increment(1) });

  const currentLikes = parseInt(likeCountEl.textContent) || 0;
  likeCountEl.textContent = currentLikes + 1;

  const viewer = getViewerData();
  await sendNotification({
    toUid: ownerId,
    fromUid: viewer.uid,
    fromDisplayName: viewer.name,
    fromuserAvatar: viewer.photo,
    message: `@${viewer.username} liked your post: "${caption}"`,
    type: "likePost"
  });
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
