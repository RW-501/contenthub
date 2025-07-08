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
  getDocs,
  orderBy,   // ✅ add this
  limit      // ✅ and this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Your config import (must expose the initialized app)
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";

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

function loadPostScript() {
    const existing = document.querySelector('script[src="https://rw-501.github.io/contenthub/includes/post.js"]');
    if (existing) return;
  console.log("?post JS ???");

    const script = document.createElement('script');
    script.src = "https://rw-501.github.io/contenthub/includes/post.js";
    script.type = "module";  // 💥 THIS IS REQUIRED
    document.head.appendChild(script);
  }
console.log(" loadPostScript post area");

  // Load it when needed
  loadPostScript();




// Load Posts based on filters
async function loadPosts(reset = true) {
//  console.log("[loadPosts] Started loading posts... reset =", reset);
  if (loadingMore) {
    console.warn("[loadPosts] Already loading, aborting...");
    return;
  }

  loadingMore = true;

  if (reset) {
   // console.log("[loadPosts] Resetting post grid and pagination.");
    postGrid.innerHTML = "";
    lastVisiblePost = null;
  }

  const collabZone = collabZoneToggle.checked;
  const filter = filterSelect.value;
  const search = searchInput.value.trim().toLowerCase();

  console.log("[loadPosts] collabZone:", collabZone);
  console.log("[loadPosts] filter:", filter);
  console.log("[loadPosts] search:", search);

  if (collabZone) {
    try {
      console.log("[loadPosts] Building Firestore query for collaborations...");

      const q = query(
        collection(db, "collaborations"),
        where("isPublic", "==", true),
        orderBy("createdAt", "desc"),
        limit(10)
      );

   //   console.log("[loadPosts] Executing query...");
      const snap = await getDocs(q);
  //    console.log("[loadPosts] Documents fetched:", snap.size);

      if (snap.empty) {
        console.log("[loadPosts] No posts found.");
      }

      snap.forEach(docSnap => {
        const data = docSnap.data();
    //    console.log("[loadPosts] Document data:", data);

        const card = document.createElement("div");
        card.className = "card p-3 mb-3";

        const progress = data.progress || 0;
        const totalTasks = data.totalTasks || 0;

        card.innerHTML = `
          <strong>${data.title || "Untitled Collab"}</strong><br/>
          <small>Requested by <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${data.owner}">Creator</a></small><br/>
          <p>${data.description || ""}</p>
          <div class="progress my-2" style="height: 20px;">
            <div class="progress-bar" role="progressbar" style="width: ${progress}%" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
              ${progress}% Complete
            </div>
          </div>
          <p class="mb-2 text-muted">🧩 Total Tasks: ${totalTasks}</p>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-primary" onclick="requestToJoin('${docSnap.id}', '${data.owner}')">Request to Join</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="followUser('${data.owner}')">Follow Creator</button>
          </div>
        `;

        postGrid.appendChild(card);
      });
    } catch (error) {
      console.error("[loadPosts] Error loading posts:", error);
    }

    loadingMore = false;
    console.log("[loadPosts] Done loading.");
    return;
  }

  async function requestToJoin(collabId, ownerId) {
  try {
    if (!user || !user.uid) {
      alert("⚠️ Please log in to request to join.");
      return;
    }

    console.log("[requestToJoin] userId:", user.uid);
    console.log("[requestToJoin] collabId:", collabId);
    console.log("[requestToJoin] ownerId:", ownerId);

    const requestsRef = collection(db, "collabJoinRequests");

    // Check if request already exists
    const existingSnap = await getDocs(query(
      requestsRef,
      where("userId", "==", user.uid),
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

    // Create the request
    await addDoc(requestsRef, {
      userId: user.uid,
      collabId,
      ownerId,
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
   // console.error("[requestToJoin] Error:", error);
    alert("❌ Failed to send join request. Please try again.");
  }
}

window.requestToJoin = requestToJoin;

  //console.log("[loadPosts] Collab Zone is OFF. Add non-collab zone logic here.");
  loadingMore = false;

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
    const caption = post.caption?.toLowerCase() || "";
    const tags = post.tags?.join(" ") || "";

    if (search && !caption.includes(search.toLowerCase()) && !tags.includes(search.toLowerCase())) continue;

    const card = document.createElement("div");
    card.className = "card mb-3";

    const mediaUrl = post.media?.[0]?.url || "";
    const mediaType = post.media?.[0]?.type || "";
    let mediaHTML = "";

    if (mediaUrl) {
      if (mediaUrl.match(/(youtube\.com|youtu\.be)/i)) {
        const youtubeEmbed = mediaUrl.includes("youtube.com")
          ? mediaUrl.replace("watch?v=", "embed/")
          : mediaUrl.replace("youtu.be/", "youtube.com/embed/");
        mediaHTML = `<iframe width="100%" height="200" src="${youtubeEmbed}" frameborder="0" allowfullscreen></iframe>`;
      } else if (mediaUrl.match(/vimeo\.com/)) {
        const id = mediaUrl.split("/").pop();
        mediaHTML = `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
      } else if (mediaType === "video") {
        mediaHTML = `<video src="${mediaUrl}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
      } else {
        mediaHTML = `<img src="${mediaUrl}" class="card-img-top" alt="Post image" style="max-height:200px; object-fit:cover;">`;
      }
    }

    const createdAt = post.createdAt?.toDate ? post.createdAt.toDate() : new Date();
    const timeAgo = timeSince(createdAt.getTime());

    const user = await getDoc(doc(db, "users", post.owner));
    const userData = user.exists() ? user.data() : {};

    card.innerHTML = `
      ${mediaHTML}
      <div class="card-body">
        <div class="d-flex align-items-center mb-2">
          <img src="${userData.photoURL || 'https://via.placeholder.com/40'}" class="rounded-circle me-2" width="40" height="40" />
          <a href="/pages/profile.html?uid=${post.owner}" class="fw-bold text-decoration-none">${userData.displayName || 'Unknown User'}</a>
        </div>
        <p class="card-text">${linkify(sanitize(post.caption || ""))}</p>
        <small class="text-muted">${timeAgo} • Likes: ${post.likes || 0} • Views: ${post.views || 0}</small><br/>
        <a href="/pages/post.html?id=${docSnap.id}" class="btn btn-sm btn-outline-primary mt-2">View Post</a>
      </div>`;

    postGrid.appendChild(card);
  }

  loadingMore = false;
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
  const q = query(usersCol, limit(5));
  const snap = await getDocs(q);
  suggestedCreatorsDiv.innerHTML = "";

  snap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.uid === currentUser?.uid) return; // skip self
    const div = document.createElement("div");
    div.className = "creator-suggest";
    div.innerHTML = `
      <img src="${u.photoURL || '/assets/default-avatar.png'}" alt="avatar" class="creator-avatar" />
      <div>
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${docSnap.id}">${u.displayName || 'Unknown'}</a><br/>
        <small>${u.niches || ''}</small>
      </div>
      <button class="btn btn-sm btn-outline-primary ms-auto" onclick="followUser('${docSnap.id}')">Follow</button>
    `;
    suggestedCreatorsDiv.appendChild(div);
  });
}

// Follow user
window.followUser = async (uid) => {
  if (!currentUser) return showModal({ title: "Login Required", message: "Please log in to follow users." });

  const userRef = doc(db, "users", currentUser.uid); // Current user
  const targetRef = doc(db, "users", uid); // Profile being viewed

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
