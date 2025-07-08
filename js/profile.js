import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";
import { app }  from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

let currentUser, viewingUserId;

// Load Profile
onAuthStateChanged(auth, async user => {
  if (!user) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");

  } 
  
  currentUser = user;


  // Check if viewing someone else's profile via URL ?uid=xxxx
  // Extract UID from URL or fallback to current user
const params = new URLSearchParams(location.search);
viewingUserId = params.get('uid') || currentUser.uid;

const userDoc = await getDoc(doc(db, "users", viewingUserId));
const data = userDoc.data();
document.getElementById("displayName").innerText = data.displayName || 'Anonymous';


  // Grab DOM elements
  const collabBtn = document.getElementById("collabBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const analyticsBtn = document.getElementById("analyticsBtn");
const userBtns = document.querySelectorAll(".userBtns");


  // Show/hide profile owner controls
  const isOwnerView = !viewingUserId || viewingUserId === currentUser.uid;


    // Show/hide collab button
if (isOwnerView) {
  collabBtn?.remove(); // Completely removes the button from the DOM
} else {
  collabBtn.onclick = () => {
    collabBtn.dataset.viewingUserId = viewingUserId;
    collabBtn.dataset.username = data.username;
    collabBtn.dataset.displayName = data.displayName;
  };
}


if (!isOwnerView) {
  editProfileBtn?.remove();
  analyticsBtn?.remove();
} else {
  editProfileBtn.style.display = "inline-block";
  analyticsBtn.style.display = "inline-block";
}

userBtns.forEach(btn => {
  if (!isOwnerView) {
    btn.remove(); // Completely remove if not the owner
  }
});



document.getElementById("usernameText").textContent = data.username || "";
document.getElementById("pronounsText").innerHTML = data.pronouns ? `<i class="bi bi-person"></i> ${data.pronouns}` : "";
document.getElementById("availabilityText").innerHTML = data.availability ? `<i class="bi bi-clock-history"></i> ${data.availability}` : "";


document.getElementById("bioText").innerText = data.bio || '';

// Location (as a link to creators filtered by location if available)
const locationText = document.getElementById("locationText");
if (data.userLocation?.country) {
  const { city, state, country } = data.userLocation;
  const locationParts = [city, state, country].filter(Boolean);
  const locationStr = locationParts.join(", ");
  const locationParam = encodeURIComponent(locationParts.join("-").toLowerCase());
  locationText.innerHTML = `<a href="https://rw-501.github.io/contenthub/pages/creators.html?location=${locationParam}" class="text-decoration-none">${locationStr}</a>`;
} else {
  locationText.innerHTML = '';
}

// Content Type Badges with links
document.getElementById("contentTypeText").innerHTML = Array.isArray(data.contentTypes)
  ? data.contentTypes.map(ct =>
      `<a href="https://rw-501.github.io/contenthub/pages/creators.html?type=${encodeURIComponent(ct.toLowerCase())}" 
         class="badge bg-secondary text-light me-1 mb-1 text-decoration-none">
         ${ct}
       </a>`
    ).join('')
  : '';

// Niche Badges with links
document.getElementById("nicheText").innerHTML = Array.isArray(data.niches)
  ? data.niches.map(n =>
      `<a href="https://rw-501.github.io/contenthub/pages/creators.html?niche=${encodeURIComponent(n.toLowerCase())}" 
         class="badge bg-light text-dark border me-1 mb-1 text-decoration-none">
         ${n}
       </a>`
    ).join('')
  : '';



document.getElementById("profilePhoto").src = data.photoURL || '/assets/default-avatar.png';

const socialContainer = document.getElementById("socialLinks");
socialContainer.innerHTML = "";


const platformIcons = {
  instagram: "bi bi-instagram",
  tiktok: "bi bi-tiktok",
  youtube: "bi bi-youtube",
  facebook: "bi bi-facebook",
  twitter: "bi bi-twitter",
  linkedin: "bi bi-linkedin",
  twitch: "bi bi-twitch",
  threads: "bi bi-threads",
  snapchat: "bi bi-snapchat",
  pinterest: "bi bi-pinterest",
  reddit: "bi bi-reddit",
  other: "bi bi-link-45deg"
};

if (Array.isArray(data.links)) {
  data.links.forEach(linkObj => {
    const { platform, url } = linkObj;
    const icon = platformIcons[platform?.toLowerCase()] || platformIcons.other;
    const isVerified = data.verifiedPlatforms?.[platform.toLowerCase()] === true;

    const a = document.createElement("a");
    a.href = url.trim();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "btn btn-sm btn-outline-secondary me-1";
    a.innerHTML = `
      <i class="${icon}"></i>
      ${isVerified ? '<i class="bi bi-patch-check-fill text-primary ms-1" title="Verified"></i>' : ''}
    `;
    socialContainer.appendChild(a);
  });
}



  // Show follow button only when viewing others
  const followBtn = document.getElementById("followBtn");
  if (!isOwnerView) {
    followBtn.style.display = "inline-block";
    if ((data.followers || []).includes(currentUser.uid)) {
      followBtn.innerText = "Unfollow";
      followBtn.onclick = () => unfollowUser(viewingUserId);
    } else {
      followBtn.innerText = "Follow";
      followBtn.onclick = () => followUser(viewingUserId);
    }
  } else {
    followBtn.style.display = "none";
    followBtn?.remove(); // Completely removes the button from the DOM

  }




checkNameChangeEligibility(data); 
loadUserPosts(viewingUserId, data.displayName, data.photoURL);
loadUserCollabs(viewingUserId);
loadFollowingList(data);
loadFollowersList(data);
loadAnalytics(viewingUserId);

});

const userCache = {};

async function getUserFromCache(uid) {
  if (!userCache[uid]) {
    const docSnap = await getDoc(doc(db, "users", uid));
    userCache[uid] = docSnap.data();
  }
  return userCache[uid];
}

async function loadFollowingList(data) {
  const list = document.getElementById("followingList");
  list.innerHTML = `<small class="text-muted">${data.following?.length || 0} Following</small>`;

  if (!data.following || data.following.length === 0) {
    list.innerHTML += `<li class='list-group-item text-muted'>Not following anyone yet.       
     <br>
        <a href="https://rw-501.github.io/contenthub/pages/explore.html" class="btn btn-outline-primary btn-sm mt-2">
          🤝 Follow some creators 
        </a>
      </li>`;
    return;
  }

  let start = 0;
  const limit = 10;

  const renderNext = async () => {
    const slice = data.following.slice(start, start + limit);
    const userDocs = await Promise.all(slice.map(uid => getUserFromCache(uid)));
userDocs.forEach(u => {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex align-items-center justify-content-between";

  const profileLink = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.uid}`;
  const niches = Array.isArray(u.niches) ? u.niches : [];

  // Convert niches to linked badges
  const badges = niches.map(niche =>
    `<a href="https://rw-501.github.io/contenthub/pages/creators.html?niche=${encodeURIComponent(niche)}"
        class="badge bg-primary text-decoration-none me-1">
      ${niche}
    </a>`
  ).join("");

  li.innerHTML = `
    <div class="d-flex align-items-center flex-wrap">
      <img src="${u.photoURL || '/assets/default-avatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
      <a href="${profileLink}" class="btn btn-link p-0 m-0 text-decoration-none">
        <strong>${u.displayName || "Unnamed"}</strong>
      </a>
      <div class="ms-3 d-flex flex-wrap">
        ${badges}
      </div>
    </div>
  `;

  list.appendChild(li);
});


    start += limit;

    if (start < data.following.length) {
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.className = "btn btn-link w-100 mt-2";
      loadMoreBtn.textContent = "Load more";
      loadMoreBtn.onclick = () => {
        loadMoreBtn.remove();
        renderNext();
      };
      list.appendChild(loadMoreBtn);
    }
  };

  renderNext();
}

async function loadFollowersList(data) {
  const list = document.getElementById("followersList");
  list.innerHTML = `<small class="text-muted">${data.followers?.length || 0} Followers</small>`;

  if (!data.followers || data.followers.length === 0) {
    list.innerHTML += "<li class='list-group-item text-muted'>No followers yet.</li>";
    return;
  }

  let start = 0;
  const limit = 10;

  const renderNext = async () => {
    const slice = data.followers.slice(start, start + limit);
    const userDocs = await Promise.all(slice.map(uid => getUserFromCache(uid)));

userDocs.forEach(u => {
  const li = document.createElement("li");
  li.className = "list-group-item d-flex align-items-center justify-content-between";

  const profileLink = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.uid}`;
  const niches = Array.isArray(u.niches) ? u.niches : [];

  // Convert niches to linked badges
  const badges = niches.map(niche =>
    `<a href="https://rw-501.github.io/contenthub/pages/creators.html?niche=${encodeURIComponent(niche)}"
        class="badge bg-primary text-decoration-none me-1">
      ${niche}
    </a>`
  ).join("");

  li.innerHTML = `
    <div class="d-flex align-items-center flex-wrap">
      <img src="${u.photoURL || '/assets/default-avatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
      <a href="${profileLink}" class="btn btn-link p-0 m-0 text-decoration-none">
        <strong>${u.displayName || "Unnamed"}</strong>
      </a>
      <div class="ms-3 d-flex flex-wrap">
        ${badges}
      </div>
    </div>
  `;

  list.appendChild(li);
});



    start += limit;

    if (start < data.followers.length) {
      const loadMoreBtn = document.createElement("button");
      loadMoreBtn.className = "btn btn-link w-100 mt-2";
      loadMoreBtn.textContent = "Load more";
      loadMoreBtn.onclick = () => {
        loadMoreBtn.remove();
        renderNext();
      };
      list.appendChild(loadMoreBtn);
    }
  };

  renderNext();
}

// Unfollow user
async function unfollowUser(uid) {
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    following: arrayRemove(uid)
  });
  showModal({ title: "Success!", message: "Unfollowed!", autoClose: 3000 });
  location.reload();
}

// Follow user
async function followUser(uid) {
  const userRef = doc(db, "users", currentUser.uid);
  await updateDoc(userRef, {
    following: arrayUnion(uid)
  });
  showModal({ title: "Success!", message: "Followed!", autoClose: 3000 });
  location.reload();
}


async function loadUserPosts(uid, displayName, photoURL) {
  const postGrid = document.getElementById("postsGrid");
  postGrid.innerHTML = "";

  const q = query(collection(db, "posts"), where("owner", "==", uid), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    postGrid.innerHTML = `
      <div class="col-12 text-center text-muted mt-3">
        <p>No posts yet.</p>
        <a href="/pages/post.html" class="btn btn-primary btn-sm">🚀 Create your first post</a>
      </div>`;
    return;
  }

  for (const docSnap of snapshot.docs) {
    const post = docSnap.data();
    const card = document.createElement("div");
    card.className = "card mb-3 shadow-sm";

    const mediaUrl = post.media?.[0]?.url || "";
    const mediaType = post.media?.[0]?.type || "";
    let mediaHTML = "";



if (mediaUrl) {
  // YouTube
  if (/youtube\.com|youtu\.be/.test(mediaUrl)) {
    const embed = mediaUrl.includes("watch?v=")
      ? mediaUrl.replace("watch?v=", "embed/")
      : mediaUrl.replace("youtu.be/", "youtube.com/embed/");
    mediaHTML = `<iframe width="100%" height="200" src="${embed}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Vimeo
  else if (/vimeo\.com/.test(mediaUrl)) {
    const id = mediaUrl.split("/").pop();
    mediaHTML = `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Dailymotion
  else if (/dailymotion\.com/.test(mediaUrl)) {
    const id = mediaUrl.split("/").pop();
    mediaHTML = `<iframe src="https://www.dailymotion.com/embed/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitch
  else if (/twitch\.tv/.test(mediaUrl)) {
    const id = mediaUrl.split("/").pop();
    mediaHTML = `<iframe src="https://player.twitch.tv/?video=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Facebook
  else if (/facebook\.com/.test(mediaUrl)) {
    const id = mediaUrl.split("/").pop();
    mediaHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=https://www.facebook.com/video.php?v=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Instagram
  else if (/instagram\.com/.test(mediaUrl)) {
    const id = mediaUrl.split("/p/").pop().split("/")[0];
    mediaHTML = `<iframe src="https://www.instagram.com/p/${id}/embed" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitter
  else if (/twitter\.com/.test(mediaUrl)) {
    mediaHTML = `<iframe src="https://twitframe.com/show?url=${encodeURIComponent(mediaUrl)}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // TikTok
  else if (/tiktok\.com/.test(mediaUrl)) {
    const id = mediaUrl.split("/video/").pop();
    mediaHTML = `<iframe src="https://www.tiktok.com/embed/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Firebase Storage or Direct Video Links
  else if (
    mediaUrl.includes("firebasestorage.googleapis.com") ||
    /\.(mp4|webm|ogg)$/i.test(mediaUrl)
  ) {
    mediaHTML = `<video src="${mediaUrl}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
  }

  // Fallback to image
  else {
    mediaHTML = `<img src="${mediaUrl}" alt="Post media" style="width:100%; max-height:200px; object-fit:cover;" />`;
  }

}


    const createdAt = post.createdAt?.toDate?.() || new Date();
    const timeAgo = timeSince(createdAt.getTime());

    card.innerHTML = `
      ${mediaHTML}
      <div class="card-body">
        <div class="d-flex align-items-center mb-2">
          <img src="${photoURL || 'https://via.placeholder.com/40'}" class="creator-avata rounded-circle me-2" width="40" height="40" />
          <a href="/pages/profile.html?uid=${uid}" class="fw-bold text-decoration-none">${displayName}</a>
        </div>

        <p class="card-text">${linkify(sanitize(post.caption || ""))}</p>

        <small class="text-muted d-block mb-2">${timeAgo} • 
          <span id="like-count-${docSnap.id}">${post.likes || 0}</span> Likes • 
          ${post.views || 0} Views
        </small>

        <button class="btn btn-sm btn-outline-danger" id="like-btn-${docSnap.id}">
          ❤️ Like
        </button>
      </div>
    `;

    const likeBtn = card.querySelector(`#like-btn-${docSnap.id}`);
    const likeCountEl = card.querySelector(`#like-count-${docSnap.id}`);

    likeBtn.addEventListener("click", async () => {
      const postRef = doc(db, "posts", docSnap.id);
      await updateDoc(postRef, { likes: increment(1) });
      likeCountEl.textContent = (parseInt(likeCountEl.textContent) || 0) + 1;
    });

    postGrid.appendChild(card);
  }
}


// Load Collabs
async function loadUserCollabs(uid) {
  const list = document.getElementById("collabList");
  const currentUserId = uid;
  list.innerHTML = `<li class="list-group-item text-muted">Loading collaborations...</li>`;

  try {
    const q = query(collection(db, "collaborations"), where("participants", "array-contains", uid));
    const snapshot = await getDocs(q);
    list.innerHTML = "";

    if (snapshot.empty) {
      list.innerHTML = `
        <li class="list-group-item text-muted text-center">
          No collaborations yet.
          <br>
          <a href="https://rw-501.github.io/contenthub/pages/explore.html" class="btn btn-outline-primary btn-sm mt-2">
            🤝 Find creators to collaborate with
          </a>
        </li>`;
      return;
    }

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const id = docSnap.id;
      const isPublic = data.isPublic === true;
      const alreadyJoined = data.participants.includes(currentUserId);
      const progress = data.progress || 0;
      const status = data.status || "active";
      const title = data.title || "Untitled Collaboration";

      const item = document.createElement("li");
      item.className = "list-group-item";

      item.innerHTML = `
        <strong>${title}</strong>
        ${isPublic ? `<span class="badge bg-info ms-2">Public</span>` : ""}
        <div class="small text-muted">Status: ${status}</div>
        <div class="progress my-2" style="height: 16px;">
          <div class="progress-bar bg-success" role="progressbar" style="width: ${progress}%;" 
            aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100">
            ${progress}%
          </div>
        </div>
        ${isPublic && !alreadyJoined && currentUserId !== uid
          ? `<button class="btn btn-sm btn-outline-primary" onclick="requestToJoin('${id}', '${data.owner}')">Request to Join</button>`
          : ""
        }
      `;

      list.appendChild(item);
    });
  } catch (error) {
    console.error("[loadUserCollabs] Error:", error);
    list.innerHTML = `<li class="list-group-item text-danger">Failed to load collaborations.</li>`;
  }
}

async function requestToJoin(collabId, ownerId) {
  try {
    if (!user || !user.uid) {
      alert("⚠️ Please log in to request to join.");
      return;
    }

    console.log("[requestToJoin] userId:", user.uid);
    console.log("[requestToJoin] collabId:", collabId);
    console.log("[requestToJoin] ownerId:", ownerId);

    const requestsRef = collection(db, "collabJoinRequests");

    // Check if request already exists
    const existingSnap = await getDocs(query(
      requestsRef,
      where("userId", "==", user.uid),
      where("collabId", "==", collabId),
      where("status", "in", ["pending", "approved"])
    ));

    if (!existingSnap.empty) {
      showModal({
        title: "Already Requested",
        message: "You've already requested to join this collaboration.",
        autoClose: 3000
      });
      return;
    }

    // Create the request
    await addDoc(requestsRef, {
      userId: user.uid,
      collabId,
      ownerId,
      status: "pending",
      timestamp: serverTimestamp()
    });

    console.log("[requestToJoin] Request successfully submitted");

    showModal({
      title: "Request Sent",
      message: "Your request to join has been sent.",
      autoClose: 3000
    });

  } catch (error) {
    console.error("[requestToJoin] Error:", error);
    alert("❌ Failed to send join request. Please try again.");
  }
}

window.requestToJoin = requestToJoin;

// Load Analytics
async function loadAnalytics(uid) {
  const list = document.getElementById("analyticsList");
  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);
  const posts = snapshot.docs.map(doc => doc.data());
  const sorted = posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
  list.innerHTML = "";
  sorted.slice(0, 5).forEach(post => {
    const item = document.createElement("li");
    item.className = "list-group-item";
    item.innerText = `${post.caption || 'Post'} - Likes: ${post.likes || 0}`;
    list.appendChild(item);
  });
}

let lastNameChange = null; // Fetched from Firestore user metadata

async function checkNameChangeEligibility(userData) {
  const nameInput = document.getElementById("editUsername");
  const note = document.getElementById("nameChangeNote");

  // Handle new users with no lastNameChange
  if (!userData.lastNameChange) {
    nameInput.disabled = false;
    note.textContent = "You can update your display name.";
    return;
  }

  // Convert Firestore Timestamp to Date
  lastNameChange = userData.lastNameChange.toDate();
  const now = new Date();
  const diffDays = Math.floor((now - lastNameChange) / (1000 * 60 * 60 * 24));
  const canChange = diffDays >= 90;

  if (canChange) {
    nameInput.disabled = false;
    note.textContent = "You can update your display name.";
  } else {
    nameInput.disabled = true;
    note.innerHTML = `You can change your name again in <strong>${90 - diffDays}</strong> days or <a href="#" onclick="openSupportTicket('name_change')">submit a ticket</a>.`;
  }
}


  // Preview photo
  document.getElementById("editPhoto").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.getElementById("photoPreview");
        img.src = reader.result;
        img.classList.remove("d-none");
      };
      reader.readAsDataURL(file);
    }
  });


  function openSupportTicket(type) {
    // placeholder logic for now
    alert(`Ticket for "${type.replace('_', ' ')}" submitted. We'll review your request.`);
    // You'd actually write this to a Firestore collection like `tickets`
  }

window.openSupportTicket = openSupportTicket;

// Store selected content types
const selectedContentTypes = new Set();

const contentTypeInput = document.getElementById("contentTypeInput");
const contentTypeWrapper = document.getElementById("contentTypeWrapper");

contentTypeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && contentTypeInput.value.trim() !== "") {
    e.preventDefault();
    const value = contentTypeInput.value.trim();
    if (!selectedContentTypes.has(value)) {
      selectedContentTypes.add(value);
      const tag = document.createElement("span");
      tag.className = "badge bg-secondary me-2 mb-1";
      tag.textContent = value;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-close btn-close-white btn-sm ms-2";
      removeBtn.style.fontSize = "0.6rem";
      removeBtn.onclick = () => {
        selectedContentTypes.delete(value);
        contentTypeWrapper.removeChild(tagWrapper);
      };

      const tagWrapper = document.createElement("div");
      tagWrapper.className = "d-flex align-items-center bg-dark text-white rounded px-2 py-1 me-2 mb-1";
      tagWrapper.appendChild(tag);
      tagWrapper.appendChild(removeBtn);

      contentTypeWrapper.insertBefore(tagWrapper, contentTypeInput);
      contentTypeInput.value = "";
    }
  }
});

const selectedNiches = new Set();

  const nicheInput = document.getElementById("nicheInput");
  const nicheTagWrapper = document.getElementById("nicheTagWrapper");


  nicheInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && nicheInput.value.trim() !== "") {
    e.preventDefault();
    const value = nicheInput.value.trim();
    if (!selectedNiches.has(value)) {
      selectedNiches.add(value);
      const tag = document.createElement("span");
      tag.className = "badge bg-secondary me-2 mb-1";
      tag.textContent = value;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn-close btn-close-white btn-sm ms-2";
      removeBtn.style.fontSize = "0.6rem";
      removeBtn.onclick = () => {
        selectedNiches.delete(value);
        nicheTagWrapper.removeChild(tagWrapper);
      };

      const tagWrapper = document.createElement("div");
      tagWrapper.className = "d-flex align-items-center bg-dark text-white rounded px-2 py-1 me-2 mb-1";
      tagWrapper.appendChild(tag);
      tagWrapper.appendChild(removeBtn);

      nicheTagWrapper.insertBefore(tagWrapper, nicheInput);
      nicheInput.value = "";
    }
  }
});

  // Save profile changes
  document.getElementById("editProfileForm").addEventListener("submit", async e => {
    e.preventDefault();

    const displayName = document.getElementById("editName").value.trim();
    let username = document.getElementById("editUsername").value.trim();
if (username && !username.startsWith("@")) {
  username = "@" + username;
}
    const bio = document.getElementById("editBio").value.trim();
    const pronouns = document.getElementById("editPronouns").value;
    const availability = document.getElementById("editAvailability").value;

    const countrySelect = document.getElementById("countrySelect");
    const stateSelect = document.getElementById("stateSelect");
    const citySelect = document.getElementById("citySelect");
    const userLocation = {
  country: countrySelect.value,
  state: stateSelect.value,
  city: citySelect.value
};

const contentTypes = Array.from(selectedContentTypes);
const niches = Array.from(selectedNiches);

const rawLinks = [ 
  { platform: "instagram", url: document.getElementById("editLink1").value.trim() },
  { platform: "tiktok", url: document.getElementById("editLink2").value.trim() },
  { platform: "youtube", url: document.getElementById("editLink3").value.trim() },
  { platform: "facebook", url: document.getElementById("editLink4").value.trim() },
  { platform: "twitch", url: document.getElementById("editLink5").value.trim() },
  { platform: "threads", url: document.getElementById("editLink6").value.trim() },
  { platform: "snapchat", url: document.getElementById("editLink7").value.trim() },
  { platform: "pinterest", url: document.getElementById("editLink8").value.trim() },
  { platform: "reddit", url: document.getElementById("editLink9").value.trim() }
].filter(link => link.url !== "");

const links = rawLinks.filter(link => link.url !== "");


    const file = document.getElementById("editPhoto").files[0];
    const userRef = doc(db, "users", currentUser.uid);
    const updates = { bio, contentTypes, niches, links, userLocation, displayName, username, pronouns, availability };

    if (!document.getElementById("editUsername").disabled) {
      updates.username = username;
      updates.lastNameChange = new Date(); // Track the name change
    }

    if (file) {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updates.photoURL = url;
    }

    await updateDoc(userRef, updates);

    
const modalEl = document.getElementById("editModal");
const modal = new bootstrap.Modal(modalEl);
modal.hide();


    showModal({
  title: "Success!",
  message: "Profile updated!",
  autoClose: 3000
});

modalEl.style.display = "none";

// Optionally reload user profile UI after 2 seconds
setTimeout(() => {
 // location.reload();
}, 2000);


  });

const socialPlatforms = {
  instagram: "https://instagram.com/",
  tiktok: "https://tiktok.com/@",
  youtube: "https://youtube.com/",
  facebook: "https://facebook.com/",
  twitch: "https://twitch.tv/",
  threads: "https://threads.net/",
  snapchat: "https://snapchat.com/add/",
  pinterest: "https://pinterest.com/",
  reddit: "https://reddit.com/u/"
};

  const verifyBtn = document.getElementById("verifyProfileBtn");
  const editProfileBtn = document.getElementById("editProfileBtn");
  const linkValidity = {}; // Store validity per platform

  function updateVerifyBtnState() {
    const allValid = Object.values(linkValidity).every(v => v !== false); // allow true or undefined
    verifyBtn.disabled = !allValid;
    editProfileBtn.disabled = !allValid;
  }

  Object.keys(socialPlatforms).forEach((platform, index) => {
    const input = document.getElementById(`editLink${index + 1}`);
    if (!input) return;

    const base = socialPlatforms[platform];

    // Create error message container
    const errorMsg = document.createElement("div");
    errorMsg.className = "text-danger small mt-1 d-none";
    input.insertAdjacentElement("afterend", errorMsg);

    input.addEventListener("change", async () => {
      let value = input.value.trim();
      linkValidity[platform] = undefined; // Reset status

      if (!value) {
        input.classList.remove("is-invalid");
        errorMsg.classList.add("d-none");
        updateVerifyBtnState();
        return;
      }

      // Format: only username → full URL
      if (!value.startsWith("http")) {
        value = base + value.replace(/^@/, "");
      }

      input.value = value;

      // Validate domain
      try {
        const url = new URL(value);
        if (!url.hostname.includes(new URL(base).hostname)) {
          throw new Error("Domain mismatch");
        }

        // Now do a CORS-safe check
        errorMsg.textContent = "Checking link...";
        errorMsg.classList.remove("d-none");
        input.classList.remove("is-invalid");

        try {
          const response = await fetch(value, { method: "HEAD", mode: "no-cors" });
          // We can't inspect response in no-cors, but assume it's okay if it doesn't throw

          linkValidity[platform] = true;
          errorMsg.classList.add("d-none");
          input.classList.remove("is-invalid");
          if(response){
          linkValidity[platform] = false;
errorMsg.textContent = `Unable to verify your ${platform} link. Please check the URL.`;
          errorMsg.classList.remove("d-none");
          input.classList.add("is-invalid");
          }
        } catch {
          linkValidity[platform] = false;
errorMsg.textContent = `Unable to verify your ${platform} link. Please check the URL.`;
          errorMsg.classList.remove("d-none");
          input.classList.add("is-invalid");
        }
      } catch (err) {
        linkValidity[platform] = false;
        errorMsg.textContent = `Please enter a valid ${platform} URL`;
        errorMsg.classList.remove("d-none");
        input.classList.add("is-invalid");
      }

      updateVerifyBtnState();
    });
  });

  updateVerifyBtnState(); // Initial check




    // Request verification
document.getElementById("verifyProfileBtn").addEventListener("click", async () => {
  const rawLinks = [ 
    { platform: "instagram", url: document.getElementById("editLink1").value.trim() },
    { platform: "tiktok", url: document.getElementById("editLink2").value.trim() },
    { platform: "youtube", url: document.getElementById("editLink3").value.trim() },
    { platform: "facebook", url: document.getElementById("editLink4").value.trim() },
    { platform: "twitch", url: document.getElementById("editLink5").value.trim() },
    { platform: "threads", url: document.getElementById("editLink6").value.trim() },
    { platform: "snapchat", url: document.getElementById("editLink7").value.trim() },
    { platform: "pinterest", url: document.getElementById("editLink8").value.trim() },
    { platform: "reddit", url: document.getElementById("editLink9").value.trim() }
  ].filter(link => link.url !== "");

  const verifiedPlatforms = {};

  // ✅ Very basic verification method: check if username appears in the URL
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.data();
const username = userData.username?.toLowerCase().replace(/^@/, "").replace(/\s/g, "");

  rawLinks.forEach(link => {
    const usernameMatch = link.url.toLowerCase().includes(username);
    if (usernameMatch) {
      verifiedPlatforms[link.platform] = true;
    }
  });

  await updateDoc(doc(db, "users", currentUser.uid), {
    links: rawLinks,
    verifiedPlatforms: verifiedPlatforms
  });


      updateVerifyBtnState();

  showModal({
    title: "Verification Requested",
    message: `
      <p class="mb-2">The system attempted automatic verification.</p>
      <p class="text-success">Verified: ${Object.keys(verifiedPlatforms).join(", ") || "None"}.</p>
    `,
    autoClose: 4000
  });

});




  // Load existing data into modal (call this when modal is opened)
  async function populateEditProfileModal() {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.data();

  // Initialize location dropdowns
  const countriesAndStates = {
  "United States": {
    "Alabama": ["Birmingham", "Montgomery", "Mobile", "Huntsville"],
    "Alaska": ["Anchorage", "Juneau", "Fairbanks"],
    "Arizona": ["Phoenix", "Tucson", "Mesa", "Scottsdale"],
    "Arkansas": ["Little Rock", "Fayetteville", "Fort Smith", "Springdale"],
    "California": ["Los Angeles", "San Diego", "San Francisco", "San Jose", "Sacramento"],
    "Colorado": ["Denver", "Colorado Springs", "Aurora", "Boulder"],
    "Connecticut": ["Bridgeport", "New Haven", "Hartford", "Stamford"],
    "Delaware": ["Wilmington", "Dover", "Newark"],
    "Florida": ["Miami", "Orlando", "Tampa", "Jacksonville"],
    "Georgia": ["Atlanta", "Savannah", "Augusta", "Columbus"],
    "Hawaii": ["Honolulu", "Hilo", "Kailua"],
    "Idaho": ["Boise", "Idaho Falls", "Meridian"],
    "Illinois": ["Chicago", "Springfield", "Naperville", "Peoria"],
    "Indiana": ["Indianapolis", "Fort Wayne", "Evansville", "South Bend"],
    "Iowa": ["Des Moines", "Cedar Rapids", "Davenport"],
    "Kansas": ["Wichita", "Topeka", "Overland Park"],
    "Kentucky": ["Louisville", "Lexington", "Bowling Green"],
    "Louisiana": ["New Orleans", "Baton Rouge", "Shreveport", "Lafayette"],
    "Maine": ["Portland", "Augusta", "Bangor"],
    "Maryland": ["Baltimore", "Annapolis", "Silver Spring"],
    "Massachusetts": ["Boston", "Worcester", "Springfield", "Cambridge"],
    "Michigan": ["Detroit", "Grand Rapids", "Ann Arbor", "Lansing"],
    "Minnesota": ["Minneapolis", "Saint Paul", "Duluth"],
    "Mississippi": ["Jackson", "Gulfport", "Hattiesburg"],
    "Missouri": ["Kansas City", "St. Louis", "Springfield", "Columbia"],
    "Montana": ["Billings", "Missoula", "Bozeman"],
    "Nebraska": ["Omaha", "Lincoln", "Bellevue"],
    "Nevada": ["Las Vegas", "Reno", "Henderson", "Carson City"],
    "New Hampshire": ["Manchester", "Nashua", "Concord"],
    "New Jersey": ["Newark", "Jersey City", "Paterson", "Trenton"],
    "New Mexico": ["Albuquerque", "Santa Fe", "Las Cruces"],
    "New York": ["New York City", "Buffalo", "Rochester", "Albany", "Syracuse"],
    "North Carolina": ["Charlotte", "Raleigh", "Durham", "Greensboro"],
    "North Dakota": ["Fargo", "Bismarck", "Grand Forks"],
    "Ohio": ["Columbus", "Cleveland", "Cincinnati", "Toledo"],
    "Oklahoma": ["Oklahoma City", "Tulsa", "Norman"],
    "Oregon": ["Portland", "Eugene", "Salem", "Beaverton"],
    "Pennsylvania": ["Philadelphia", "Pittsburgh", "Allentown", "Harrisburg"],
    "Rhode Island": ["Providence", "Warwick", "Cranston"],
    "South Carolina": ["Columbia", "Charleston", "Greenville"],
    "South Dakota": ["Sioux Falls", "Rapid City", "Pierre"],
    "Tennessee": ["Nashville", "Memphis", "Knoxville", "Chattanooga"],
    "Texas": ["Dallas", "Houston", "Austin", "San Antonio", "Fort Worth"],
    "Utah": ["Salt Lake City", "Provo", "Ogden", "St. George"],
    "Vermont": ["Burlington", "Montpelier", "Rutland"],
    "Virginia": ["Virginia Beach", "Richmond", "Norfolk", "Arlington"],
    "Washington": ["Seattle", "Spokane", "Tacoma", "Bellevue"],
    "West Virginia": ["Charleston", "Huntington", "Morgantown"],
    "Wisconsin": ["Milwaukee", "Madison", "Green Bay", "Kenosha"],
    "Wyoming": ["Cheyenne", "Casper", "Laramie"]
  },
  "Canada": {
    "Ontario": ["Toronto", "Ottawa", "Hamilton", "London"],
    "Quebec": ["Montreal", "Quebec City", "Laval", "Gatineau"],
    "British Columbia": ["Vancouver", "Victoria", "Surrey"],
    "Alberta": ["Calgary", "Edmonton", "Red Deer"],
    "Manitoba": ["Winnipeg", "Brandon"],
    "Nova Scotia": ["Halifax", "Sydney"]
  },
  "United Kingdom": {
    "England": ["London", "Manchester", "Birmingham", "Leeds"],
    "Scotland": ["Edinburgh", "Glasgow", "Aberdeen"],
    "Wales": ["Cardiff", "Swansea", "Newport"],
    "Northern Ireland": ["Belfast", "Derry"]
  },
  "Australia": {
    "New South Wales": ["Sydney", "Newcastle", "Wollongong"],
    "Victoria": ["Melbourne", "Geelong", "Ballarat"],
    "Queensland": ["Brisbane", "Gold Coast", "Cairns"],
    "Western Australia": ["Perth", "Fremantle"],
    "South Australia": ["Adelaide", "Mount Gambier"],
    "Tasmania": ["Hobart", "Launceston"]
  },
  "India": {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur"],
    "Delhi": ["New Delhi"],
    "Karnataka": ["Bangalore", "Mysore"],
    "Tamil Nadu": ["Chennai", "Coimbatore"],
    "West Bengal": ["Kolkata", "Howrah"],
    "Gujarat": ["Ahmedabad", "Surat"]
  }
};

const countrySelect = document.getElementById("countrySelect");
const stateSelect = document.getElementById("stateSelect");
const citySelect = document.getElementById("citySelect");
const locationStatus = document.getElementById("locationStatus");


// Populate countries dropdown
Object.keys(countriesAndStates).forEach(country => {
  const option = document.createElement("option");
  option.value = country;
  option.textContent = country;
  countrySelect.appendChild(option);
});

// When country changes, populate states/provinces
countrySelect.addEventListener("change", () => {
  const country = countrySelect.value;
  stateSelect.innerHTML = `<option value="">Select State/Province</option>`;
  citySelect.innerHTML = `<option value="">Select City</option>`;

  if (countriesAndStates[country]) {
    Object.keys(countriesAndStates[country]).forEach(state => {
      const option = document.createElement("option");
      option.value = state;
      option.textContent = state;
      stateSelect.appendChild(option);
    });
  }
});


  



// When state changes, populate cities
stateSelect.addEventListener("change", () => {
  const country = countrySelect.value;
  const state = stateSelect.value;
  citySelect.innerHTML = `<option value="">Select City</option>`;

  if (country && state && countriesAndStates[country] && countriesAndStates[country][state]) {
    countriesAndStates[country][state].forEach(city => {
      const option = document.createElement("option");
      option.value = city;
      option.textContent = city;
      citySelect.appendChild(option);
    });
  }
});


  



document.getElementById("detectLocationBtn").addEventListener("click", () => {
  locationStatus.textContent = "Detecting location...";
  navigator.geolocation.getCurrentPosition(async position => {
    const { latitude, longitude } = position.coords;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
      const data = await res.json();

      const city = data.address.city || data.address.town || data.address.village || "";
      const state = data.address.state || "";
      const country = data.address.country || "";

      if (country) {
        countrySelect.value = country;
        countrySelect.dispatchEvent(new Event("change"));

        setTimeout(() => {
          if (state) {
            // Select state if it exists in dropdown
            let foundState = false;
            [...stateSelect.options].forEach(option => {
              if (option.value.toLowerCase() === state.toLowerCase()) {
                stateSelect.value = option.value;
                foundState = true;
              }
            });

            if (!foundState && state !== "") {
              const opt = document.createElement("option");
              opt.value = state;
              opt.textContent = state;
              stateSelect.appendChild(opt);
              stateSelect.value = state;
            }
            stateSelect.dispatchEvent(new Event("change"));

            setTimeout(() => {
              // Select city if in dropdown
              let foundCity = false;
              [...citySelect.options].forEach(option => {
                if (option.value.toLowerCase() === city.toLowerCase()) {
                  citySelect.value = option.value;
                  foundCity = true;
                }
              });

              if (!foundCity && city !== "") {
                const opt = document.createElement("option");
                opt.value = city;
                opt.textContent = city;
                citySelect.appendChild(opt);
                citySelect.value = city;
              }

              locationStatus.textContent = `Detected: ${city}, ${state}, ${country}`;
            }, 200);
          } else {
            locationStatus.textContent = `Detected: ${country}`;
          }
        }, 200);
      } else {
        locationStatus.textContent = "Could not auto-detect location.";
      }
    } catch (err) {
      console.error(err);
      locationStatus.textContent = "Error retrieving location.";
    }
  }, err => {
    console.warn(err);
    locationStatus.textContent = "Location permission denied.";
  });
});


const contentTypeInput = document.getElementById("contentTypeInput");
const nicheInput = document.getElementById("nicheInput");

if (userData.contentTypes && Array.isArray(userData.contentTypes)) {
  userData.contentTypes.forEach(type => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    contentTypeInput.value = type;
    contentTypeInput.dispatchEvent(event);
  });
}else{
  contentTypeInput.value = userData.contentTypes || "";
}

if (userData.niches && Array.isArray(userData.niches)) {
  userData.niches.forEach(type => {
    const event = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
    });
    nicheInput.value = type;
    nicheInput.dispatchEvent(event);
  });
}else{
  nicheInput.value = userData.niches || "";
}

  // Fill other profile fields
  document.getElementById("editName").value = userData.displayName || "";
  document.getElementById("editBio").value = userData.bio || "";

  
  document.getElementById("editUsername").value = userData.username || "";
document.getElementById("editPronouns").value = userData.pronouns || "";
document.getElementById("editAvailability").value = userData.availability || "";



const platforms = [
  "instagram", "tiktok", "youtube", "facebook",
  "twitch", "threads", "snapchat", "pinterest", "reddit"
];

const linkIds = [
  "editLink1", "editLink2", "editLink3", "editLink4",
  "editLink5", "editLink6", "editLink7", "editLink8", "editLink9"
];

// ✅ Create a mapping from platform to link
const linkMap = {};
(userData.links || []).forEach(link => {
  linkMap[link.platform] = link.url;
});

// ✅ Populate the inputs
linkIds.forEach((id, i) => {
  const el = document.getElementById(id);
  if (el) el.value = linkMap[platforms[i]] || "";
});



  if (userData.photoURL) {
    const preview = document.getElementById("photoPreview");
    preview.src = userData.photoURL;
    preview.classList.remove("d-none");
  }

  // ✅ Set location if already stored
 if (userData.userLocation) {
  if (userData.userLocation.country) {
    countrySelect.value = userData.userLocation.country;
    countrySelect.dispatchEvent(new Event("change"));
  }

  setTimeout(() => {
    if (userData.userLocation.state) {
      // Add state option if missing
      if (![...stateSelect.options].some(o => o.value === userData.userLocation.state)) {
        const opt = document.createElement("option");
        opt.value = userData.userLocation.state;
        opt.textContent = userData.userLocation.state;
        stateSelect.appendChild(opt);
      }
      stateSelect.value = userData.userLocation.state;
      stateSelect.dispatchEvent(new Event("change"));
    }

    setTimeout(() => {
      if (userData.userLocation.city) {
        // Add city option if missing
        if (![...citySelect.options].some(o => o.value === userData.userLocation.city)) {
          const opt = document.createElement("option");
          opt.value = userData.userLocation.city;
          opt.textContent = userData.userLocation.city;
          citySelect.appendChild(opt);
        }
        citySelect.value = userData.userLocation.city;
      }
    }, 100);
  }, 100);
}


  }

  // Optional: hook into modal show event
const modalEl = document.getElementById("editModal");

modalEl.addEventListener('shown.bs.modal', () => {
  populateEditProfileModal(); // Your function that sets input values
});





