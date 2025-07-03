import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser, viewingUserId;

// Load Profile
onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "/pages/login.html";
  currentUser = user;

  // Check if viewing someone else's profile via URL ?uid=xxxx
  const params = new URLSearchParams(location.search);
  viewingUserId = params.get('uid') || currentUser.uid;

  const userDoc = await getDoc(doc(db, "users", viewingUserId));
  const data = userDoc.data();
  document.getElementById("displayName").innerText = data.displayName || 'Unnamed';
  document.getElementById("bioText").innerText = data.bio || '';
  document.getElementById("niche").innerText = data.niche || '';
  document.getElementById("profilePhoto").src = data.photoURL || '/assets/default-avatar.png';

  const socialContainer = document.getElementById("socialLinks");
  if (data.links) {
    data.links.split(",").forEach(link => {
      const a = document.createElement("a");
      a.href = link.trim();
      a.target = "_blank";
      a.className = "btn btn-sm btn-outline-secondary me-1";
      a.innerText = "🔗";
      socialContainer.appendChild(a);
    });
  }

  if (viewingUserId !== currentUser.uid) {
    document.getElementById("followBtn").style.display = "inline-block";
    // TODO: check if already followed and update text
  }

  loadUserPosts(viewingUserId);
  loadUserCollabs(viewingUserId);
  loadAnalytics(viewingUserId);
});

// Load Posts
async function loadUserPosts(uid) {
  const postGrid = document.getElementById("postsGrid");
  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);
  postGrid.innerHTML = "";
  snapshot.forEach(docSnap => {
    const post = docSnap.data();
    const col = document.createElement("div");
    col.className = "col-sm-6 col-md-4";
    col.innerHTML = post.type === 'video'
      ? `<video src="${post.mediaUrl}" controls></video>`
      : `<img src="${post.mediaUrl}" alt="Post" />`;
    postGrid.appendChild(col);
  });
}

// Load Collabs
async function loadUserCollabs(uid) {
  const list = document.getElementById("collabList");
  const q = query(collection(db, "collabs"), where("participants", "array-contains", uid));
  const snapshot = await getDocs(q);
  list.innerHTML = "";
  snapshot.forEach(docSnap => {
    const item = document.createElement("li");
    item.className = "list-group-item";
    item.innerText = docSnap.data().title || "Untitled Collaboration";
    list.appendChild(item);
  });
}

// Load Analytics
async function loadAnalytics(uid) {
  const list = document.getElementById("analyticsList");
  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => doc.data());
  const sorted = posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  list.innerHTML = "";
  sorted.slice(0, 5).forEach(post => {
    const item = document.createElement("li");
    item.className = "list-group-item";
    item.innerText = `${post.caption || 'Post'} - Likes: ${post.likes || 0}`;
    list.appendChild(item);
  });
}

// Save Profile Changes
document.getElementById("editProfileForm").addEventListener("submit", async e => {
  e.preventDefault();
  const name = document.getElementById("editName").value.trim();
  const bio = document.getElementById("editBio").value.trim();
  const niche = document.getElementById("editNiche").value.trim();
  const links = document.getElementById("editLinks").value.trim();
  const file = document.getElementById("editPhoto").files[0];

  const userRef = doc(db, "users", currentUser.uid);
  let updates = { displayName: name, bio, niche, links };

  if (file) {
    const storageRef = ref(storage, `avatars/${currentUser.uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    updates.photoURL = url;
  }

  await updateDoc(userRef, updates);
  alert("Profile updated!");
  location.reload();
});
