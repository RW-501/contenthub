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
  <div id="postComposer" class="border rounded-4 shadow-sm bg-white mb-4 p-3">

    <!-- Profile pic + Post input -->
    <div class="d-flex align-items-start mb-3">
      <img src="https://rw-501.github.io/contenthub/images/defaultAvatar.png"
           width="48" height="48" class="rounded-circle me-3" />

      <div class="flex-grow-1">
        <div contenteditable="true"
             id="caption"
             class="form-control empty"
             data-placeholder="What are you working on? Share an update or request help... ✨"
             style="min-height: 80px; border-radius: 12px;">
        </div>
      </div>
    </div>

    <!-- Toolbar: Post type + Upload -->
    <div class="d-flex flex-wrap align-items-center gap-2 mb-3">

      <select id="postType" class="form-select form-select-sm w-auto">
        <option value="general">📝 General</option>
        <option value="collab">🤝 Collab Request</option>
        <option value="help">🆘 Need Help</option>
      </select>

      <button class="btn btn-outline-secondary btn-sm"
              onclick="document.getElementById('mediaFile').click()">📎 Add Media</button>
      <input type="file" id="mediaFile" accept="image/*,video/*" multiple hidden />
    </div>

    <!-- Project Goal (Conditional) -->
    <div id="goalWrapper" class="mb-3" style="display:none;">
      <input type="text" class="form-control" id="projectGoal"
             placeholder="What skills or roles are you looking for?" />
    </div>

    <!-- Media Preview -->
    <div id="mediaPreview" class="d-flex flex-wrap gap-2 mb-3"></div>

    <!-- Tag Contributors -->
    <input type="text" class="form-control mb-2"
           id="contributors"
           placeholder="Tag collaborators using @username or email..." />

    <!-- Optional Schedule (Hidden for now) -->
    <input type="datetime-local" id="scheduleTime" class="form-control mb-2" hidden />

    <!-- Publish -->
    <button id="publishPostBtn" class="btn btn-primary w-100">🚀 Publish</button>
  </div>
`;

// Insert composer
const wrapper = document.createElement("div");
wrapper.innerHTML = composerHTML;
targetBtn.parentNode.insertBefore(wrapper, targetBtn);

const captionBox = document.getElementById('caption');
captionBox.addEventListener('input', () => {
  captionBox.classList.toggle('empty', captionBox.innerText.trim() === '');
});




  const caption = document.getElementById("caption");

  function updatePlaceholderState() {
    const isEmpty = !caption.textContent.trim();
    caption.classList.toggle("empty", isEmpty);
  }

  caption.addEventListener("input", updatePlaceholderState);
  caption.addEventListener("focus", updatePlaceholderState);
  caption.addEventListener("blur", updatePlaceholderState);

  // Initial check
  updatePlaceholderState()

  const postTypeSelect = document.getElementById("postType");
const projectGoalWrapper = document.getElementById("goalWrapper");

postTypeSelect.addEventListener("change", () => {
  const type = postTypeSelect.value;

  // Update placeholder text dynamically
  const placeholderMap = {
    general: "What are you creating today? Share it with the world... ✨",
    collab: "Looking for collaborators? Describe your project and who you're looking for...",
    help: "Need help on a project? Describe the issue or support you need..."
  };
  caption.setAttribute("data-placeholder", placeholderMap[type]);
  updatePlaceholderState();

  // Show/hide the project goal input
  if (type === "collab" || type === "help") {
    projectGoalWrapper.style.display = "block";
  } else {
    projectGoalWrapper.style.display = "none";
  }
});

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
  const projectGoal = document.getElementById("projectGoal").value.trim();

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
  type: postTypeSelect.value,  // 🔥 new field
  projectGoal: projectGoal || null,
  createdAt: new Date(),
  scheduledAt: scheduleTime ? new Date(scheduleTime) : null
});


  showModal({ title: "Posted!", message: "✅ Post Created!", autoClose: 3000 });
  location.reload();
});

}

// Run the script only after DOM is ready
//initPostScript();
