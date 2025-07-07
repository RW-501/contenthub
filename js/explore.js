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
  if (loadingMore) return;
  loadingMore = true;

  if (reset) {
    postGrid.innerHTML = "";
    lastVisiblePost = null;
  }

  let q;
  const collabZone = collabZoneToggle.checked;
  const filter = filterSelect.value;
  const search = searchInput.value.trim().toLowerCase();

  if (collabZone) {

  // Show open collaboration requests
  const q = query(
    collection(db, "collaborations"),
    where("open", "==", true),
    orderBy("createdAt", "desc"),
    limit(10)
  );

  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    const data = docSnap.data();

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

  loadingMore = false;
  return;
}

async function requestToJoin(collabId, ownerId) {
  const confirmJoin = confirm("Send a request to join this project?");
  if (!confirmJoin) return;

  await addDoc(collection(db, "collabJoinRequests"), {
    userId: user.uid,
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
}

async function followUser(targetUid) {
  if (!user || !targetUid || user.uid === targetUid) return;

  const followRef = doc(db, "users", user.uid);
  const userDoc = await getDoc(followRef);
  const currentFollows = userDoc.data()?.following || [];

  if (!currentFollows.includes(targetUid)) {
    await updateDoc(followRef, {
      following: arrayUnion(targetUid)
    });

    showModal({
      title: "Followed",
      message: "You are now following this user.",
      autoClose: 3000
    });
  } else {
    showModal({
      title: "Already Following",
      message: "You're already following this user.",
      autoClose: 3000
    });
  }
}


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

  snap.forEach(docSnap => {
    const post = docSnap.data();
    if (search) {
      // Search filtering by caption, tags, or creator displayName
      const caption = post.caption?.toLowerCase() || "";
      const tags = post.tags?.join(" ") || "";
      // Skip posts that don't match search
      if (!caption.includes(search) && !tags.includes(search)) return;
    }
    const card = document.createElement("div");
    card.className = "card";

    if (post.type === "video") {
      card.innerHTML = `<video src="${post.mediaUrl}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
    } else {
      card.innerHTML = `<img src="${post.mediaUrl}" alt="Post image" />`;
    }
    card.innerHTML += `
      <div class="card-body">
        <p class="card-text">${post.caption || ""}</p>
        <small>Likes: ${post.likes || 0} • Views: ${post.views || 0}</small><br/>
        <a href="/pages/post.html?id=${docSnap.id}" class="btn btn-sm btn-primary mt-2">View Post</a>
      </div>`;
    postGrid.appendChild(card);
  });

  loadingMore = false;
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
