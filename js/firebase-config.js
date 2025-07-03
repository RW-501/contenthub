// firebase-config.js (MODULAR EXPORT VERSION)
 import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
  import { getFirestore, collection, query, where, limit, getDocs } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

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

// Export what you want to use in other files
export { app, auth, getFirestore, collection, query, where, limit, getDocs };
