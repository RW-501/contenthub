import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  getDoc,
  doc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import confetti from 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.module.mjs';


const firebaseConfig = {
  apiKey: "AIzaSyALJLxSJthWI2tnQZ-WnK1DDQNEelUCr7s",
  authDomain: "content-hub-11923.firebaseapp.com",
  projectId: "content-hub-11923",
  storageBucket: "content-hub-11923.appspot.com",
  messagingSenderId: "1021963959280",
  appId: "1:1021963959280:web:68155134c25cc38dcdfb35",
  measurementId: "G-6G9VXCGFTG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (user) {
  

    const userSnap = await getDoc(doc(db, "users", user.uid));
    const data = userSnap.data();

    const safeUserData = {
      uid: user.uid,
      displayName: data.displayName || "",
      photoURL: data.photoURL || "",
      bio: data.bio || ""
    };

    window.currentUserData = safeUserData;
    localStorage.setItem("currentUserData", JSON.stringify(safeUserData));
  }
});



function getCurrentUserData() {
  if (window.currentUserData) return window.currentUserData;

  const cached = localStorage.getItem("currentUserData");
  if (cached) {
    window.currentUserData = JSON.parse(cached);
    return window.currentUserData;
  }

  return null;
}

window.getCurrentUserData = getCurrentUserData;

export { app, auth, db, getAuth, onAuthStateChanged, confetti, signOut };

function insertBootstrapCSS() {
  if (!document.querySelector('link[href*="bootstrap.min.css"]')) {
    const link = document.createElement("link");
    link.href = "https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css";
    link.rel = "stylesheet";
    document.head.appendChild(link);
  }
}

// Call this early in your script
//  insertBootstrapCSS();

  function insertBootstrapIcons() {
  const link = document.createElement("link");
  link.href = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

// Call it early in your script
insertBootstrapIcons();





