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
onAuthStateChanged(auth, async user => {
  if (user) {
    document.getElementById("signupBtn").classList.add("d-none");
    document.getElementById("userAvatar").classList.remove("d-none");

    const avatar = user.photoURL || "/assets/default-avatar.png";
    document.getElementById("avatarImg").src = avatar;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists() && snap.data().admin === true) {
      document.getElementById("adminLink").style.display = "block";
    }
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
