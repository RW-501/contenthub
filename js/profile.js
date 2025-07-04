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
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");

  } 
  
  currentUser = user;

  // Check if viewing someone else's profile via URL ?uid=xxxx
  const params = new URLSearchParams(location.search);
  viewingUserId = params.get('uid') || currentUser.uid;

  const userDoc = await getDoc(doc(db, "users", viewingUserId));
  const data = userDoc.data();
  document.getElementById("displayName").innerText = data.displayName || 'Unnamed';

      // Set collab button
    const collabBtn = document.getElementById("collabBtn");
    collabBtn.classList.remove("d-none");
    collabBtn.onclick = () => setCollabTarget(viewingUserId);
  

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

  let lastNameChange = null; // fetched from Firestore user metadata

  // Check display name change eligibility
  async function checkNameChangeEligibility(userData) {
    lastNameChange = userData.lastNameChange?.toDate?.() || new Date(0);
    const now = new Date();
    const diffDays = Math.floor((now - lastNameChange) / (1000 * 60 * 60 * 24));

    const canChange = diffDays >= 90;
    const nameInput = document.getElementById("editName");
    const note = document.getElementById("nameChangeNote");

    if (canChange) {
      nameInput.disabled = false;
      note.textContent = "You can update your display name.";
    } else {
      nameInput.disabled = true;
      note.innerHTML = `You can change your name again in <strong>${90 - diffDays}</strong> days or <a href="#" onclick="openSupportTicket('name_change')">submit a ticket</a>.`;
    }
  }

  // Preview photo
  document.getElementById("editPhoto").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.getElementById("photoPreview");
        img.src = reader.result;
        img.classList.remove("d-none");
      };
      reader.readAsDataURL(file);
    }
  });

  // Request verification
  document.getElementById("verifyProfileBtn").addEventListener("click", () => {
    // 🔧 This function should submit a "verification" ticket in Firestore
    openSupportTicket("verify_profile");
  });

  function openSupportTicket(type) {
    // placeholder logic for now
    alert(`Ticket for "${type.replace('_', ' ')}" submitted. We'll review your request.`);
    // You'd actually write this to a Firestore collection like `tickets`
  }

  // Save profile changes
  document.getElementById("editProfileForm").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("editName").value.trim();
    const bio = document.getElementById("editBio").value.trim();
    const niche = document.getElementById("editNiche").value.trim();
    const links = [
      document.getElementById("editLink1").value.trim(),
      document.getElementById("editLink2").value.trim(),
      document.getElementById("editLink3").value.trim(),
    ].filter(link => link !== "");

    const file = document.getElementById("editPhoto").files[0];
    const userRef = doc(db, "users", currentUser.uid);
    const updates = { bio, niche, links };

    if (!document.getElementById("editName").disabled) {
      updates.displayName = name;
      updates.lastNameChange = new Date(); // Track the name change
    }

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

  // Load existing data into modal (call this when modal is opened)
  async function populateEditProfileModal() {
    const userSnap = await getDoc(doc(db, "users", currentUser.uid));
    const userData = userSnap.data();

    document.getElementById("editName").value = userData.displayName || "";
    document.getElementById("editBio").value = userData.bio || "";
    document.getElementById("editNiche").value = userData.niche || "";
    const [link1, link2, link3] = userData.links || [];
    document.getElementById("editLink1").value = link1 || "";
    document.getElementById("editLink2").value = link2 || "";
    document.getElementById("editLink3").value = link3 || "";

    if (userData.photoURL) {
      const preview = document.getElementById("photoPreview");
      preview.src = userData.photoURL;
      preview.classList.remove("d-none");
    }

    checkNameChangeEligibility(userData);
  }

  // Optional: hook into modal show event
  document.getElementById("editModal").addEventListener("shown.bs.modal", populateEditProfileModal);
