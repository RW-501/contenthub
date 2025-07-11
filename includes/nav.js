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
  getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ✅ Import your Firebase app config
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
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
  avatar.dataset.displayname = userData.displayName || "";
  avatar.dataset.photo = userData.photoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png";
  avatar.dataset.username = userData.username || "";
  avatar.dataset.email = user.email || "";
  avatar.dataset.location = userData.userLocation?.city || "";
  avatar.dataset.niches = (userData.niches || []).join(",");
  avatar.dataset.pronouns = userData.pronouns || "";

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
  special: "🌟"
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

      let tiles = "";
      for (const task of completedTasks) {
        tiles += renderBadgeTile(task, true, completedMap);
      }
      if (next) {
        tiles += renderBadgeTile(next, false, completedMap);
        if (!globalNext) globalNext = next;
      }

      section.innerHTML = sectionHeader + `<div class="row row-cols-2 row-cols-sm-3 row-cols-md-4 g-3">${tiles}</div>`;
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

  // Create DOM element
  const div = document.createElement("div");
  div.className = `col badge-tile ${badgeType} ${earnedClass}`;
  div.innerHTML = `
    <div class="badge-icon">${badgeIcons[task.type] || "🎖️"}</div>
    <div class="badge-name">${task.reward.badge}</div>
    <div class="badge-type">${task.type}</div>
    <div class="badge-points text-muted small">${task.reward.points} pts</div>
    ${completedDate}
  `;

  div.addEventListener("click", () => showBadgeDetail(task, isDone));

  return div.outerHTML;
}

function showBadgeDetail(task, isDone) {
  console.log("????????????????????????????/");
  
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
