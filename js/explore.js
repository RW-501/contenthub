import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const postGrid = document.getElementById("postGrid");
const suggestedCreatorsDiv = document.getElementById("suggestedCreators");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const collabZoneToggle = document.getElementById("collabZoneToggle");

let lastVisiblePost = null;
let loadingMore = false;

let currentUser = null;

onAuthStateChanged(auth, user => {
  if (!user) location.href = "/pages/login.html";
  currentUser = user;
  loadSuggestedCreators();
  loadPosts();
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
    q = query(collection(db, "collabs"), where("open", "==", true), orderBy("createdAt", "desc"), limit(10));
    const snap = await getDocs(q);
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const card = document.createElement("div");
      card.className = "card p-3 mb-3";
      card.innerHTML = `<strong>${data.title || "Untitled Collab"}</strong><br/>
        <small>Requested by <a href="/pages/profile.html?uid=${data.owner}">Creator</a></small><br/>
        <p>${data.description || ""}</p>`;
      postGrid.appendChild(card);
    });
    loadingMore = false;
    return;
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
        <a href="/pages/profile.html?uid=${docSnap.id}">${u.displayName || 'Unknown'}</a><br/>
        <small>${u.niche || ''}</small>
      </div>
      <button class="btn btn-sm btn-outline-primary ms-auto" onclick="followUser('${docSnap.id}')">Follow</button>
    `;
    suggestedCreatorsDiv.appendChild(div);
  });
}

// Follow user
window.followUser = async (uid) => {
  if (!currentUser) return alert("Login required");
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    following: arrayUnion(uid)
  });
  alert("Followed!");
};

filterSelect.addEventListener("change", () => loadPosts(true));
searchInput.addEventListener("input", () => loadPosts(true));
collabZoneToggle.addEventListener("change", () => loadPosts(true));
