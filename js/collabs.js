import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app, auth }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';


const incomingList = document.getElementById("incomingList");
const sentList = document.getElementById("sentList");
const activeList = document.getElementById("activeList");
const archivedList = document.getElementById("archivedList");

onAuthStateChanged(auth, user => {
  if (user) loadDashboard(user.uid);
});

async function loadDashboard(uid) {
  await Promise.all([
    loadIncoming(uid),
    loadSent(uid),
    loadActive(uid),
    loadArchived(uid)
  ]);
}

async function loadIncoming(uid) {
  const q = query(collection(db, "collabRequests"), where("toUid", "==", uid), where("status", "==", "pending"));
  const snap = await getDocs(q);
  incomingList.innerHTML = "";
  snap.forEach(docSnap => {
    const data = docSnap.data();
    incomingList.innerHTML += renderRequest(docSnap.id, data, true);
  });
}

async function loadSent(uid) {
  const q = query(collection(db, "collabRequests"), where("fromUid", "==", uid));
  const snap = await getDocs(q);
  sentList.innerHTML = "";
  snap.forEach(docSnap => {
    const data = docSnap.data();
    sentList.innerHTML += renderRequest(docSnap.id, data, false);
  });
}

async function loadActive(uid) {
  const q = query(collection(db, "collaborations"), where("participants", "array-contains", uid));
  const snap = await getDocs(q);
  activeList.innerHTML = "";
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (!data.archived) activeList.innerHTML += renderCollab(docSnap.id, data);
  });
}

async function loadArchived(uid) {
  const q = query(collection(db, "collaborations"), where("participants", "array-contains", uid));
  const snap = await getDocs(q);
  archivedList.innerHTML = "";
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.archived) archivedList.innerHTML += renderCollab(docSnap.id, data);
  });
}

function renderRequest(id, data, incoming) {
  return `
    <div class="list-group-item">
      <div class="d-flex justify-content-between">
        <div>
          <strong>${data.title || "Untitled Project"}</strong>
          <p class="mb-1">${data.message}</p>
          <small class="text-muted">${incoming ? "From" : "To"}: ${incoming ? data.fromUid : data.toUid}</small>
        </div>
        <div class="text-end">
          ${incoming ? `
            <button class="btn btn-sm btn-success" onclick="respondToRequest('${id}', 'accepted')">Accept</button>
            <button class="btn btn-sm btn-danger" onclick="respondToRequest('${id}', 'declined')">Decline</button>`
          : data.status === "pending" ? `<span class="badge bg-warning">Pending</span>` : `<span class="badge bg-danger">Declined</span>`}
        </div>
      </div>
    </div>`;
}

function renderCollab(id, data) {
  return `
    <div class="list-group-item collab-item" onclick="window.location.href='/collabs/view.html?id=${id}'">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${data.title || "Untitled Project"}</strong>
          <p class="mb-1">${data.description?.substring(0, 100) || "No description provided."}</p>
          <small class="text-muted">Participants: ${data.participants.length}</small>
        </div>
        <span class="badge bg-primary">Accepted</span>
      </div>
    </div>`;
}

window.respondToRequest = async function(id, status) {
  await updateDoc(doc(db, "collabRequests", id), { status });
  loadDashboard(auth.currentUser.uid);
};