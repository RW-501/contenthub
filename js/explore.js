// Firebase Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where, addDoc, 
  arrayUnion, increment, serverTimestamp, Timestamp,
  startAfter, 
  getDocs,
  orderBy,   // ✅ add this
  limit      // ✅ and this
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

// Your config import (must expose the initialized app)
import { app } from "https://rw-501.github.io/contenthub/js/firebase-config.js";
import { sendNotification, NOTIFICATION_TEMPLATES, checkAndAwardTasks} from "https://rw-501.github.io/contenthub/includes/notifications.js";
 import { createPostCard } from "https://rw-501.github.io/contenthub/includes/createPostCard.js";

// Firebase instances
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app, "gs://content-hub-11923.firebasestorage.app");

// UI Elements
const postGrid = document.getElementById("postGrid");
const suggestedCreatorsDiv = document.getElementById("suggestedCreators");
const filterSelect = document.getElementById("filterSelect");
const searchInput = document.getElementById("searchInput");
const collabZoneToggle = document.getElementById("collabZoneToggle");

// App State
let lastVisiblePost = null;
let loadingMore = false;
let currentUser = null;
let q;
 

// Auth check
onAuthStateChanged(auth, user => {
  if (!user) {
    loadPosts();
    loadSuggestedCreators();

  }  else {
    currentUser = user;
    loadPosts();
    loadSuggestedCreators();

  }
});



// Load Posts based on filters
async function loadPosts(reset = true) {
  if (loadingMore) return console.warn("[loadPosts] Already loading, aborting...");
  loadingMore = true;
  if (reset) resetPostGrid();

  const collabZone = collabZoneToggle.checked;
  const filter = filterSelect.value;
  const search = searchInput.value.trim().toLowerCase();

  console.log("[loadPosts] collabZone:", collabZone, "| filter:", filter, "| search:", search);

  if (collabZone) {
    await loadCollabPosts();
  } else {
    await loadRegularPosts(filter, search);
  }

  loadingMore = false;
}


function resetPostGrid() {
  postGrid.innerHTML = "";
  lastVisiblePost = null;
}

async function loadCollabPosts() {
  try {
    const q = query(
      collection(db, "collaborations"),
      where("isPublic", "==", true),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    const snap = await getDocs(q);
    if (snap.empty) return console.log("[loadCollabPosts] No collab posts found.");

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const card = createCollabCard(data, docSnap.id);
      postGrid.appendChild(card);
    });
  } catch (error) {
    console.error("[loadCollabPosts] Error:", error);
  }
}


function isBase64Encoded(str) {
  if (typeof str !== "string") return false;
  try {
    // atob can decode some invalid strings without throwing
    const decoded = atob(str);
    // Check if the result is valid URI-encoded JSON
    decodeURIComponent(decoded); // this may throw if it's not URI encoded
    return true;
  } catch (e) {
    return false;
  }
}

function safeDecodeData(str) {
  if (!isValidEncodedJson(str)) return str; // fallback for raw doc ID or string

  try {
    const decoded = decodeURIComponent(atob(str));
    return JSON.parse(decoded);
  } catch (e) {
    console.error("safeDecodeData failed:", e);
    return str;
  }
}


function encodeData(obj) {
  if (typeof obj === "string") return obj; // already a string (e.g., ID)

  try {
    const json = JSON.stringify(obj);
    return btoa(encodeURIComponent(json));
  } catch (e) {
    console.error("encodeData failed:", e);
    return obj;
  }
}

function isValidEncodedJson(str) {
  if (typeof str !== "string") return false;

  // Basic check for base64-like string
  const base64Regex = /^[A-Za-z0-9+/=]+$/;
  if (!base64Regex.test(str)) return false;

  try {
    const decoded = atob(str);
    const jsonStr = decodeURIComponent(decoded);
    JSON.parse(jsonStr);
    return true;
  } catch {
    return false;
  }
}

function createCollabCard(data, collabData) {
  const card = document.createElement("div");
  card.className = "card p-3 mb-3";
  const progress = data.progress || 0;
  const totalTasks = data.totalTasks || 0;

    console.log("[createCollabCard] data:", data);
    console.log("[createCollabCard] collabData:", collabData);

const encodedPost = encodeData(data);
const encodedUser = typeof collabData === "object" ? encodeData(collabData) : collabData;


    console.log("[createCollabCard] encodedPost:", encodedPost);
    console.log("[createCollabCard] encodedUser:", encodedUser);

  card.innerHTML = `
   <a href="https://rw-501.github.io/contenthub/pages/collabs/details.html?id=${collabData}">
    <strong>${data.title || "Untitled Collab"}</strong></a>
    <br/>
    <small>Creator by 
    <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${data.owner}">
    ${data.ownerName}</a></small><br/>
    
    <p>${data.description || ""}</p>
    <div class="progress my-2" style="height: 20px;">
      <div class="progress-bar" role="progressbar" style="width: ${progress}%">${progress}%</div>
    </div>
    <p class="mb-2">🧩 Total Tasks: ${totalTasks}</p>
    <div class="d-flex gap-2">
<button 
  class="btn btn-sm btn-outline-primary mt-2"
    data-collab="${encodedPost}"
    data-post="${encodedPost}"
    data-user="${encodedUser}"

  onclick="requestToJoin(this)"
>
  Request to Join
</button>      
<button class="btn btn-sm btn-outline-secondary" onclick="followUser('${data.owner}')">Follow Creator</button>
    </div>
  `;
  return card;
}


async function requestToJoin(btn) {
  const encodedUser = btn.dataset.user;
  const encodedPost = btn.dataset.post;
  const encodedCollab = btn.dataset.collab;

  const ownerData = safeDecodeData(encodedUser);
  const infoData = safeDecodeData(encodedPost);
  const collabData = safeDecodeData(encodedCollab);

  console.log("[requestToJoin] encodedUser:", encodedUser);
  console.log("[requestToJoin] ownerData:", ownerData);
  console.log("[requestToJoin] infoData:", infoData);
  console.log("[requestToJoin] collabData:", collabData);


    if (typeof collabData === "string") {
  const collabId = collabData;
  // use it directly
} else {
  const collabId = collabData?.id || collabData?.collabId;
  // fallback logic
}


    const currentUser = auth.currentUser;
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
let toUserId = infoData.owner || ownerData.owner;
let toUserName = ownerData.ownerDisplayName || ownerData.ownerName || ownerData.displayName || infoData.displayName;
let toPhoto = ownerData.ownerPhotoURL || ownerData.ownerPhoto || ownerData.photoURL;
let postInfo = infoData.caption || infoData.title  || ownerData.title;



    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

    if (toUserId == viewerUserId) return alert("⚠️ You are the owner of this post");


    if (collabData && ownerData) {
const collabRef = doc(db, "collaborations", ownerData);

const requestInfo = {
  uid: viewerUserId,
  displayName: viewerDisplayName || viewerUsername,
  username: viewerUsername,
  photoURL: viewerUserPhotoURL || "https://rw-501.github.io/contenthub/images/defaultAvatar.png",
  role: "viewer",
  status: "pending",
};

// First, set the timestamp manually
requestInfo.requestedAt = Timestamp.now(); // ✅ Instead of serverTimestamp()

try {
  await updateDoc(collabRef, {
    requests: arrayUnion(requestInfo)
  });

  

      await sendNotification({
    toUid: toUserId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerDisplayName} sent you a request to collaborate.`,
    type: "collabRequest",
  });


    console.log("✅ Join request submitted to collaboration.");
    alert("🚀 Request sent!", "success");
  } catch (error) {
    console.error("❌ Failed to update collaboration requests:", error);
    alert("Error sending request", "danger");
  }
  return;
}else {
     console.log("collabRequests ??????????????????");
console.log("toUserId:", toUserId);
console.log("toUserName:", toUserName);
console.log("toPhoto:", toPhoto);
console.log("postInfo:", postInfo);
console.log("viewerUserId:", viewerUserId);
console.log("viewerDisplayName:", viewerDisplayName);
console.log("viewerUserPhotoURL:", viewerUserPhotoURL);

  
if (!viewerUserId || !toUserId) {
  console.error("Missing IDs:", { viewerUserId, toUserId });
  return alert("Missing user info. Please refresh and try again.");
}

  try {

    const requestsRef = collection(db, "collabRequests");
    const existingSnap = await getDocs(query(requestsRef,
      where("toUid", "==", toUserId),
      where("fromUid", "==", viewerUserId),
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






try {
  await addDoc(requestsRef, {
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromPhotoURL: viewerUserPhotoURL,
    toUid: toUserId,
    toDisplayName: toUserName,
    toUserPhoto: toPhoto,
    message: `${viewerDisplayName} sent you a request to collaborate.`,
    title: `Collaboration Request`,
    description: `${viewerDisplayName} requested to join this collaboration. From: ${postInfo || "Unknown Project"}`,
    status: "pending",
    timestamp: Timestamp.now()
  });
} catch (e) {
  console.error("❌ addDoc failed:", e);
}



    // ✅ Increment collabRequestsSent on user
    const userRef = doc(db, "users", viewerUserId);
    await updateDoc(userRef, {
      collabRequestsSent: increment(1)
    });  

    showModal({
      title: "Request Sent",
      message: "Your request to join has been sent.",
      autoClose: 3000
    });

      await sendNotification({
    toUid: toUserId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerDisplayName} sent you a request to collaborate.`,
    type: "collabRequest",
  });



  } catch (error) {
    console.error("[requestToJoin] Error:", error);
    alert("❌ Failed to send join request. Please try again.");
  }

}

}
window.requestToJoin = requestToJoin;





async function loadRegularPosts(filter, search) {
  let q;
  const postsCol = collection(db, "posts");


switch (filter) {
  case "new":
    q = query(postsCol, orderBy("createdAt", "desc"), limit(10));
    break;
  case "trending":
    q = query(postsCol, orderBy("likes", "desc"), limit(10));
    break;
  // q = query(postsCol, where("tags", "array-contains", filter), orderBy("createdAt", "desc"), limit(10));
   // break;
  default:
    // 🔥 Default to newest posts
    q = query(postsCol, orderBy("createdAt", "desc"), limit(10));
}

if (lastVisiblePost) {
  q = query(q, startAfter(lastVisiblePost));
}
  console.log("[loadRegularPosts] q:", q, "| filter:", filter);

const snap = await getDocs(q);

if (!snap.empty) lastVisiblePost = snap.docs[snap.docs.length - 1];

const now = new Date();

for (const docSnap of snap.docs) {
  const post = docSnap.data();

    console.log("post ",post);

  // ⛔ Skip if scheduled in the future
  if (post.scheduledAt && post.scheduledAt.toDate() > now) continue;

  // ⛔ Skip if should be filtered
  if (shouldSkipPost(post, search)) continue;

  // ✅ Skip if status is removed
  const status = (post.status ?? "").toLowerCase();
  if (status === "removed") continue;

    console.log("status ",status);

  const card = await createPostCard(post, docSnap.id);
  postGrid.appendChild(card);
}


}





function shouldSkipPost(post, search) {
  const caption = post.caption?.toLowerCase() || "";
  const tags = post.tags?.join(" ") || "";
  return search && !caption.includes(search) && !tags.includes(search);
}






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


// Infinite scroll handler
window.addEventListener("scroll", () => {
  if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
    loadPosts(false);
  }
});

// Suggested creators
async function loadSuggestedCreators() {
  const usersCol = collection(db, "users");
  const q = query(usersCol, limit(20)); // Grab more for randomness
  const snap = await getDocs(q);
  suggestedCreatorsDiv.innerHTML = "";

  let users = [];
  snap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.uid !== currentUser?.uid) {
      users.push({ id: docSnap.id, ...u });
    }
  });

  // Shuffle array
  users = users.sort(() => 0.5 - Math.random());

  // Take first 5 after shuffle
users.slice(0, 5).forEach(u => {
  const div = document.createElement("div");
  div.className = "creator-suggest";
  div.innerHTML = `
    <img src="${u.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}" alt="avatar" class="creator-avatar" />
    <div>
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${u.id}">${u.displayName || 'Unknown'}</a><br/>
      <small>${(u.niches || []).join(', ')}</small><br/>
      <small>💎 ${u.points || 0} pts</small>
    </div>
    <button class="btn btn-sm btn-outline-primary ms-auto" onclick="followUser('${u.id}')">Follow</button>
  `;
  suggestedCreatorsDiv.appendChild(div);
});

}


// Follow user
window.followUser = async (uid) => {
  if (!currentUser) return showModal({ title: "Login Required", message: "Please log in to follow users." });

  const userRef = doc(db, "users", currentUser.uid); // Current user
  const targetRef = doc(db, "users", uid); // Profile being viewed

      
    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayName;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: uid,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `@${viewerDisplayName} follows you`,
    type: "following"
  });

  await updateDoc(userRef, {
    following: arrayUnion(uid)
  });

  await updateDoc(targetRef, {
    followers: arrayUnion(currentUser.uid)
  });

  showModal({
    title: "Followed!",
    message: "You are now following this creator.",
    autoClose: 3000
  });
};

filterSelect.addEventListener("change", () => loadPosts(true));
searchInput.addEventListener("input", () => loadPosts(true));
collabZoneToggle.addEventListener("change", () => loadPosts(true));


async function removePost(postId) {
  if (!confirm("Are you sure you want to remove this post?")) return;
  try {
    await updateDoc(doc(db, "posts", postId), { status: "removed" });
    // Optionally hide or reload the post
    document.getElementById(`post-${postId}`)?.remove();
  } catch (err) {
    console.error("Failed to remove post:", err);
    alert("Something went wrong removing the post.");
  }
}
window.removePost = removePost;

let currentPostId = null;
let currentPostOwnerId = null;

async function openComments(postId, postOwnerId) {
      const avatar = document.getElementById("userAvatar");
    const viewerUserId = avatar.dataset.uid;
  currentPostId = postId;
  currentPostOwnerId = postOwnerId;
  document.getElementById("commentsList").innerHTML = "Loading...";
  document.getElementById("newCommentText").value = "";

  const modal = new bootstrap.Modal(document.getElementById("commentModal"));
  modal.show();

  const commentsRef = collection(db, "posts", postId, "comments");
 const snap = await getDocs(query(commentsRef, orderBy("timestamp", "asc")));
const comments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

const commentMap = {};
comments.forEach(c => {
  if (!c.parentId) {
    commentMap[c.id] = { ...c, replies: [] };
  } else {
    if (commentMap[c.parentId]) {
      commentMap[c.parentId].replies.push(c);
    } else {
      commentMap[c.parentId] = { replies: [c] }; // fallback if parent not rendered yet
    }
  }
});

let html = "";
for (const id in commentMap) {
  const c = commentMap[id];

const status = (c.status ?? "").toLowerCase();
if (c.parentId || status === "removed") continue;

  html += `
    <div class="border-bottom pb-2 mb-2 d-flex position-relative">
    
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${c.commenteduId}">
      <img src="${c.commenteduPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
           alt="${c.commenteduName}"
           class="rounded-circle me-2 flex-shrink-0"
           width="50" height="50" style="object-fit: cover;" />
    <div class='w-100'>
        <strong>${c.commenteduName}:</strong></a>
        <div class="w-100"> ${c.text}             
         ${c.commenteduId === viewerUserId
        ? `<button class="btn btn-sm btn-danger position-absolute end-0 top-0 me-2 mb-1 removeBtn"
                   onclick="removeComment('${id}')">Remove</button>`
        : ""}</div>
        <div class="small">${timeAgo(c.timestamp?.toDate?.())}</div>

        <button class="btn btn-sm text-primary p-0 mt-2" onclick="showReplyBox('${id}')">↪️ Reply</button>
        <div id="replyBox-${id}" class="mt-2" style="display: none;">
          <textarea class="form-control" rows="1" placeholder="Write a reply..." id="replyText-${id}"></textarea>
          <button class="btn btn-sm btn-secondary mt-1" onclick="addReply('${id}','${c.commenteduId}','${currentPostId}')">Reply</button>
        </div>
      </div>

    </div>
  `;

  if (c.replies?.length) {
    html += `<div class="ms-4 mt-2">`;
    for (const reply of c.replies) {

const status = (reply.status ?? "").toLowerCase();
if (status === "removed") continue;

html += `
        <div class="border-start ps-2 mb-2 d-flex position-relative">
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${reply.replyerUid}">
          <img src="${reply.replyerUserPhoto || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
               alt="${reply.replyerUname}"
               class="rounded-circle me-2 flex-shrink-0"
               width="40" height="40"
               style="object-fit: cover;" />
          <div>
            <strong>${reply.replyerUname}:</strong></a>
             <div class="w-100"> 
             ${reply.text}          
             ${reply.replyerUid === viewerUserId
            ? `<button class="btn btn-sm btn-danger position-absolute end-0 top-0 me-2 mb-1 removeBtn"
                       onclick="removeComment('${reply.id}')">Remove</button>`
            : ""}</div>
            <div class="small">${timeAgo(reply.timestamp?.toDate?.())}</div>
          </div>

        </div>
      `;
    }
   html += `</div>`; // close comment div
}

}

  

  document.getElementById("commentsList").innerHTML = html || "<p>No comments yet.</p>";
}
window.openComments = openComments;

async function removeComment(commentId) {
  if (!commentId || !currentPostId) return;

  try {
    await updateDoc(doc(db, "posts", currentPostId, "comments", commentId), {
      status: "removed"
    });
    openComments(currentPostId); // Refresh UI
  } catch (err) {
    console.error("Failed to remove comment:", err);
    alert("Failed to remove the comment. Please try again.");
  }
}
window.removeComment = removeComment;

async function addComments() {
    if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const text = document.getElementById("newCommentText").value.trim();
  if (!text) return;

    const avatar = document.getElementById("userAvatar");
    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayName;
    const viewerUsername = avatar.dataset.username;
    const viewerUserPhotoURL = avatar.dataset.photo;

  const comment = {
    text,
    currentPostOwnerId,
    status: "active",
    commenteduId: viewerUserId,
    commenteduPhoto: viewerUserPhotoURL,
    commenteduName: viewerDisplayName || "Anonymous",
    timestamp: serverTimestamp(),
  };



await sendNotification({
  toUid: currentPostOwnerId,
  fromUid: viewerUserId,
  fromDisplayName: viewerDisplayName,
  fromuserAvatar: viewerUserPhotoURL,
  message: `${viewerUsername} left a comment on your <a href="https://rw-501.github.io/contenthub/pages/post.html?p=${currentPostId}">post</a>: "${sanitizeText(text)}"`,
  type: "commented"
});


await updateDoc(doc(db, "users", viewerUserId), {
  commentMade: increment(1)
});

  await addDoc(collection(db, "posts", currentPostId, "comments"), comment);
  openComments(currentPostId); // Reload comments
}
window.addComments = addComments;

function sanitizeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function showReplyBox(commentId) {
  document.getElementById(`replyBox-${commentId}`).style.display = "block";
}
window.showReplyBox = showReplyBox;

async function addReply(parentCommentId, commenteruId, currentPostId, currentPostOwnerId) {
    if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const replyInput = document.getElementById(`replyText-${parentCommentId}`);
  const replyText = replyInput?.value?.trim();
  if (!replyText) return;

  const avatar = document.getElementById("userAvatar");
  const viewerUserId = avatar.dataset.uid;
  const viewerDisplayName = avatar.dataset.displayName;
  const viewerUsername = avatar.dataset.username;
  const viewerUserPhotoURL = avatar.dataset.photo;

  const reply = {
    text: replyText,
    commenterUid: commenteruId,
    status: "active",
    replyerUid: viewerUserId,
    replyerUserPhoto: viewerUserPhotoURL,
    replyerUname: viewerDisplayName || "Anonymous",
    parentId: parentCommentId,
    timestamp: serverTimestamp(),
  };

  // Save the reply to Firestore
  await addDoc(collection(db, "posts", currentPostId, "comments"), reply);

  // Send a notification to the original commenter
  await sendNotification({
    toUid: commenteruId, // fixed: this should go to the person who got replied to, not the post owner
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerUsername} replied to your comment on the <a href="/contenthub/pages/post.html?p=${currentPostId}">post</a>: "${sanitizeText(replyText)}"`,
    type: "reply"
  });

  // Optional: reload comments section
  openComments(currentPostId);
}
window.addReply = addReply;


