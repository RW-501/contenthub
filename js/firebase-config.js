// Import the functions you need from the SDKs you need
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithPhoneNumber,
  RecaptchaVerifier
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyALJLxSJthWI2tnQZ-WnK1DDQNEelUCr7s",
  authDomain: "content-hub-11923.firebaseapp.com",
  projectId: "content-hub-11923",
  storageBucket: "content-hub-11923.firebasestorage.app",
  messagingSenderId: "1021963959280",
  appId: "1:1021963959280:web:68155134c25cc38dcdfb35",
  measurementId: "G-6G9VXCGFTG"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);

window.firebase = { auth };
