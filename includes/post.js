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
  getDocs, updateDoc,
  query,
  where, increment 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';
import { sendNotification, NOTIFICATION_TEMPLATES, checkAndAwardTasks } from "https://rw-501.github.io/contenthub/includes/notifications.js";

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

console.log(" loading POST JS  post area");

export function initPostScript() {
  const targetBtn = document.getElementById("mainPostBtn");
  if (!targetBtn) return;

  console.log("✅ mainPostBtn found, running post script...");

  // Insert composer UI early
  const composerHTML = `
    <div id="postComposer" class="border rounded-4 shadow-sm bg-white mb-4 p-3">
      <div class="d-flex align-items-start mb-3">
<a id="postAvatarHref" href="https://rw-501.github.io/contenthub/pages/profile.html?uid=default" 
   class="fw-bold text-decoration-none d-inline-flex align-items-center">
  <img id="postAvatar" 
       src="https://rw-501.github.io/contenthub/images/defaultAvatar.png"
       width="48" height="48" 
       class="rounded-circle me-3"
       alt="User Avatar" />
</a>

        <div class="flex-grow-1">
<div contenteditable="true"
     id="caption"
     class="form-control empty"
     data-suggested="What are you working on? Share an update or request help... ✨"
     data-placeholder="What are you working on? Share an update or request help... ✨"
     style="min-height: 80px; border-radius: 12px;">
</div>

        </div>
      </div>

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

      <div id="goalWrapper" class="mb-3" style="display:none;">
<input type="text" class="form-control" id="projectGoal"
       placeholder="What skills or roles are you looking for?"
       data-suggested="What skills or roles are you looking for?" />

      </div>

      <div id="mediaPreview" class="d-flex flex-wrap gap-2 mb-3"></div>

      <input type="text" class="form-control mb-2"
             id="contributors"
             placeholder="Tag collaborators using @username or email..." />

      <input type="datetime-local" id="scheduleTime" class="form-control mb-2" hidden />

      <button id="publishPostBtn" class="btn btn-primary w-100">🚀 Publish</button>
    </div>


    <div class="modal fade" id="commentModal" tabindex="-1" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">Comments</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <div id="commentsList"></div>
        <div class="mt-3">
          <textarea class="form-control" id="newCommentText" rows="2" placeholder="Add a comment..."></textarea>
          <button class="btn btn-primary mt-2" onclick="addComments()">Post Comment</button>
        </div>
      </div>
    </div>
  </div>
</div>

  `;

  const wrapper = document.createElement("div");
  wrapper.innerHTML = composerHTML;
  targetBtn.parentNode.insertBefore(wrapper, targetBtn);

  const caption = document.getElementById("caption");
  const postTypeSelect = document.getElementById("postType");
  const projectGoalWrapper = document.getElementById("goalWrapper");
  const captionBox = document.getElementById("caption");

  function updatePlaceholderState() {
    const isEmpty = !caption.textContent.trim();
    caption.classList.toggle("empty", isEmpty);
  }

  caption.addEventListener("input", updatePlaceholderState);
  caption.addEventListener("focus", updatePlaceholderState);
  caption.addEventListener("blur", updatePlaceholderState);
  updatePlaceholderState();

  let placeholderMap = {};
  let name = "creator";

  // Delay to allow DOM + avatar data to load
  setTimeout(() => {
    const avatar = document.getElementById("userAvatar");
    if (!avatar) {
      console.warn("⚠️ Avatar element not found.");
      return;
    }

    const viewerDisplayName = avatar.dataset.displayname || avatar.dataset.username || "creator";
    name = viewerDisplayName.includes("@")
      ? viewerDisplayName.split("@")[0]
      : viewerDisplayName.split(" ")[0];

const viewerUserPhotoURL = avatar.dataset.photo;
const userID = avatar.dataset.uid;

const postAvatar = document.getElementById("postAvatar");
const postAvatarHref = document.getElementById("postAvatarHref");

if (postAvatar && viewerUserPhotoURL) {
  postAvatar.src = viewerUserPhotoURL;
}
if (postAvatarHref && userID) {
  postAvatarHref.href = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${userID}`;
}


    // Update placeholderMap dynamically using first name
    placeholderMap = {
      general: `What's on your mind, ${name}? ✨`,
      collab: `Hey ${name}, describe your project and who you're looking for... 🤝`,
      help: `Need help, ${name}? Explain your issue or what kind of support you need. 🆘`
    };

    // Set initial placeholder
    const type = postTypeSelect.value || "general";
caption.dataset.suggested = placeholderMap[type];
caption.setAttribute("data-placeholder", placeholderMap[type]);
    updatePlaceholderState();
  }, 1000);

  // Handle post type change
  postTypeSelect.addEventListener("change", () => {
    const type = postTypeSelect.value;

    if (placeholderMap[type]) {
caption.dataset.suggested = placeholderMap[type];
caption.setAttribute("data-placeholder", placeholderMap[type]);
      updatePlaceholderState();
    }

    projectGoalWrapper.style.display = (type === "collab" || type === "help") ? "block" : "none";
    const goalInput = document.getElementById("projectGoal");
if ((type === "collab" || type === "help") && goalInput.value.trim() === "") {
  goalInput.value = goalInput.dataset.suggested;
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
const avatar = document.getElementById("userAvatar");

const ownerDisplayName = avatar.dataset.displayname || "creator";
const ownerPhotoURL = avatar.dataset.photo;

await addDoc(collection(db, "posts"), {
  owner: user.uid,
  ownerDisplayName,
  ownerPhotoURL,
  caption: captionRaw,
  tags,
  contributors,
  media: uploaded,
  likes: 0,
  helpful: 0,
  interested: 0,
  views: 0,
  status: "active",
  type: postTypeSelect.value,  // 🔥 new field
  projectGoal: projectGoal || null,
  createdAt: new Date(),
  scheduledAt: scheduleTime ? new Date(scheduleTime) : null
});

  // 🔥 Increment post count (assume you're tracking it on user doc)
  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, {
    postCount: increment(1),
    lastPostDate: new Date()
  });

  // ✅ Fetch updated user and check for any post-related rewards
  const snap = await getDoc(userRef);
  const userData = snap.data();
  await checkAndAwardTasks(user.uid, { ...userData, postCount: (userData.postCount || 0) + 1 });

  showModal({ title: "Posted!", message: "✅ Post Created!", autoClose: 3000 });
  location.reload();
});

}




function animateTheElement(el, animation = null, duration = 800) {
  if (!el) return;

  const animations = [
    "bounce", "tada", "rubberBand", "pulse", "shakeX",
    "heartBeat", "jello", "swing", "flip", "zoomIn",
    "fadeIn", "lightSpeedInRight", "backInUp"
  ];

  const chosen = animation || animations[Math.floor(Math.random() * animations.length)];

  el.classList.add("animate__animated", `animate__${chosen}`);
  setTimeout(() => {
    el.classList.remove("animate__animated", `animate__${chosen}`);
  }, duration);
}
window.animateTheElement = animateTheElement;