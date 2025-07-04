import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs
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
document.getElementById("displayName").innerText = data.displayName || 'Unnamed';

// Set collab button
const collabBtn = document.getElementById("collabBtn");
collabBtn.classList.remove("d-none");
collabBtn.onclick = () => {
  document.getElementById("collabBtn").dataset.viewingUserId = viewingUserId;
};

document.getElementById("bioText").innerText = data.bio || '';
document.getElementById("locationText").innerText = 
  data.location?.city && data.location?.state
    ? `${data.location.city}, ${data.location.state}`
    : '';
document.getElementById("niche").innerText = data.niche || '';
document.getElementById("profilePhoto").src = data.photoURL || '/assets/default-avatar.png';

const socialContainer = document.getElementById("socialLinks");
socialContainer.innerHTML = "";

if (Array.isArray(data.links)) {
  const platformIcons = {
    instagram: "bi bi-instagram",
    tiktok: "bi bi-tiktok",
    youtube: "bi bi-youtube",
    facebook: "bi bi-facebook",
    twitter: "bi bi-twitter",
    linkedin: "bi bi-linkedin",
    other: "bi bi-link-45deg"
  };

  data.links.forEach(linkObj => {
    const { platform, url } = linkObj;
    const icon = platformIcons[platform?.toLowerCase()] || platformIcons.other;

    const a = document.createElement("a");
    a.href = url.trim();
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.className = "btn btn-sm btn-outline-secondary me-1";
    a.innerHTML = `<i class="${icon}"></i>`;
    socialContainer.appendChild(a);
  });
}

if (viewingUserId !== currentUser.uid) {
  const followBtn = document.getElementById("followBtn");
  followBtn.style.display = "inline-block";

  if ((data.followers || []).includes(currentUser.uid)) {
    followBtn.innerText = "Unfollow";
    followBtn.onclick = () => unfollowUser(viewingUserId);
  } else {
    followBtn.innerText = "Follow";
    followBtn.onclick = () => followUser(viewingUserId);
  }
}

loadUserPosts(viewingUserId);
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
      li.className = "list-group-item d-flex align-items-center";
      li.innerHTML = `
        <img src="${u.photoURL || '/assets/default-avatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
        <strong>${u.displayName || "Unnamed"}</strong> - <small class="text-muted ms-2">${u.niche || ''}</small>
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
      li.className = "list-group-item d-flex align-items-center";
      li.innerHTML = `
        <img src="${u.photoURL || '/assets/default-avatar.png'}" class="rounded-circle me-2" style="width: 32px; height: 32px; object-fit: cover;">
        <strong>${u.displayName || "Unnamed"}</strong> - <small class="text-muted ms-2">${u.niche || ''}</small>
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


// Load Posts
async function loadUserPosts(uid) {
  const postGrid = document.getElementById("postsGrid");
  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);
  postGrid.innerHTML = "";

  if (snapshot.empty) {
    postGrid.innerHTML = `
      <div class="col-12 text-center text-muted mt-3">
        <p>No posts yet.</p>
        <a href="https://rw-501.github.io/contenthub/pages/post.html" class="btn btn-primary btn-sm">
          🚀 Create your first post
        </a>
      </div>`;
    return;
  }

  snapshot.forEach(docSnap => {
    const post = docSnap.data();
    const col = document.createElement("div");
    col.className = "col-sm-6 col-md-4";
    col.innerHTML = post.type === 'video'
      ? `<video src="${post.mediaUrl}" controls class="w-100 rounded shadow-sm"></video>`
      : `<img src="${post.mediaUrl}" alt="Post" class="img-fluid rounded shadow-sm" />`;
    postGrid.appendChild(col);
  });
}


// Load Collabs
async function loadUserCollabs(uid) {
  const list = document.getElementById("collabList");
  const q = query(collection(db, "collabs"), where("participants", "array-contains", uid));
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
    const item = document.createElement("li");
    item.className = "list-group-item";
    item.innerText = docSnap.data().title || "Untitled Collaboration";
    list.appendChild(item);
  });
}


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

  let lastNameChange = null; // fetched from Firestore user metadata

  // Check display name change eligibility
  async function checkNameChangeEligibility(userData) {
    lastNameChange = userData.lastNameChange?.toDate?.() || new Date(0);
    const now = new Date();
    const diffDays = Math.floor((now - lastNameChange) / (1000 * 60 * 60 * 24));

    const canChange = diffDays >= 90;
    const nameInput = document.getElementById("editName");
    const note = document.getElementById("nameChangeNote");

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

  // Request verification
  document.getElementById("verifyProfileBtn").addEventListener("click", () => {
    // 🔧 This function should submit a "verification" ticket in Firestore
    openSupportTicket("verify_profile");
  });

  function openSupportTicket(type) {
    // placeholder logic for now
    alert(`Ticket for "${type.replace('_', ' ')}" submitted. We'll review your request.`);
    // You'd actually write this to a Firestore collection like `tickets`
  }

  // Save profile changes
  document.getElementById("editProfileForm").addEventListener("submit", async e => {
    e.preventDefault();

    const name = document.getElementById("editName").value.trim();
    const bio = document.getElementById("editBio").value.trim();
    const stateSelect = document.getElementById("stateSelect");
    const citySelect = document.getElementById("citySelect");
    const location = {
  state: stateSelect.value,
  city: citySelect.value
};


    const niche = document.getElementById("editNiche").value.trim();

const rawLinks = [
  { platform: "instagram", url: document.getElementById("editLink1").value.trim() },
  { platform: "tiktok", url: document.getElementById("editLink2").value.trim() },
  { platform: "youtube", url: document.getElementById("editLink3").value.trim() },
  { platform: "facebook", url: document.getElementById("editLink3").value.trim() }
];

const links = rawLinks.filter(link => link.url !== "");


    const file = document.getElementById("editPhoto").files[0];
    const userRef = doc(db, "users", currentUser.uid);
    const updates = { bio, niche, links, location };

    if (!document.getElementById("editName").disabled) {
      updates.displayName = name;
      updates.lastNameChange = new Date(); // Track the name change
    }

    if (file) {
      const storageRef = ref(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      updates.photoURL = url;
    }

    await updateDoc(userRef, updates);

    showModal({
  title: "Success!",
  message: "Profile updated!",
  autoClose: 3000
});


const modalEl = document.getElementById("editModal");
const modal = new bootstrap.Modal(modalEl);
modal.hide();
  });

  // Load existing data into modal (call this when modal is opened)
  async function populateEditProfileModal() {
  const userSnap = await getDoc(doc(db, "users", currentUser.uid));
  const userData = userSnap.data();

  // Initialize location dropdowns
const statesAndCities = {
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
};

  const stateSelect = document.getElementById("stateSelect");
  const citySelect = document.getElementById("citySelect");
  const locationStatus = document.getElementById("locationStatus");

  Object.keys(statesAndCities).forEach(state => {
    const option = document.createElement("option");
    option.value = state;
    option.textContent = state;
    stateSelect.appendChild(option);
  });

  stateSelect.addEventListener("change", () => {
    const state = stateSelect.value;
    citySelect.innerHTML = `<option value="">Select City</option>`;
    if (statesAndCities[state]) {
      statesAndCities[state].forEach(city => {
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

      if (state && city) {
        stateSelect.value = state;
        stateSelect.dispatchEvent(new Event("change")); // Populate cities

        // Wait for city options to load
        setTimeout(() => {
          let found = false;
          [...citySelect.options].forEach(option => {
            if (option.value.toLowerCase() === city.toLowerCase()) {
              citySelect.value = option.value;
              found = true;
            }
          });

          // If city wasn't in dropdown, add it manually
          if (!found) {
            const opt = document.createElement("option");
            opt.value = city;
            opt.textContent = city;
            citySelect.appendChild(opt);
            citySelect.value = city;
          }

          locationStatus.textContent = `Detected: ${city}, ${state}`;
        }, 200);
      } else {
        locationStatus.textContent = "Could not auto-detect city/state.";
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


  // Fill other profile fields
  document.getElementById("editName").value = userData.displayName || "";
  document.getElementById("editBio").value = userData.bio || "";
  document.getElementById("editNiche").value = userData.niche || "";

const linkMap = {};
(userData.links || []).forEach(link => {
  linkMap[link.platform] = link.url;
});

document.getElementById("editLink1").value = linkMap.instagram || "";
document.getElementById("editLink2").value = linkMap.tiktok || "";
document.getElementById("editLink3").value = linkMap.youtube || "";
document.getElementById("editLink4").value = linkMap.facebook || "";



  if (userData.photoURL) {
    const preview = document.getElementById("photoPreview");
    preview.src = userData.photoURL;
    preview.classList.remove("d-none");
  }

  // ✅ Set location if already stored
  if (userData.location) {
    stateSelect.value = userData.location.state || "";
    stateSelect.dispatchEvent(new Event("change"));

    setTimeout(() => {
                if (userData.location.city) {
            const opt = document.createElement("option");
            opt.value = userData.location.city;
            opt.textContent = userData.location.city;
            citySelect.appendChild(opt);
            citySelect.value = userData.location.city;
          }
      citySelect.value = userData.location.city || "";
    }, 100);
  }

  checkNameChangeEligibility(userData);
}

  // Optional: hook into modal show event
  document.getElementById("editModal").addEventListener("shown.bs.modal", populateEditProfileModal);
