// ✅ Import Auth only
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// ✅ Import Firestore functions separately
import {
  getFirestore,
  doc,
  getDoc, 
   collection, addDoc, onSnapshot, updateDoc,  serverTimestamp, query, orderBy 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ✅ Import your Firebase app config
import { confetti, app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
import { sendNotification, NOTIFICATION_TEMPLATES, markAllNotificationsRead, rewardTasks } from "https://rw-501.github.io/contenthub/includes/notifications.js";

// ✅ Init services
const auth = getAuth(app);
const db = getFirestore(app);


const currentPath = location.pathname.replace(/\/$/, '').toLowerCase();

// Highlight current page
const navLinks = document.querySelectorAll('#navLinks .nav-link');
navLinks.forEach(link => {
  const href = link.getAttribute('href').replace(/\/$/, '').toLowerCase();
  if (currentPath.includes(href)) link.classList.add('active');
});

let role = '';
// Auth handling
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("signupBtn").classList.add("d-none");
    document.getElementById("userAvatar").classList.remove("d-none");

    const avatar = user.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
    document.getElementById("avatarImg").src = avatar;

    try {
const userRef = doc(db, "users", user.uid);
const snap = await getDoc(userRef);

const avatar = document.getElementById("userAvatar");

if (snap.exists()) {
  const userData = snap.data();

  // Show admin link if needed
  if (userData.role === "admin") {
    document.getElementById("adminLink").style.display = "block";
  } else {
    document.getElementById("adminLink").style.display = "none";
  }

  // Cache in DOM
  avatar.dataset.uid = user.uid;
  avatar.dataset.role = userData.role || "";
  avatar.dataset.displayName = userData.displayName || "";
  avatar.dataset.photo = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
  avatar.dataset.username = userData.username || "";
  avatar.dataset.email = user.email || "";
  avatar.dataset.location = userData.userLocation?.city || "";
  avatar.dataset.niches = (userData.niches || []).join(",");
  avatar.dataset.pronouns = userData.pronouns || "";

  role = userData.role;
  // Set avatar image
  document.getElementById("avatarImg").src = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";

  // Show avatar
  avatar.classList.remove("d-none");

} else {
  document.getElementById("adminLink").style.display = "none";
}

    } catch (error) {
      console.error("Error fetching user data:", error);
      document.getElementById("adminLink").style.display = "none";
    }
  } else {
    // User not logged in, reset UI accordingly
    document.getElementById("signupBtn").classList.remove("d-none");
    document.getElementById("userAvatar").classList.add("d-none");
    document.getElementById("adminLink").style.display = "none";
  }
});

// Logout
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "https://rw-501.github.io/contenthub/";
});


function loadAuthScript() {
  const existing = document.querySelector('script[src="https://rw-501.github.io/contenthub/js/auth.js"]');
  if (existing) return;

  const script = document.createElement('script');
  script.src = "https://rw-501.github.io/contenthub/js/auth.js";
  script.type = "module";  // 💥 THIS IS REQUIRED
  document.head.appendChild(script);
}

// Load it when needed
loadAuthScript();


window.showModal = function({
  title = "Notice",
  message = "",
  confirmText = null,
  cancelText = null,
  onConfirm = null,
  onCancel = null,
  autoClose = null // in ms
}) {
  const modalEl = document.getElementById("reusableModal");
  const titleEl = document.getElementById("reusableModalTitle");
  const bodyEl = document.getElementById("reusableModalBody");
  const footerEl = document.getElementById("reusableModalFooter");

  // Set content
  titleEl.textContent = title;
  bodyEl.innerHTML = message;
  footerEl.innerHTML = ""; // Clear previous buttons

// Cancel button
if (cancelText) {
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "btn btn-secondary";
  cancelBtn.textContent = cancelText;
  cancelBtn.addEventListener("click", () => {
    if (onCancel) onCancel();

    // Accessibility fix
    modalEl.setAttribute("aria-hidden", "true");

    bootstrap.Modal.getInstance(modalEl)?.hide();
  });
  footerEl.appendChild(cancelBtn);
}

// Confirm button
if (confirmText) {
  const confirmBtn = document.createElement("button");
  confirmBtn.className = "btn btn-primary";
  confirmBtn.textContent = confirmText;
  confirmBtn.addEventListener("click", () => {
    if (onConfirm) onConfirm();

    // Accessibility fix
    modalEl.setAttribute("aria-hidden", "true");

    bootstrap.Modal.getInstance(modalEl)?.hide();
  });
  footerEl.appendChild(confirmBtn);
}


// Ensure modal is not hidden to assistive tech
modalEl.setAttribute("aria-hidden", "false");

let bsModal = bootstrap.Modal.getInstance(modalEl);
if (!bsModal) bsModal = new bootstrap.Modal(modalEl);

// Focus first focusable element after modal is shown
modalEl.addEventListener("shown.bs.modal", () => {
const focusTarget = modalEl.querySelector(
  'button:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
);
  if (focusTarget) focusTarget.focus();
}, { once: true });

// Show the modal once
bsModal.show();


  // Auto-close after timeout
if (autoClose) {
  setTimeout(() => {
    if (document.activeElement && modalEl.contains(document.activeElement)) {
      // Move focus to body or another safe element before hiding the modal
      document.activeElement.blur();
    }

    modalEl.setAttribute("aria-hidden", "true");
bootstrap.Modal.getInstance(modalEl)?.hide();

// Cleanup for scrollbar/overlay issue
document.body.classList.remove('modal-open');
document.body.style.overflow = '';
document.body.style.paddingRight = '';
  }, autoClose);
}

};

/*
showModal({
  title: "Success!",
  message: "Your post was submitted.",
  autoClose: 3000
});

showModal({
  title: "Delete Post?",
  message: "Are you sure you want to delete this post? This cannot be undone.",
  confirmText: "Delete",
  cancelText: "Cancel",
  onConfirm: () => {
    // handle delete
  }
});

showModal({
  title: "Verification Required",
  message: "<p>Please verify your email before continuing.</p>",
  confirmText: "Resend Email",
  cancelText: "Close",
  onConfirm: () => resendVerificationEmail()
});


*/

const badgeIcons = { 
  post: "📝",
  feedback: "💬",
  referral: "🔗",
  collab: "🤝",
  dailyLogin: "📅",
  profile: "👤",
  viewsGiven: "🔍",
  viewsReceived: "👁️",
  reaction: "⭐",
  special: "🌟",
  commentMade: "💬"
};



async function loadRewardModal() {
  const user = auth.currentUser;
  if (!user) return;

  const uid = user.uid;
  const userSnap = await getDoc(doc(db, "users", uid));
  const userData = userSnap.exists() ? userSnap.data() : {};

  const completed = userData.rewardsCompleted || [];
  const points = userData.points || 0;

  const header = document.getElementById("rewardsModalLabel");
  header.innerHTML = `🎖️ Your Rewards & Badges <span class="text-warning fw-normal">(${points} pts)</span>`;

  const grid = document.getElementById("rewardGrid");
  grid.innerHTML = "";

  const nextTaskElement = document.getElementById("nextTask");
  nextTaskElement.innerHTML = "";

  const grouped = {};
  rewardTasks.forEach(task => {
    if (!grouped[task.type]) grouped[task.type] = [];
    grouped[task.type].push(task);
  });

  // Prepare map of completed dates
  const completedMap = {};
  rewardTasks.forEach(task => {
    if (completed.includes(task.id)) {
      const date = userData.badges?.[task.type]?.lastEarned?.toDate?.();
      if (date) completedMap[task.id] = date;
    }
  });

  let globalNext = null;

  for (const type in grouped) {
    const tasks = grouped[type];
    tasks.sort((a, b) => {
      const aVal = a.condition[Object.keys(a.condition)[0]] ?? 0;
      const bVal = b.condition[Object.keys(b.condition)[0]] ?? 0;
      return aVal - bVal;
    });

    const completedTasks = tasks.filter(t => completed.includes(t.id));
    const uncompletedTasks = tasks.filter(t => !completed.includes(t.id));
    const next = uncompletedTasks[0];

    if (completedTasks.length > 0 || next) {
      const section = document.createElement("div");
      section.className = "col-12 mb-4";

      const progress = Math.round((completedTasks.length / tasks.length) * 100);
      const sectionHeader = `
        <h6 class="text-uppercase text-secondary fw-bold mb-2">${type}</h6>
        <div class="progress mb-2" style="height: 6px;">
          <div class="progress-bar" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
        </div>
        <div class="small text-muted mb-2">${completedTasks.length}/${tasks.length} completed</div>
      `;

let row = document.createElement("div");
row.className = "row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3";

for (const task of completedTasks) {
  row.appendChild(renderBadgeTile(task, true, completedMap));
}

if (next) {
  row.appendChild(renderBadgeTile(next, false, completedMap));
  if (!globalNext) globalNext = next;
}

section.innerHTML = sectionHeader;
section.appendChild(row);
grid.appendChild(section);

    }
  }

  nextTaskElement.innerHTML = globalNext
    ? `🎯 <strong>${globalNext.reward.badge}</strong> — ${Object.entries(globalNext.condition)[0].join(": ")}`
    : "🏆 All rewards completed!";
}


 function renderBadgeTile(task, isDone, completedMap = {}) {
  const icon = isDone ? "🏅" : "🔓";
  const badgeType = `badge-type-${task.type}`;
  const earnedClass = isDone ? "earned" : "";

  const completedDate = isDone && completedMap[task.id]
    ? `<div class="badge-date text-success small">Earned: ${new Date(completedMap[task.id]).toLocaleDateString()}</div>`
    : "";

  const div = document.createElement("div");
  div.className = `col badge-tile ${badgeType} ${earnedClass}`;
  div.setAttribute("data-task-id", task.id);
  div.innerHTML = `
    <div class="badge-icon">${badgeIcons[task.type] || "🎖️"}</div>
    <div class="badge-name">${task.reward.badge}</div>
    <div class="badge-type">${task.type}</div>
    <div class="badge-points small">${task.reward.points} pts</div>
    ${completedDate}
  `;

  div.addEventListener("click", () => {
        // Confetti
    confetti({
      particleCount: 320,
      spread: 90,
      origin: { y: 0.6 }
    });

    showBadgeDetail(task, isDone);
  });

  return div; // return the actual DOM node
}

function fireworks() {
  confetti({
    particleCount: 20,
    startVelocity: 30,
    spread: 360,
    origin: { x: Math.random(), y: Math.random() }
  });
}
/*
const duration = 2 * 1000;
const interval = setInterval(fireworks, 250);
setTimeout(() => clearInterval(interval), duration);
*/
function showBadgeDetail(task, isDone) {

  const detail = document.getElementById("badgeDetailContent");
  const cond = Object.entries(task.condition)[0];
  detail.innerHTML = `
    <h5>${task.reward.badge}</h5>
    <p><strong>Type:</strong> ${task.type}</p>
    <p><strong>Points:</strong> ${task.reward.points}</p>
    <p><strong>Condition:</strong> ${cond[0]} ≥ ${cond[1]}</p>
    <p><strong>Status:</strong> ${isDone ? "✅ Earned" : "🔓 Locked"}</p>
  `;
  const modal = new bootstrap.Modal(document.getElementById("badgeDetailModal"));
  modal.show();
}

window.showBadgeDetail = showBadgeDetail;



document.getElementById("viewRewardsBtn")?.addEventListener("click", () => {
  loadRewardModal();
});




// 🌐 Get IP + Geo Location
async function getGeoData() {
  const res = await fetch("https://ipapi.co/json");
  return await res.json();
}

async function logAnalytics() {
  const geo = await getGeoData();

  await addDoc(collection(db, "analyticsLogs"), {
    pageUrl: window.location.href,
    ip: geo.ip,
    location: `${geo.city}, ${geo.region}, ${geo.country_name}`,
    deviceTime: new Date().toLocaleString(),
    timestamp: serverTimestamp(),
    userAgent: navigator.userAgent
  });

//  console.log("[Analytics] Logged successfully.");
}

setTimeout(() => {
  if(role == "user"){
logAnalytics();
  }
}, 2000);








function timeSince(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  const units = [
    { label: "yr", value: 31536000 },
    { label: "mo", value: 2592000 },
    { label: "d", value: 86400 },
    { label: "h", value: 3600 },
    { label: "m", value: 60 },
    { label: "s", value: 1 }
  ];
  for (const unit of units) {
    const interval = Math.floor(seconds / unit.value);
    if (interval >= 1) return `${interval}${unit.label}`;
  }
  return "now";
}



let currentUser = null;

// Toggle Chat UI
function toggleChat() {
  document.getElementById("chatContainer").classList.toggle("d-none");
}
window.toggleChat = toggleChat;

// Handle Open Chat Button
document.getElementById("openChatBtn").addEventListener("click", () => {
  
    toggleChat();
    initChat();
  
});

// Monitor Auth State
onAuthStateChanged(auth, user => {
  currentUser = user;
});

// Profanity Filter List
const bannedWords = [
  "badword1",
  "badword2",
  "badword3",
  "damn",
  "hell",
  "shit",
  "fuck",
  "bitch",
  "asshole",
  "bastard",
  "slut",
  "dick",
  "pussy",
  "nigger",
  "faggot",
  "cunt"
];

function filterProfanity(text) {
  const regex = new RegExp(bannedWords.join("|"), "gi");
  return text.replace(regex, "****");
}

function toggleUserList() {
  const chatUserList = document.getElementById("chatUserList");
  const chatMessages = document.getElementById("chatMessages");
  const chatSettings = document.getElementById("chatSettings");

  chatUserList.classList.remove("d-none");
  chatMessages.classList.add("d-none");
  chatSettings.classList.add("d-none");

    const avatar = document.getElementById("userAvatar");
  viewerUserId = avatar.dataset.uid;
  viewerUsername = avatar.dataset.username || avatar.dataset.displayName;
  viewerUserPhotoURL = avatar.dataset.photo || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
  viewerRole = avatar.dataset.role || "user";

  document.getElementById("currentUserAvatar").src = viewerUserPhotoURL;
  document.getElementById("currentUserName").textContent = viewerUsername || "Anonymous";

 
}
window.toggleUserList = toggleUserList;

function toggleChatSettings() {
  const chatSettings = document.getElementById("chatSettings");
  const chatMessages = document.getElementById("chatMessages");
  const chatUserList = document.getElementById("chatUserList");

  chatSettings.classList.remove("d-none");
  chatMessages.classList.add("d-none");
  chatUserList.classList.add("d-none");


}
window.toggleChatSettings = toggleChatSettings;

function showChatMessages() {
  document.getElementById("chatMessages").classList.remove("d-none");
  document.getElementById("chatUserList").classList.add("d-none");
  document.getElementById("chatSettings").classList.add("d-none");
}
window.showChatMessages = showChatMessages;


let viewerUserId, viewerUsername, viewerUserPhotoURL, viewerRole;

let chatListenerUnsub = null;

async function initChat() {

  
  if (!currentUser) {
    document.getElementById("auth-login").classList.remove("d-none");
   // return;
  }

  if (chatListenerUnsub) return; // prevent multiple listeners

  const avatar = document.getElementById("userAvatar");
  viewerUserId = avatar.dataset.uid;
  viewerUsername = avatar.dataset.username || avatar.dataset.displayName;
  viewerUserPhotoURL = avatar.dataset.photo || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
  viewerRole = avatar.dataset.role || "user";

  document.getElementById("currentUserAvatar").src = viewerUserPhotoURL;
  document.getElementById("currentUserName").textContent = viewerUsername || "Anonymous";

  const chatRef = collection(db, "chatRoom");
  const q = query(chatRef, orderBy("timestamp", "asc"));

  const openChatBtn = document.getElementById("openChatBtn");
  const chatMessages = document.getElementById("chatMessages");
  const recentUsersEl = document.getElementById("recentUsers");

  chatListenerUnsub = onSnapshot(q, async snapshot => {
    chatMessages.innerHTML = "";
    recentUsersEl.innerHTML = "";

    const recentUserIds = new Set();
    const pinnedMessages = [];
    const normalMessages = [];
    let mentionedYou = false;

    for (const docSnap of snapshot.docs) {
      const msg = docSnap.data();
      const docId = docSnap.id;
      const isMe = msg.uid === viewerUserId;

      if (msg.status === "deleted") continue;

      const mentioned = msg.text.includes(`@${viewerUsername}`);
      const notSeen = msg.mentionSeen?.[viewerUsername] === false;

      if (mentioned && notSeen) mentionedYou = true;

      const userDoc = await getDoc(doc(db, "users", msg.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const avatarURL = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
      const displayName = userData.displayName || userData.username || msg.uid;

      const safeMsg = convertLinks(msg.text);
      const timeAgo = msg.timestamp?.toDate() ? timeSince(msg.timestamp.toDate()) + " ago" : "Just now";

      const canDelete = isMe || viewerRole === "admin";
      const deleteBtn = canDelete ? `<button class="btn btn-sm btn-danger btn-delete ms-1" data-id="${docId}">🗑️</button>` : "";
      const pinBtn = viewerRole === "admin" ? `<button class="btn btn-sm btn-warning btn-pin ms-1" data-id="${docId}">📌</button>` : "";

      const messageEl = document.createElement("div");
      messageEl.className = `d-flex ${isMe ? "justify-content-end" : "justify-content-start"} my-2`;

      messageEl.innerHTML = `
        <div class="d-flex align-items-start">
          <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${msg.uid}" target="_blank">
            <img src="${avatarURL}" alt="avatar" class="rounded-circle me-2" style="width: 36px; height: 36px;" />
          </a>
        </div>
        <div class="message-content">
          <span 
            class="badge ${isMe ? "bg-primary" : msg.pinned ? "bg-warning text-dark" : "bg-secondary"} message-bubble d-block mb-1" 
            data-time="${timeAgo}" style="cursor: pointer;">
            <strong><a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${msg.uid}" class="text-white text-decoration-none">${displayName}</a></strong><br/>
            ${safeMsg}
          </span>
          <div class="small d-none text-muted time-info">${timeAgo} 
            <button class="btn btn-sm btn-outline-light btn-like">
            <span class="badge bg-danger">🔥 ${msg.heart || 0}</span></button>
            ${deleteBtn} ${pinBtn}
          </div>
        </div>
      `;

      messageEl.querySelector(".message-bubble").addEventListener("click", () => {
        messageEl.querySelector(".time-info").classList.toggle("d-none");
      });

      if (mentioned && notSeen) {
        await updateDoc(doc(db, "chatRoom", docId), {
          [`mentionSeen.${viewerUsername}`]: true
        });
      }

      const deleteBtnEl = messageEl.querySelector(".btn-delete");
      if (deleteBtnEl) {
        deleteBtnEl.addEventListener("click", async () => {
          if (confirm("Remove this message?")) {
            await updateDoc(doc(db, "chatRoom", deleteBtnEl.dataset.id), { status: "deleted" });
          }
        });
      }

      const pinBtnEl = messageEl.querySelector(".btn-pin");
      if (pinBtnEl) {
        pinBtnEl.addEventListener("click", async () => {
          await updateDoc(doc(db, "chatRoom", pinBtnEl.dataset.id), { pinned: true });
        });
      }

      if (msg.pinned) pinnedMessages.push(messageEl);
      else normalMessages.push(messageEl);

      recentUserIds.add(msg.uid);
    }

    if (mentionedYou) openChatBtn.classList.add("blink");
    else openChatBtn.classList.remove("blink");

    [...pinnedMessages, ...normalMessages].forEach(el => chatMessages.appendChild(el));

    for (const uid of recentUserIds) {
      if (uid === viewerUserId) continue;
      const uDoc = await getDoc(doc(db, "users", uid));
      if (!uDoc.exists()) continue;
      const uData = uDoc.data();
      const photo = uData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
      recentUsersEl.innerHTML += `
        <li class="d-flex align-items-center mb-2">
          <img src="${photo}" class="rounded-circle me-2" width="32" height="32" />
          <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${uid}" class="text-decoration-none">${uData.displayName || uid}</a>
        </li>
      `;
    }

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

  document.getElementById("chatInput").addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault(); // Prevent new line if Enter pressed
    document.getElementById("sendBtn").focus();
  }
});



// Send Message
document.getElementById("sendBtn").addEventListener("click", async () => {
  if (!currentUser) {
    document.getElementById("auth-login").classList.remove("d-none");
    return;
  }

  const input = document.getElementById("chatInput");
  let message = input.value.trim();
  if (!message) return;

  message = filterProfanity(message);

  const mentionedUsernames = Array.from(message.matchAll(/@(\w+)/g)).map(m => m[1]);
  const mentionSeen = {};
  mentionedUsernames.forEach(name => (mentionSeen[name] = false));
  mentionSeen[viewerUsername] = true;

  await addDoc(collection(db, "chatRoom"), {
    uid: viewerUserId,
    uPhoto: viewerUserPhotoURL,
    uName: viewerUsername,
    uRole: viewerRole,
    text: message,
    timestamp: serverTimestamp(),
    mentionSeen,
    heart: 0,
    pinned: false,
    status: "active"
  });

  input.value = "";
});

function convertLinks(text) {
  return text.replace(
    /(https?:\/\/[^\s]+)/g,
    url => `<a href="${url}" target="_blank" class="text-light text-decoration-underline">${url}</a>`
  );
}