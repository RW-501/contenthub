// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

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
const db = getFirestore(app); // ✅ This is what you need

// Export what you want to use in other files
export { app, auth, db,   getAuth,
  onAuthStateChanged,
  signOut  };
