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
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");

  } 

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

if (selectedFiles.length === 0) {
  return alert("Please add at least one media file.");
}

const uploadedUrls = [];

for (const file of selectedFiles) {
  const ext = file.type.includes("video") ? 'video' : 'image';
  const storageRef = ref(storage, `posts/${Date.now()}_${file.name}`);
  await uploadBytes(storageRef, file);
  const mediaUrl = await getDownloadURL(storageRef);
  uploadedUrls.push({ url: mediaUrl, type: ext });
}


  const caption = document.getElementById("caption").value.trim();
  const tags = getTagsForDatabase();
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
  media: uploadedUrls, // array of { url, type }
  likes: 0,
  views: 0,
  createdAt: new Date(),
  scheduledAt: schedule ? new Date(schedule) : null
};


  const docRef = await addDoc(collection(db, "posts"), newPost);
  alert("Post created!");
  location.href = `/pages/post.html?id=${docRef.id}`;
});


  const mediaFileInput = document.getElementById("mediaFile");
  const uploadArea = document.getElementById("uploadArea");
  const previewContainer = document.getElementById("mediaPreview");
  let selectedFiles = [];

  function renderPreviews() {
    previewContainer.innerHTML = "";
    selectedFiles.forEach((file, index) => {
      const url = URL.createObjectURL(file);
      const isVideo = file.type.includes("video");
      
      const wrapper = document.createElement("div");
      wrapper.className = "position-relative";

      const media = document.createElement(isVideo ? "video" : "img");
      media.src = url;
      media.className = "rounded border";
      media.style.width = "120px";
      media.style.height = "120px";
      media.style.objectFit = "cover";
      if (isVideo) media.controls = true;

      const removeBtn = document.createElement("button");
      removeBtn.innerHTML = "&times;";
      removeBtn.className = "btn btn-sm btn-danger position-absolute top-0 end-0";
      removeBtn.onclick = () => {
        selectedFiles.splice(index, 1);
        renderPreviews();
      };

      wrapper.appendChild(media);
      wrapper.appendChild(removeBtn);
      previewContainer.appendChild(wrapper);
    });
  }

  mediaFileInput.addEventListener("change", (e) => {
    selectedFiles.push(...Array.from(e.target.files));
    renderPreviews();
  });

  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("border-primary");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("border-primary");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("border-primary");
    if (e.dataTransfer.files.length > 0) {
      selectedFiles.push(...Array.from(e.dataTransfer.files));
      renderPreviews();
    }
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



  const tagInput = document.getElementById("tagsInput");
  const tagContainer = document.getElementById("tagContainer");
  const tagSuggestions = document.getElementById("tagSuggestions");

  // Predefined suggestions for content creators
  const suggestedTags = [
    "vlog", "tutorial", "behindthescenes", "reels", "funny", "music", "review",
    "challenge", "lifestyle", "fashion", "tech", "gaming", "podcast", "shorts",
    "motivation", "fitness", "howto", "interview", "trending", "viral"
  ];

  let tags = [];

  function normalizeTag(tag) {
    return tag
      .replace(/[#\s]/g, '')     // Remove `#` and whitespace
      .toLowerCase();
  }

  function addTag(tag) {
    const cleanTag = normalizeTag(tag);
    if (cleanTag && !tags.includes(cleanTag)) {
      tags.push(cleanTag);

      const badge = document.createElement("span");
      badge.className = "badge bg-primary me-1 mb-1";
      badge.textContent = `#${cleanTag}`;

      const remove = document.createElement("button");
      remove.innerHTML = "&times;";
      remove.className = "btn-close btn-close-white btn-sm ms-2";
      remove.onclick = () => {
        tags = tags.filter(t => t !== cleanTag);
        badge.remove();
      };

      badge.appendChild(remove);
      tagContainer.appendChild(badge);
    }
    tagInput.value = '';
    tagSuggestions.innerHTML = '';
  }

  tagInput.addEventListener("input", () => {
    const inputVal = tagInput.value.toLowerCase().trim();
    tagSuggestions.innerHTML = "";

    if (inputVal.length > 0) {
      const matches = suggestedTags.filter(tag => tag.startsWith(inputVal) && !tags.includes(tag));
      matches.forEach(tag => {
        const item = document.createElement("button");
        item.className = "list-group-item list-group-item-action";
        item.textContent = `#${tag}`;
        item.onclick = () => addTag(tag);
        tagSuggestions.appendChild(item);
      });
    }
  });

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      addTag(tagInput.value);
    }
  });

  // Optional: expose tags to your DB
  function getTagsForDatabase() {
    return tags;
  }