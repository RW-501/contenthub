// /js/admin.js
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, updateDoc, deleteDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Admin check
onAuthStateChanged(auth, async user => {
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");

  } 
  const userDoc = await getDocs(collection(db, "users"));
  const adminDoc = [...userDoc.docs].find(d => d.id === user.uid);
  if (!adminDoc || !adminDoc.data().admin) {
    alert("Access Denied – Admins Only");
    return window.location.href = "/";
  }

  loadAnalytics();
  loadUsers();
  loadFlaggedPosts();
});

// Load Stats
async function loadAnalytics() {
  const users = await getDocs(collection(db, "users"));
  const posts = await getDocs(collection(db, "posts"));
  const reports = await getDocs(collection(db, "reports"));

  document.getElementById("totalUsers").innerText = users.size;
  document.getElementById("totalPosts").innerText = posts.size;
  document.getElementById("reportCount").innerText = reports.size;
}

// Load All Users
async function loadUsers() {
  const userTable = document.getElementById("userTable");
  const users = await getDocs(collection(db, "users"));
  userTable.innerHTML = "";

  users.forEach(docSnap => {
    const u = docSnap.data();
    const row = `
      <tr>
        <td>${u.email || 'N/A'}</td>
        <td>${u.niche || ''}</td>
        <td>
          <button class="btn btn-sm btn-warning" onclick="verifyUser('${docSnap.id}')">Verify</button>
          <button class="btn btn-sm btn-danger" onclick="banUser('${docSnap.id}')">Ban</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${docSnap.id}')">Delete</button>
        </td>
      </tr>`;
    userTable.insertAdjacentHTML("beforeend", row);
  });
}

// Load Flagged Content
async function loadFlaggedPosts() {
  const flaggedTable = document.getElementById("flaggedTable");
  const reports = await getDocs(collection(db, "reports"));
  flaggedTable.innerHTML = "";

  reports.forEach(docSnap => {
    const report = docSnap.data();
    const row = `
      <tr>
        <td>${report.postId}</td>
        <td>${report.reason || 'Inappropriate'}</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="deletePost('${report.postId}', '${docSnap.id}')">Delete Post</button>
        </td>
      </tr>`;
    flaggedTable.insertAdjacentHTML("beforeend", row);
  });
}

// Action Buttons
window.verifyUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { verified: true });
  alert("User verified.");
};

window.banUser = async (uid) => {
  await updateDoc(doc(db, "users", uid), { banned: true });
  alert("User banned.");
};

window.deleteUser = async (uid) => {
  await deleteDoc(doc(db, "users", uid));
  alert("User deleted.");
  loadUsers();
};

window.deletePost = async (postId, reportId) => {
  await deleteDoc(doc(db, "posts", postId));
  await deleteDoc(doc(db, "reports", reportId));
  alert("Post deleted.");
  loadFlaggedPosts();
};

// Feature Management
document.getElementById("setFeaturedBtn").addEventListener("click", async () => {
  const uid = document.getElementById("featureCreatorUID").value.trim();
  if (!uid) return alert("Enter UID");
  await updateDoc(doc(db, "users", uid), { featured: true });
  alert("Creator featured!");
});

document.getElementById("assignBadgeBtn").addEventListener("click", async () => {
  const badge = document.getElementById("badgeName").value.trim();
  const uid = document.getElementById("badgeUserUID").value.trim();
  if (!badge || !uid) return alert("Missing fields");
  await setDoc(doc(db, "badges", `${uid}_${badge}`), {
    userId: uid,
    badge,
    assignedAt: new Date()
  });
  alert("Badge assigned!");
});






    const searchBtn = document.getElementById('searchBtn');
    const platform = document.getElementById('platform');
    const usernameInput = document.getElementById('usernameInput');
    const saveBtn = document.getElementById('saveProfileBtn');

    // **YOUR RAPIDAPI KEYS HERE** - get from https://rapidapi.com
    const rapidApiKey = 'YOUR_RAPIDAPI_KEY';

    let latestProfile = null;

    searchBtn.addEventListener('click', async () => {
      const selected = platform.value;
      const user = usernameInput.value.trim().replace('@', '');

      if (!user) return alert('Please enter a valid username.');

      if (selected === 'youtube') {
        await fetchYouTube(user);
      } else if (selected === 'tiktok') {
        await fetchTikTok(user);
      } else if (selected === 'instagram') {
        await fetchInstagram(user);
      } else if (selected === 'facebook') {
        alert('Facebook API not integrated yet.');
      }
    });

    async function fetchYouTube(username) {
      const apiKey = 'YOUR_YOUTUBE_API_KEY';
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forUsername=${username}&key=${apiKey}`;

      const res = await fetch(url);
      const data = await res.json();
      if (!data.items || !data.items.length) return alert('No YouTube profile found.');

      const profile = data.items[0];
      latestProfile = {
        platform: 'youtube',
        username: username,
        displayName: profile.snippet.title,
        bio: profile.snippet.description,
        profilePic: profile.snippet.thumbnails.default.url,
        followers: profile.statistics.subscriberCount,
        url: `https://www.youtube.com/${profile.snippet.customUrl || 'channel/' + profile.id}`
      };

      showProfile(latestProfile);
    }

    async function fetchTikTok(username) {
      const url = `https://tiktok-scraper.p.rapidapi.com/user/info/${username}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'tiktok-scraper.p.rapidapi.com'
          }
        });
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();

        const user = data.user;
        latestProfile = {
          platform: 'tiktok',
          username: username,
          displayName: user.nickname,
          bio: user.signature,
          profilePic: user.avatarThumb,
          followers: user.followerCount,
          url: `https://www.tiktok.com/@${username}`
        };

        showProfile(latestProfile);
      } catch (err) {
        alert('TikTok profile not found or API limit exceeded.');
      }
    }

    async function fetchInstagram(username) {
      const url = `https://instagram-profile1.p.rapidapi.com/profile/${username}`;

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'instagram-profile1.p.rapidapi.com'
          }
        });
        if (!res.ok) throw new Error('Profile not found');
        const data = await res.json();

        const user = data;
        latestProfile = {
          platform: 'instagram',
          username: username,
          displayName: user.full_name,
          bio: user.biography,
          profilePic: user.profile_pic_url_hd,
          followers: user.edge_followed_by.count,
          url: `https://instagram.com/${username}`
        };

        showProfile(latestProfile);
      } catch (err) {
        alert('Instagram profile not found or API limit exceeded.');
      }
    }

    function showProfile(profile) {
      document.getElementById('profileImage').src = profile.profilePic || '/assets/default-avatar.png';
      document.getElementById('profileName').textContent = profile.displayName || profile.username;
      document.getElementById('profileUsername').textContent = `@${profile.username}`;
      document.getElementById('profileFollowers').textContent = `Followers: ${profile.followers || 'N/A'}`;
      document.getElementById('profileUrl').href = profile.url;
      document.getElementById('resultBox').classList.remove('d-none');
    }

    saveBtn.addEventListener('click', async () => {
      if (!latestProfile) return alert('No profile to save.');
      try {
        await setDoc(doc(db, "external_profiles", `${latestProfile.platform}_${latestProfile.username}`), latestProfile);
        alert('Profile saved to Firestore!');
      } catch (err) {
        console.error("Error saving profile:", err);
        alert('Failed to save profile.');
      }
    });