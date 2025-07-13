// /js/auth-service.js
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

import {
  updateDoc, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { app, auth, db  } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
import { sendNotification, NOTIFICATION_TEMPLATES, markAllNotificationsRead, rewardTasks } from "https://rw-501.github.io/contenthub/includes/notifications.js";


export async function ensureUserExists(user) {
  const userRef = doc(db, "users", user.uid);
  const docSnap = await getDoc(userRef);

  if (docSnap.exists()) {
    const data = docSnap.data();

    // 🔒 Blocked User Check
    if (data.status === 'blocked') {
      throw new Error("Your account is blocked.");
    }

    // 🕒 Update Last Login Timestamp
    await updateDoc(userRef, {
      lastLogin: new Date()
    });

  } else {
    // 🆕 Create New User Profile
const rawName = user.displayName || user.email || "unnamed";

// Helper function to generate a username
function generateUsername(base) {
  return base
    .toLowerCase()
    .replace(/\s+/g, '')           // remove spaces
    .replace(/[^a-z0-9]/g, '')     // remove non-alphanumeric chars
    .slice(0, 8);                 // trim to 8 characters
}
function getCleanName(displayName, email) {
  if (displayName && displayName.includes(" ")) {
    return displayName.split(" ")[0]; // get first name
  } else if (displayName && displayName.includes("@")) {
    return displayName.split("@")[0]; // email prefix
  } else if (displayName) {
    return displayName;
  } else if (email) {
    return email.split("@")[0]; // fallback to email prefix
  }
  return "user";
}

const userData = { 
  displayName: getCleanName(user.displayName, user.email) || "Unnamed",
  username: generateUsername(rawName),
  email: user.email || null,
  photoURL: user.photoURL || "",
  createdAt: new Date(),
  lastLogin: new Date(),
  status: "active",
  role: "user",
  verified: false
};

await setDoc(userRef, userData);



    // 🤝 Auto-send collab request from system
    const requestsRef = collection(db, "collabRequests");

    const adminData = {
      fromUid: "0000",
      fromDisplayName: "Collab Hub Admin",
      fromPhotoURL: "https://rw-501.github.io/contenthub/images/defaultAvatar.png",  // Update this if needed

      toUid: user.uid,
      toDisplayName: cleanName,
      toUserPhoto: user.photoURL || "",

      message: `Collab Hub invited you to your first collaboration.`,
      title: `Collaboration Invitation`,
      description: `Welcome to the Creator Collab Hub! This is an invite to get started by exploring your first collab.`,

      status: "pending",
      timestamp: serverTimestamp()
    };

    await addDoc(requestsRef, adminData);

    // 🔔 Fire a notification
await sendNotification({
  toUid: user.uid,
  fromUid: "0000",
  fromDisplayName: "Collab Hub Admin",
  fromuserAvatar: "https://rw-501.github.io/contenthub/images/defaultAvatar.png",
  message: `You've been invited to collaborate on the platform. <a href="https://rw-501.github.io/contenthub/pages/collabs/" target="_blank" class="text-info text-decoration-underline">View Collab Dashboard</a>`,
  type: "collabRequest"
});



  // Get referral from URL or fallback to localStorage
  const urlParams = new URLSearchParams(window.location.search);
  let referredBy = urlParams.get("ref") || localStorage.getItem("pendingReferral");

    if (!referredBy) return;

  // Attach to user doc
  const userRef = doc(db, "users", user.uid);
  await setDoc(userRef, {
    uid: user.uid,
    referredBy: referredBy || null,
    createdAt: new Date(),
  }, { merge: true });

  // Update inviter's referral stats
  if (referredBy) {
    const refStatsRef = doc(db, "referrals", referredBy);
    await updateDoc(refStatsRef, {
      invitesJoined: increment(1)
    });

    // Optional: Clear the referral code once it's used
    localStorage.removeItem("pendingReferral");
    console.log("🎉 Referral counted for:", referredBy);

  // ✅ Send Notification to Referrer
  await sendNotification({
    toUid: referredBy,
    fromUid: user.uid,
    fromDisplayName: userData.displayName || "New Creator",
    fromuserAvatar: userData.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png',
    message: `${userData.displayName || "A new user"} joined via your invite!`,
    type: "referrals",
  });
  
  }

  }
}
// 📱 Invisible reCAPTCHA verifier (phone login)
let recaptchaVerifier;
let confirmationResult;

export function initRecaptcha(containerId = 'recaptcha-container') {
  recaptchaVerifier = new RecaptchaVerifier(containerId, {
    size: 'invisible',
    callback: () => {}
  }, auth);
  recaptchaVerifier.render();
}

// 🔁 Main reusable login function
export async function loginWith(method, data = {}) {
  try {
    switch (method) {
      case 'email-login':
        const emailLoginUser = await signInWithEmailAndPassword(auth, data.email, data.password);
        return { user: emailLoginUser.user };

      case 'email-signup':
        const emailSignupUser = await createUserWithEmailAndPassword(auth, data.email, data.password);
        return { user: emailSignupUser.user };

      case 'google':
        const provider = new GoogleAuthProvider();
        const googleResult = await signInWithPopup(auth, provider);
        return { user: googleResult.user };

      case 'send-otp':
        if (!recaptchaVerifier) initRecaptcha(data.recaptchaContainerId || 'recaptcha-container');
        confirmationResult = await signInWithPhoneNumber(auth, data.phone, recaptchaVerifier);
        return { message: 'OTP Sent' };

      case 'verify-otp':
        if (!confirmationResult) throw new Error("OTP not sent yet.");
        const otpResult = await confirmationResult.confirm(data.otp);
        return { user: otpResult.user };

      default:
        throw new Error("Unknown login method");
    }
  } catch (error) {
    return { error: error.message };
  }
}




  // EMAIL SIGNUP
  document.getElementById("emailSignUpBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
const result = await loginWith('email-signup', { email, password });
if (result.error) return alert(result.error);
await ensureUserExists(result.user);
    window.location.href = 'https://rw-501.github.io/contenthub/pages/profile.html';
  });

  // GOOGLE
  document.getElementById("googleBtn").addEventListener("click", async () => {
    const result = await loginWith('google');
if (result.error) return alert(result.error);
await ensureUserExists(result.user);
    window.location.href = 'https://rw-501.github.io/contenthub/pages/profile.html';
  });

  // PHONE OTP
  initRecaptcha('recaptcha-container');

  document.getElementById("sendOtpBtn").addEventListener("click", async () => {
    const phone = document.getElementById("phoneNumber").value;
    const result = await loginWith('send-otp', { phone });
    if (result.error) return alert(result.error);
    alert("OTP sent!");
  });

  document.getElementById("verifyOtpBtn").addEventListener("click", async () => {
    const otp = document.getElementById("otpCode").value;
const result = await loginWith('verify-otp', { otp });
if (result.error) return alert(result.error);
await ensureUserExists(result.user);
    window.location.href = 'https://rw-501.github.io/contenthub/pages/profile.html';
  });



  const signupBtn = document.getElementById("signupBtn");
  const authModal = document.getElementById("auth-login");
  const closeAuthBtn = document.getElementById("closeAuthBtn");

  signupBtn.addEventListener("click", () => {
    authModal.classList.remove("d-none");
  });

  closeAuthBtn.addEventListener("click", () => {
    authModal.classList.add("d-none");
  });

  // Optional: ESC key closes modal
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      authModal.classList.add("d-none");
    }
  });



  const closeBtn = document.getElementById("closeAuthBtn");
  const sendOtpBtn = document.getElementById("sendOtpBtn");
  const otpSection = document.getElementById("otpSection");
  const phoneInput = document.getElementById("phoneNumber");

  // Show modal
  signupBtn?.addEventListener("click", () => {
    authModal.classList.remove("d-none");
  });

  // Hide modal
  closeBtn?.addEventListener("click", () => {
    authModal.classList.add("d-none");
  });

  // Hide on ESC
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") authModal.classList.add("d-none");
  });

  // OTP Flow
  sendOtpBtn?.addEventListener("click", () => {
    if (phoneInput.value.length >= 10) {
      otpSection.classList.remove("d-none");
    } else {
      alert("Enter a valid phone number first.");
    }
  });

  // Auto-format phone number to E.164
  phoneInput?.addEventListener("blur", () => {
    let val = phoneInput.value.replace(/\D/g, '');
    if (val.length === 10) {
      phoneInput.value = `+1${val}`;
    } else if (!val.startsWith('+' || val.length < 10)) {
      alert("Please enter a valid international phone number.");
    }
  });
