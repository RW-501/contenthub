import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, addDoc, doc, getDoc, updateDoc, increment,
  query, where, getDocs, arrayUnion
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const createSection = document.getElementById("createSection");
const viewSection = document.getElementById("viewSection");
const postId = new URLSearchParams(location.search).get("id");

let currentUser;

onAuthStateChanged(auth, async user => {
  if (!user) return location.href = "/pages/login.html";
  currentUser = user;

  if (postId) {
    createSection.classList.add("d-none");
    viewSection.classList.remove("d-none");
    await loadPost(postId);
  }
});

// 🔽 POST CREATION
document.getElementById("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const file = document.getElementById("mediaFile").files[0];
  const caption = document.getElementById("caption").value.trim();
  const tags = document.getElementById("tags").value.split(",").map(t => t.trim().toLowerCase());
  const schedule = document.getElementById("scheduleTime").value;
  const contributorsInput = document.getElementById("contributors").value;

  const ext = file.type.includes("video") ? 'video' : 'image';
  const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const mediaUrl = await getDownloadURL(storageRef);

  let contributors = [];
  if (contributorsInput) {
    const emails = contributorsInput.split(",").map(e => e.trim());
    for (const email of emails) {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      snap.forEach(doc => contributors.push(doc.id));
    }
  }

  const newPost = {
    owner: currentUser.uid,
    caption,
    tags,
    contributors,
    mediaUrl,
    type: ext,
    likes: 0,
    views: 0,
    createdAt: new Date(),
    scheduledAt: schedule ? new Date(schedule) : null
  };

  const docRef = await addDoc(collection(db, "posts"), newPost);
  alert("Post created!");
  location.href = `/pages/post.html?id=${docRef.id}`;
});

// 🔼 POST VIEWER
async function loadPost(id) {
  const docSnap = await getDoc(doc(db, "posts", id));
  if (!docSnap.exists()) return alert("Post not found");

  const data = docSnap.data();

  // Media
  if (data.type === 'video') {
    viewVideo.src = data.mediaUrl;
    viewVideo.classList.remove("d-none");
  } else {
    viewImage.src = data.mediaUrl;
    viewImage.classList.remove("d-none");
  }

  // Text + Tags
  viewCaption.innerText = data.caption;
  likeCount.innerText = data.likes || 0;
  viewCount.innerText = data.views || 0;
  viewTags.innerHTML = data.tags.map(t => `<span class="tag">#${t}</span>`).join(" ");

  // Contributors
  if (data.contributors?.length) {
    const list = document.getElementById("contribList");
    for (const uid of data.contributors) {
      const userDoc = await getDoc(doc(db, "users", uid));
      const a = document.createElement("a");
      a.href = `/pages/profile.html?uid=${uid}`;
      a.className = "contributor-link";
      a.innerText = userDoc.data()?.displayName || "User";
      list.appendChild(a);
    }
  }

  // Auto-increment views
  await updateDoc(doc(db, "posts", id), { views: increment(1) });
}

// ❤️ LIKE
likeBtn?.addEventListener("click", async () => {
  await updateDoc(doc(db, "posts", postId), { likes: increment(1) });
  likeCount.innerText = parseInt(likeCount.innerText) + 1;
});

// 💬 COMMENT
commentBtn?.addEventListener("click", async () => {
  const text = commentInput.value.trim();
  if (!text) return;
  const comment = {
    uid: currentUser.uid,
    text,
    createdAt: new Date()
  };
  await addDoc(collection(db, "posts", postId, "comments"), comment);
  commentInput.value = "";
  renderComment(comment);
});

async function loadComments() {
  const q = await getDocs(collection(db, "posts", postId, "comments"));
  q.forEach(doc => renderComment(doc.data()));
}
function renderComment(c) {
  const div = document.createElement("div");
  div.className = "comment";
  div.innerText = c.text;
  commentList.appendChild(div);
}
if (postId) loadComments();

// 🔗 SHARE
window.copyLink = () => {
  const link = location.href;
  navigator.clipboard.writeText(link);
  alert("Link copied!");
};
