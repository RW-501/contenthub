// ✅ Reusable Post Composer Module
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log(" loading POST JS  post area");


const targetBtn = document.getElementById("mainPostBtn");
if (!targetBtn) return;

const composerHTML = `
  <div id="postComposer" class="p-3 border rounded mb-4">
    <div id="uploadArea" class="border border-2 rounded p-4 text-center bg-light mb-3">
      <p class="text-muted">📁 Drag & drop or <span class="text-primary" style="cursor:pointer;" onclick="document.getElementById('mediaFile').click()">browse</span></p>
      <input type="file" id="mediaFile" accept="image/*,video/*" multiple hidden />
      <div id="mediaPreview" class="d-flex flex-wrap gap-2 mt-3"></div>
    </div>

    <div id="caption" contenteditable="true" class="form-control mb-2" placeholder="Write a caption..." style="min-height: 100px;"></div>
    <input type="text" class="form-control mb-2" id="tagsInput" placeholder="Enter tags..." />
    <div id="tagContainer" class="mb-2"></div>
    <div id="tagSuggestions" class="list-group"></div>

    <input type="text" class="form-control mb-2" id="contributors" placeholder="Tag collaborators by email" />
    <button class="btn btn-outline-secondary w-100 mb-2" onclick="document.getElementById('scheduleTime').click()">📅 Schedule Post</button>
    <input type="datetime-local" id="scheduleTime" class="form-control mb-2" hidden />

    <button id="publishPostBtn" class="btn btn-primary w-100">🚀 Publish Post</button>
  </div>
`;

// Insert composer before the button
const wrapper = document.createElement("div");
wrapper.innerHTML = composerHTML;
targetBtn.parentNode.insertBefore(wrapper, targetBtn);
console.log(" loaded post area");

let selectedFiles = [], tags = [], mentionList = [];

const previewContainer = document.getElementById("mediaPreview");
const mediaInput = document.getElementById("mediaFile");

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

mediaInput.addEventListener("change", e => {
  selectedFiles.push(...Array.from(e.target.files));
  renderPreviews();
});

document.getElementById("uploadArea").addEventListener("dragover", e => {
  e.preventDefault();
});
document.getElementById("uploadArea").addEventListener("drop", e => {
  e.preventDefault();
  selectedFiles.push(...Array.from(e.dataTransfer.files));
  renderPreviews();
});

const tagInput = document.getElementById("tagsInput");
const tagContainer = document.getElementById("tagContainer");
const tagSuggestions = document.getElementById("tagSuggestions");
const suggestedTags = ["vlog", "music", "funny", "tutorial", "podcast"];

function addTag(tag) {
  const clean = tag.replace(/[#\s]/g, '').toLowerCase();
  if (!clean || tags.includes(clean)) return;
  tags.push(clean);

  const badge = document.createElement("span");
  badge.className = "badge bg-primary me-1 mb-1";
  badge.textContent = `#${clean}`;
  tagContainer.appendChild(badge);
}

tagInput.addEventListener("input", () => {
  const val = tagInput.value.trim().toLowerCase();
  tagSuggestions.innerHTML = "";
  suggestedTags.filter(t => t.startsWith(val)).forEach(tag => {
    const btn = document.createElement("button");
    btn.className = "list-group-item list-group-item-action";
    btn.textContent = `#${tag}`;
    btn.onclick = () => addTag(tag);
    tagSuggestions.appendChild(btn);
  });
});

tagInput.addEventListener("keydown", e => {
  if (["Enter", ",", " "].includes(e.key)) {
    e.preventDefault();
    addTag(tagInput.value);
    tagInput.value = "";
  }
});

// Publish Handler
const publishBtn = document.getElementById("publishPostBtn");
publishBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please sign in.");

  const caption = document.getElementById("caption").innerText.trim();
  const contributorsRaw = document.getElementById("contributors").value;
  const scheduleTime = document.getElementById("scheduleTime").value;

  const uploaded = [];
  for (const file of selectedFiles) {
    const ext = file.type.includes("video") ? 'video' : 'image';
    const refPath = ref(storage, `posts/${Date.now()}_${file.name}`);
    await uploadBytes(refPath, file);
    const url = await getDownloadURL(refPath);
    uploaded.push({ url, type: ext });
  }

  let contributors = [];
  if (contributorsRaw) {
    const emails = contributorsRaw.split(",").map(e => e.trim());
    for (const email of emails) {
      const q = query(collection(db, "users"), where("email", "==", email));
      const snap = await getDocs(q);
      snap.forEach(d => contributors.push(d.id));
    }
  }

  await addDoc(collection(db, "posts"), {
    owner: user.uid,
    caption,
    tags,
    contributors,
    media: uploaded,
    likes: 0,
    views: 0,
    createdAt: new Date(),
    scheduledAt: scheduleTime ? new Date(scheduleTime) : null
  });

  showModal({
  title: "Posted!",
  message: "✅ Post Created!",
  autoClose: 3000
});

  location.reload();
});
