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

  import { loginWith, initRecaptcha } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

// 🔌 Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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



/*

<script type="module">
  import { loginWith, initRecaptcha } from './js/firebase-config.js';

  // EMAIL SIGNUP
  document.getElementById("emailSignUpBtn").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const result = await loginWith('email-signup', { email, password });
    if (result.error) return alert(result.error);
    window.location.href = '/pages/profile.html';
  });

  // GOOGLE
  document.getElementById("googleBtn").addEventListener("click", async () => {
    const result = await loginWith('google');
    if (result.error) return alert(result.error);
    window.location.href = '/pages/profile.html';
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
    window.location.href = '/pages/profile.html';
  });
</script>

<input type="email" id="email" />
<input type="password" id="password" />
<button id="emailSignUpBtn">Sign Up</button>
<button id="googleBtn">Login with Google</button>

<input type="text" id="phoneNumber" placeholder="+1234567890" />
<div id="recaptcha-container"></div>
<button id="sendOtpBtn">Send OTP</button>
<input type="text" id="otpCode" />
<button id="verifyOtpBtn">Verify OTP</button>


*/


