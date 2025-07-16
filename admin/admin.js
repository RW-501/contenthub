// /js/admin.js


import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";


import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, query,where, addDoc, Timestamp,  serverTimestamp, increment, orderBy,getDoc,  getDocs, updateDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";

// ✅ Initialize storage
const storage = getStorage(app, "gs://content-hub-11923.firebasestorage.app");
const auth = getAuth(app);
const db = getFirestore(app);

// Admin check
onAuthStateChanged(auth, async (user) => {
  const authModal = document.getElementById("auth-login");

  if (!user) {
    // No user logged in — show login modal
    authModal.classList.remove("d-none");
    return; // Stop further processing
  }

  try {
    // Get user document by user.uid
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      alert("Access Denied – User record not found.");
      authModal.classList.remove("d-none");
      return;
    }

    const userData = userDocSnap.data();

    if (userData.role !== "admin") {
      alert("Access Denied – Admins Only");
      authModal.classList.remove("d-none");
      return;
    }

    // If admin, load admin-only data/functions
    loadAnalytics();
    loadUsers();
    loadFlaggedPosts();

  } catch (error) {
    console.error("Error checking admin role:", error);
    alert("Error validating admin access.");
    authModal.classList.remove("d-none");
  }
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


  const contactList = document.getElementById("contactList");
  const filterSelect = document.getElementById("filterStatus");

  filterSelect.addEventListener("change", loadContacts);

  async function loadContacts() {
    const filter = filterSelect.value;
    contactList.innerHTML = "<div class='text-muted p-3'>Loading messages...</div>";

    const q = query(collection(db, "contact"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    contactList.innerHTML = "";

    if (snapshot.empty) {
      contactList.innerHTML = "<div class='text-muted p-3'>No messages found.</div>";
      return;
    }

    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const id = docSnap.id;

      const status = msg.status || "unread";
      if (filter !== "all" && status !== filter) return;

      const date = msg.createdAt?.toDate().toLocaleString() || "N/A";

      const item = document.createElement("div");
      item.className = `list-group-item flex-column align-items-start ${status === 'unread' ? 'list-group-item-warning' : 'list-group-item-light'}`;

      item.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>
            <h5 class="mb-1">${msg.subject || "No Subject"}</h5>
            <small class="text-muted">${msg.name || "Anonymous"} – ${msg.email}</small>
          </div>
          <span class="badge bg-${status === 'unread' ? 'warning' : status === 'read' ? 'primary' : 'success'} text-uppercase">${status}</span>
        </div>
        <p class="mt-2">${msg.message || "(no message)"}</p>
        ${msg.attachment ? `<a href="${msg.attachment}" target="_blank" class="btn btn-sm btn-outline-secondary mb-2">📎 View Attachment</a><br>` : ''}
        <small class="text-muted">Received: ${date}</small>
        <div class="mt-2">
          ${status !== "read" ? `<button class="btn btn-sm btn-outline-primary me-2" onclick="markMessageStatus('${id}', 'read')">Mark as Read</button>` : ""}
          ${status !== "resolved" ? `<button class="btn btn-sm btn-outline-success" onclick="markMessageStatus('${id}', 'resolved')">Mark as Resolved</button>` : ""}
        </div>
      `;

      contactList.appendChild(item);
    });
  }

  window.markMessageStatus = async function(id, status) {
    await updateDoc(doc(db, "contact", id), {
      status
    });
    loadContacts();
  };

  // Load on page start
  window.addEventListener("DOMContentLoaded", loadContacts);



/*
// Example during login
if (userData.status === "removed") {
  alert("Your account was removed. Contact support to appeal.");
  await signOut(auth);
}



*/


// Load All Users
// --- Enhancements ---
// 1. Actions moved into a single modal popup for clarity
// 2. Role changing is now done through a popover menu
// 3. Added helper modal + refactor suggestions

// Call this after your DOM is loaded
// Main User Loader

const userMap = {}; // Global map of demo user data

async function loadUsers() {
  const userTable = document.getElementById("userTable");
  const searchInput = document.getElementById("userSearch");
  const sortSelect = document.getElementById("sortUsers");

  const querySnapshot = await getDocs(collection(db, "users"));
  let users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Filter users
  const searchValue = (searchInput?.value || "").toLowerCase();
  if (searchValue) {
    users = users.filter(u => {
      return (
        (u.displayName || "").toLowerCase().includes(searchValue) ||
        (u.niches || []).join(",").toLowerCase().includes(searchValue) ||
        (u.role || "").toLowerCase().includes(searchValue)
      );
    });
  }

  // Sort users
  const sortOption = sortSelect?.value || "newest";
  users.sort((a, b) => {
    if (sortOption === "newest") return new Date(b.createdAt?.toDate?.()) - new Date(a.createdAt?.toDate?.());
    if (sortOption === "oldest") return new Date(a.createdAt?.toDate?.()) - new Date(b.createdAt?.toDate?.());
    if (sortOption === "name") return (a.displayName || "").localeCompare(b.displayName || "");
    if (sortOption === "role") return (a.role || "").localeCompare(b.role || "");
    if (sortOption === "status") return (a.status || "").localeCompare(b.status || "");
    return 0;
  });

  // Render users
  userTable.innerHTML = "";
  const now = new Date();

  users.forEach(u => {
    const id = u.id;
    const banUntil = u.bannedUntil?.toDate?.();
    const banUntilDisplay = banUntil ? banUntil.toLocaleDateString() : "";
    const createdAt = u.createdAt?.toDate?.();
    const isNew = createdAt && (now - createdAt) < (3 * 24 * 60 * 60 * 1000); // last 3 days

    const actionButtons = `
      <button class="usersCard btn btn-sm btn-outline-primary me-1" onclick="openActionModal('${id}')">⚙ Actions</button>
      ${u.role === 'demo' ? `<button class="btn btn-sm btn-outline-success" onclick="editUserProfile('${id}')">✏️ Edit</button>` : ''}
    `;

    const row = `
      <tr>
        <td>
          ${u.displayName || 'N/A'}
          ${u.featured?.isFeatured ? `<span class="badge bg-warning text-dark ms-1">⭐ Featured</span>` : ""}
          ${isNew ? `<span class="badge bg-success ms-1">New</span>` : ""}
        </td>
        <td>${(u.niches || []).join(", ")}</td>
        <td><span class="badge bg-info text-dark">${u.role || 'user'}</span></td>
        <td><span class="badge bg-${u.status === 'active' ? 'success' : u.status === 'blocked' ? 'warning' : 'secondary'}">${u.status}</span></td>
        <td>${banUntilDisplay}</td>
        <td>${actionButtons}</td>
      </tr>
    `;

    userTable.insertAdjacentHTML("beforeend", row);
  });
}

window.loadUsers = loadUsers;


document.getElementById("userSearch")?.addEventListener("input", debounce(loadUsers, 300));
document.getElementById("sortUsers")?.addEventListener("change", loadUsers);

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}


let selectedUserId = null;
let selectedUserData = null;

// Open Modal
function openActionModal(userId) {
  const userData = userMap[userId];
  selectedUserId = userId;
  selectedUserData = userData;

  
  const {
    displayName = "Unknown",
    bio = "No bio available",
    pronouns = "—",
    availability = "—",
    userLocation = {},
    niches = [],
    contentTypes = [],
    links = [],
    photoURL,
    points,
    postCount,
     verified,
     lastLogin,
     dailyLogins
  } = userData;

const username = userData.username?.replace("@", "") || "";

const featureBtn = document.getElementById("featureUserBtn");

featureBtn.textContent = userData.featured?.isFeatured ? "❌ Remove Feature" : "⭐ Feature This Creator";
featureBtn.className = userData.featured?.isFeatured
  ? "btn btn-outline-danger w-100 my-2"
  : "btn btn-outline-warning w-100 my-2";

featureBtn.onclick = () => {
  if (!userId) return;

  if (userData.featured?.isFeatured) {
    const confirmUnfeature = confirm("Remove this creator from the featured list?");
    if (!confirmUnfeature) return;

    updateDoc(doc(db, "users", userId), {
      "featured.isFeatured": false
    }).then(() => {
      alert("✅ Creator has been unfeatured.");
    }).catch(err => {
      console.error("Error unfeaturing user:", err);
      alert("❌ Failed to update.");
    });
  } else {
    // Prefill modal values
    document.getElementById("featureReasonInput").value = userData.featured?.reason || "Active contributor";
    document.getElementById("featureRankSelect").value = userData.featured?.rank || "1";
    new bootstrap.Modal(document.getElementById("featureModal")).show();
  }
};


document.getElementById("userPoints").textContent = points;
document.getElementById("userPostCount").textContent = postCount;
document.getElementById("userVerified").textContent = verified ? "✅" : "❌";
document.getElementById("userLastLogin").textContent = timeAgo(lastLogin?.toDate?.() || new Date());
document.getElementById("userDailyLogins").textContent = dailyLogins;


  // Avatar and name
const avatarImg = document.getElementById("userAvatarView");
if (avatarImg && photoURL) {
  avatarImg.src = photoURL;
} else {
  console.warn("Avatar image element not found or photoURL missing:", avatarImg, photoURL);
}
  document.getElementById("userDisplayName").innerText = displayName;
  document.getElementById("actionUserNameDisplay").innerText = username;

  // Other fields
  document.getElementById("userBio").innerText = bio;
  document.getElementById("userPronouns").innerText = pronouns;
  document.getElementById("userAvailability").innerText = availability;

  // Location
  const { city = "", state = "", country = "" } = userLocation;
  const locationText = [city, state, country].filter(Boolean).join(", ");
  document.getElementById("userLocation").innerText = locationText || "—";

  // Niches
  const nichesContainer = document.getElementById("userNiches");
  nichesContainer.innerHTML = "";
  niches.forEach(niche => {
    const span = document.createElement("span");
    span.className = "badge bg-secondary";
    span.innerText = niche;
    nichesContainer.appendChild(span);
  });

  // Content Types
  const contentContainer = document.getElementById("userContentTypes");
  contentContainer.innerHTML = "";
  contentTypes.forEach(type => {
    const span = document.createElement("span");
    span.className = "badge bg-info text-dark";
    span.innerText = type;
    contentContainer.appendChild(span);
  });

  // Links
  const linksContainer = document.getElementById("userLinks");
  linksContainer.innerHTML = "";
  links.forEach(link => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = link.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerText = `${link.platform || "Link"}`;
    li.appendChild(a);
    linksContainer.appendChild(li);
  });


  document.getElementById("actionModal").value = userId;
  new bootstrap.Modal(document.getElementById("actionModal")).show();
}
window.openActionModal = openActionModal;


document.getElementById("confirmFeatureBtn").onclick = async () => {
  const reason = document.getElementById("featureReasonInput").value || "Featured Creator";
  const rank = parseInt(document.getElementById("featureRankSelect").value) || 1;

  const startDateInput = document.getElementById("featureStartDate").value;
  const days = parseInt(document.getElementById("featureDaysSelect").value) || 7;

  const now = new Date();
  let startDate = startDateInput ? new Date(startDateInput) : now;

  let featuredUntil = new Date(startDate);
  featuredUntil.setDate(featuredUntil.getDate() + days);

  // Extend if already featured and date is still active
  const existing = selectedUserData?.featured;
  if (existing?.isFeatured) {
    const currentEnd = existing.featuredUntil?.toDate?.();
    if (currentEnd && currentEnd > now) {
      featuredUntil = new Date(currentEnd);
      featuredUntil.setDate(featuredUntil.getDate() + days);
      startDate = existing.startDate?.toDate?.() || now;
    }
  }

  try {
    await updateDoc(doc(db, "users", selectedUserId), {
      featured: {
        isFeatured: true,
        reason,
        rank,
        startDate: Timestamp.fromDate(startDate),
        featuredUntil: Timestamp.fromDate(featuredUntil),
        addedBy: "admin",
        addedAt: serverTimestamp()
      }
    });
    alert("🎉 Creator has been featured!");
    bootstrap.Modal.getInstance(document.getElementById("featureModal")).hide();
  } catch (err) {
    console.error("Error setting feature:", err);
    alert("❌ Failed to update feature.");
  }
};


// Set Role
async function setUserRole(role) {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), { role });
  alert(`Role updated to ${role}`);
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.setUserRole = setUserRole;

// Verify
async function verifyUser() {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), { verified: true });
  alert("User verified.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.verifyUser = verifyUser;

// Ban
async function banUser(duration) {
  const userId = document.getElementById("actionUserId").value;
  const banUntil = duration === 'perm'
    ? new Date("2099-12-31")
    : new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);

  await updateDoc(doc(db, "users", userId), {
    role: "banned",
    status: "blocked",
    banUntil
  });

  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.banUser = banUser;

// Unban
async function unbanUser() {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), {
    role: "user",
    status: "active",
    bannedUntil: null
  });
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.unbanUser = unbanUser;

// Delete
async function deleteUser() {
  const userId = document.getElementById("actionUserId").value;
  if (!confirm("Are you sure you want to remove this user?")) return;

  await updateDoc(doc(db, "users", userId), {
    status: "removed",
    role: "removed",
    removedAt: new Date()
  });

  alert("User marked as removed.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.deleteUser = deleteUser;

// Restore
async function restoreUser() {
  const userId = document.getElementById("actionUserId").value;
  if (!confirm("Restore this user?")) return;

  await updateDoc(doc(db, "users", userId), {
    status: "active",
    role: "user",
    removedAt: deleteField()
  });

  alert("User restored.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.restoreUser = restoreUser;

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
let allFeaturedUsers = [];
let currentPage = 1;
const usersPerPage = 6;

document.getElementById("loadFeaturedBtn").addEventListener("click", loadAndRenderFeaturedUsers);
document.getElementById("sortFeaturedSelect").addEventListener("change", renderFeaturedPage);
document.getElementById("searchFeaturedInput").addEventListener("input", renderFeaturedPage);
document.getElementById("prevPageBtn").addEventListener("click", () => changePage(-1));
document.getElementById("nextPageBtn").addEventListener("click", () => changePage(1));

async function loadAndRenderFeaturedUsers() {
  const snapshot = await getDocs(query(collection(db, "users"), where("featured.isFeatured", "==", true)));
  allFeaturedUsers = [];

  snapshot.forEach(doc => {
    const user = doc.data();
    const id = doc.id;
    const featured = user.featured || {};
    const startDate = featured.startDate?.toDate?.();
    const endDate = featured.featuredUntil?.toDate?.();

    if (endDate && endDate > new Date()) {
      allFeaturedUsers.push({
        id,
        displayName: user.displayName || "Unnamed",
        photoURL: user.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png",
        reason: featured.reason || "Featured Creator",
        rank: featured.rank || 99,
        startDate,
        featuredUntil: endDate
      });
    }
  });

  currentPage = 1;
  renderFeaturedPage();
}

function renderFeaturedPage() {
  const list = document.getElementById("featuredUsersList");
  const sortBy = document.getElementById("sortFeaturedSelect").value;
  const query = document.getElementById("searchFeaturedInput").value.toLowerCase();

  let filtered = allFeaturedUsers.filter(u => u.displayName.toLowerCase().includes(query));

  if (sortBy === "rank") {
    filtered.sort((a, b) => a.rank - b.rank);
  } else {
    filtered.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  }

  const totalPages = Math.ceil(filtered.length / usersPerPage);
  const startIdx = (currentPage - 1) * usersPerPage;
  const paginated = filtered.slice(startIdx, startIdx + usersPerPage);

  list.innerHTML = "";

  if (paginated.length === 0) {
    list.innerHTML = `<div class="col-12 text-muted text-center">No featured users found.</div>`;
  }

  paginated.forEach(user => {
    const daysLeft = Math.max(0, Math.ceil((user.featuredUntil - new Date()) / (1000 * 60 * 60 * 24)));

    const card = `
      <div class="col">
        <div class="card h-100 border-warning shadow-sm">
          <div class="card-body text-center">
            <img src="${user.photoURL}" class="rounded-circle mb-2" style="width: 80px; height: 80px; object-fit: cover;">
            <h6 class="fw-bold mb-0">${user.displayName}</h6>
            <small class="text-muted d-block mb-2">Rank: ${user.rank} | ${daysLeft} day(s) left</small>
            <div class="mb-2"><span class="badge bg-warning text-dark">${user.reason}</span></div>
            <button onclick="unfeatureUser('${user.id}')" class="btn btn-sm btn-outline-danger">❌ Remove</button>
          </div>
        </div>
      </div>
    `;
    list.insertAdjacentHTML("beforeend", card);
  });

  document.getElementById("pageIndicator").innerText = `Page ${currentPage} / ${totalPages}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled = currentPage === totalPages;
}

function changePage(direction) {
  const totalPages = Math.ceil(allFeaturedUsers.length / usersPerPage);
  currentPage += direction;
  currentPage = Math.max(1, Math.min(currentPage, totalPages));
  renderFeaturedPage();
}

async function unfeatureUser(uid) {
  const confirmMsg = confirm("Are you sure you want to remove this user from featured?");
  if (!confirmMsg) return;

  try {
    await updateDoc(doc(db, "users", uid), {
      "featured.isFeatured": false
    });
    alert("✅ User has been unfeatured.");
    loadAndRenderFeaturedUsers(); // refresh the list
  } catch (err) {
    console.error("Error unfeaturing user:", err);
    alert("❌ Failed to unfeature user.");
  }
}

window.unfeatureUser = unfeatureUser;


window.loadAnalytics = async function () {
  const q = query(collection(db, "analyticsLogs"), orderBy("timestamp", "desc"));
  const snap = await getDocs(q);

  const logs = snap.docs.map(doc => doc.data());

  let html = `
    <input class="form-control mb-2" placeholder="🔍 Filter by city, IP or page" oninput="filterAnalytics(this.value)">
    <table class="table table-bordered table-striped table-sm">
      <thead>
        <tr>
          <th>Page</th>
          <th>IP</th>
          <th>Location</th>
          <th>Device Time</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody id="analyticsBody">
        ${logs.map(log => `
          <tr>
            <td>${log.pageUrl}</td>
            <td>${log.ip}</td>
            <td>${log.location}</td>
            <td>${log.deviceTime}</td>
            <td>${log.timestamp?.toDate?.().toLocaleString() || "-"}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
  document.getElementById("analyticsTable").innerHTML = html;
};

window.filterAnalytics = function (term) {
  const rows = document.querySelectorAll("#analyticsBody tr");
  term = term.toLowerCase();
  rows.forEach(row => {
    const visible = [...row.children].some(td => td.textContent.toLowerCase().includes(term));
    row.style.display = visible ? "" : "none";
  });
};



let calendarItemsByDate = {};
let scheduledPostsByDate = {};
let calendarStartOffset = 0;
const monthsToShow = 3;

const calendarWrapper = document.getElementById("calendarWrapper");
const toggleCalendarBtn = document.getElementById("toggleCalendarBtn");

// Load all scheduled content (posts, featured users, events)
async function loadCalendarItems() {
  calendarItemsByDate = {};

  const postSnap = await getDocs(query(collection(db, "posts"), where("scheduledAt", "!=", null)));
  postSnap.forEach(doc => {
    const post = doc.data();
    const dateKey = post.scheduledAt.toDate().toISOString().split("T")[0];
    calendarItemsByDate[dateKey] ??= { posts: [], events: [], featured: [] };
    calendarItemsByDate[dateKey].posts.push({ ...post, id: doc.id });
  });

  const userSnap = await getDocs(query(collection(db, "users"), where("featured.isFeatured", "==", true)));
  userSnap.forEach(doc => {
    const user = doc.data();
    const startDate = user.featured?.startDate?.toDate?.();
    if (!startDate) return;
    const dateKey = startDate.toISOString().split("T")[0];
    calendarItemsByDate[dateKey] ??= { posts: [], events: [], featured: [] };
    calendarItemsByDate[dateKey].featured.push({ ...user, id: doc.id });
  });

  const eventSnap = await getDocs(query(collection(db, "events"), where("date", "!=", null)));
  eventSnap.forEach(doc => {
    const event = doc.data();
    const dateKey = event.date.toDate().toISOString().split("T")[0];
    calendarItemsByDate[dateKey] ??= { posts: [], events: [], featured: [] };
    calendarItemsByDate[dateKey].events.push({ ...event, id: doc.id });
  });
}

async function loadScheduledPosts() {
  scheduledPostsByDate = {};
  const q = query(collection(db, "posts"), where("scheduledAt", "!=", null));
  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const post = doc.data();
    const date = post.scheduledAt?.toDate?.();
    if (!date) return;

    const dateKey = date.toISOString().split("T")[0];
    scheduledPostsByDate[dateKey] ??= [];
    scheduledPostsByDate[dateKey].push({ ...post, id: doc.id });
  });
}

function renderCalendar() {
  const now = new Date();
  calendarWrapper.innerHTML = "";

  const mode = typeof viewMode !== "undefined" ? viewMode : "month";

 if (mode === "day") {
    // Show only one day view
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    renderDayView(today);
    return;
  }

  if (mode === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay()); // Start of week
    for (let i = 0; i < 7; i++) {
      renderDayView(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return;
  }
  for (let i = 0; i < monthsToShow; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + calendarStartOffset + i, 1);
    const monthYearStr = monthDate.toLocaleString("default", { month: "long", year: "numeric" });

    const monthDiv = document.createElement("div");
    monthDiv.className = "mb-4";
    monthDiv.innerHTML = `<h5>${monthYearStr}</h5>`;

    const table = document.createElement("table");
    table.className = "table table-bordered text-center small";

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const headerRow = document.createElement("tr");
    daysOfWeek.forEach(day => {
      const th = document.createElement("th");
      th.innerText = day;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);
const filter = document.getElementById("calendarFilter")?.value || "all";

    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    let currentRow = document.createElement("tr");
    for (let d = 0; d < firstDay.getDay(); d++) {
      currentRow.appendChild(document.createElement("td"));
    }

    for (let dateNum = 1; dateNum <= lastDay.getDate(); dateNum++) {
      const dayDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), dateNum);
      const dateKey = dayDate.toISOString().split("T")[0];

      const td = document.createElement("td");
      const dayData = calendarItemsByDate[dateKey];

      if (dayData) {

const count =
  (filter === "all" || filter === "posts" ? dayData.posts.length : 0) +
  (filter === "all" || filter === "events" ? dayData.events.length : 0) +
  (filter === "all" || filter === "featured" ? dayData.featured.length : 0);

  td.innerHTML = `<button class="btn btn-sm btn-warning w-100" data-date="${dateKey}">
          ${dateNum}<br><small>${count} item(s)</small>
        </button>`;
      } else {
        td.innerHTML = `<div class="text-muted">${dateNum}</div>`;
      }

      currentRow.appendChild(td);

      if (dayDate.getDay() === 6 || dateNum === lastDay.getDate()) {
        table.appendChild(currentRow);
        currentRow = document.createElement("tr");
      }
    }

    monthDiv.appendChild(table);
    calendarWrapper.appendChild(monthDiv);
  }
function timeAgo(date) {
  if (!date) return "";
  const seconds = Math.floor((new Date() - date) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
    second: 1,
  };

  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count > 0) return rtf.format(-count, unit);
  }

  return "just now";
}

  // Page Indicator
  const startMonth = new Date(now.getFullYear(), now.getMonth() + calendarStartOffset, 1);
  const endMonth = new Date(now.getFullYear(), now.getMonth() + calendarStartOffset + monthsToShow - 1, 1);
  document.getElementById("pageIndicator").textContent = `Showing: ${startMonth.toLocaleString("default", { month: "long", year: "numeric" })} → ${endMonth.toLocaleString("default", { month: "long", year: "numeric" })}`;

  // Add day click handlers
  calendarWrapper.querySelectorAll("button[data-date]").forEach(btn => {
  const cloned = btn.cloneNode(true);
  btn.replaceWith(cloned);

  cloned.addEventListener("click", () => {
    const date = cloned.dataset.date;
    renderModalForDate(date);
    document.getElementById("calendarModalDate").textContent = date;
    new bootstrap.Modal(document.getElementById("calendarDayModal")).show();

    document.getElementById("addNewPostForDate").onclick = () => openPostCreationForm(date);
    document.getElementById("addNewEventForDate").onclick = () => {
      document.getElementById("eventDateInput").value = date;
      document.getElementById("eventTitleInput").value = "";
      document.getElementById("eventDescInput").value = "";
      new bootstrap.Modal(document.getElementById("addEventModal")).show();
    };
    document.getElementById("addFeaturedUserForDate").onclick = () => {
      document.getElementById("featuredDateInput").value = date;
      document.getElementById("featuredUserUidInput").value = "";
      document.getElementById("featuredReasonInput").value = "";
      new bootstrap.Modal(document.getElementById("scheduleFeaturedModal")).show();
    };
  });
});

}

let prevBound = false;

function bindPaginationEvents() {
  if (prevBound) return;
  prevBound = true;

  document.getElementById("prevPageBtn").addEventListener("click", () => {
    if (calendarStartOffset > 0) {
      calendarStartOffset -= monthsToShow;
      renderCalendar();
    }
  });

  document.getElementById("nextPageBtn").addEventListener("click", () => {
    calendarStartOffset += monthsToShow;
    renderCalendar();
  });
}


// Toggle calendar view
toggleCalendarBtn.addEventListener("click", async () => {
  calendarWrapper.classList.toggle("d-none");
  bindPaginationEvents();

  if (!calendarWrapper.dataset.loaded) {
    await loadScheduledPosts();
    await loadCalendarItems();
    renderCalendar();
    calendarWrapper.dataset.loaded = true;
  }
});

function renderDayView(dateObj) {
  const dateKey = dateObj.toISOString().split("T")[0];
  const dayLabel = dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

  const div = document.createElement("div");
  div.className = "mb-4";
  div.innerHTML = `<h6>${dayLabel}</h6>`;

  const btn = document.createElement("button");
  btn.className = "btn btn-sm btn-outline-info";
  btn.innerText = "View Details";
  btn.dataset.date = dateKey;
  btn.onclick = () => {
    document.getElementById("calendarModalDate").textContent = dateKey;
    renderModalForDate(dateKey);
    new bootstrap.Modal(document.getElementById("calendarDayModal")).show();
  };

  div.appendChild(btn);
  calendarWrapper.appendChild(div);
  document.getElementById("calendarDayModal").scrollIntoView({ behavior: "smooth" });

}

function renderModalForDate(date) {
  const filter = document.getElementById("calendarFilter")?.value || "all";
  const items = calendarItemsByDate[date] || { posts: [], events: [], featured: [] };
  const modalBody = document.getElementById("calendarModalBody");
  const blocks = [];

  // Posts
  if ((filter === "all" || filter === "posts") && items.posts.length) {
    blocks.push(`<h6 class="text-primary">📸 Scheduled Posts</h6>`);
    blocks.push(...items.posts.map(post => `
      <div class="card mb-2"><div class="card-body">
        <h6>${post.caption || "Untitled"}</h6>
        <p><strong>Owner:</strong> ${post.owner || "—"}</p>
        <p><strong>Type:</strong> ${post.type || "—"}</p>
        <p><strong>Goal:</strong> ${post.projectGoal || "—"}</p>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-sm btn-primary" onclick="editScheduledPost('${post.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteScheduledPost('${post.id}', '${date}')">🗑 Delete</button>
        </div>
      </div></div>
    `));
  }

  // Events
  if ((filter === "all" || filter === "events") && items.events.length) {
    blocks.push(`<h6 class="text-success">📅 Events</h6>`);
    blocks.push(...items.events.map(event => `
      <div class="card mb-2"><div class="card-body">
        <h6>${event.title}</h6>
        <p>${event.description || ""}</p>
        <div class="d-flex justify-content-end gap-2">
          <button class="btn btn-sm btn-primary" onclick="editEvent('${event.id}')">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteEvent('${event.id}', '${date}')">🗑 Delete</button>
        </div>
      </div></div>
    `));
  }

  // Featured Users
  if ((filter === "all" || filter === "featured") && items.featured.length) {
    blocks.push(`<h6 class="text-warning">⭐ Featured Users</h6>`);
    blocks.push(...items.featured.map(user => `
      <div class="card mb-2"><div class="card-body">
        <h6>${user.displayName}</h6>
        <p>Reason: ${user.featured?.reason || "—"}</p>
      </div></div>
    `));
  }

  modalBody.innerHTML = blocks.length
    ? blocks.join("")
    : `<p class="text-muted">No scheduled items for this filter.</p>`;
}
window.renderModalForDate = renderModalForDate;

async function deleteEvent(id, dateStr) {
  if (!confirm("Delete this event?")) return;

  try {
    await deleteDoc(doc(db, "events", id));
    await loadCalendarItems();
    renderCalendar();
    renderModalForDate(dateStr);
  } catch (error) {
    console.error("Failed to delete event:", error);
    alert("Could not delete the event.");
  }
}
window.deleteEvent = deleteEvent;

function editEvent(eventId) {
  const event = Object.values(calendarItemsByDate)
    .flatMap(day => day.events)
    .find(e => e.id === eventId);

  if (!event) return alert("Event not found.");

  document.getElementById("eventDateInput").value = event.date.toDate().toISOString().split("T")[0];
  document.getElementById("eventTitleInput").value = event.title;
  document.getElementById("eventDescInput").value = event.description || "";
  document.getElementById("addEventModal").dataset.editingId = eventId;

  new bootstrap.Modal(document.getElementById("addEventModal")).show();
}
window.editEvent = editEvent;

// Open post creation form
function openPostCreationForm(dateStr) {
  const formDateInput = document.getElementById("scheduledDateInput");
  if (formDateInput) {
    formDateInput.value = dateStr;
    new bootstrap.Modal(document.getElementById("createPostModal")).show();
  } else {
    console.warn("No scheduledDateInput found.");
  }
}

// Save Event logic
document.getElementById("saveEventBtn").addEventListener("click", async () => {
  const dateStr = document.getElementById("eventDateInput").value;
  const title = document.getElementById("eventTitleInput").value.trim();
  const description = document.getElementById("eventDescInput").value.trim();
  if (!title || !dateStr) return alert("Event title and date required.");

  const dateObj = new Date(dateStr);
  try {
const modal = document.getElementById("addEventModal");
const eventId = modal.dataset.editingId;

if (eventId) {
  // Update existing
  await updateDoc(doc(db, "events", eventId), {
    title,
    description,
    date: Timestamp.fromDate(dateObj),
  });
  delete modal.dataset.editingId;
} else {
  // Create new
  await addDoc(collection(db, "events"), {
    title,
    description,
    date: Timestamp.fromDate(dateObj),
    createdAt: serverTimestamp(),
  });
}


    await loadCalendarItems();
    renderCalendar();
    bootstrap.Modal.getInstance(document.getElementById("addEventModal")).hide();
  } catch (err) {
    console.error("Error saving event", err);
    alert("Error saving event. See console.");
  }
});




    const searchBtn = document.getElementById('searchBtn');
    const platform = document.getElementById('platform');
    const usernameInput = document.getElementById('usernameInput');
    const saveBtn = document.getElementById('saveProfileBtn');

    // **YOUR RAPIDAPI KEYS HERE** - get from https://rapidapi.com
    const rapidApiKey = 'YOUR_RAPIDAPI_KEY';

    let latestProfile = null;

    searchBtn.addEventListener('click', async () => {
      const selected = platform.value;
      const user = usernameInput.value.trim().replace('@', '');

      if (!user) return alert('Please enter a valid username.');

      if (selected === 'youtube') {
        await fetchYouTube(user);
      } else if (selected === 'tiktok') {
        await fetchTikTok(user);
      } else if (selected === 'instagram') {
        await fetchInstagram(user);
      } else if (selected === 'facebook') {
        alert('Facebook API not integrated yet.');
      }
    });

    async function fetchYouTube(username) {
      const apiKey = 'YOUR_YOUTUBE_API_KEY';
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${username}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!data.items || !data.items.length) return alert('No YouTube profile found.');

      const profile = data.items[0];
      latestProfile = {
        platform: 'youtube',
        username: username,
        displayName: profile.snippet.title,
        bio: profile.snippet.description,
        profilePic: profile.snippet.thumbnails.default.url,
        followers: profile.statistics.subscriberCount,
        url: `https://www.youtube.com/${profile.snippet.customUrl || 'channel/' + profile.id}`
      };

      showProfile(latestProfile);
    }

    async function fetchTikTok(username) {
      const url = `https://tiktok-scraper.p.rapidapi.com/user/info/${username}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'tiktok-scraper.p.rapidapi.com'
          }
        });
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();

        const user = data.user;
        latestProfile = {
          platform: 'tiktok',
          username: username,
          displayName: user.nickname,
          bio: user.signature,
          profilePic: user.avatarThumb,
          followers: user.followerCount,
          url: `https://www.tiktok.com/@${username}`
        };

        showProfile(latestProfile);
      } catch (err) {
        alert('TikTok profile not found or API limit exceeded.');
      }
    }

    async function fetchInstagram(username) {
      const url = `https://instagram-profile1.p.rapidapi.com/profile/${username}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'instagram-profile1.p.rapidapi.com'
          }
        });
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();

        const user = data;
        latestProfile = {
          platform: 'instagram',
          username: username,
          displayName: user.full_name,
          bio: user.biography,
          profilePic: user.profile_pic_url_hd,
          followers: user.edge_followed_by.count,
          url: `https://instagram.com/${username}`
        };

        showProfile(latestProfile);
      } catch (err) {
        alert('Instagram profile not found or API limit exceeded.');
      }
    }

    function showProfile(profile) {
      document.getElementById('profileImage').src = profile.profilePic || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png';
      document.getElementById('profileName').textContent = profile.displayName || profile.username;
      document.getElementById('profileUsername').textContent = `@${profile.username}`;
      document.getElementById('profileFollowers').textContent = `Followers: ${profile.followers || 'N/A'}`;
      document.getElementById('profileUrl').href = profile.url;
      document.getElementById('resultBox').classList.remove('d-none');
    }

    saveBtn.addEventListener('click', async () => {
      if (!latestProfile) return alert('No profile to save.');
      try {
        await setDoc(doc(db, "external_profiles", `${latestProfile.platform}_${latestProfile.username}`), latestProfile);
        alert('Profile saved to Firestore!');
      } catch (err) {
        console.error("Error saving profile:", err);
        alert('Failed to save profile.');
      }
    });


  async function loadTickets() {
    const ticketList = document.getElementById("ticketList");
    ticketList.innerHTML = "<div class='text-muted'>Loading tickets...</div>";

    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      ticketList.innerHTML = "<div class='text-muted'>No tickets found.</div>";
      return;
    }

    ticketList.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const ticket = docSnap.data();
      const ticketId = docSnap.id;

      const userSnap = await getDoc(doc(db, "users", ticket.userId));
      const user = userSnap.data();

      const item = document.createElement("div");
      item.className = `list-group-item list-group-item-action flex-column align-items-start`;

      item.innerHTML = `
        <div class="d-flex justify-content-between w-100">
          <div>
            <h6 class="mb-1">${ticket.type.replace("_", " ").toUpperCase()}</h6>
            <small class="text-muted">User: ${user?.displayName || "Unknown"} (${user?.email || "N/A"})</small>
          </div>
          <span class="badge bg-${ticket.status === 'pending' ? 'warning' : ticket.status === 'approved' ? 'success' : 'danger'} text-uppercase">${ticket.status}</span>
        </div>
        <small class="text-muted">Submitted: ${ticket.createdAt?.toDate().toLocaleString() || "unknown"}</small>
        ${ticket.status === 'pending' ? `
        <div class="mt-2">
          <button class="btn btn-sm btn-success me-2" onclick="updateTicketStatus('${ticketId}', 'approved')">✅ Approve</button>
          <button class="btn btn-sm btn-danger me-2" onclick="updateTicketStatus('${ticketId}', 'denied')">❌ Deny</button>
          <button class="btn btn-sm btn-secondary" onclick="updateTicketStatus('${ticketId}', 'resolved')">✔️ Mark Resolved</button>
        </div>` : ''}
      `;

      ticketList.appendChild(item);
    }
  }

  async function updateTicketStatus(ticketId, status) {
    await updateDoc(doc(db, "tickets", ticketId), {
      status,
      reviewedAt: new Date()
    });
    alert(`Ticket ${status}`);
    loadTickets();
  }
window.updateTicketStatus = updateTicketStatus;

  // Load on admin page load
  window.addEventListener("DOMContentLoaded", loadTickets);



    document.getElementById('brandingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const faviconURL = document.getElementById('faviconURL').value.trim();
    const logoURL = document.getElementById('logoURL').value.trim();
    const profileImageURL = document.getElementById('profileImageURL').value.trim();

    const brandingData = {
      faviconURL,
      logoURL,
      profileImageURL,
      updatedAt: new Date().toISOString()
    };

    const content = JSON.stringify(brandingData, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const owner = "RW-501";
    const repo = "contenthub";
    const filePath = "https://rw-501.github.io/contenthub/branding/settings.json";
    const branch = 'main';

// Randomized or complex approach
const parts = ['p', 'h', 'g'];
const randomizePart = (part) => {
    return part.split('').reverse().join('');
};

const part_1 = randomizePart(parts.join(''));
const part_2 = "_akXGrO51HwgEI";
const part_3 = "VWzDIghLbIE";
const part_4 = "G9MnTu0fIjKj";

const token = part_1 + part_2 + part_3 + part_4;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    let sha = "";

    try {
      const check = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (check.ok) {
        const json = await check.json();
        sha = json.sha;
      }

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: sha ? "Update branding settings" : "Create branding settings",
          content: encodedContent,
          sha,
          branch
        })
      });

      if (!res.ok) throw new Error("Failed to update file");
      document.getElementById('messageDiv').textContent = "Branding settings updated successfully!";
    } catch (err) {
      console.error(err);
      document.getElementById('messageDiv').textContent = `Error: ${err.message}`;
    }
  });




async function createDemoProfiles() {
  const demoUsers = [
    {
      displayName: "DreamChaser",
      username: "@dreamchaser",
      bio: "Visual artist exploring identity and digital dreams.",
      pronouns: "they/them",
      availability: "weekends",
      userLocation: { country: "USA", state: "CA", city: "Los Angeles" },
      niches: ["art", "animation"],
      contentTypes: ["video", "reels"],
      links: [
        { platform: "instagram", url: "https://instagram.com/dreamchaser" }
      ],
      photo: "demo_avatars/dreamchaser.png"
    },
    {
      displayName: "VisualBeats",
      username: "@visualbeats",
      bio: "Motion + sound = magic. Let’s collab.",
      pronouns: "he/him",
      availability: "nights",
      userLocation: { country: "USA", state: "NY", city: "Brooklyn" },
      niches: ["music", "vfx"],
      contentTypes: ["audio", "animation"],
      links: [
        { platform: "youtube", url: "https://youtube.com/visualbeats" }
      ],
      photo: "demo_avatars/visualbeats.png"
    },
    {
      displayName: "CodeMuse",
      username: "@codemuse",
      bio: "Frontend wizard crafting magic with pixels & JS.",
      pronouns: "she/her",
      availability: "full-time",
      userLocation: { country: "USA", state: "TX", city: "Austin" },
      niches: ["webdev", "ux"],
      contentTypes: ["tutorials", "design"],
      links: [
        { platform: "github", url: "https://github.com/codemuse" }
      ],
      photo: "demo_avatars/codemuse.png"
    },
    {
      displayName: "VibeWriter",
      username: "@vibewriter",
      bio: "Script & spoken word creative looking to connect.",
      pronouns: "they/them",
      availability: "mornings",
      userLocation: { country: "USA", state: "IL", city: "Chicago" },
      niches: ["writing", "spokenword"],
      contentTypes: ["scripts", "voiceover"],
      links: [
        { platform: "twitter", url: "https://twitter.com/vibewriter" }
      ],
      photo: "demo_avatars/vibewriter.png"
    },
  {
    displayName: "User001",
    username: "@user001",
    bio: "Passionate real estate creator sharing authentic content.",
    pronouns: "she/her",
    availability: "part-time",
    userLocation: { country: "USA", state: "NY", city: "Brooklyn" },
    niches: ["Skits & Acting", "Gaming"],
    contentTypes: ["Challenges", "Livestreams"],
    links: [{ platform: "github", url: "https://instagram.com/user001" }],
    photo: "demo_avatars/user001.png"
  },
  {
    displayName: "User002",
    username: "@user002",
    bio: "Passionate asmr creator sharing authentic content.",
    pronouns: "she/her",
    availability: "part-time",
    userLocation: { country: "USA", state: "TX", city: "Austin" },
    niches: ["Lifestyle", "Tutorials"],
    contentTypes: ["Music Videos", "Animations"],
    links: [{ platform: "facebook", url: "https://twitter.com/user002" }],
    photo: "demo_avatars/user002.png"
  },
  {
    displayName: "User003",
    username: "@user003",
    bio: "Passionate music creator sharing authentic content.",
    pronouns: "she/her",
    availability: "weekends",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Art & Design", "Tech"],
    contentTypes: ["Animations", "Skits"],
    links: [{ platform: "facebook", url: "https://youtube.com/user003" }],
    photo: "demo_avatars/user003.png"
  },
  {
    displayName: "BlakeTracks",
    username: "@blaketracks",
    bio: "Visionary motivation here to collab, connect, and grow.",
    pronouns: "they/them",
    availability: "part-time",
    userLocation: { country: "USA", state: "WA", city: "Miami" },
    niches: ["Comedy", "Photography"],
    contentTypes: ["Skits", "Livestreams"],
    links: [{ platform: "youtube", url: "https://youtube.com/blaketracks" }],
    photo: "demo_avatars/blaketracks.png"
  },
  {
    displayName: "QuinnBakes",
    username: "@quinnbakes",
    bio: "Passionate fitness influencer bringing vibes to your feed.",
    pronouns: "he/him",
    availability: "nights",
    userLocation: { country: "USA", state: "FL", city: "Seattle" },
    niches: ["Real Estate", "Memes"],
    contentTypes: ["Vlogs", "Reviews"],
    links: [{ platform: "instagram", url: "https://instagram.com/quinnbakes" }],
    photo: "demo_avatars/quinnbakes.png"
  },
  {
    displayName: "SkylarMotion",
    username: "@skylarmotion",
    bio: "Creative product reviews influencer bringing vibes to your feed.",
    pronouns: "they/them",
    availability: "weekends",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Product Reviews", "Lifestyle"],
    contentTypes: ["Behind-the-Scenes", "Animations"],
    links: [{ platform: "youtube", url: "https://youtube.com/skylarmotion" }],
    photo: "demo_avatars/skylarmotion.png"
  },
  {
    displayName: "BlakeMotion",
    username: "@blakemotion",
    bio: "Creative motivation creator sharing real moments.",
    pronouns: "he/him",
    availability: "nights",
    userLocation: { country: "USA", state: "CA", city: "San Diego" },
    niches: ["Education", "Music"],
    contentTypes: ["Short Reels", "Vlogs"],
    links: [{ platform: "twitter", url: "https://twitter.com/blakemotion" }],
    photo: "demo_avatars/blakemotion.png"
  },
  {
    displayName: "PhoenixDrive",
    username: "@phoenixdrive",
    bio: "Passionate photography creator sharing authentic vibes.",
    pronouns: "he/him",
    availability: "full-time",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Spirituality", "Finance & Investing"],
    contentTypes: ["Tutorials", "Q&A"],
    links: [{ platform: "tiktok", url: "https://tiktok.com/phoenixdrive" }],
    photo: "demo_avatars/phoenixdrive.png"
  },
  {
    displayName: "ParkerTrack",
    username: "@parkertrack",
    bio: "Passionate motivation creator sharing daily wins.",
    pronouns: "he/him",
    availability: "weekends",
    userLocation: { country: "USA", state: "GA", city: "Atlanta" },
    niches: ["Lifestyle", "Parenting"],
    contentTypes: ["Short Reels", "Challenges"],
    links: [{ platform: "tiktok", url: "https://tiktok.com/parkertrack" }],
    photo: "demo_avatars/parkertrack.png"
  },{
    "displayName": "BlakeMotion",
    "username": "@blakemotion",
    "bio": "Creative motivation creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CA",
      "city": "San Diego"
    },
    "niches": [
      "Education",
      "Music"
    ],
    "contentTypes": [
      "Short Reels",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "twitter",
        "url": "https://twitter.com/blakemotion"
      }
    ],
    "photo": "demo_avatars/blakemotion.png"
  },
  {
    "displayName": "PhoenixDrive",
    "username": "@phoenixdrive",
    "bio": "Passionate photography creator sharing authentic vibes.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "IL",
      "city": "Chicago"
    },
    "niches": [
      "Spirituality",
      "Finance & Investing"
    ],
    "contentTypes": [
      "Tutorials",
      "Q&A"
    ],
    "links": [
      {
        "platform": "tiktok",
        "url": "https://tiktok.com/phoenixdrive"
      }
    ],
    "photo": "demo_avatars/phoenixdrive.png"
  },
  {
    "displayName": "ParkerTrack",
    "username": "@parkertrack",
    "bio": "Passionate motivation creator sharing daily wins.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "GA",
      "city": "Atlanta"
    },
    "niches": [
      "Lifestyle",
      "Parenting"
    ],
    "contentTypes": [
      "Short Reels",
      "Challenges"
    ],
    "links": [
      {
        "platform": "tiktok",
        "url": "https://tiktok.com/parkertrack"
      }
    ],
    "photo": "demo_avatars/parkertrack.png"
  },
  {
    "displayName": "QuinnVibe",
    "username": "@quinnvibe",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Tech",
      "Travel"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnvibe"
      }
    ],
    "photo": "demo_avatars/quinnvibe.png"
  },
  {
    "displayName": "JordanVibe",
    "username": "@jordanvibe",
    "bio": "Passionate photography creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Beauty",
      "Fashion"
    ],
    "contentTypes": [
      "Livestreams",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordanvibe"
      }
    ],
    "photo": "demo_avatars/jordanvibe.png"
  },
  {
    "displayName": "MorganLoop",
    "username": "@morganloop",
    "bio": "Creative beauty creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "DIY & Crafts",
      "Travel"
    ],
    "contentTypes": [
      "Livestreams",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganloop"
      }
    ],
    "photo": "demo_avatars/morganloop.png"
  },
  {
    "displayName": "AveryLoop",
    "username": "@averyloop",
    "bio": "Passionate beauty creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Beauty",
      "Fashion"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyloop"
      }
    ],
    "photo": "demo_avatars/averyloop.png"
  },
  {
    "displayName": "SkylarDrive",
    "username": "@skylardrive",
    "bio": "Passionate photography creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Travel",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylardrive"
      }
    ],
    "photo": "demo_avatars/skylardrive.png"
  },
  {
    "displayName": "TaylorWave",
    "username": "@taylorwave",
    "bio": "Authentic fitness creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Comedy",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/taylorwave"
      }
    ],
    "photo": "demo_avatars/taylorwave.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative food & cooking creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Comedy",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Music Videos",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "QuinnEdge",
    "username": "@quinnedge",
    "bio": "Creative photography creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Beauty",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Tutorials",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnedge"
      }
    ],
    "photo": "demo_avatars/quinnedge.png"
  },
  {
    "displayName": "MorganLoop",
    "username": "@morganloop",
    "bio": "Authentic food & cooking creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Beauty",
      "Gaming"
    ],
    "contentTypes": [
      "Podcasts",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganloop"
      }
    ],
    "photo": "demo_avatars/morganloop.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative fitness creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Food & Cooking",
      "Photography"
    ],
    "contentTypes": [
      "Tutorials",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "CaseyGlow",
    "username": "@caseyglow",
    "bio": "Creative diy & crafts creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Gaming",
      "Comedy"
    ],
    "contentTypes": [
      "Podcasts",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseyglow"
      }
    ],
    "photo": "demo_avatars/caseyglow.png"
  },
  {
    "displayName": "AveryWave",
    "username": "@averywave",
    "bio": "Passionate food & cooking creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Travel",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Q&A",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averywave"
      }
    ],
    "photo": "demo_avatars/averywave.png"
  },
  {
    "displayName": "ReeseLoop",
    "username": "@reeseloop",
    "bio": "Passionate fitness creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Fitness",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reeseloop"
      }
    ],
    "photo": "demo_avatars/reeseloop.png"
  },
  {
    "displayName": "AlexSync",
    "username": "@alexsync",
    "bio": "Authentic photography creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Gaming",
      "Tech"
    ],
    "contentTypes": [
      "Podcasts",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexsync"
      }
    ],
    "photo": "demo_avatars/alexsync.png"
  },
  {
    "displayName": "CaseyFlare",
    "username": "@caseyflare",
    "bio": "Creative fashion creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Fitness",
      "Comedy"
    ],
    "contentTypes": [
      "Skits",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseyflare"
      }
    ],
    "photo": "demo_avatars/caseyflare.png"
  },
  {
    "displayName": "QuinnGlow",
    "username": "@quinnglow",
    "bio": "Creative photography creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Beauty",
      "Tech"
    ],
    "contentTypes": [
      "Skits",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnglow"
      }
    ],
    "photo": "demo_avatars/quinnglow.png"
  },
  {
    "displayName": "JordanEdge",
    "username": "@jordanedge",
    "bio": "Creative fashion creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fitness",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Podcasts",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordanedge"
      }
    ],
    "photo": "demo_avatars/jordanedge.png"
  },
  {
    "displayName": "TaylorVision",
    "username": "@taylorvision",
    "bio": "Passionate gaming creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Fitness",
      "Fashion"
    ],
    "contentTypes": [
      "Animations",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/taylorvision"
      }
    ],
    "photo": "demo_avatars/taylorvision.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Creative comedy creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Tech",
      "Comedy"
    ],
    "contentTypes": [
      "Podcasts",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Food & Cooking",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "SkylarCreator",
    "username": "@skylarcreator",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Travel",
      "Photography"
    ],
    "contentTypes": [
      "Podcasts",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarcreator"
      }
    ],
    "photo": "demo_avatars/skylarcreator.png"
  },
  {
    "displayName": "AveryDrive",
    "username": "@averydrive",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Food & Cooking",
      "Fitness"
    ],
    "contentTypes": [
      "Vlogs",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averydrive"
      }
    ],
    "photo": "demo_avatars/averydrive.png"
  },
  {
    "displayName": "SkylarDrive",
    "username": "@skylardrive",
    "bio": "Creative gaming creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Podcasts",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylardrive"
      }
    ],
    "photo": "demo_avatars/skylardrive.png"
  },
  {
    "displayName": "AveryCreator",
    "username": "@averycreator",
    "bio": "Authentic comedy creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Comedy",
      "Travel"
    ],
    "contentTypes": [
      "Tutorials",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averycreator"
      }
    ],
    "photo": "demo_avatars/averycreator.png"
  },
  {
    "displayName": "CaseyDrive",
    "username": "@caseydrive",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Gaming",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Skits",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseydrive"
      }
    ],
    "photo": "demo_avatars/caseydrive.png"
  },
  {
    "displayName": "AveryGlow",
    "username": "@averyglow",
    "bio": "Authentic fashion creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Travel",
      "Fitness"
    ],
    "contentTypes": [
      "Music Videos",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyglow"
      }
    ],
    "photo": "demo_avatars/averyglow.png"
  },
  {
    "displayName": "RileyVision",
    "username": "@rileyvision",
    "bio": "Creative food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fashion",
      "Tech"
    ],
    "contentTypes": [
      "Livestreams",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/rileyvision"
      }
    ],
    "photo": "demo_avatars/rileyvision.png"
  },
  {
    "displayName": "AveryVision",
    "username": "@averyvision",
    "bio": "Passionate fitness creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Tech",
      "Fitness"
    ],
    "contentTypes": [
      "Animations",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyvision"
      }
    ],
    "photo": "demo_avatars/averyvision.png"
  },
  {
    "displayName": "ReeseWave",
    "username": "@reesewave",
    "bio": "Passionate gaming creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Comedy",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesewave"
      }
    ],
    "photo": "demo_avatars/reesewave.png"
  },
  {
    "displayName": "ReeseEdge",
    "username": "@reeseedge",
    "bio": "Authentic fashion creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Fitness",
      "Travel"
    ],
    "contentTypes": [
      "Livestreams",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reeseedge"
      }
    ],
    "photo": "demo_avatars/reeseedge.png"
  },
  {
    "displayName": "ReeseSync",
    "username": "@reesesync",
    "bio": "Creative tech creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Fashion",
      "Travel"
    ],
    "contentTypes": [
      "Q&A",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesesync"
      }
    ],
    "photo": "demo_avatars/reesesync.png"
  },
  {
    "displayName": "ReeseCreator",
    "username": "@reesecreator",
    "bio": "Passionate gaming creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Fashion",
      "Travel"
    ],
    "contentTypes": [
      "Podcasts",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesecreator"
      }
    ],
    "photo": "demo_avatars/reesecreator.png"
  },
  {
    "displayName": "MorganVibe",
    "username": "@morganvibe",
    "bio": "Creative gaming creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Beauty",
      "Photography"
    ],
    "contentTypes": [
      "Livestreams",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvibe"
      }
    ],
    "photo": "demo_avatars/morganvibe.png"
  },
  {
    "displayName": "MorganVibe",
    "username": "@morganvibe",
    "bio": "Passionate fitness creator sharing bold ideas.",
    "pronouns": "she/her",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Vlogs",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvibe"
      }
    ],
    "photo": "demo_avatars/morganvibe.png"
  },
  {
    "displayName": "QuinnWave",
    "username": "@quinnwave",
    "bio": "Authentic food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Beauty",
      "Fitness"
    ],
    "contentTypes": [
      "Vlogs",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnwave"
      }
    ],
    "photo": "demo_avatars/quinnwave.png"
  },
  {
    "displayName": "MorganVision",
    "username": "@morganvision",
    "bio": "Authentic gaming creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Beauty",
      "Photography"
    ],
    "contentTypes": [
      "Q&A",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvision"
      }
    ],
    "photo": "demo_avatars/morganvision.png"
  },
  {
    "displayName": "AlexWave",
    "username": "@alexwave",
    "bio": "Passionate beauty creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fashion",
      "Fitness"
    ],
    "contentTypes": [
      "Skits",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexwave"
      }
    ],
    "photo": "demo_avatars/alexwave.png"
  },
  {
    "displayName": "MorganCreator",
    "username": "@morgancreator",
    "bio": "Creative beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Comedy",
      "Beauty"
    ],
    "contentTypes": [
      "Tutorials",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morgancreator"
      }
    ],
    "photo": "demo_avatars/morgancreator.png"
  },
  {
    "displayName": "SkylarSync",
    "username": "@skylarsync",
    "bio": "Authentic comedy creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Fitness",
      "Comedy"
    ],
    "contentTypes": [
      "Tutorials",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarsync"
      }
    ],
    "photo": "demo_avatars/skylarsync.png"
  },
  {
    "displayName": "AverySync",
    "username": "@averysync",
    "bio": "Passionate beauty creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Travel",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Q&A",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averysync"
      }
    ],
    "photo": "demo_avatars/averysync.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Authentic fashion creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Food & Cooking",
      "Travel"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "RileySync",
    "username": "@rileysync",
    "bio": "Authentic travel creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Tech",
      "Comedy"
    ],
    "contentTypes": [
      "Tutorials",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/rileysync"
      }
    ],
    "photo": "demo_avatars/rileysync.png"
  },
  {
    "displayName": "AlexFlare",
    "username": "@alexflare",
    "bio": "Authentic beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Beauty",
      "Comedy"
    ],
    "contentTypes": [
      "Livestreams",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexflare"
      }
    ],
    "photo": "demo_avatars/alexflare.png"
  },
  {
    "displayName": "SkylarSync",
    "username": "@skylarsync",
    "bio": "Passionate food & cooking creator sharing daily stories.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Tech",
      "Gaming"
    ],
    "contentTypes": [
      "Livestreams",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarsync"
      }
    ],
    "photo": "demo_avatars/skylarsync.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Authentic diy & crafts creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "DIY & Crafts",
      "Tech"
    ],
    "contentTypes": [
      "Q&A",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "QuinnDrive",
    "username": "@quinndrive",
    "bio": "Passionate fitness creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Q&A",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinndrive"
      }
    ],
    "photo": "demo_avatars/quinndrive.png"
  },
  {
    "displayName": "MorganFlare",
    "username": "@morganflare",
    "bio": "Creative food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Beauty",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Livestreams",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganflare"
      }
    ],
    "photo": "demo_avatars/morganflare.png"
  }



  ];

  for (const demo of demoUsers) {
    try {
      const id = `demo_${demo.username.replace("@", "")}`;
      const userRef = doc(db, "users", id);

 

      await setDoc(userRef, {
        displayName: demo.displayName,
        username: demo.username,
        bio: demo.bio,
        pronouns: demo.pronouns,
        availability: demo.availability,
        userLocation: demo.userLocation,
        contentTypes: demo.contentTypes,
        niches: demo.niches,
        links: demo.links,
        createdAt: serverTimestamp(),
        status: "active",
        role: "demo",
        verified: false,
        photoURL: demo.photo,
        badge: "🔧 Demo Profile – used to showcase features"
      });

      console.log(`✅ Created: ${demo.username}`);
    } catch (err) {
      console.error(`❌ Error creating ${demo.username}:`, err);
    }
  }

  showModal({
    title: "Demo Users Created",
    message: "Seeded demo users successfully!",
    autoClose: 3000
  });
}

document.getElementById("seedDemoUsers").addEventListener("click", createDemoProfiles);


function setSelectValueOrAdd(selectId, value) {
  const select = document.getElementById(selectId);
  if (!value) return;

  const match = Array.from(select.options).some(opt => opt.value === value);

  if (!match) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = true;
    select.appendChild(option);
  } else {
    select.value = value;
  }
}


function editUserProfile(userId) {
  const demoUserData = userMap[userId];
  if (!demoUserData) {
    console.warn("No demo user data found for:", userId);
    return;
  }
  

console.log("Loading demo user data...");

const username = demoUserData.username?.replace("@", "") || "";
const { displayName, bio, pronouns, availability, userLocation, niches, contentTypes, links, photoURL } = demoUserData;

// Log each piece of user data
console.log("Username:", username);
console.log("Display Name:", displayName);


  document.getElementById("demoUsername").value = username;
  document.getElementById("demoDisplayName").value = displayName || "";
  document.getElementById("demoBio").value = bio || "";

setSelectValueOrAdd("demoPronouns", pronouns);
setSelectValueOrAdd("demoAvailability", availability);


  document.getElementById("demoCountry").value = userLocation?.country || "";
  document.getElementById("demoState").value = userLocation?.state || "";
  document.getElementById("demoCity").value = userLocation?.city || "";

  document.getElementById("demoNiches").value = (niches || []).join(", ");
  document.getElementById("demoContentTypes").value = (contentTypes || []).join(", ");

  // Format links into "platform|url" format
  document.getElementById("demoLinks").value = (links || []).map(link => `${link.platform}|${link.url}`).join(", ");

  // Optional: show existing photo
  if (photoURL) {
    const preview = document.getElementById("demoPhotoPreview");
    if (preview) {
      preview.src = photoURL;
      preview.classList.remove("d-none");
    }
  }

  // Optionally scroll to form or open modal if form is hidden
  const form = document.getElementById("demoUserForm");
  if (form) {
    form.scrollIntoView({ behavior: "smooth" });
    form.classList.remove("d-none"); // if it's hidden by default
  }
}
window.editUserProfile = editUserProfile ;


document.getElementById("demoUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("demoUsername").value.trim().replace('@', '');
  const id = `demo_${username}`;
  const userRef = doc(db, "users", id);

  const displayName = document.getElementById("demoDisplayName").value.trim();
  const bio = document.getElementById("demoBio").value.trim();
  const pronouns = document.getElementById("demoPronouns").value.trim();
  const availability = document.getElementById("demoAvailability").value.trim();

  const userLocation = {
    country: document.getElementById("demoCountry").value.trim(),
    state: document.getElementById("demoState").value.trim(),
    city: document.getElementById("demoCity").value.trim()
  };

  const niches = document.getElementById("demoNiches").value.split(",").map(n => n.trim());
  const contentTypes = document.getElementById("demoContentTypes").value.split(",").map(c => c.trim());

  const rawLinks = document.getElementById("demoLinks").value.split(",").map(pair => {
    const [platform, url] = pair.split("|");
    return { platform: platform?.trim(), url: url?.trim() };
  }).filter(link => link.url);

  const file = document.getElementById("demoPhoto").files[0];

  let photoURL = "";
  let isNew = false;

  const existingSnap = await getDoc(userRef);

  // If file is uploaded, replace existing avatar
  if (file) {
    const avatarRef = ref(storage, `avatars/${id}`);
    await uploadBytes(avatarRef, file);
    photoURL = await getDownloadURL(avatarRef);
  } else {
    photoURL = existingSnap.exists() ? existingSnap.data().photoURL || "" : "";
  }

  const demoData = {
    displayName,
    username: `@${username}`,
    bio,
    pronouns,
    availability,
    userLocation,
    contentTypes,
    niches,
    links: rawLinks,
    status: "active",
    role: "demo",
    verified: false,
    photoURL,
    badge: "🔧 Demo"
  };

  // Only set createdAt on new users
  if (!existingSnap.exists()) {
    demoData.createdAt = serverTimestamp();
    isNew = true;
  }

  await setDoc(userRef, demoData, { merge: true });

  showModal({
    title: isNew ? "Demo User Created" : "Demo User Updated",
    message: `@${username} has been ${isNew ? 'added' : 'updated'}.`,
    autoClose: 3000
  });

  e.target.reset();

  // Optional: hide preview if you're showing it
  const preview = document.getElementById("demoPhotoPreview");
  if (preview) preview.classList.add("d-none");
});


document.getElementById("demoPhoto").addEventListener("change", (e) => {
  const file = e.target.files[0];
  const preview = document.getElementById("demoPhotoPreview");
  if (file && preview) {
    const reader = new FileReader();
    reader.onload = () => {
      preview.src = reader.result;
      preview.classList.remove("d-none");
    };
    reader.readAsDataURL(file);
  }
});









const projectTemplates = [
  {
    title: "Built a portfolio website",
    description: "Created a fully responsive portfolio using HTML, CSS, JS, and Firebase.",
    url: "https://portfolio-demo.web.app",
    projectDate: "2024-12-15"
  },
  {
    title: "Launched a blog platform",
    description: "Designed and launched a blog CMS using Firestore and Bootstrap.",
    url: "https://blog-demo.web.app",
    projectDate: "2025-01-10"
  },
  {
    title: "Collaborated on a music app",
    description: "Worked on a full-stack music sharing platform with real-time features.",
    url: "https://musichub-demo.web.app",
    projectDate: "2025-02-20"
  },
  {
    title: "Hosted a live podcast series",
    description: "Produced a 6-part podcast focused on creative entrepreneurship.",
    url: "https://spotify.com/show/creative-voices",
    projectDate: "2025-03-05"
  },
  {
    title: "Created a YouTube mini doc",
    description: "Directed and edited a mini-documentary on streetwear culture.",
    url: "https://youtube.com/shorts/streetweardoc",
    projectDate: "2025-02-01"
  },
  {
    title: "Launched a creator merch store",
    description: "Built and launched an online merch store using Shopify and Printful.",
    url: "https://creator-merch.web.app",
    projectDate: "2024-11-22"
  },
  {
    title: "Ran a 7-day content challenge",
    description: "Hosted a content sprint to help new creators post daily for a week.",
    url: "https://contenthub.io/challenge7",
    projectDate: "2025-04-10"
  },
  {
    title: "Edited a viral TikTok series",
    description: "Created and edited a viral 5-part TikTok series on creative hustle.",
    url: "https://tiktok.com/@creatorvision",
    projectDate: "2025-03-21"
  },
  {
    title: "Released a Notion template pack",
    description: "Published a productivity + content planner for creators.",
    url: "https://notion.so/creator-pack",
    projectDate: "2024-12-01"
  },
  {
    title: "Built an IG Reel automation tool",
    description: "Built a simple automation to extract trending IG Reels audio.",
    url: "https://tools.contenthub.io/reel-audio-finder",
    projectDate: "2025-01-18"
  },
  {
    title: "Filmed a brand partnership vlog",
    description: "Produced a vlog documenting a behind-the-scenes brand shoot.",
    url: "https://youtube.com/watch?v=brandvlog001",
    projectDate: "2025-01-28"
  },
  {
    title: "Wrote a creator income guide",
    description: "Published a blog post breaking down 5 income streams for creators.",
    url: "https://blog.contenthub.io/income-guide",
    projectDate: "2025-02-09"
  },
  {
    title: "Built a digital resume page",
    description: "Created a modern, scrollable resume with embedded projects.",
    url: "https://resume-demo.web.app",
    projectDate: "2025-03-01"
  },
  {
    title: "Co-hosted a live collab workshop",
    description: "Facilitated a virtual event to pair creators for collab opportunities.",
    url: "https://eventbrite.com/e/collab-workshop",
    projectDate: "2025-02-13"
  },
  {
    title: "Launched a meme content page",
    description: "Grew a comedy meme account from 0 to 5k followers in 3 months.",
    url: "https://instagram.com/creator_memes",
    projectDate: "2024-10-19"
  },
  {
    title: "Published a storytelling course",
    description: "Designed and launched a 4-week course on digital storytelling.",
    url: "https://gumroad.com/l/storytelling",
    projectDate: "2025-04-02"
  },
  {
    title: "Started a weekly newsletter",
    description: "Launched a Substack covering creator tools + AI resources.",
    url: "https://creatordigest.substack.com",
    projectDate: "2025-01-06"
  },
  {
    title: "Curated a niche creator directory",
    description: "Built a discovery tool to connect creators by genre and location.",
    url: "https://creatormap.contenthub.io",
    projectDate: "2025-03-11"
  },
  {
    title: "Created a reel transition pack",
    description: "Designed and gave away free video transition effects for Reels.",
    url: "https://gumroad.com/l/reel-transitions",
    projectDate: "2025-02-04"
  },
  {
    title: "Made a short film with friends",
    description: "Shot and edited a 10-min short film with a team of 4.",
    url: "https://youtube.com/shortfilm-collab",
    projectDate: "2025-03-28"
  },
  {
    title: "Started a creative accountability group",
    description: "Organized a small peer group to meet weekly and share updates.",
    url: "https://discord.gg/creative-checkin",
    projectDate: "2025-01-15"
  },
  {
    title: "Built a micro-influencer media kit",
    description: "Designed a shareable pitch deck for securing brand deals.",
    url: "https://canva.com/influencer-kit",
    projectDate: "2025-02-25"
  },
  {
    title: "Contributed to a community zine",
    description: "Designed two pages for a visual zine with 10+ other creatives.",
    url: "https://zinehub.io/creatorsvol1",
    projectDate: "2024-11-05"
  },
  {
    title: "Dropped a digital photo preset pack",
    description: "Released a Lightroom preset pack with signature editing styles.",
    url: "https://sellfy.com/photo-presets",
    projectDate: "2025-01-23"
  },
  {
    title: "Built a creator booking page",
    description: "Integrated Calendly to simplify brand call scheduling.",
    url: "https://bookme-demo.web.app",
    projectDate: "2025-03-16"
  },
  {
    title: "Filmed a collab skit series",
    description: "Wrote and filmed comedy skits with 3 other creators.",
    url: "https://youtube.com/skitsquad",
    projectDate: "2025-02-12"
  },
  {
    title: "Launched a public resources hub",
    description: "Curated a Notion page for free tools and templates.",
    url: "https://notion.so/creator-tools-hub",
    projectDate: "2025-04-05"
  },
  {
    title: "Hosted a creator Q&A livestream",
    description: "Went live on IG to answer questions from aspiring creators.",
    url: "https://instagram.com/live/qna",
    projectDate: "2025-03-19"
  },
  {
    title: "Contributed to a group short story",
    description: "Wrote a 1,000-word piece as part of a collaborative fiction project.",
    url: "https://medium.com/creativefiction",
    projectDate: "2025-01-09"
  },
  {
    title: "Participated in a global collab reel",
    description: "Shot a 10-second clip as part of an international collab reel project.",
    url: "https://instagram.com/p/global-reel",
    projectDate: "2025-03-08"
  }
];



async function addProjectHistoryToUser(userId, {
  title,
  description,
  url = "",
  taggedUserIds = [],
  projectDate = new Date()
}) {
  if (!userId || !title || !description) {
    console.error("Missing required fields.");
    return;
  }

  const ref = collection(db, `users/${userId}/projectHistory`);

  await addDoc(ref, {
    title,
    description,
    url,
    taggedUserIds,
    projectDate: new Date(projectDate),
    createdAt: serverTimestamp()
  });

  console.log(`✅ Project history added to user: ${userId}`);
}

window.addProjectHistoryToUser  = addProjectHistoryToUser;


async function getDemoUserIds() {
  const q = query(collection(db, "users"), where("role", "==", "demo"));
  const snapshot = await getDocs(q);
  const ids = snapshot.docs.map(doc => doc.id);
  console.log("✅ Demo User IDs:", ids);
  return ids;
}

async function getExistingProjectTitles(userId) {
  const q = query(collection(db, `users/${userId}/projectHistory`));
  const snap = await getDocs(q);
  return snap.docs.map(doc => doc.data().title);
}

async function seedDemoUserProjects() {
  const demoUserIds = await getDemoUserIds();

  for (const userId of demoUserIds) {
    const existingTitles = await getExistingProjectTitles(userId);
    const otherUsers = demoUserIds.filter(id => id !== userId);

    // Shuffle and pick 2–3 unique new projects
    const shuffledProjects = [...projectTemplates].sort(() => 0.5 - Math.random());
    const uniqueProjects = shuffledProjects.filter(p => !existingTitles.includes(p.title));
    const selectedProjects = uniqueProjects.slice(0, Math.floor(Math.random() * 2) + 2);

    for (const project of selectedProjects) {
      const taggedUserIds = [];

      // Tag 1–2 other demo users randomly
      if (otherUsers.length) {
        const shuffled = [...otherUsers].sort(() => 0.5 - Math.random());
        taggedUserIds.push(...shuffled.slice(0, Math.floor(Math.random() * 2) + 1));
      }

      await addProjectHistoryToUser(userId, {
        ...project,
        taggedUserIds
      });
    }

    console.log(`📦 Seeded ${selectedProjects.length} projects for ${userId}`);
  }

  console.log("🎉 All demo users seeded with project history.");
}




/*
const ENABLE_PROJECT_SEEDING = true;

if (ENABLE_PROJECT_SEEDING) {
  window.addEventListener("DOMContentLoaded", () => {
    seedDemoUserProjects().catch(console.error);
  });
}

*/



async function seedDemoUserReviews() {
  const demoUserIds = await getDemoUserIds();

const sampleReviews = [
  {
    rating: 5,
    review: "Amazing collaborator! Communicated clearly and delivered on time.",
    collabType: "Video Project",
    projectLink: "https://demo-contenthub.com/project1"
  },
  {
    rating: 4,
    review: "Great work overall. A few bumps but we made it through!",
    collabType: "Podcast Interview",
    projectLink: "https://demo-contenthub.com/project2"
  },
  {
    rating: 5,
    review: "Super creative and motivated—loved working together!",
    collabType: "IG Reel Collaboration",
    projectLink: "https://demo-contenthub.com/project3"
  },
  {
    rating: 4,
    review: "Responsive and helpful. Would team up again!",
    collabType: "Music Video Edit",
    projectLink: "https://demo-contenthub.com/project4"
  },
  {
    rating: 5,
    review: "Went above and beyond! Top-tier professionalism.",
    collabType: "Brand Deal",
    projectLink: "https://demo-contenthub.com/project5"
  },
  {
    rating: 5,
    review: "Their energy brought the whole collab to life. So fun to work with!",
    collabType: "YouTube Collab",
    projectLink: "https://demo-contenthub.com/project6"
  },
  {
    rating: 4,
    review: "Loved their editing style. Clean transitions and creative cuts.",
    collabType: "Short Film",
    projectLink: "https://demo-contenthub.com/project7"
  },
  {
    rating: 5,
    review: "Helped boost my IG engagement big time. A real strategist.",
    collabType: "Instagram Takeover",
    projectLink: "https://demo-contenthub.com/project8"
  },
  {
    rating: 5,
    review: "Fast turnaround and clear communication. Would collab again.",
    collabType: "TikTok Duet",
    projectLink: "https://demo-contenthub.com/project9"
  },
  {
    rating: 4,
    review: "Delivered quality work, even under pressure. Respect!",
    collabType: "Ad Campaign",
    projectLink: "https://demo-contenthub.com/project10"
  },
  {
    rating: 5,
    review: "Concept to launch in under a week. Seriously impressive!",
    collabType: "Mini Course Launch",
    projectLink: "https://demo-contenthub.com/project11"
  },
  {
    rating: 5,
    review: "They made the content go viral. Real marketing chops!",
    collabType: "Viral Challenge",
    projectLink: "https://demo-contenthub.com/project12"
  },
  {
    rating: 4,
    review: "A solid partner and great with feedback loops.",
    collabType: "Reels Editing",
    projectLink: "https://demo-contenthub.com/project13"
  },
  {
    rating: 5,
    review: "Every clip they sent was gold. Excellent creative eye.",
    collabType: "Highlight Reel",
    projectLink: "https://demo-contenthub.com/project14"
  },
  {
    rating: 5,
    review: "Smart, chill, and super organized. Would collab again.",
    collabType: "Live Stream Event",
    projectLink: "https://demo-contenthub.com/project15"
  },
  {
    rating: 5,
    review: "Smoothest collab I've had in months. We crushed it.",
    collabType: "Tutorial Series",
    projectLink: "https://demo-contenthub.com/project16"
  },
  {
    rating: 4,
    review: "Very responsive and supportive during content creation.",
    collabType: "Behind-the-Scenes Feature",
    projectLink: "https://demo-contenthub.com/project17"
  },
  {
    rating: 5,
    review: "They added unexpected value to every phase of the project.",
    collabType: "Brand Partnership",
    projectLink: "https://demo-contenthub.com/project18"
  },
  {
    rating: 4,
    review: "Tons of insight and experience. Really elevated the content.",
    collabType: "Course Collaboration",
    projectLink: "https://demo-contenthub.com/project19"
  },
  {
    rating: 5,
    review: "Professional, reliable, and full of creative ideas.",
    collabType: "Content Planning Session",
    projectLink: "https://demo-contenthub.com/project20"
  },
  {
    rating: 5,
    review: "They crushed the voiceover and visuals. 🔥🔥🔥",
    collabType: "Promo Video",
    projectLink: "https://demo-contenthub.com/project21"
  },
  {
    rating: 5,
    review: "Quick, clean, and on-brand. Perfect execution.",
    collabType: "Media Kit Design",
    projectLink: "https://demo-contenthub.com/project22"
  },
  {
    rating: 4,
    review: "Great communicator and really got the brand tone.",
    collabType: "Podcast Guest Spot",
    projectLink: "https://demo-contenthub.com/project23"
  },
  {
    rating: 5,
    review: "Brought great vibes and ideas to our shoot day.",
    collabType: "Photoshoot Session",
    projectLink: "https://demo-contenthub.com/project24"
  },
  {
    rating: 5,
    review: "Scriptwriting was tight and witty—perfect for the audience.",
    collabType: "Script Collaboration",
    projectLink: "https://demo-contenthub.com/project25"
  },
  {
    rating: 4,
    review: "Tuned into my needs and helped shape the final product.",
    collabType: "Workshop Co-Host",
    projectLink: "https://demo-contenthub.com/project26"
  },
  {
    rating: 5,
    review: "A powerhouse on camera. Charisma + clarity = 💯",
    collabType: "Live Collab Stream",
    projectLink: "https://demo-contenthub.com/project27"
  },
  {
    rating: 4,
    review: "Solid editing work and great use of transitions.",
    collabType: "Social Media Ad",
    projectLink: "https://demo-contenthub.com/project28"
  },
  {
    rating: 5,
    review: "Creative genius and super humble. Rare combo.",
    collabType: "Creative Direction",
    projectLink: "https://demo-contenthub.com/project29"
  },
  {
    rating: 5,
    review: "Helped with outreach and content delivery. MVP.",
    collabType: "Community Campaign",
    projectLink: "https://demo-contenthub.com/project30"
  }
];


  for (const toUserId of demoUserIds) {
    const fromUserPool = demoUserIds.filter(id => id !== toUserId);
    const fromUsersShuffled = fromUserPool.sort(() => 0.5 - Math.random());
    const selectedFromUsers = fromUsersShuffled.slice(0, Math.floor(Math.random() * 2) + 2); // 2–3 reviews

    for (const fromUserId of selectedFromUsers) {
      // Fetch fromUser profile data
      const fromSnap = await getDoc(doc(db, "users", fromUserId));
      if (!fromSnap.exists()) continue;
      const fromUserData = fromSnap.data();

      // Pick random review template
      const review = sampleReviews[Math.floor(Math.random() * sampleReviews.length)];

      const reviewData = {
        fromUserId,
        toUserId,
        fromUserDisplayName:fromUserData.displayName,
        fromUserPhotoURL: fromUserData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png",
        rating: review.rating,
        review: review.review,
        collabType: review.collabType,
        projectLink: review.projectLink,
        submittedAt: Timestamp.now(),
        confirmedByTarget: true,
        approved: true
      };

      await addDoc(collection(db, `users/${toUserId}/reviews`), reviewData);
      console.log(`✅ Review from ${fromUserId} ➡ ${toUserId}`);
    }
  }

  console.log("🎯 All demo users seeded with reviews.");
}


/*
const ENABLE_REVIEW_SEEDING = true;

if (ENABLE_REVIEW_SEEDING) {
  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      seedDemoUserReviews().catch(console.error);
    }, 1000); // ⏱ wait for Firebase auth/init
  });
}


*/


/*
const demoPostTemplates = [
  { caption: "Launching my new creator site soon! Feedback welcome 🚀", type: "general" },
  { caption: "Looking for a music editor for my upcoming reel 🎶", type: "collab", projectGoal: "Music editor, reel experience" },
  { caption: "Can someone help me troubleshoot a Firebase rule error?", type: "help", projectGoal: "Firebase security rules" },
  { caption: "Just published a collab video with 3 amazing creators! 🎬", type: "general" },
  { caption: "Need a podcast intro jingle—any audio folks here? 🎧", type: "collab", projectGoal: "Audio producer or editor" },
  { caption: "What’s the best way to grow on Instagram in 2025? 🤔", type: "help" },
  { caption: "I finally launched my creator blog 💻 — excited for feedback!", type: "general" },
  { caption: "Looking for video scriptwriters to collab on skits 📜", type: "collab", projectGoal: "Creative writing, humor, Gen Z tone" },
  { caption: "What's your go-to content planning tool? 💡", type: "general" },
  { caption: "Need help fixing a layout bug in Bootstrap, who got me? 🛠️", type: "help", projectGoal: "CSS/Flexbox expert" },
  { caption: "Filmed my first cooking tutorial—nervous but excited! 🍳", type: "general" },
  { caption: "Looking for voice actors for my animated short 🎤", type: "collab", projectGoal: "Voice acting, animation sync" },
  { caption: "Having trouble connecting my domain to Firebase Hosting.", type: "help", projectGoal: "DNS and Firebase setup" },
  { caption: "Started a new IG Reels series—episode 1 out now!", type: "general" },
  { caption: "Need a motion graphics designer for 15-sec outro 🎞️", type: "collab", projectGoal: "After Effects or Canva Pro user" },
  { caption: "Best tips to stay consistent with posting? 📆", type: "help" },
  { caption: "Dropped a new spoken word piece 🎙️🔥", type: "general" },
  { caption: "Searching for a creative partner to launch a YouTube challenge series 🎥", type: "collab", projectGoal: "Creative YouTuber, good on camera" },
  { caption: "Why is my CSS animation not firing on scroll?", type: "help", projectGoal: "IntersectionObserver / CSS" },
  { caption: "My first mini-documentary is live now. Feedback welcome! 🎬", type: "general" },
  { caption: "Need a content strategist to help brainstorm TikTok series", type: "collab", projectGoal: "Growth-focused strategist" },
  { caption: "How do you price brand deals as a micro-influencer?", type: "help" },
  { caption: "I finally hit 1k followers! Appreciate you all 💯", type: "general" },
  { caption: "Looking for a UX designer to help with my creator dashboard", type: "collab", projectGoal: "UX audits, Figma wireframes" },
  { caption: "Need help choosing a payment system for my site 💸", type: "help", projectGoal: "Stripe vs. PayPal advice" },
  { caption: "Just tested out DaVinci Resolve for the first time 🎬", type: "general" },
  { caption: "Looking for a graphic designer to create podcast cover art 🎨", type: "collab", projectGoal: "Bold, modern branding" },
  { caption: "Stuck on how to create an Instagram carousel template 😩", type: "help", projectGoal: "Figma / Canva help" },
  { caption: "My first vlog is finally edited and posted! 🎥✂️", type: "general" },
  { caption: "Seeking someone to co-host a weekly live stream 🎙️", type: "collab", projectGoal: "Charisma, consistency" },
  { caption: "Why is my engagement dropping all of a sudden?", type: "help" },
  { caption: "New blog post: 5 Tools Every Creator Needs 🔧", type: "general" },
  { caption: "Looking for an accountability buddy for 30 days 💪", type: "collab", projectGoal: "Daily check-ins, positive vibes" },
  { caption: "Can someone help me create a link-in-bio landing page?", type: "help", projectGoal: "Webflow / Carrd / HTML" },
  { caption: "Weekly wins: finished a script, edited a video, posted 3x 🔥", type: "general" },
  { caption: "Need help with YouTube thumbnail design 🖼️", type: "collab", projectGoal: "CTR-optimized designer" },
  { caption: "Struggling to get my Mailchimp forms to trigger automation.", type: "help" },
  { caption: "Just did a collab with a brand and got reposted! 🙌", type: "general" },
  { caption: "Need an editor for a fast-turnaround promo clip ⏱️", type: "collab", projectGoal: "Quick, high-quality cut" },
  { caption: "What's the best no-code platform for client portfolios?", type: "help" },
  { caption: "Finally feel confident calling myself a 'creator' 💡", type: "general" },
  { caption: "Looking for a collab: 3 creators, 3 cities, 1 project 🌍", type: "collab", projectGoal: "Photographers or vloggers" },
  { caption: "Why does my TikTok audio not sync after upload?", type: "help" },
  { caption: "New free resource: my Notion content calendar template 📅", type: "general" },
  { caption: "Seeking a partner for a virtual event series 🎤", type: "collab", projectGoal: "Hosts, event marketing" },
  { caption: "Can't figure out why my analytics aren't showing views 🤔", type: "help" },
  { caption: "Just got featured in a local newsletter! 🎉", type: "general" },
  { caption: "Need a designer for a short animated explainer ✏️", type: "collab", projectGoal: "2D animation, clear visuals" },
  { caption: "Best video hosting site for free creators?", type: "help" },
  { caption: "Finally got my content batching system locked in 🔒", type: "general" },
  { caption: "Looking for a guest for my next podcast ep 🎙️", type: "collab", projectGoal: "Creative voice, unique story" },
  { caption: "How do you find trending audios early? 🔍", type: "help" },
  { caption: "Celebrating 100 videos uploaded! 📹💯", type: "general" },
  { caption: "Need someone to review my digital product landing page 💬", type: "collab", projectGoal: "Copywriting & conversion feedback" },
  { caption: "Why isn’t my Instagram link showing in bio?", type: "help" },
  { caption: "Posting my first YouTube Short today. Let’s go! 🎬", type: "general" },
  { caption: "Seeking a design partner for a merch line collab 👕", type: "collab", projectGoal: "Clothing designer / branding" },
  { caption: "What's the best time to post on Threads?", type: "help" },
  { caption: "I made my first 3D render today! 🧊", type: "general" },
  { caption: "Need a co-editor for a weekly gaming recap 🔥", type: "collab", projectGoal: "Quick turnaround, attention to detail" },
  { caption: "Any tips for setting up OBS for dual screens?", type: "help" },
  { caption: "New milestone: 1K newsletter subs! 🎉", type: "general" },
  { caption: "Seeking a lyricist to turn my poetry into music 🎶", type: "collab", projectGoal: "Lyric writing, flow" },
  { caption: "Why is my site loading slow on mobile?", type: "help" },
  { caption: "Today I tried AI voiceovers. Thoughts?", type: "general" },
  { caption: "Want to co-create a parody skit for TikTok? 🤡", type: "collab", projectGoal: "Scriptwriting, acting, editing" },
  { caption: "Need help making a transparent PNG in Canva 🖼️", type: "help" },
  { caption: "Shared my latest 1-minute doc—super proud of it 🎥", type: "general" },
  { caption: "Looking for a photographer to collab on a portrait reel 📸", type: "collab", projectGoal: "Moody, cinematic style" },
  { caption: "My video keeps getting flagged—why?", type: "help" },
  { caption: "Just found a new AI tool that helps write captions 🤖", type: "general" },
  { caption: "Seeking fashion creators for cross-platform collab 👠", type: "collab", projectGoal: "Instagram & TikTok creators" },
  { caption: "How do you track client invoices?", type: "help" },
  { caption: "Posted a new reel every day this week 😮‍💨", type: "general" },
  { caption: "Looking for someone to co-manage a meme page 😂", type: "collab", projectGoal: "Funny, fast content" },
  { caption: "Can't get my embeds to load on my site.", type: "help" },
  { caption: "Dropped a new song—produced it all myself 🎧", type: "general" },
  { caption: "Who wants to team up for a 24hr content challenge?", type: "collab", projectGoal: "Fast turn, creative ideas" },
  { caption: "What do I need to get verified on Threads?", type: "help" },
  { caption: "Just wrapped a 3-part docuseries—exhausted but proud 🧠", type: "general" },
  { caption: "Seeking voiceover artist for comedy skit series 🎤", type: "collab", projectGoal: "Fun, expressive voice" },
  { caption: "Can’t connect Google Analytics to my creator site.", type: "help" },
  { caption: "Today’s lesson: always back up your files 😩", type: "general" },
  { caption: "Want to do a creative TikTok duet? 🎭", type: "collab", projectGoal: "Actor/creator, fun energy" },
  { caption: "Need help writing a cold pitch for a brand email 📧", type: "help" },
  { caption: "Launched my first digital product today 🛍️", type: "general" },
  { caption: "Looking to collab on a 'day in the life' style edit 🎥", type: "collab", projectGoal: "Quick turn video" },
  { caption: "How do you grow a Discord server from scratch?", type: "help" },
  { caption: "Just wrapped a photo shoot with neon lights 🔦", type: "general" },
  { caption: "Need someone to help design YouTube channel banner 🎨", type: "collab", projectGoal: "Bold, clean aesthetic" },
  { caption: "Why does my mic sound staticky on Zoom?", type: "help" }
];


const demoPostTemplatesRaw = [
  { caption: "Launching my new creator site soon! Feedback welcome 🚀", type: "general" },
  { caption: "Let's build something amazing together 🌟", type: "general" },
  { caption: "Great things happen when we collaborate 💡", type: "general" },
  { caption: "Teaming up with incredible creators this week 🎨👥", type: "general" },
  { caption: "Dream it. Plan it. Build it. Together. 💭🛠️", type: "general" },
  { caption: "The best ideas come from collaboration 🤝", type: "general" },
  { caption: "Ready to connect and create 🔗✨", type: "general" },
  { caption: "If you want to go far, go together 🌍", type: "general" },
  { caption: "Behind every success is a great team 👏", type: "general" },
  { caption: "Finding my creative tribe online 🧠💬", type: "general" },
  { caption: "Pushing each other to do better 💪💬", type: "general" },
  { caption: "Helping others grow while growing myself 🌱🚀", type: "general" },
  { caption: "New collab dropping soon — stay tuned! 📢", type: "general" },
  { caption: "Grateful for every creator who's helped me grow 🙏", type: "general" },
  { caption: "Let’s combine our skills and make magic 🧩✨", type: "general" },
  { caption: "Learning so much from this amazing collab 🧠🔥", type: "general" },
  { caption: "One vision, many minds 🧠💡", type: "general" },
  { caption: "Working with others fuels my creativity 🎇", type: "general" },
  { caption: "Looking for creatives to build something meaningful 💬", type: "general" },
  { caption: "You never know who you'll meet when you reach out 🤝", type: "general" },
  { caption: "Together, we’re limitless ♾️", type: "general" },
  { caption: "Every collab is a chance to grow 🌱", type: "general" },
  { caption: "Energy is contagious — let's share it ⚡", type: "general" },
  { caption: "Inspired by those around me 🙌", type: "general" },
  { caption: "Success is better when it’s shared 🏆", type: "general" },
  { caption: "Creators supporting creators 🫶", type: "general" },
  { caption: "One project. Many talents. 🔥", type: "general" },
  { caption: "A rising tide lifts all boats ⛵", type: "general" },
  { caption: "Every connection brings new opportunities 🔗", type: "general" },
  { caption: "Creativity thrives in community 🎭", type: "general" },
  { caption: "Let's brainstorm something wild together 🧠⚡", type: "general" },
  { caption: "Solo is great. Team is better 🚀", type: "general" },
  { caption: "Don't compete — collaborate 🧩", type: "general" },
  { caption: "Shoutout to the amazing minds in this project 🎤", type: "general" },
  { caption: "Let’s turn ideas into reality — together 💭➡️🏗️", type: "general" },
  { caption: "Creating with good people = 🔥 results", type: "general" },
  { caption: "Every collab teaches me something new 📚", type: "general" },
  { caption: "Let’s start something epic together 📢", type: "general" },
  { caption: "Teamwork makes the dream work 💯", type: "general" },
  { caption: "Incredible things happen when creators unite 🎨🤝", type: "general" },
  { caption: "Found a dope partner for this next project 😎", type: "general" },
  { caption: "More minds = more momentum 🧠💨", type: "general" },
  { caption: "This platform helped me find real collaborators 💬", type: "general" },
  { caption: "Let’s help each other win 💪", type: "general" },
  { caption: "Big collab energy 🔥", type: "general" },
  { caption: "Stronger together — always 💫", type: "general" },
  { caption: "So proud of what our team created 🎉", type: "general" },
  { caption: "The internet connects the best minds 🌐🧠", type: "general" },
  { caption: "Every partner adds a new spark ✨", type: "general" },
  { caption: "This collab changed how I create 🙌", type: "general" },
  { caption: "Let’s make content that matters 🎬", type: "general" },
  { caption: "Ideas are better when shared 💡↔️", type: "general" },
  { caption: "Creativity has no borders 🌎", type: "general" },
  { caption: "Grateful to build with such talented people 🛠️❤️", type: "general" },
  { caption: "Iron sharpens iron ⚔️", type: "general" },
  { caption: "We’re building a movement, not just a project 💥", type: "general" },
  { caption: "Tag someone you want to collab with 🎯", type: "general" },
  { caption: "Who’s down to build something bold? 👀", type: "general" },
  { caption: "Creators of the world, let’s unite 🌍", type: "general" },
  { caption: "Working with people I admire = 💯", type: "general" },
  { caption: "It all starts with a message 💬", type: "general" },
  { caption: "Real ones collab, not compete 🔁", type: "general" },
  { caption: "Time to expand your creative circle 🌐", type: "general" },
  { caption: "Collab requests open 🎯", type: "general" },
  { caption: "Taking collaboration seriously this year 🎯🔥", type: "general" },
  { caption: "This platform has changed how I connect 🔗", type: "general" },
  { caption: "You bring the ideas, I’ll bring the execution 🛠️", type: "general" },
  { caption: "Every creator has something unique to give ✨", type: "general" },
  { caption: "Let’s build the next big thing 💡🚀", type: "general" },
  { caption: "Always open to new collab energy 💥", type: "general" },
  { caption: "Who’s your dream collaborator? Tag them below ⬇️", type: "general" },
  { caption: "Join me on this creator journey 🌈", type: "general" },
  { caption: "The most creative projects are team-built 🧠🧠", type: "general" },
  { caption: "Want to team up? Let’s chat 📩", type: "general" },
  { caption: "More magic. Less ego. More collabs 💫", type: "general" },
  { caption: "Building something special with my network 🔧", type: "general" },
  { caption: "One vision. One team. Endless potential 💡", type: "general" },
  { caption: "Doing it differently with a team I trust 🔁", type: "general" },
  { caption: "Collabs keep me motivated 🙌", type: "general" },
  { caption: "If you want to go fast, go alone. If you want to go far, go together 🛤️", type: "general" },
  { caption: "Connecting with creatives is my favorite part 🌐❤️", type: "general" },
  { caption: "Sharing wins, lessons, and momentum 🎯", type: "general" },
  { caption: "Every connection is a chance to grow 🌱", type: "general" },
  { caption: "Let’s connect and get creative ⚡", type: "general" },
  { caption: "Built online, made by real people 👥📲", type: "general" },
  { caption: "Got an idea? Let’s build it 💡💪", type: "general" },
  { caption: "From strangers to collaborators — love this journey 🧭", type: "general" },
  { caption: "Bringing visions to life with a crew 🧑‍🤝‍🧑", type: "general" },
  { caption: "Who’s building something dope this week? 🔥", type: "general" },
  { caption: "Creating something that feels bigger than me 🧠🌐", type: "general" },
  { caption: "Ready to level up with the right team 🎮🚀", type: "general" },
  { caption: "Everyone wins when we build together 🏗️🏆", type: "general" },
  { caption: "It takes a squad to do it right 🙌", type: "general" },
  { caption: "Finding my people one project at a time 🤝", type: "general" },
  { caption: "The energy from this collab is unmatched 🔋", type: "general" },
  { caption: "Not just making content — we’re making impact 💥", type: "general" },
  { caption: "The best part of creating is who you meet along the way 🚶‍♂️🚶‍♀️", type: "general" },
  { caption: "Don’t wait for the perfect time. Just start with someone. 👊", type: "general" }
,
  { caption: "Tired of doing it alone. I’m ready for real collaboration.", type: "general" },
  { caption: "No team, no budget — just pure vision. Let’s build.", type: "general" },
  { caption: "Not chasing clout. I want to build something that lasts.", type: "general" },
  { caption: "Real talk — I’m burnt out creating alone. Who’s building something real?", type: "general" },
  { caption: "If you're serious, let’s work. No egos, just execution.", type: "general" },
  { caption: "Everyone wants to shine. Few want to grind together.", type: "general" },
  { caption: "I don't need a fanbase — I need a crew.", type: "general" },
  { caption: "Not looking for likes. I’m looking for legacy.", type: "general" },
  { caption: "Sick of surface-level ‘collabs’. Let’s actually build.", type: "general" },
  { caption: "If you’ve been doubted, disrespected, or dismissed — I see you. Let’s rise.", type: "general" },
  { caption: "This isn’t hype. This is hunger.", type: "general" },
  { caption: "Alone, I survived. Together, we could win.", type: "general" },
  { caption: "It’s lonely creating in silence. Let’s make some noise together.", type: "general" },
  { caption: "Tired of gatekeepers. Let’s open our own doors.", type: "general" },
  { caption: "I don’t want credit. I want progress.", type: "general" },
  { caption: "They won’t share their seat at the table? Cool. Let’s build our own table.", type: "general" },
  { caption: "If you’ve ever been slept on, you’re not alone. Let’s wake 'em up.", type: "general" },
  { caption: "This is for the ones still creating even when no one’s watching.", type: "general" },
  { caption: "No degrees, no followers, no ‘blue check’. Just skill and drive.", type: "general" },
  { caption: "Not perfect. Not polished. Just passionate.", type: "general" },
  { caption: "If you don’t see a space for you — create it.", type: "general" },
  { caption: "Not begging to be seen. Just refusing to be silenced.", type: "general" },
  { caption: "I’ve failed more times than I’ve succeeded. Still building.", type: "general" },
  { caption: "Done waiting for approval. Let’s go.", type: "general" },
  { caption: "They’ll ignore you until you’re undeniable. Keep going.", type: "general" },
  { caption: "I don't need a stage — I need a squad.", type: "general" },
  { caption: "I know what it’s like to feel overlooked. That’s why I collab with heart.", type: "general" },
  { caption: "The best collabs don’t care about numbers — they care about the vision.", type: "general" },
  { caption: "No more fake hype. I want real work with real ones.", type: "general" },
  { caption: "This isn’t a trend. This is therapy.", type: "general" },
  { caption: "Trying to connect with others who’ve felt invisible. Let’s build loud.", type: "general" },
  { caption: "You ever feel like you're giving 110% into silence? Yeah, same.", type: "general" },
  { caption: "Not chasing viral. Chasing value.", type: "general" },
  { caption: "We all start at 0. But we don't have to stay there alone.", type: "general" },
  { caption: "I’m not the most popular. But I’m one of the most consistent.", type: "general" },
  { caption: "If you’re sick of small talk and want to build, hit me up.", type: "general" },
  { caption: "I don’t want a collab partner. I want someone who gives a damn.", type: "general" },
  { caption: "If you're still showing up, you're already ahead.", type: "general" },
  { caption: "You ever feel like quitting... but don’t? That’s your power.", type: "general" },
  { caption: "Here’s to the ones who keep creating with no cosign.", type: "general" },
  { caption: "This is raw. This is real. This is why I keep showing up.", type: "general" },
  { caption: "Burnout is real. Connection helps. Let’s talk.", type: "general" },
  { caption: "Don’t need permission. Just purpose.", type: "general" },
  { caption: "Let’s link with people who get it — no fluff.", type: "general" },
  { caption: "This ain't a flex. It's a fight to keep going.", type: "general" },
  { caption: "If you feel alone in this journey, you’re not. Let’s link.", type: "general" },
  { caption: "They won’t support you until it’s safe. Support yourself until then.", type: "general" },
  { caption: "Every post is a reminder: I'm still here. Still trying. Still building.", type: "general" },
  { caption: "Want to collab with people who believe in more than just numbers.", type: "general" }
];
*/



const insightfulPostTemplates = [
  { caption: "Every collaboration teaches me something new—even when it doesn’t go as planned.", type: "general" },
  { caption: "Creators: what’s something you wish you knew before starting your last collab?", type: "general" },
  { caption: "Not every idea needs to be perfect. Just real enough to start a conversation.", type: "general" },
  { caption: "Growth doesn’t come from the easy projects. It comes from the messy, real ones.", type: "general" },
  { caption: "Sometimes the best contribution isn’t doing more—it’s asking better questions.", type: "general" },
  { caption: "A good collaborator listens as much as they lead. Silence can be strategy.", type: "general" },
  { caption: "One person’s feedback helped shift my entire creative direction. Forever grateful.", type: "general" },
  { caption: "Just realized: I’ve learned more from collabs this month than I did in school last year.", type: "general" },
  { caption: "Creative conflict doesn’t mean failure. It means people care.", type: "general" },
  { caption: "You don’t need to know everything. You just need to know how to ask the right people.", type: "general" },
  { caption: "Making content is easy. Making meaningful content? That takes team trust.", type: "general" },
  { caption: "Some people bring skills. Some bring energy. Some bring both. Find those people.", type: "general" },
  { caption: "Most people just need a chance. Be the person who gives it.", type: "general" },
  { caption: "The goal isn’t to go viral. It’s to go real.", type: "general" },
  { caption: "A few good minds > a thousand empty likes.", type: "general" },
  { caption: "Collab tip: Set shared goals. Not just deadlines.", type: "general" },
  { caption: "What’s a mistake you made that helped you grow faster?", type: "general" },
  { caption: "Had a tough talk with a teammate today. It brought us closer. That’s growth.", type: "general" },
  { caption: "Not every follower will get it. Make content for the people who do.", type: "general" },
  { caption: "Every collab is a mirror. What are you learning about yourself?", type: "general" },
  { caption: "Deadlines matter. But so does mental health. Creators, check in with yourselves.", type: "general" },
  { caption: "You can tell a lot about someone by how they handle creative disagreements.", type: "general" },
  { caption: "Energy doesn’t lie. That’s why your collab team matters more than your equipment.", type: "general" },
  { caption: "When someone supports your vision without fully understanding it—that’s trust.", type: "general" },
  { caption: "Some posts will flop. Some will fly. Make them anyway.", type: "general" },
  { caption: "The hardest part of creating isn’t starting. It’s continuing when no one claps.", type: "general" },
  { caption: "The right feedback at the right time can change your whole path.", type: "general" },
  { caption: "What if success isn’t numbers, but alignment?", type: "general" },
  { caption: "Being real is harder than being polished. Be real anyway.", type: "general" },
  { caption: "Tired ≠ unproductive. Rest is creative strategy.", type: "general" },
  { caption: "Keep showing up. Consistency builds trust in yourself and others.", type: "general" },
  { caption: "The work speaks even when you don’t post it. Stay consistent.", type: "general" },
  { caption: "Best collab advice I ever got: Work with people, not their followers.", type: "general" },
  { caption: "Creators: What’s one mindset shift that changed how you show up?", type: "general" },
  { caption: "Let go of ego. Make space for shared genius.", type: "general" },
  { caption: "Sometimes your idea is just waiting for the right partner to unlock it.", type: "general" },
  { caption: "Not everyone will get the vision. Build with the ones who do.", type: "general" },
  { caption: "When you find people who challenge you and cheer for you—keep them.", type: "general" },
  { caption: "The internet is noisy. Insight is quiet. Share it anyway.", type: "general" },
  { caption: "Today I almost gave up. But I remembered why I started.", type: "general" },
  { caption: "No is part of the journey. Don’t let it be the end.", type: "general" },
  { caption: "What’s your real goal—attention, impact, or legacy?", type: "general" },
  { caption: "If you want to go far, build with people who hold you accountable.", type: "general" },
  { caption: "Trust is earned in small moments. Keep showing up.", type: "general" },
  { caption: "Collab mindset: Less ego. More empathy.", type: "general" },
  { caption: "Being seen is powerful. Seeing others is a superpower.", type: "general" },
  { caption: "Creativity is brave. So is asking for help.", type: "general" },
  { caption: "Share the journey, not just the results. People connect to process.", type: "general" },
  { caption: "You won’t always be motivated. That’s why habits matter.", type: "general" },
  { caption: "It’s okay to pause. Just don’t quit.", type: "general" }
];


async function seedDemoUserPosts() {
  const demoUsersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "user")));
  const demoUsers = demoUsersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const usedCaptions = new Set();
  const availablePosts = [...insightfulPostTemplates].sort(() => 0.5 - Math.random());

  let postIndex = 0; // Used to control daily posting spread

  for (let dayOffset = 0; dayOffset < 21; dayOffset++) {
    const postDateBase = new Date();
    postDateBase.setDate(postDateBase.getDate() + dayOffset);

    for (const user of demoUsers) {
      if (availablePosts.length === 0) break;

      // Pull the next unique post
      let post;
      do {
        post = availablePosts.pop();
      } while (usedCaptions.has(post.caption) && availablePosts.length > 0);

      if (!post || usedCaptions.has(post.caption)) continue;
      usedCaptions.add(post.caption);

      // Random hour and minute for scheduling time
      const hour = Math.floor(Math.random() * 24);     // 0–23
      const minute = Math.floor(Math.random() * 60);   // 0–59
      const second = Math.floor(Math.random() * 60);   // Add randomness to seconds too

      const scheduledDate = new Date(postDateBase);
      scheduledDate.setHours(hour, minute, second, 0);

      const timestamp = Timestamp.fromDate(scheduledDate);

      const likes = Math.floor(Math.random() * 10);
      const helpful = Math.floor(Math.random() * 5);
      const interested = Math.floor(Math.random() * 7);

      const docData = {
        owner: user.id,
        caption: post.caption,
        tags: [...(post.caption.match(/#(\w+)/g) || [])].map(t => t.slice(1)),
        contributors: [],
        media: [],
        likes,
        helpful,
        status: "active",
        interested,
        views: Math.floor(likes * 2.5),
        type: post.type,
        projectGoal: post.projectGoal || null,
        createdAt: timestamp,
        scheduledAt: timestamp,
      };

      await addDoc(collection(db, "posts"), docData);
      console.log(`✅ Day ${dayOffset + 1}: Seeded post for ${user.displayName || user.id}: "${post.caption}"`);
    }
  }

  console.log("📢 Finished seeding scheduled daily posts for 3 weeks.");
}

/*
window.addEventListener("DOMContentLoaded", () => {
  const ENABLE_DEMO_POST_SEEDING = true;
  if (ENABLE_DEMO_POST_SEEDING) {
    seedDemoUserPosts().catch(console.error);
  }
});

*/
function getRandomTimestampWithinDays(daysRange = 21, inFuture = false) {
  const now = new Date();
  const offsetMs = Math.random() * daysRange * 24 * 60 * 60 * 1000;
  const randomDate = new Date(now.getTime() + (inFuture ? offsetMs : -offsetMs));

  // Random hour, minute, second
  const hour = Math.floor(Math.random() * 24);
  const minute = Math.floor(Math.random() * 60);
  const second = Math.floor(Math.random() * 60);
  randomDate.setHours(hour, minute, second, 0);

  return Timestamp.fromDate(randomDate);
}

async function updateAllPosts() {
  const usersSnap = await getDocs(query(collection(db, "users"), where("role", "==", "user")));
  
  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;

    // Get all posts by this user
    const postsSnap = await getDocs(query(collection(db, "posts"), where("owner", "==", userId)));

    for (const postDoc of postsSnap.docs) {
      const post = postDoc.data();
      const shouldSchedule = Math.random() < 0.3;

      const createdAt = getRandomTimestampWithinDays(21, false); // past
      const scheduledAt = shouldSchedule ? getRandomTimestampWithinDays(21, true) : null;

      const updateData = {
        createdAt,
        scheduledAt,
      };

      if (!post.status) {
        updateData.status = "active";
      }

      await updateDoc(doc(db, "posts", postDoc.id), updateData);
      console.log(`✅ Updated post ${postDoc.id} for user ${userId}`);
    }
  }

  console.log("📢 All posts updated with createdAt, scheduledAt, and fallback status.");
}

//updateAllPosts().catch(console.error);


async function awardPointsToDemoUsers() {
  const usersRef = collection(db, "users");
  const demoUsersQuery = query(usersRef, where("role", "==", "demo"));
  const snap = await getDocs(demoUsersQuery);

  if (snap.empty) {
    console.log("No demo users found.");
    return;
  }

  for (const docSnap of snap.docs) {
    const userId = docSnap.id;
    const randomPoints = Math.floor(Math.random() * 151) + 150; // 150 to 300
    await updateDoc(doc(db, "users", userId), {
      points: increment(randomPoints)
    });
    console.log(`✅ Gave ${randomPoints} points to ${userId}`);
  }

  console.log("🎉 Finished awarding points to demo users.");
}
///awardPointsToDemoUsers();






