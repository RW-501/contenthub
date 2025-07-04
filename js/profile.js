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
  document.getElementById("niche").innerText = data.niche || '';
  document.getElementById("profilePhoto").src = data.photoURL || '/assets/default-avatar.png';

  const socialContainer = document.getElementById("socialLinks");
  if (data.links) {
    data.links.split(",").forEach(link => {
      const a = document.createElement("a");
      a.href = link.trim();
      a.target = "_blank";
      a.className = "btn btn-sm btn-outline-secondary me-1";
      a.innerText = "🔗";
      socialContainer.appendChild(a);
    });
  }

  if (viewingUserId !== currentUser.uid) {
    document.getElementById("followBtn").style.display = "inline-block";
    // TODO: check if already followed and update text
  }

  loadUserPosts(viewingUserId);
  loadUserCollabs(viewingUserId);
  loadAnalytics(viewingUserId);
});

// Load Posts
async function loadUserPosts(uid) {
  const postGrid = document.getElementById("postsGrid");
  const q = query(collection(db, "posts"), where("owner", "==", uid));
  const snapshot = await getDocs(q);
  postGrid.innerHTML = "";
  snapshot.forEach(docSnap => {
    const post = docSnap.data();
    const col = document.createElement("div");
    col.className = "col-sm-6 col-md-4";
    col.innerHTML = post.type === 'video'
      ? `<video src="${post.mediaUrl}" controls></video>`
      : `<img src="${post.mediaUrl}" alt="Post" />`;
    postGrid.appendChild(col);
  });
}

// Load Collabs
async function loadUserCollabs(uid) {
  const list = document.getElementById("collabList");
  const q = query(collection(db, "collabs"), where("participants", "array-contains", uid));
  const snapshot = await getDocs(q);
  list.innerHTML = "";
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
    const links = [
      document.getElementById("editLink1").value.trim(),
      document.getElementById("editLink2").value.trim(),
      document.getElementById("editLink3").value.trim(),
    ].filter(link => link !== "");

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

   // alert("Profile updated!");
    location.reload();
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
          stateSelect.dispatchEvent(new Event("change"));

          setTimeout(() => {
            citySelect.value = city;
          }, 100);

          locationStatus.textContent = `Detected: ${city}, ${state}`;
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
  const [link1, link2, link3] = userData.links || [];
  document.getElementById("editLink1").value = link1 || "";
  document.getElementById("editLink2").value = link2 || "";
  document.getElementById("editLink3").value = link3 || "";

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
      citySelect.value = userData.location.city || "";
    }, 100);
  }

  checkNameChangeEligibility(userData);
}

  // Optional: hook into modal show event
  document.getElementById("editModal").addEventListener("shown.bs.modal", populateEditProfileModal);
