import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, addDoc, collection, query, where, getDocs, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);


let isUploading = false;

const form = document.getElementById("collabRequestForm");

function sanitizeInput(str) {
  if (typeof str !== "string") return "";

  const map = {
    '&': "&amp;",
    '<': "&lt;",
    '>': "&gt;",
    '"': "&quot;",
    "'": "&#39;",
    "`": "&#96;"
  };

  return str.replace(/[&<>"'`]/g, char => map[char]);
}


const mediaInput = document.getElementById("collabMedia");
const fileFeedback = document.getElementById("fileFeedback");

const mediaPreview = document.getElementById("mediaPreview");

const fileTrigger = document.getElementById("customFileTrigger");
const fileNameLabel = document.getElementById("selectedFileName");

fileTrigger.addEventListener("click", () => {
  mediaInput.click();
});

mediaInput.addEventListener("change", () => {
  const file = mediaInput.files[0];
  mediaPreview.innerHTML = "";
  fileFeedback.textContent = "";

  if (file) {
    fileNameLabel.textContent = file.name;

    if (file.size > 15 * 1024 * 1024) {
      fileFeedback.textContent = "File too large (max 15MB)";
      mediaInput.classList.add("is-invalid");
    } else {
      mediaInput.classList.remove("is-invalid");

      const url = URL.createObjectURL(file);
      if (file.type.startsWith("image/")) {
        mediaPreview.innerHTML = `<img src="${url}" alt="Preview" class="img-fluid rounded shadow-sm" style="max-height: 200px;" />`;
      } else if (file.type.startsWith("video/")) {
        mediaPreview.innerHTML = `<video src="${url}" controls class="w-100 rounded shadow-sm" style="max-height: 240px;"></video>`;
      }
    }
  } else {
    fileNameLabel.textContent = "No file chosen";
  }
});




form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (isUploading) {
    return alert("Please wait, file is still uploading...");
  }

  const toUid = collabBtn.dataset.viewingUserId;
  const username = collabBtn.dataset.username;
  const displayName = collabBtn.dataset.displayName;
  const user = auth.currentUser;
  if (!user || !toUid || user.uid === toUid);// return;

  const message = sanitizeInput(document.getElementById("collabMessage").value.trim());
  const title = sanitizeInput(document.getElementById("collabTitle").value.trim());
  const description = sanitizeInput(document.getElementById("collabDesc").value.trim());
  const url = document.getElementById("collabUrl").value.trim();
  const file = mediaInput.files[0];

  if (!message){

      showModal({
    title: "Info",
    message: "Please enter a message or pitch.",
    autoClose: 3000
  });
  return 
};

  // Check for duplicate requests
  const q = query(collection(db, "collabRequests"),
    where("fromUid", "==", user.uid),
    where("toUid", "==", toUid)
  );
  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    const req = docSnap.data();
    if (req.status === "pending") return alert("You already have a pending request.");
    if (req.status === "declined" && req.timestamp?.toDate()) {
      const cooldown = new Date(req.timestamp.toDate());
      cooldown.setDate(cooldown.getDate() + 30);
      if (new Date() < cooldown) return alert("You can resend this request after 30 days.");
    }
  }

  let mediaLink = url || null;
  if (!mediaLink && file) {
    isUploading = true;
    try {
      const safeName = file.name.replace(/\s+/g, '_').replace(/[^\w.-]/g, '');
      const storageRef = ref(storage, `collabPreviews/${user.uid}_${Date.now()}_${safeName}`);
      await uploadBytes(storageRef, file);
      mediaLink = await getDownloadURL(storageRef);
    } catch (err) {
            showModal({
    title: "Info",
    message: "Upload failed. Please try again.",
    autoClose: 3000
  });
      isUploading = false;
      return;
    }
    isUploading = false;
  }

  await addDoc(collection(db, "collabRequests"), {
    fromUid: user.uid,
    toUid,
    username,
    displayName,
    message,
    title,
    description,
    mediaLink,
    status: "pending",
    timestamp: serverTimestamp()
  });

  


  form.reset();
  mediaPreview.innerHTML = "";
  fileFeedback.textContent = "";
  mediaInput.classList.remove("is-invalid");

  const modalEl = document.getElementById("collabRequestModal");
  bootstrap.Modal.getInstance(modalEl)?.hide();

  showModal({
    title: "Sent!",
    message: "Collaboration request sent successfully.",
    autoClose: 3000
  });
});


const titleInput = document.getElementById("collabTitle");

titleInput.addEventListener("focus", () => {
  const cachedTitles = JSON.parse(localStorage.getItem("pastCollabTitles") || "[]");
  if (cachedTitles.length) {
    const list = document.createElement("ul");
    list.className = "list-group position-absolute mt-1 w-100 z-1";
    cachedTitles.forEach(title => {
      const item = document.createElement("li");
      item.className = "list-group-item list-group-item-action";
      item.textContent = title;
      item.onclick = () => {
        titleInput.value = title;
        list.remove();
      };
      list.appendChild(item);
    });
    titleInput.parentElement.appendChild(list);
    titleInput.addEventListener("blur", () => setTimeout(() => list.remove(), 200));
  }
});

  // Hide modal
  document.getElementById("cancelModalBtn").addEventListener("click", () => {
    document.getElementById("collabModalOverlay").style.display = "none";
  });

