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


export function initPostScript() {
  const targetBtn = document.getElementById("mainPostBtn");
  if (!targetBtn) return; // ✅ Now valid because it's inside a function

  // your main post script logic here
  console.log("✅ mainPostBtn found, running post script...");


// 🚀 Enhanced Post Composer UI + Functionality (Modernized)
const composerHTML = `
  <div id="postComposer" class="p-4 border rounded-4 shadow bg-white mb-4">
    <div class="d-flex align-items-start mb-3">
      <img src="/assets/img/avatar-default.png" alt="avatar" class="rounded-circle me-2" style="width:40px; height:40px; object-fit:cover;">
      <div contenteditable="true" id="caption" class="form-control" style="min-height:100px; border-radius:12px;" placeholder="What are you creating today? Share it with the world... ✨"></div>
    </div>

    <div id="uploadArea" class="border border-2 rounded-3 p-4 text-center bg-light mb-3">
      <p class="text-muted mb-1">📁 Drag & drop or <span class="text-primary text-decoration-underline" style="cursor:pointer;" onclick="document.getElementById('mediaFile').click()">browse</span> to upload media</p>
      <input type="file" id="mediaFile" accept="image/*,video/*" multiple hidden />
      <div id="mediaPreview" class="d-flex flex-wrap gap-2 mt-3"></div>
    </div>

    <input type="text" class="form-control mb-2" id="contributors" placeholder="Tag collaborators using @username or their email..." />

    <button class="btn btn-outline-secondary w-100 mb-2" onclick="document.getElementById('scheduleTime').click()">📅 Schedule Post</button>
    <input type="datetime-local" id="scheduleTime" class="form-control mb-2" hidden />

    <button id="publishPostBtn" class="btn btn-primary w-100">🚀 Publish Post</button>
  </div>
`;

// Insert composer
const wrapper = document.createElement("div");
wrapper.innerHTML = composerHTML;
targetBtn.parentNode.insertBefore(wrapper, targetBtn);

// Media Handling
let selectedFiles = [];
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

document.getElementById("uploadArea").addEventListener("dragover", e => e.preventDefault());
document.getElementById("uploadArea").addEventListener("drop", e => {
  e.preventDefault();
  selectedFiles.push(...Array.from(e.dataTransfer.files));
  renderPreviews();
});

// Publish Handler
const publishBtn = document.getElementById("publishPostBtn");
publishBtn.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return alert("Please sign in.");

  const captionRaw = document.getElementById("caption").innerText.trim();
  const contributorsRaw = document.getElementById("contributors").value;
  const scheduleTime = document.getElementById("scheduleTime").value;

  // Auto detect hashtags from #...
  const tags = [...captionRaw.matchAll(/#(\w+)/g)].map(m => m[1].toLowerCase());

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
    const parts = contributorsRaw.split(/[\s,]+/);
    for (const input of parts) {
      if (input.startsWith("@")) {
        const username = input.slice(1);
        const q = query(collection(db, "users"), where("username", "==", username));
        const snap = await getDocs(q);
        snap.forEach(d => contributors.push(d.id));
      } else if (input.includes("@")) {
        const q = query(collection(db, "users"), where("email", "==", input));
        const snap = await getDocs(q);
        snap.forEach(d => contributors.push(d.id));
      }
    }
  }

  await addDoc(collection(db, "posts"), {
    owner: user.uid,
    caption: captionRaw,
    tags,
    contributors,
    media: uploaded,
    likes: 0,
    views: 0,
    createdAt: new Date(),
    scheduledAt: scheduleTime ? new Date(scheduleTime) : null
  });

  showModal({ title: "Posted!", message: "✅ Post Created!", autoClose: 3000 });
  location.reload();
});

}

// Run the script only after DOM is ready
//initPostScript();
