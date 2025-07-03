import {
  getAuth, onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

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
    document.getElementById("loginBtn").classList.add("d-none");
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
  location.href = "/";
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
