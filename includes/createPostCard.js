
import {
  getDoc,
  doc,
  updateDoc,
  increment,
  addDoc,
  getDocs,
  collection,
  serverTimestamp,
  query,
  orderBy
} from  "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { db, auth } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

import { sendNotification, NOTIFICATION_TEMPLATES} from "https://rw-501.github.io/contenthub/includes/notifications.js";


    let currentUser = null;

    auth.onAuthStateChanged(user => {
      if (user) {
        currentUser = user;


      }
    });

function encodeData(obj) {
  const json = JSON.stringify(obj);
  return btoa(encodeURIComponent(json));
}
function sanitize(text) {
  return String(text || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}


function sanitizeText(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function linkify(text) {
  return text.replace(/(https?:\/\/[\w\.-\/?=&%#]+)/gi, '<a href="$1" target="_blank">$1</a>')
             .replace(/@([\w]+)/g, '<span class="text-primary">@$1</span>')
             .replace(/#([\w]+)/g, '<span class="text-info">#$1</span>');
}


function formatTimeAgo(timestamp) {
  const date = typeof timestamp === "number" ? new Date(timestamp) : timestamp?.toDate?.() || new Date();
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const intervals = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60, second: 1 };
  
  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count > 0) return rtf.format(-count, unit);
  }

  return "just now";
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

function insertSharedPostOptionsModal() {
  // Prevent duplicate insertion
  if (document.getElementById("postOptionsModal")) return;

  const modalHTML = `
    <div class="modal fade" id="postOptionsModal" tabindex="-1" aria-labelledby="postOptionsModalLabel" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="postOptionsModalLabel">Post Options</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body" id="postOptionsContent">
            <!-- Buttons will be injected here -->
          </div>
        </div>
      </div>
    </div>
  `;

  const div = document.createElement("div");
  div.innerHTML = modalHTML.trim();
  document.body.appendChild(div.firstChild);
}
window.insertSharedPostOptionsModal = insertSharedPostOptionsModal;


async function createPostCard(post, postId) {
  console.log("postId ",postId);

  const card = document.createElement("div");
  card.className = "card mb-3";

  const mediaHTML = renderMedia(post.media?.[0]);
  const createdAt = post.createdAt?.toDate?.() || new Date();
  const timeAgo = formatTimeAgo(createdAt.getTime());

  const userSnap = await getDoc(doc(db, "users", post.owner));
  const userData = userSnap.exists() ? userSnap.data() : {};


      console.log("[createPostCard] userData:", userData);
    console.log("[createPostCard] post:", post);

const encodedPost = encodeData(userData);
const encodedUser = typeof post === "object" ? encodeData(post) : post;


    console.log("[createPostCard] encodedPost:", encodedPost);
    console.log("[createPostCard] encodedUser:", encodedUser);

  let typeBadge = "";
  if (post.type === "collab") {
    typeBadge = `<span class="badge bg-primary me-2">🤝 Collab Request</span>`;
  } else if (post.type === "help") {
    typeBadge = `<span class="badge bg-warning text-dark me-2">🆘 Help Wanted</span>`;
  }

  let joinButton = "";
  if (["collab", "help"].includes(post.type)) {
    joinButton = `
<button 
  class="btn btn-sm btn-outline-primary mt-2"
    data-user="${encodedUser}"
    data-post="${encodedPost}"
  onclick="requestToJoin(this)"
>
  Request to Join
</button>
    `;
  }

const likeBtnId = `like-btn-${postId}`;
const helpfulBtnId = `helpful-btn-${postId}`;
const interestedBtnId = `interested-btn-${postId}`;
const likeCountId = `like-count-${postId}`;
const interestedCountId = `interested-count-${postId}`;
const helpfulCountId = `helpful-count-${postId}`;

// Set the card content first (this creates the social-links div)
card.innerHTML = `
  ${mediaHTML}
  <div class="PostCard card-body position-relative">
  
  <!-- ⋮ OPTIONS BUTTON (Top-Right Corner) -->
  <button class="btn btn-sm btn-light rounded-circle shadow-sm position-absolute top-0 end-0 mt-2 me-2 px-2 py-1"
          onclick="openPostOptions('${postId}', '${post.owner}')" 
          title="More Options">
    <i class="bi bi-three-dots-vertical small"></i>
  </button>

  
    <div class="d-flex align-items-center mb-2">
      <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${post.owner}"
         class="fw-bold text-decoration-none">
        <img id="user-image-${postId}" src="${userData.photoURL || 'https://rw-501.github.io/contenthub/images/defaultAvatar.png'}"
             class="creator-avata rounded-circle me-2"
             width="40" height="40" />
      </a>
      <div>
        <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${post.owner}"
           class="fw-bold text-decoration-none">
          <div class="d-flex align-items-center gap-2">
            <p id="user-name-${postId}" class="mb-0">${userData.displayName || 'Unknown User'}</p>
            <span id="user-points-${postId}" class="badge bg-warning text-dark" title="Creator Points">⭐ ${userData.points || 0}</span>
          </div>
        </a>
        <p>${userData.availability ? `<i class='bi bi-clock-history'></i> ${userData.availability}` : ""}</p>
        <br/>
        ${typeBadge}
        <div class="mt-1" id="social-links-${postId}"></div>
      </div>
    </div>

    <a id="post-link-${postId}" class="text-decoration-none" href="https://rw-501.github.io/contenthub/pages/post.html?id=${postId}">
      <p id="user-post-${postId}" class="card-text">${linkify(sanitize(post.caption || ""))}</p>
    </a>

    <small class="d-block mb-2">
      ${timeAgo} • <span id="${likeCountId}">${post.likes || 0}</span> Likes 
      • <span id="${helpfulCountId}">${post.helpful || 0}</span> Helpful 
      • <span id="${interestedCountId}">${post.interested || 0}</span> Interested 
    </small>

    <div class="d-flex gap-2 mb-2">
      <button class="btn btn-sm btn-outline-danger btn-like" id="${likeBtnId}">❤️ Like</button>
      <button class="btn btn-sm btn-outline-success btn-helpful" id="${helpfulBtnId}">🙌 Helpful</button>
      <button class="btn btn-sm btn-outline-info btn-interested" id="${interestedBtnId}">⭐ Interested</button>
    </div>

    <div class="d-flex gap-2 mb-2">
      ${joinButton}
    </div>

    <button class="btn btn-sm btn-outline-primary mb-2"
      data-post-id="${postId}"
      data-post-owner="${post.owner}"
      onclick="openComments('${postId}', '${post.owner}')">
      💬 Comments
    </button>

    ${
      currentUser?.uid === post.owner
        ? `<button class="btn btn-sm btn-outline-danger mb-2 removeBtn" onclick="removePost('${postId}')">🗑️ Remove</button>`
        : ""
    }
  </div>
`;




// Now safely access and populate social links
const socialContainer = document.getElementById(`social-links-${postId}`);
if (socialContainer && Array.isArray(userData.links)) {
  userData.links.forEach(linkObj => {
    const { platform, url } = linkObj;
    const icon = platformIcons[platform?.toLowerCase()] || platformIcons.other;
    const isVerified = userData.verifiedPlatforms?.[platform?.toLowerCase()] === true;

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


// Buttons
const likeBtn = card.querySelector(`#${likeBtnId}`);
const likeCountEl = card.querySelector(`#${likeCountId}`);
const helpfulBtn = card.querySelector(`#${helpfulBtnId}`);
const helpfulCountEl = card.querySelector(`#${helpfulCountId}`);
const interestedBtn = card.querySelector(`#${interestedBtnId}`);
const interestedCountEl = card.querySelector(`#${interestedCountId}`);

// ❤️ Like Button
if (likeBtn) {
  likeBtn.addEventListener("click", () => {
    console.log("❤️ Like clicked");
    const isActive = likeBtn.classList.toggle("active");

    // Animate
    likeBtn.classList.add("animate__animated", "animate__bounce");
    setTimeout(() => likeBtn.classList.remove("animate__animated", "animate__bounce"), 800);

    // Update like count
    if (likeCountEl) {
      const current = parseInt(likeCountEl.innerText) || 0;
      likeCountEl.innerText = isActive ? current + 1 : current - 1;
    }

    reactToPost(postId, "likes", post.owner, post.caption);
  });
}

// 🙌 Helpful Button
if (helpfulBtn) {
  helpfulBtn.addEventListener("click", () => {
    console.log("🙌 Helpful clicked");
    const isActive = helpfulBtn.classList.toggle("active");

    // Animate
    helpfulBtn.classList.add("animate__animated", "animate__pulse");
    setTimeout(() => helpfulBtn.classList.remove("animate__animated", "animate__pulse"), 800);

    // Update helpful count
    if (helpfulCountEl) {
      const current = parseInt(helpfulCountEl.innerText) || 0;
      helpfulCountEl.innerText = isActive ? current + 1 : current - 1;
    }

    reactToPost(postId, "helpful", post.owner, post.caption);
  });
}

// ⭐ Interested Button
if (interestedBtn) {
  interestedBtn.addEventListener("click", () => {
    console.log("⭐ Interested clicked");
    const isActive = interestedBtn.classList.toggle("active");

    // Animate
    interestedBtn.classList.add("animate__animated", "animate__tada");
    setTimeout(() => interestedBtn.classList.remove("animate__animated", "animate__tada"), 800);

    // Update interested count
    if (interestedCountEl) {
      const current = parseInt(interestedCountEl.innerText) || 0;
      interestedCountEl.innerText = isActive ? current + 1 : current - 1;
    }

    reactToPost(postId, "interested", post.owner, post.caption);
  });
}

return card;
}

async function reactToPost(postId, type, ownerId, caption) {
  if (!currentUser) {
    const authModal = document.getElementById("auth-login");
    authModal.classList.remove("d-none");
    return;
  }
  const postRef = doc(db, "posts", postId);
  const userRef = doc(db, "users", ownerId);

  await updateDoc(postRef, { [`${type}`]: increment(1) });
  await updateDoc(userRef, {
    [`receivedReactions.${type}`]: increment(1)
  });

  const emojiMap = {
    helpful: "🙌",
    interested: "⭐",
    like: "❤️"
  };
  const emoji = emojiMap[type] || "✨";
    const avatar = document.getElementById("userAvatar");
    const viewerUserId = avatar.dataset.uid;
    const viewerDisplayName = avatar.dataset.displayName;
    const viewerUsername = avatar.dataset.username;
    const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: ownerId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: `${viewerUsername} marked your post as ${type} ${emoji}: "${caption}"`,
    type: `${type}Post`
  });

  
}

function openPostOptions(postId, ownerId) {
  const isOwner = currentUser?.uid === ownerId;
  const modalContent = document.getElementById("postOptionsContent");

  modalContent.innerHTML = `
    <button class="btn btn-outline-danger w-100 mb-2" onclick="reportPost('${postId}')">🚨 Report Post</button>
    ${isOwner ? `<button class="btn btn-outline-danger w-100" onclick="removePost('${postId}')">🗑️ Remove Post</button>` : ""}
  `;

  // Open modal manually
  const modal = new bootstrap.Modal(document.getElementById("postOptionsModal"));
  modal.show();
}
window.openPostOptions = openPostOptions;


async function reportPost(postId) {
  try {
    const postRef = doc(db, "posts", postId);

    await updateDoc(postRef, {
      flagged: true,
      flaggedAt: Timestamp.now(), // Optional: track when it was flagged
    });

    showModal({
      title: "Post Reported",
      message: `Thank you for reporting. We will review the post shortly.`,
      autoClose: 3000
    });
  } catch (error) {
    console.error("Failed to report post:", error);
    showModal({
      title: "Error",
      message: `Could not report post. Please try again later.`,
      autoClose: 3000
    });
  }
}


window.reportPost = reportPost;


function renderMedia(media) {
  if (!media || !media.url) return "";

  const url = media.url;
  const lowerUrl = url.toLowerCase();

  let mediaHTML = "";

  // YouTube
  if (/youtube\.com|youtu\.be/.test(lowerUrl)) {
    const embedUrl = lowerUrl.includes("watch?v=")
      ? lowerUrl.replace("watch?v=", "embed/")
      : lowerUrl.replace("youtu.be/", "youtube.com/embed/");
    mediaHTML = `<iframe width="100%" height="200" src="${embedUrl}" frameborder="0" allowfullscreen></iframe>`;
  }

  // Vimeo
  else if (/vimeo\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://player.vimeo.com/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Dailymotion
  else if (/dailymotion\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://www.dailymotion.com/embed/video/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitch
  else if (/twitch\.tv/.test(lowerUrl)) {
    const id = url.split("/").pop();
    mediaHTML = `<iframe src="https://player.twitch.tv/?video=${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Facebook
  else if (/facebook\.com/.test(lowerUrl)) {
    const id = url.split("/").pop();
    const encodedUrl = encodeURIComponent(`https://www.facebook.com/video.php?v=${id}`);
    mediaHTML = `<iframe src="https://www.facebook.com/plugins/video.php?href=${encodedUrl}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Instagram
  else if (/instagram\.com/.test(lowerUrl)) {
    const id = url.split("/p/").pop()?.split("/")[0];
    mediaHTML = `<iframe src="https://www.instagram.com/p/${id}/embed" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Twitter
  else if (/twitter\.com/.test(lowerUrl)) {
    const encodedUrl = encodeURIComponent(url);
    mediaHTML = `<iframe src="https://twitframe.com/show?url=${encodedUrl}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // TikTok
  else if (/tiktok\.com/.test(lowerUrl)) {
    const id = url.split("/video/").pop()?.split("?")[0];
    mediaHTML = `<iframe src="https://www.tiktok.com/embed/${id}" width="100%" height="200" frameborder="0" allowfullscreen></iframe>`;
  }

  // Firebase Storage or direct video links
  else if (
    url.includes("firebasestorage.googleapis.com") ||
    /\.(mp4|webm|ogg)$/i.test(url)
  ) {
    mediaHTML = `<video src="${url}" controls muted loop style="width:100%; max-height:200px; object-fit:cover;"></video>`;
  }

  // Fallback to image
  else {
    mediaHTML = `<img src="${url}" alt="Post media" style="width:100%; max-height:200px; object-fit:cover;" />`;
  }

  return mediaHTML;
}





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
        <div class="small">${formatTimeAgo(c.timestamp?.toDate?.())}</div>

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
            <div class="small">${formatTimeAgo(reply.timestamp?.toDate?.())}</div>
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




window.openComments = openComments;
window.removeComment = removeComment;
window.addComments = addComments;
window.showReplyBox = showReplyBox;
window.addReply = addReply;

export {
  openComments,
  removeComment,
  addComments,
  showReplyBox,
  addReply
};

export {
  createPostCard,
  sanitize,
  sanitizeText,
  formatTimeAgo,
  renderMedia
};
