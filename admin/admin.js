// /js/admin.js


import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, query,serverTimestamp, orderBy,getDoc,  getDocs, updateDoc, doc, setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);

// Admin check
onAuthStateChanged(auth, async (user) => {
  const authModal = document.getElementById("auth-login");

  if (!user) {
    // No user logged in — show login modal
    authModal.classList.remove("d-none");
    return; // Stop further processing
  }

  try {
    // Get user document by user.uid
    const userDocRef = doc(db, "users", user.uid);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      alert("Access Denied – User record not found.");
      authModal.classList.remove("d-none");
      return;
    }

    const userData = userDocSnap.data();

    if (userData.role !== "admin") {
      alert("Access Denied – Admins Only");
      authModal.classList.remove("d-none");
      return;
    }

    // If admin, load admin-only data/functions
    loadAnalytics();
    loadUsers();
    loadFlaggedPosts();

  } catch (error) {
    console.error("Error checking admin role:", error);
    alert("Error validating admin access.");
    authModal.classList.remove("d-none");
  }
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


  const contactList = document.getElementById("contactList");
  const filterSelect = document.getElementById("filterStatus");

  filterSelect.addEventListener("change", loadContacts);

  async function loadContacts() {
    const filter = filterSelect.value;
    contactList.innerHTML = "<div class='text-muted p-3'>Loading messages...</div>";

    const q = query(collection(db, "contact"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    contactList.innerHTML = "";

    if (snapshot.empty) {
      contactList.innerHTML = "<div class='text-muted p-3'>No messages found.</div>";
      return;
    }

    snapshot.forEach(docSnap => {
      const msg = docSnap.data();
      const id = docSnap.id;

      const status = msg.status || "unread";
      if (filter !== "all" && status !== filter) return;

      const date = msg.createdAt?.toDate().toLocaleString() || "N/A";

      const item = document.createElement("div");
      item.className = `list-group-item flex-column align-items-start ${status === 'unread' ? 'list-group-item-warning' : 'list-group-item-light'}`;

      item.innerHTML = `
        <div class="d-flex justify-content-between">
          <div>
            <h5 class="mb-1">${msg.subject || "No Subject"}</h5>
            <small class="text-muted">${msg.name || "Anonymous"} – ${msg.email}</small>
          </div>
          <span class="badge bg-${status === 'unread' ? 'warning' : status === 'read' ? 'primary' : 'success'} text-uppercase">${status}</span>
        </div>
        <p class="mt-2">${msg.message || "(no message)"}</p>
        ${msg.attachment ? `<a href="${msg.attachment}" target="_blank" class="btn btn-sm btn-outline-secondary mb-2">📎 View Attachment</a><br>` : ''}
        <small class="text-muted">Received: ${date}</small>
        <div class="mt-2">
          ${status !== "read" ? `<button class="btn btn-sm btn-outline-primary me-2" onclick="markMessageStatus('${id}', 'read')">Mark as Read</button>` : ""}
          ${status !== "resolved" ? `<button class="btn btn-sm btn-outline-success" onclick="markMessageStatus('${id}', 'resolved')">Mark as Resolved</button>` : ""}
        </div>
      `;

      contactList.appendChild(item);
    });
  }

  window.markMessageStatus = async function(id, status) {
    await updateDoc(doc(db, "contact", id), {
      status
    });
    loadContacts();
  };

  // Load on page start
  window.addEventListener("DOMContentLoaded", loadContacts);



/*
// Example during login
if (userData.status === "removed") {
  alert("Your account was removed. Contact support to appeal.");
  await signOut(auth);
}



*/


// Load All Users
// --- Enhancements ---
// 1. Actions moved into a single modal popup for clarity
// 2. Role changing is now done through a popover menu
// 3. Added helper modal + refactor suggestions

// Call this after your DOM is loaded
// Main User Loader
async function loadUsers() {
  const userTable = document.getElementById("userTable");
  const users = await getDocs(collection(db, "users"));
  userTable.innerHTML = "";

users.forEach(docSnap => {
  const u = docSnap.data();
  const id = docSnap.id;

  const banUntil = u.bannedUntil?.toDate?.();
  const banUntilDisplay = banUntil ? banUntil.toLocaleDateString() : "";

  const role = u.role || "user";
  const status = u.status || "active";

  const actionButtons = `
    <button class="btn btn-sm btn-outline-primary me-1" onclick="openActionModal('${id}')">⚙ Actions</button>
    ${role === 'demo' ? `<button class="btn btn-sm btn-outline-success" onclick="editUserProfile('${u}')">✏️ Edit</button>` : ''}
  `;

  const row = `
    <tr>
      <td>${u.email || 'N/A'}</td>
      <td>${(u.niches || []).join(", ")}</td>
      <td><span class="badge bg-info text-dark">${role}</span></td>
      <td><span class="badge bg-${status === 'active' ? 'success' : status === 'blocked' ? 'warning' : 'secondary'}">${status}</span></td>
      <td>${banUntilDisplay}</td>
      <td>${actionButtons}</td>
    </tr>`;

  userTable.insertAdjacentHTML("beforeend", row);
});

}
window.loadUsers = loadUsers;

// Open Modal
function openActionModal(userId) {
  document.getElementById("actionUserId").value = userId;
  new bootstrap.Modal(document.getElementById("actionModal")).show();
}
window.openActionModal = openActionModal;

// Set Role
async function setUserRole(role) {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), { role });
  alert(`Role updated to ${role}`);
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.setUserRole = setUserRole;

// Verify
async function verifyUser() {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), { verified: true });
  alert("User verified.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.verifyUser = verifyUser;

// Ban
async function banUser(duration) {
  const userId = document.getElementById("actionUserId").value;
  const banUntil = duration === 'perm'
    ? new Date("2099-12-31")
    : new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);

  await updateDoc(doc(db, "users", userId), {
    role: "banned",
    status: "blocked",
    banUntil
  });

  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.banUser = banUser;

// Unban
async function unbanUser() {
  const userId = document.getElementById("actionUserId").value;
  await updateDoc(doc(db, "users", userId), {
    role: "user",
    status: "active",
    bannedUntil: null
  });
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.unbanUser = unbanUser;

// Delete
async function deleteUser() {
  const userId = document.getElementById("actionUserId").value;
  if (!confirm("Are you sure you want to remove this user?")) return;

  await updateDoc(doc(db, "users", userId), {
    status: "removed",
    role: "removed",
    removedAt: new Date()
  });

  alert("User marked as removed.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.deleteUser = deleteUser;

// Restore
async function restoreUser() {
  const userId = document.getElementById("actionUserId").value;
  if (!confirm("Restore this user?")) return;

  await updateDoc(doc(db, "users", userId), {
    status: "active",
    role: "user",
    removedAt: deleteField()
  });

  alert("User restored.");
  bootstrap.Modal.getInstance(document.getElementById("actionModal")).hide();
  loadUsers();
}
window.restoreUser = restoreUser;

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


  async function loadTickets() {
    const ticketList = document.getElementById("ticketList");
    ticketList.innerHTML = "<div class='text-muted'>Loading tickets...</div>";

    const q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      ticketList.innerHTML = "<div class='text-muted'>No tickets found.</div>";
      return;
    }

    ticketList.innerHTML = "";

    for (const docSnap of snapshot.docs) {
      const ticket = docSnap.data();
      const ticketId = docSnap.id;

      const userSnap = await getDoc(doc(db, "users", ticket.userId));
      const user = userSnap.data();

      const item = document.createElement("div");
      item.className = `list-group-item list-group-item-action flex-column align-items-start`;

      item.innerHTML = `
        <div class="d-flex justify-content-between w-100">
          <div>
            <h6 class="mb-1">${ticket.type.replace("_", " ").toUpperCase()}</h6>
            <small class="text-muted">User: ${user?.displayName || "Unknown"} (${user?.email || "N/A"})</small>
          </div>
          <span class="badge bg-${ticket.status === 'pending' ? 'warning' : ticket.status === 'approved' ? 'success' : 'danger'} text-uppercase">${ticket.status}</span>
        </div>
        <small class="text-muted">Submitted: ${ticket.createdAt?.toDate().toLocaleString() || "unknown"}</small>
        ${ticket.status === 'pending' ? `
        <div class="mt-2">
          <button class="btn btn-sm btn-success me-2" onclick="updateTicketStatus('${ticketId}', 'approved')">✅ Approve</button>
          <button class="btn btn-sm btn-danger me-2" onclick="updateTicketStatus('${ticketId}', 'denied')">❌ Deny</button>
          <button class="btn btn-sm btn-secondary" onclick="updateTicketStatus('${ticketId}', 'resolved')">✔️ Mark Resolved</button>
        </div>` : ''}
      `;

      ticketList.appendChild(item);
    }
  }

  async function updateTicketStatus(ticketId, status) {
    await updateDoc(doc(db, "tickets", ticketId), {
      status,
      reviewedAt: new Date()
    });
    alert(`Ticket ${status}`);
    loadTickets();
  }

  // Load on admin page load
  window.addEventListener("DOMContentLoaded", loadTickets);



    document.getElementById('brandingForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const faviconURL = document.getElementById('faviconURL').value.trim();
    const logoURL = document.getElementById('logoURL').value.trim();
    const profileImageURL = document.getElementById('profileImageURL').value.trim();

    const brandingData = {
      faviconURL,
      logoURL,
      profileImageURL,
      updatedAt: new Date().toISOString()
    };

    const content = JSON.stringify(brandingData, null, 2);
    const encodedContent = btoa(unescape(encodeURIComponent(content)));

    const owner = "RW-501";
    const repo = "contenthub";
    const filePath = "https://rw-501.github.io/contenthub/branding/settings.json";
    const branch = 'main';

// Randomized or complex approach
const parts = ['p', 'h', 'g'];
const randomizePart = (part) => {
    return part.split('').reverse().join('');
};

const part_1 = randomizePart(parts.join(''));
const part_2 = "_akXGrO51HwgEI";
const part_3 = "VWzDIghLbIE";
const part_4 = "G9MnTu0fIjKj";

const token = part_1 + part_2 + part_3 + part_4;
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

    let sha = "";

    try {
      const check = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      });

      if (check.ok) {
        const json = await check.json();
        sha = json.sha;
      }

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: sha ? "Update branding settings" : "Create branding settings",
          content: encodedContent,
          sha,
          branch
        })
      });

      if (!res.ok) throw new Error("Failed to update file");
      document.getElementById('messageDiv').textContent = "Branding settings updated successfully!";
    } catch (err) {
      console.error(err);
      document.getElementById('messageDiv').textContent = `Error: ${err.message}`;
    }
  });




async function createDemoProfiles() {
  const demoUsers = [
    {
      displayName: "DreamChaser",
      username: "@dreamchaser",
      bio: "Visual artist exploring identity and digital dreams.",
      pronouns: "they/them",
      availability: "weekends",
      userLocation: { country: "USA", state: "CA", city: "Los Angeles" },
      niches: ["art", "animation"],
      contentTypes: ["video", "reels"],
      links: [
        { platform: "instagram", url: "https://instagram.com/dreamchaser" }
      ],
      photo: "demo_avatars/dreamchaser.png"
    },
    {
      displayName: "VisualBeats",
      username: "@visualbeats",
      bio: "Motion + sound = magic. Let’s collab.",
      pronouns: "he/him",
      availability: "nights",
      userLocation: { country: "USA", state: "NY", city: "Brooklyn" },
      niches: ["music", "vfx"],
      contentTypes: ["audio", "animation"],
      links: [
        { platform: "youtube", url: "https://youtube.com/visualbeats" }
      ],
      photo: "demo_avatars/visualbeats.png"
    },
    {
      displayName: "CodeMuse",
      username: "@codemuse",
      bio: "Frontend wizard crafting magic with pixels & JS.",
      pronouns: "she/her",
      availability: "full-time",
      userLocation: { country: "USA", state: "TX", city: "Austin" },
      niches: ["webdev", "ux"],
      contentTypes: ["tutorials", "design"],
      links: [
        { platform: "github", url: "https://github.com/codemuse" }
      ],
      photo: "demo_avatars/codemuse.png"
    },
    {
      displayName: "VibeWriter",
      username: "@vibewriter",
      bio: "Script & spoken word creative looking to connect.",
      pronouns: "they/them",
      availability: "mornings",
      userLocation: { country: "USA", state: "IL", city: "Chicago" },
      niches: ["writing", "spokenword"],
      contentTypes: ["scripts", "voiceover"],
      links: [
        { platform: "twitter", url: "https://twitter.com/vibewriter" }
      ],
      photo: "demo_avatars/vibewriter.png"
    },
  {
    displayName: "User001",
    username: "@user001",
    bio: "Passionate real estate creator sharing authentic content.",
    pronouns: "she/her",
    availability: "part-time",
    userLocation: { country: "USA", state: "NY", city: "Brooklyn" },
    niches: ["Skits & Acting", "Gaming"],
    contentTypes: ["Challenges", "Livestreams"],
    links: [{ platform: "github", url: "https://instagram.com/user001" }],
    photo: "demo_avatars/user001.png"
  },
  {
    displayName: "User002",
    username: "@user002",
    bio: "Passionate asmr creator sharing authentic content.",
    pronouns: "she/her",
    availability: "part-time",
    userLocation: { country: "USA", state: "TX", city: "Austin" },
    niches: ["Lifestyle", "Tutorials"],
    contentTypes: ["Music Videos", "Animations"],
    links: [{ platform: "facebook", url: "https://twitter.com/user002" }],
    photo: "demo_avatars/user002.png"
  },
  {
    displayName: "User003",
    username: "@user003",
    bio: "Passionate music creator sharing authentic content.",
    pronouns: "she/her",
    availability: "weekends",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Art & Design", "Tech"],
    contentTypes: ["Animations", "Skits"],
    links: [{ platform: "facebook", url: "https://youtube.com/user003" }],
    photo: "demo_avatars/user003.png"
  },
  {
    displayName: "BlakeTracks",
    username: "@blaketracks",
    bio: "Visionary motivation here to collab, connect, and grow.",
    pronouns: "they/them",
    availability: "part-time",
    userLocation: { country: "USA", state: "WA", city: "Miami" },
    niches: ["Comedy", "Photography"],
    contentTypes: ["Skits", "Livestreams"],
    links: [{ platform: "youtube", url: "https://youtube.com/blaketracks" }],
    photo: "demo_avatars/blaketracks.png"
  },
  {
    displayName: "QuinnBakes",
    username: "@quinnbakes",
    bio: "Passionate fitness influencer bringing vibes to your feed.",
    pronouns: "he/him",
    availability: "nights",
    userLocation: { country: "USA", state: "FL", city: "Seattle" },
    niches: ["Real Estate", "Memes"],
    contentTypes: ["Vlogs", "Reviews"],
    links: [{ platform: "instagram", url: "https://instagram.com/quinnbakes" }],
    photo: "demo_avatars/quinnbakes.png"
  },
  {
    displayName: "SkylarMotion",
    username: "@skylarmotion",
    bio: "Creative product reviews influencer bringing vibes to your feed.",
    pronouns: "they/them",
    availability: "weekends",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Product Reviews", "Lifestyle"],
    contentTypes: ["Behind-the-Scenes", "Animations"],
    links: [{ platform: "youtube", url: "https://youtube.com/skylarmotion" }],
    photo: "demo_avatars/skylarmotion.png"
  },
  {
    displayName: "BlakeMotion",
    username: "@blakemotion",
    bio: "Creative motivation creator sharing real moments.",
    pronouns: "he/him",
    availability: "nights",
    userLocation: { country: "USA", state: "CA", city: "San Diego" },
    niches: ["Education", "Music"],
    contentTypes: ["Short Reels", "Vlogs"],
    links: [{ platform: "twitter", url: "https://twitter.com/blakemotion" }],
    photo: "demo_avatars/blakemotion.png"
  },
  {
    displayName: "PhoenixDrive",
    username: "@phoenixdrive",
    bio: "Passionate photography creator sharing authentic vibes.",
    pronouns: "he/him",
    availability: "full-time",
    userLocation: { country: "USA", state: "IL", city: "Chicago" },
    niches: ["Spirituality", "Finance & Investing"],
    contentTypes: ["Tutorials", "Q&A"],
    links: [{ platform: "tiktok", url: "https://tiktok.com/phoenixdrive" }],
    photo: "demo_avatars/phoenixdrive.png"
  },
  {
    displayName: "ParkerTrack",
    username: "@parkertrack",
    bio: "Passionate motivation creator sharing daily wins.",
    pronouns: "he/him",
    availability: "weekends",
    userLocation: { country: "USA", state: "GA", city: "Atlanta" },
    niches: ["Lifestyle", "Parenting"],
    contentTypes: ["Short Reels", "Challenges"],
    links: [{ platform: "tiktok", url: "https://tiktok.com/parkertrack" }],
    photo: "demo_avatars/parkertrack.png"
  },{
    "displayName": "BlakeMotion",
    "username": "@blakemotion",
    "bio": "Creative motivation creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CA",
      "city": "San Diego"
    },
    "niches": [
      "Education",
      "Music"
    ],
    "contentTypes": [
      "Short Reels",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "twitter",
        "url": "https://twitter.com/blakemotion"
      }
    ],
    "photo": "demo_avatars/blakemotion.png"
  },
  {
    "displayName": "PhoenixDrive",
    "username": "@phoenixdrive",
    "bio": "Passionate photography creator sharing authentic vibes.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "IL",
      "city": "Chicago"
    },
    "niches": [
      "Spirituality",
      "Finance & Investing"
    ],
    "contentTypes": [
      "Tutorials",
      "Q&A"
    ],
    "links": [
      {
        "platform": "tiktok",
        "url": "https://tiktok.com/phoenixdrive"
      }
    ],
    "photo": "demo_avatars/phoenixdrive.png"
  },
  {
    "displayName": "ParkerTrack",
    "username": "@parkertrack",
    "bio": "Passionate motivation creator sharing daily wins.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "GA",
      "city": "Atlanta"
    },
    "niches": [
      "Lifestyle",
      "Parenting"
    ],
    "contentTypes": [
      "Short Reels",
      "Challenges"
    ],
    "links": [
      {
        "platform": "tiktok",
        "url": "https://tiktok.com/parkertrack"
      }
    ],
    "photo": "demo_avatars/parkertrack.png"
  },
  {
    "displayName": "QuinnVibe",
    "username": "@quinnvibe",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Tech",
      "Travel"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnvibe"
      }
    ],
    "photo": "demo_avatars/quinnvibe.png"
  },
  {
    "displayName": "JordanVibe",
    "username": "@jordanvibe",
    "bio": "Passionate photography creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Beauty",
      "Fashion"
    ],
    "contentTypes": [
      "Livestreams",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordanvibe"
      }
    ],
    "photo": "demo_avatars/jordanvibe.png"
  },
  {
    "displayName": "MorganLoop",
    "username": "@morganloop",
    "bio": "Creative beauty creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "DIY & Crafts",
      "Travel"
    ],
    "contentTypes": [
      "Livestreams",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganloop"
      }
    ],
    "photo": "demo_avatars/morganloop.png"
  },
  {
    "displayName": "AveryLoop",
    "username": "@averyloop",
    "bio": "Passionate beauty creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Beauty",
      "Fashion"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyloop"
      }
    ],
    "photo": "demo_avatars/averyloop.png"
  },
  {
    "displayName": "SkylarDrive",
    "username": "@skylardrive",
    "bio": "Passionate photography creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Travel",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylardrive"
      }
    ],
    "photo": "demo_avatars/skylardrive.png"
  },
  {
    "displayName": "TaylorWave",
    "username": "@taylorwave",
    "bio": "Authentic fitness creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Comedy",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/taylorwave"
      }
    ],
    "photo": "demo_avatars/taylorwave.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative food & cooking creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Comedy",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Music Videos",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "QuinnEdge",
    "username": "@quinnedge",
    "bio": "Creative photography creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Beauty",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Tutorials",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnedge"
      }
    ],
    "photo": "demo_avatars/quinnedge.png"
  },
  {
    "displayName": "MorganLoop",
    "username": "@morganloop",
    "bio": "Authentic food & cooking creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Beauty",
      "Gaming"
    ],
    "contentTypes": [
      "Podcasts",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganloop"
      }
    ],
    "photo": "demo_avatars/morganloop.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative fitness creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Food & Cooking",
      "Photography"
    ],
    "contentTypes": [
      "Tutorials",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "CaseyGlow",
    "username": "@caseyglow",
    "bio": "Creative diy & crafts creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Gaming",
      "Comedy"
    ],
    "contentTypes": [
      "Podcasts",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseyglow"
      }
    ],
    "photo": "demo_avatars/caseyglow.png"
  },
  {
    "displayName": "AveryWave",
    "username": "@averywave",
    "bio": "Passionate food & cooking creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Travel",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Q&A",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averywave"
      }
    ],
    "photo": "demo_avatars/averywave.png"
  },
  {
    "displayName": "ReeseLoop",
    "username": "@reeseloop",
    "bio": "Passionate fitness creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Fitness",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reeseloop"
      }
    ],
    "photo": "demo_avatars/reeseloop.png"
  },
  {
    "displayName": "AlexSync",
    "username": "@alexsync",
    "bio": "Authentic photography creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Gaming",
      "Tech"
    ],
    "contentTypes": [
      "Podcasts",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexsync"
      }
    ],
    "photo": "demo_avatars/alexsync.png"
  },
  {
    "displayName": "CaseyFlare",
    "username": "@caseyflare",
    "bio": "Creative fashion creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Fitness",
      "Comedy"
    ],
    "contentTypes": [
      "Skits",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseyflare"
      }
    ],
    "photo": "demo_avatars/caseyflare.png"
  },
  {
    "displayName": "QuinnGlow",
    "username": "@quinnglow",
    "bio": "Creative photography creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Beauty",
      "Tech"
    ],
    "contentTypes": [
      "Skits",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnglow"
      }
    ],
    "photo": "demo_avatars/quinnglow.png"
  },
  {
    "displayName": "JordanEdge",
    "username": "@jordanedge",
    "bio": "Creative fashion creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fitness",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Podcasts",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordanedge"
      }
    ],
    "photo": "demo_avatars/jordanedge.png"
  },
  {
    "displayName": "TaylorVision",
    "username": "@taylorvision",
    "bio": "Passionate gaming creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Fitness",
      "Fashion"
    ],
    "contentTypes": [
      "Animations",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/taylorvision"
      }
    ],
    "photo": "demo_avatars/taylorvision.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Creative comedy creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Tech",
      "Comedy"
    ],
    "contentTypes": [
      "Podcasts",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "AlexVision",
    "username": "@alexvision",
    "bio": "Creative beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Food & Cooking",
      "Gaming"
    ],
    "contentTypes": [
      "Animations",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexvision"
      }
    ],
    "photo": "demo_avatars/alexvision.png"
  },
  {
    "displayName": "SkylarCreator",
    "username": "@skylarcreator",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Travel",
      "Photography"
    ],
    "contentTypes": [
      "Podcasts",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarcreator"
      }
    ],
    "photo": "demo_avatars/skylarcreator.png"
  },
  {
    "displayName": "AveryDrive",
    "username": "@averydrive",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Food & Cooking",
      "Fitness"
    ],
    "contentTypes": [
      "Vlogs",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averydrive"
      }
    ],
    "photo": "demo_avatars/averydrive.png"
  },
  {
    "displayName": "SkylarDrive",
    "username": "@skylardrive",
    "bio": "Creative gaming creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Podcasts",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylardrive"
      }
    ],
    "photo": "demo_avatars/skylardrive.png"
  },
  {
    "displayName": "AveryCreator",
    "username": "@averycreator",
    "bio": "Authentic comedy creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Comedy",
      "Travel"
    ],
    "contentTypes": [
      "Tutorials",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averycreator"
      }
    ],
    "photo": "demo_avatars/averycreator.png"
  },
  {
    "displayName": "CaseyDrive",
    "username": "@caseydrive",
    "bio": "Passionate diy & crafts creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Gaming",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Skits",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/caseydrive"
      }
    ],
    "photo": "demo_avatars/caseydrive.png"
  },
  {
    "displayName": "AveryGlow",
    "username": "@averyglow",
    "bio": "Authentic fashion creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Travel",
      "Fitness"
    ],
    "contentTypes": [
      "Music Videos",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyglow"
      }
    ],
    "photo": "demo_avatars/averyglow.png"
  },
  {
    "displayName": "RileyVision",
    "username": "@rileyvision",
    "bio": "Creative food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fashion",
      "Tech"
    ],
    "contentTypes": [
      "Livestreams",
      "Vlogs"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/rileyvision"
      }
    ],
    "photo": "demo_avatars/rileyvision.png"
  },
  {
    "displayName": "AveryVision",
    "username": "@averyvision",
    "bio": "Passionate fitness creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Tech",
      "Fitness"
    ],
    "contentTypes": [
      "Animations",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averyvision"
      }
    ],
    "photo": "demo_avatars/averyvision.png"
  },
  {
    "displayName": "ReeseWave",
    "username": "@reesewave",
    "bio": "Passionate gaming creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Comedy",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesewave"
      }
    ],
    "photo": "demo_avatars/reesewave.png"
  },
  {
    "displayName": "ReeseEdge",
    "username": "@reeseedge",
    "bio": "Authentic fashion creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Fitness",
      "Travel"
    ],
    "contentTypes": [
      "Livestreams",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reeseedge"
      }
    ],
    "photo": "demo_avatars/reeseedge.png"
  },
  {
    "displayName": "ReeseSync",
    "username": "@reesesync",
    "bio": "Creative tech creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Fashion",
      "Travel"
    ],
    "contentTypes": [
      "Q&A",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesesync"
      }
    ],
    "photo": "demo_avatars/reesesync.png"
  },
  {
    "displayName": "ReeseCreator",
    "username": "@reesecreator",
    "bio": "Passionate gaming creator sharing bold ideas.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Fashion",
      "Travel"
    ],
    "contentTypes": [
      "Podcasts",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/reesecreator"
      }
    ],
    "photo": "demo_avatars/reesecreator.png"
  },
  {
    "displayName": "MorganVibe",
    "username": "@morganvibe",
    "bio": "Creative gaming creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Beauty",
      "Photography"
    ],
    "contentTypes": [
      "Livestreams",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvibe"
      }
    ],
    "photo": "demo_avatars/morganvibe.png"
  },
  {
    "displayName": "MorganVibe",
    "username": "@morganvibe",
    "bio": "Passionate fitness creator sharing bold ideas.",
    "pronouns": "she/her",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Vlogs",
      "Q&A"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvibe"
      }
    ],
    "photo": "demo_avatars/morganvibe.png"
  },
  {
    "displayName": "QuinnWave",
    "username": "@quinnwave",
    "bio": "Authentic food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "Beauty",
      "Fitness"
    ],
    "contentTypes": [
      "Vlogs",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinnwave"
      }
    ],
    "photo": "demo_avatars/quinnwave.png"
  },
  {
    "displayName": "MorganVision",
    "username": "@morganvision",
    "bio": "Authentic gaming creator sharing daily stories.",
    "pronouns": "he/him",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Beauty",
      "Photography"
    ],
    "contentTypes": [
      "Q&A",
      "Podcasts"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganvision"
      }
    ],
    "photo": "demo_avatars/morganvision.png"
  },
  {
    "displayName": "AlexWave",
    "username": "@alexwave",
    "bio": "Passionate beauty creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Fashion",
      "Fitness"
    ],
    "contentTypes": [
      "Skits",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexwave"
      }
    ],
    "photo": "demo_avatars/alexwave.png"
  },
  {
    "displayName": "MorganCreator",
    "username": "@morgancreator",
    "bio": "Creative beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TN",
      "city": "Nashville"
    },
    "niches": [
      "Comedy",
      "Beauty"
    ],
    "contentTypes": [
      "Tutorials",
      "Skits"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morgancreator"
      }
    ],
    "photo": "demo_avatars/morgancreator.png"
  },
  {
    "displayName": "SkylarSync",
    "username": "@skylarsync",
    "bio": "Authentic comedy creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "MA",
      "city": "Boston"
    },
    "niches": [
      "Fitness",
      "Comedy"
    ],
    "contentTypes": [
      "Tutorials",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarsync"
      }
    ],
    "photo": "demo_avatars/skylarsync.png"
  },
  {
    "displayName": "AverySync",
    "username": "@averysync",
    "bio": "Passionate beauty creator sharing real moments.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "AZ",
      "city": "Phoenix"
    },
    "niches": [
      "Travel",
      "DIY & Crafts"
    ],
    "contentTypes": [
      "Q&A",
      "Tutorials"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/averysync"
      }
    ],
    "photo": "demo_avatars/averysync.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Authentic fashion creator sharing real moments.",
    "pronouns": "he/him",
    "availability": "weekends",
    "userLocation": {
      "country": "USA",
      "state": "NY",
      "city": "New York"
    },
    "niches": [
      "Food & Cooking",
      "Travel"
    ],
    "contentTypes": [
      "Animations",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "RileySync",
    "username": "@rileysync",
    "bio": "Authentic travel creator sharing bold ideas.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "TX",
      "city": "Austin"
    },
    "niches": [
      "Tech",
      "Comedy"
    ],
    "contentTypes": [
      "Tutorials",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/rileysync"
      }
    ],
    "photo": "demo_avatars/rileysync.png"
  },
  {
    "displayName": "AlexFlare",
    "username": "@alexflare",
    "bio": "Authentic beauty creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "CO",
      "city": "Denver"
    },
    "niches": [
      "Beauty",
      "Comedy"
    ],
    "contentTypes": [
      "Livestreams",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/alexflare"
      }
    ],
    "photo": "demo_avatars/alexflare.png"
  },
  {
    "displayName": "SkylarSync",
    "username": "@skylarsync",
    "bio": "Passionate food & cooking creator sharing daily stories.",
    "pronouns": "she/her",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "FL",
      "city": "Miami"
    },
    "niches": [
      "Tech",
      "Gaming"
    ],
    "contentTypes": [
      "Livestreams",
      "Animations"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/skylarsync"
      }
    ],
    "photo": "demo_avatars/skylarsync.png"
  },
  {
    "displayName": "JordanSync",
    "username": "@jordansync",
    "bio": "Authentic diy & crafts creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "full-time",
    "userLocation": {
      "country": "USA",
      "state": "WA",
      "city": "Seattle"
    },
    "niches": [
      "DIY & Crafts",
      "Tech"
    ],
    "contentTypes": [
      "Q&A",
      "Livestreams"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/jordansync"
      }
    ],
    "photo": "demo_avatars/jordansync.png"
  },
  {
    "displayName": "QuinnDrive",
    "username": "@quinndrive",
    "bio": "Passionate fitness creator sharing daily stories.",
    "pronouns": "they/them",
    "availability": "mornings",
    "userLocation": {
      "country": "USA",
      "state": "NV",
      "city": "Las Vegas"
    },
    "niches": [
      "Fashion",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Q&A",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/quinndrive"
      }
    ],
    "photo": "demo_avatars/quinndrive.png"
  },
  {
    "displayName": "MorganFlare",
    "username": "@morganflare",
    "bio": "Creative food & cooking creator sharing real moments.",
    "pronouns": "they/them",
    "availability": "nights",
    "userLocation": {
      "country": "USA",
      "state": "MI",
      "city": "Detroit"
    },
    "niches": [
      "Beauty",
      "Food & Cooking"
    ],
    "contentTypes": [
      "Livestreams",
      "Music Videos"
    ],
    "links": [
      {
        "platform": "instagram",
        "url": "https://instagram.com/morganflare"
      }
    ],
    "photo": "demo_avatars/morganflare.png"
  }



  ];

  for (const demo of demoUsers) {
    try {
      const id = `demo_${demo.username.replace("@", "")}`;
      const userRef = doc(db, "users", id);

 

      await setDoc(userRef, {
        displayName: demo.displayName,
        username: demo.username,
        bio: demo.bio,
        pronouns: demo.pronouns,
        availability: demo.availability,
        userLocation: demo.userLocation,
        contentTypes: demo.contentTypes,
        niches: demo.niches,
        links: demo.links,
        createdAt: serverTimestamp(),
        status: "active",
        role: "demo",
        verified: false,
        photoURL: demo.photo,
        badge: "🔧 Demo Profile – used to showcase features"
      });

      console.log(`✅ Created: ${demo.username}`);
    } catch (err) {
      console.error(`❌ Error creating ${demo.username}:`, err);
    }
  }

  showModal({
    title: "Demo Users Created",
    message: "Seeded demo users successfully!",
    autoClose: 3000
  });
}

document.getElementById("seedDemoUsers").addEventListener("click", createDemoProfiles);


function editUserProfile(demoUserData) {
  if (!demoUserData) return;

  const username = demoUserData.username?.replace("@", "") || "";
  const { displayName, bio, pronouns, availability, userLocation, niches, contentTypes, links, photoURL } = demoUserData;

  document.getElementById("demoUsername").value = username;
  document.getElementById("demoDisplayName").value = displayName || "";
  document.getElementById("demoBio").value = bio || "";
  document.getElementById("demoPronouns").value = pronouns || "";
  document.getElementById("demoAvailability").value = availability || "";

  document.getElementById("demoCountry").value = userLocation?.country || "";
  document.getElementById("demoState").value = userLocation?.state || "";
  document.getElementById("demoCity").value = userLocation?.city || "";

  document.getElementById("demoNiches").value = (niches || []).join(", ");
  document.getElementById("demoContentTypes").value = (contentTypes || []).join(", ");

  // Format links into "platform|url" format
  document.getElementById("demoLinks").value = (links || []).map(link => `${link.platform}|${link.url}`).join(", ");

  // Optional: show existing photo
  if (photoURL) {
    const preview = document.getElementById("demoPhotoPreview");
    if (preview) {
      preview.src = photoURL;
      preview.classList.remove("d-none");
    }
  }

  // Optionally scroll to form or open modal if form is hidden
  const form = document.getElementById("demoUserForm");
  if (form) {
    form.scrollIntoView({ behavior: "smooth" });
    form.classList.remove("d-none"); // if it's hidden by default
  }
}

document.getElementById("demoUserForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("demoUsername").value.trim().replace('@', '');
  const id = `demo_${username}`;
  const userRef = doc(db, "users", id);

  const displayName = document.getElementById("demoDisplayName").value.trim();
  const bio = document.getElementById("demoBio").value.trim();
  const pronouns = document.getElementById("demoPronouns").value.trim();
  const availability = document.getElementById("demoAvailability").value.trim();

  const userLocation = {
    country: document.getElementById("demoCountry").value.trim(),
    state: document.getElementById("demoState").value.trim(),
    city: document.getElementById("demoCity").value.trim()
  };

  const niches = document.getElementById("demoNiches").value.split(",").map(n => n.trim());
  const contentTypes = document.getElementById("demoContentTypes").value.split(",").map(c => c.trim());

  const rawLinks = document.getElementById("demoLinks").value.split(",").map(pair => {
    const [platform, url] = pair.split("|");
    return { platform: platform?.trim(), url: url?.trim() };
  }).filter(link => link.url);

  const file = document.getElementById("demoPhoto").files[0];

  let photoURL = "";
  let isNew = false;

  const existingSnap = await getDoc(userRef);

  // If file is uploaded, replace existing avatar
  if (file) {
    const avatarRef = ref(storage, `avatars/${id}`);
    await uploadBytes(avatarRef, file);
    photoURL = await getDownloadURL(avatarRef);
  } else {
    photoURL = existingSnap.exists() ? existingSnap.data().photoURL || "" : "";
  }

  const demoData = {
    displayName,
    username: `@${username}`,
    bio,
    pronouns,
    availability,
    userLocation,
    contentTypes,
    niches,
    links: rawLinks,
    status: "active",
    role: "demo",
    verified: false,
    photoURL,
    badge: "🔧 Demo Profile – used to showcase features"
  };

  // Only set createdAt on new users
  if (!existingSnap.exists()) {
    demoData.createdAt = serverTimestamp();
    isNew = true;
  }

  await setDoc(userRef, demoData, { merge: true });

  showModal({
    title: isNew ? "Demo User Created" : "Demo User Updated",
    message: `@${username} has been ${isNew ? 'added' : 'updated'}.`,
    autoClose: 3000
  });

  e.target.reset();

  // Optional: hide preview if you're showing it
  const preview = document.getElementById("demoPhotoPreview");
  if (preview) preview.classList.add("d-none");
});
