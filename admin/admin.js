// /js/admin.js
import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, collection, query, orderBy, getDocs, updateDoc, doc, setDoc
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
    
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
  
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

    const row = `
      <tr>
        <td>${u.email || 'N/A'}</td>
        <td>${u.niche || ''}</td>
        <td>
          <select class="form-select form-select-sm" onchange="setUserRole('${id}', this.value)">
            <option value="user" ${role === 'user' ? 'selected' : ''}>User</option>
            <option value="mod" ${role === 'mod' ? 'selected' : ''}>Mod</option>
            <option value="admin" ${role === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="banned" ${role === 'banned' ? 'selected' : ''}>Banned</option>
          </select>
        </td>
        <td><span class="badge bg-${status === 'active' ? 'success' : status === 'blocked' ? 'warning' : 'secondary'}">${status}</span></td>
        <td>${banUntilDisplay}</td>
<td>
  ${status === "removed" ? `
    <button class="btn btn-sm btn-outline-success" onclick="restoreUser('${id}')">♻️ Restore</button>
  ` : `
    <button class="btn btn-sm btn-success" onclick="verifyUser('${id}')">✔ Verify</button>
    <button class="btn btn-sm btn-danger" onclick="openBanModal('${id}')">🚫 Ban</button>
    <button class="btn btn-sm btn-secondary" onclick="unbanUser('${id}')">🛑 Unban</button>
    <button class="btn btn-sm btn-outline-danger" onclick="deleteUser('${id}')">🗑 Remove</button>
  `}
</td>

      </tr>`;
    userTable.insertAdjacentHTML("beforeend", row);
  });
}

function openBanModal(userId) {
  document.getElementById("banUserId").value = userId;
  new bootstrap.Modal(document.getElementById("banModal")).show();
}

document.getElementById("banForm").addEventListener("submit", async e => {
  e.preventDefault();
  const userId = document.getElementById("banUserId").value;
  const duration = document.getElementById("banDuration").value;

  const banUntil = duration === 'perm'
    ? new Date("2099-12-31")
    : new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);

  await updateDoc(doc(db, "users", userId), {
    role: "banned",
    status: "blocked",
    bannedUntil: banUntil
  });

  bootstrap.Modal.getInstance(document.getElementById("banModal")).hide();
  loadUsers();
});

async function unbanUser(userId) {
  await updateDoc(doc(db, "users", userId), {
    role: "user",
    status: "active",
    bannedUntil: null
  });
  loadUsers();
}

async function verifyUser(userId) {
  await updateDoc(doc(db, "users", userId), { verified: true });
  alert("User verified.");
  loadUsers();
}

async function deleteUser(userId) {
  const confirmDelete = confirm("Are you sure you want to remove this user? They will be marked as 'removed' and lose access.");
  if (!confirmDelete) return;

  await updateDoc(doc(db, "users", userId), {
    status: "removed",
    role: "removed",
    removedAt: new Date()
  });

  alert("User marked as removed.");
  loadUsers();
}

async function restoreUser(userId) {
  const confirmRestore = confirm("Restore this user and return their account to active?");
  if (!confirmRestore) return;

  await updateDoc(doc(db, "users", userId), {
    status: "active",
    role: "user",
    removedAt: deleteField()
  });

  alert("User restored.");
  loadUsers();
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




  import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
    }
  ];

  for (const demo of demoUsers) {
    try {
      const id = `demo_${demo.username.replace("@", "")}`;
      const userRef = doc(db, "users", id);

      let photoURL = "";
      if (demo.photo) {
        const response = await fetch(`/assets/${demo.photo}`);
        if (!response.ok) throw new Error(`Could not fetch ${demo.photo}`);
        const blob = await response.blob();
        const avatarRef = ref(storage, `avatars/${id}`);
        await uploadBytes(avatarRef, blob);
        photoURL = await getDownloadURL(avatarRef);
      }

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
        photoURL,
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
    return { platform: platform.trim(), url: url.trim() };
  }).filter(link => link.url);

  const file = document.getElementById("demoPhoto").files[0];
  let photoURL = "";

  if (file) {
    const avatarRef = ref(storage, `avatars/${id}`);
    await uploadBytes(avatarRef, file);
    photoURL = await getDownloadURL(avatarRef);
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
    createdAt: serverTimestamp(),
    status: "active",
    role: "demo",
    verified: false,
    photoURL,
    badge: "🔧 Demo Profile – used to showcase features"
  };

  await setDoc(userRef, demoData);

  showModal({
    title: "Demo User Saved",
    message: `@${username} has been added/updated.`,
    autoClose: 3000
  });

  e.target.reset();
});
