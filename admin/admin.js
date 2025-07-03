// /js/admin.js
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, updateDoc, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Admin check
onAuthStateChanged(auth, async user => {
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");

  } 
  const userDoc = await getDocs(collection(db, "users"));
  const adminDoc = [...userDoc.docs].find(d => d.id === user.uid);
  if (!adminDoc || !adminDoc.data().admin) {
    alert("Access Denied – Admins Only");
    return window.location.href = "/";
  }

  loadAnalytics();
  loadUsers();
  loadFlaggedPosts();
});

// Load Stats
async function loadAnalytics() {
  const users = await getDocs(collection(db, "users"));
  const posts = await getDocs(collection(db, "posts"));
  const reports = await getDocs(collection(db, "reports"));

  document.getElementById("totalUsers").innerText = users.size;
  document.getElementById("totalPosts").innerText = posts.size;
  document.getElementById("reportCount").innerText = reports.size;
}

// Load All Users
async function loadUsers() {
  const userTable = document.getElementById("userTable");
  const users = await getDocs(collection(db, "users"));
  userTable.innerHTML = "";

  users.forEach(docSnap => {
    const u = docSnap.data();
    const row = `
      <tr>
        <td>${u.email || 'N/A'}</td>
        <td>${u.niche || ''}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="verifyUser('${docSnap.id}')">Verify</button>
          <button class="btn btn-sm btn-danger" onclick="banUser('${docSnap.id}')">Ban</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${docSnap.id}')">Delete</button>
        </td>
      </tr>`;
    userTable.insertAdjacentHTML("beforeend", row);
  });
}

// Load Flagged Content
async function loadFlaggedPosts() {
  const flaggedTable = document.getElementById("flaggedTable");
  const reports = await getDocs(collection(db, "reports"));
  flaggedTable.innerHTML = "";

  reports.forEach(docSnap => {
    const report = docSnap.data();
    const row = `
      <tr>
        <td>${report.postId}</td>
        <td>${report.reason || 'Inappropriate'}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deletePost('${report.postId}', '${docSnap.id}')">Delete Post</button>
        </td>
      </tr>`;
    flaggedTable.insertAdjacentHTML("beforeend", row);
  });
}

// Action Buttons
window.verifyUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { verified: true });
  alert("User verified.");
};

window.banUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { banned: true });
  alert("User banned.");
};

window.deleteUser = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
  alert("User deleted.");
  loadUsers();
};

window.deletePost = async (postId, reportId) => {
  await deleteDoc(doc(db, "posts", postId));
  await deleteDoc(doc(db, "reports", reportId));
  alert("Post deleted.");
  loadFlaggedPosts();
};

// Feature Management
document.getElementById("setFeaturedBtn").addEventListener("click", async () => {
  const uid = document.getElementById("featureCreatorUID").value.trim();
  if (!uid) return alert("Enter UID");
  await updateDoc(doc(db, "users", uid), { featured: true });
  alert("Creator featured!");
});

document.getElementById("assignBadgeBtn").addEventListener("click", async () => {
  const badge = document.getElementById("badgeName").value.trim();
  const uid = document.getElementById("badgeUserUID").value.trim();
  if (!badge || !uid) return alert("Missing fields");
  await setDoc(doc(db, "badges", `${uid}_${badge}`), {
    userId: uid,
    badge,
    assignedAt: new Date()
  });
  alert("Badge assigned!");
});
