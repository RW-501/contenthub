// 🔄 REFACTORED & IMPROVED COLLAB DASHBOARD
// ✅ Highlight pinned collabs
// ✅ Unified data load (only 2 requests)
// ✅ Chat message popup support
// ✅ Better UX/UI & Clean DOM update

import {
  getAuth, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore, doc, addDoc, getDoc, updateDoc, collection, query, where, getDocs, 
  serverTimestamp, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";
import { db, auth } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';

const tabs = {
  incoming: document.getElementById("incomingList"),
  sent: document.getElementById("sentList"),
  active: document.getElementById("activeList"),
  archived: document.getElementById("archivedList")
};

onAuthStateChanged(auth, user => {
  if (user) loadDashboard(user.uid);
      loadPendingReviews();

});

async function loadDashboard(uid) {
  const [requestsSnap, collabsSnap] = await Promise.all([
    getDocs(query(collection(db, "collabRequests"),
      where("fromUid", "==", uid)
    )),
    getDocs(query(collection(db, "collaborations"),
      where("participants", "array-contains", uid)
    ))
  ]);

  const receivedSnap = await getDocs(query(collection(db, "collabRequests"), where("toUid", "==", uid)));

  const requests = [...requestsSnap.docs, ...receivedSnap.docs];
  const collaborations = collabsSnap.docs;

  const categorized = {
    incoming: [],
    sent: [],
    active: [],
    archived: []
  };


for (const reqDoc of requests) {
  const data = reqDoc.data();
  const isIncoming = data.toUid === uid;

  if (isIncoming && data.status === "pending") {
    categorized.incoming.push(renderRequest(reqDoc.id, data, true));
  } else if (!isIncoming && data.status === "pending") {
    categorized.sent.push(renderRequest(reqDoc.id, data, false));
  } else if (data.status === "declined" || data.status === "accepted") {
    try {
      await deleteDoc(doc(db, "collabRequests", reqDoc.id));
    } catch (error) {
      console.error(`[Cleanup] Failed to delete request ${reqDoc.id}:`, error);
    }
  }
}


for (const key in categorized) {
  if (categorized[key].length === 0) {
    tabs[key].innerHTML = `
      <li class="list-group-item text-muted text-center">
        No ${key} items yet.
        <br>
        <a href="https://rw-501.github.io/contenthub/pages/explore.html" class="btn btn-outline-primary btn-sm mt-2">
          🤝 Find creators to collaborate with
        </a>
      </li>`;
  } else {
    tabs[key].innerHTML = categorized[key].join("");
  }
}

}

function formatTimestamp(timestamp) {
  return timestamp?.toDate ? new Date(timestamp.toDate()).toLocaleString() : "";
}

function renderMediaPreview(mediaLink) {
  if (!mediaLink) return "";
  if (mediaLink.match(/\.(jpeg|jpg|png|gif)$/i)) {
    return `<img src="${mediaLink}" class="img-fluid rounded mt-2" style="max-height: 200px;">`;
  } else if (mediaLink.match(/\.(mp4|webm)$/i)) {
    return `<video controls class="w-100 rounded mt-2" style="max-height: 240px;"><source src="${mediaLink}" type="video/mp4"></video>`;
  } else {
    return `<a href="${mediaLink}" target="_blank" class="d-block mt-2">View Media</a>`;
  }
}

function renderRequest(id, data, incoming) {
  const name = data.displayName || (incoming ? data.fromUid : data.toUid);
  const senderUrl = `https://rw-501.github.io/contenthub/pages/profile.html?uid=${incoming ? data.fromUid : data.toUid}`
  const dateStr = formatTimestamp(data.timestamp);
  const mediaHTML = renderMediaPreview(data.mediaLink);

  const actions = incoming
    ? `<button class="btn btn-sm btn-success me-1" onclick="respondToRequest('${id}', 'accepted','${data}')">Accept</button>
       <button class="btn btn-sm btn-danger" onclick="respondToRequest('${id}', 'declined')">Decline</button>`
    : data.status === "pending"
      ? `<span class="badge bg-warning text-dark">Pending</span>`
      : `<span class="badge bg-danger">Declined</span>`;
/*
  const chatBtn = `<button class="btn btn-sm btn-outline-primary ms-2" onclick="showChatPopup('${incoming ? data.fromUid : data.toUid}')">
    <i class="bi bi-chat-dots"></i> showChatPopup
  </button>
  
  <button class="btn btn-sm btn-outline-primary ms-2" onclick="openGroupChat('${incoming ? data.fromUid : data.toUid}')">
    <i class="bi bi-chat-dots"></i> Open Message
  </button>`;
*/
  return `
    <div class="list-group-item">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${data.title || "Untitled Project"}</strong>
          <p class="mb-1">${data.message}</p>
<small class="text-muted">
  ${incoming ? "From" : "To"}: 
  <a href="${senderUrl}" target="_blank" class="text-decoration-none">${name}</a>
  <br>${dateStr}
</small>
        </div>
        <div class="text-end">
          <button class="btn btn-sm btn-link text-decoration-none" data-bs-toggle="collapse" data-bs-target="#req-details-${id}">View</button>
        </div>
      </div>
      <div class="collapse mt-2" id="req-details-${id}">
        <div class="border-top pt-2">
          <p class="mb-1"><strong>Description:</strong> ${data.description || "No description."}</p>
          ${mediaHTML}
          <div class="text-end">
          ${actions}
          
          </div>
        </div>
      </div>
    </div>`;
}

function renderCollab(id, data) {
  const dateStr = formatTimestamp(data.timestamp);
  const mediaHTML = renderMediaPreview(data.mediaLink);
  const isPinned = data.pinned;
  const isPublic = data.isPublic;
  const participantCount = (data.participants || []).length;
  const totalTasks = (data.tasks || []).length;
  const progress = data.progress || 0;
  const status = data.status || "active";

  const statusBadge = status === "archive"
    ? `<span class="badge bg-secondary">Archived</span>`
    : `<span class="badge bg-success">Active</span>`;

  return `
    <div class="list-group-item ${isPinned ? 'border border-2 border-warning bg-light' : ''}">
      <div class="d-flex justify-content-between align-items-center">
        <div>
          <strong>${data.title || "Untitled Project"}</strong>
          ${isPinned ? '<span class="badge bg-warning text-dark ms-2">📌 Pinned</span>' : ''}
          <p class="mb-1">${data.description?.substring(0, 100) || "No description provided."}</p>
          <small class="text-muted">
            📅 ${dateStr}
          </small>
        </div>
        <div class="text-end">
          ${statusBadge}
          <button class="btn btn-sm btn-outline-primary ms-2" onclick="openGroupChat('${id}')">
            <i class="bi bi-chat-left-text"></i> View Project
          </button>
          <button class="btn btn-sm btn-link text-decoration-none" data-bs-toggle="collapse" data-bs-target="#collab-details-${id}">
            Details
          </button>
        </div>
      </div>

      <div class="collapse mt-3" id="collab-details-${id}">
        <div class="border-top pt-3">
          <div class="row mb-2 text-muted small">
            <div class="col-md-4">
              🔐 <strong>Visibility:</strong> ${isPublic ? "Public" : "Private"}
            </div>
            <div class="col-md-4">
            👥 Participants: ${participantCount}<br>
            </div>
            <div class="col-md-4">
              ✅ <strong>Tasks:</strong> ${totalTasks}
            </div>
            <div class="col-md-4">
              📈 <strong>Progress:</strong>
              <div class="progress" style="height: 10px;">
                <div class="progress-bar bg-info" role="progressbar" style="width: ${progress}%;" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
              </div>
            </div>
          </div>
          <p class="mb-1"><strong>Full Description:</strong> ${data.description || "No description."}</p>
          ${mediaHTML}
        </div>
      </div>
    </div>
  `;
}



window.respondToRequest = async function(id, status) {
  const requestRef = doc(db, "collabRequests", id);
  const snap = await getDoc(requestRef);
  if (!snap.exists()) return;

  const rawData = snap.data();

  await updateDoc(requestRef, { status });

  if (status === "accepted" && rawData) {
    const { fromUid, toUid, title, description, mediaLink } = rawData;

    if (!fromUid || !toUid) {
      console.error("Missing fromUid or toUid in request data");
      return;
    }

    const newCollab = {
      title: title || "Untitled",
      description: description || "No description provided.",
      mediaLink: mediaLink || "",
      isPublic: false,
      owner: fromUid,
      participants: [fromUid, toUid],
      tasks: [],
      pinned: false,
      createdAt: new Date(),
    timestamp: serverTimestamp()

    };

    await addDoc(collection(db, "collaborations"), newCollab);
  }

  loadDashboard(auth.currentUser.uid);
};


// 🔧 Basic Chat Popup Handler
window.showChatPopup = function(uid) {
  // Show a chat modal or drawer for messaging with specific user
showChatPopup(uid)
};

  window.openGroupChat = function (collabId) {
    // Redirect to full page chat
    window.location.href = `https://rw-501.github.io/contenthub/pages/collabs/view.html?id=${collabId}`;

  };

  // Optional modal chat popup function (only use if popup preferred)
  function showChatPopup(collabId) {
    const modalHtml = `
      <div class="modal fade" id="groupChatModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Group Chat</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <iframe src="https://rw-501.github.io/contenthub/pages/collabs/view.html?id=${collabId}" frameborder="0" class="w-100" style="height: 500px;"></iframe>
            </div>
          </div>
        </div>
      </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    new bootstrap.Modal(document.getElementById('groupChatModal')).show();
  }

function openReviewConfirmModal(reviewId) {
  document.getElementById("confirmReviewId").value = reviewId;
  new bootstrap.Modal(document.getElementById("reviewConfirmModal")).show();
}
window.openReviewConfirmModal = openReviewConfirmModal;


document.getElementById("confirmReviewForm").addEventListener("submit", async e => {
  e.preventDefault();

  const reviewId = document.getElementById("confirmReviewId").value;
  const rating = parseInt(document.getElementById("responseRating").value);
  const text = document.getElementById("responseFeedback").value.trim();

  const reviewDocRef = doc(db, "reviews", reviewId);
  const reviewSnap = await getDoc(reviewDocRef);
  if (!reviewSnap.exists()) return;

  const review = reviewSnap.data();

  const batch = writeBatch(db);

  // Confirm the original review
  batch.update(reviewDocRef, { confirmedByTarget: true });

  // Add response review if user submitted rating or feedback
  if (rating || text) {
    const responseReview = {
      reviewerId: review.targetUserId,
      targetUserId: review.reviewerId,
      rating,
      text,
      type: "reply",
      projectLink: "",
      timestamp: serverTimestamp(),
      approved: true,
      confirmedByTarget: true
    };
    const responseRef = doc(collection(db, "reviews"));
    batch.set(responseRef, responseReview);

    // Update rating of the original reviewer
    const userRef = doc(db, "users", review.reviewerId);
    if (rating) {
      batch.update(userRef, {
        ratingTotal: increment(rating),
        ratingCount: increment(1)
      });
    }
  }

  await batch.commit();

  bootstrap.Modal.getInstance(document.getElementById("reviewConfirmModal")).hide();
  showModal({ title: "Thank You!", message: "Response recorded.", autoClose: 3000 });
});


async function loadPendingReviews() {
  const currentUser = auth.currentUser;
  if (!currentUser) return;

  const q = query(
    collection(db, "reviews"),
    where("targetUserId", "==", currentUser.uid),
    where("confirmedByTarget", "==", false)
  );

  const snapshot = await getDocs(q);
  const container = document.getElementById("pendingReviewsContainer");

  container.innerHTML = "";

  if (snapshot.empty) {
    container.innerHTML = `
      <div class="alert alert-info text-center">
        <strong>Haven’t been reviewed yet?</strong><br>
        Invite someone you've collaborated with to leave feedback!
      </div>`;
    return;
  }

  snapshot.forEach(docSnap => {
    const review = docSnap.data();
    const docId = docSnap.id;

    const stars = "⭐".repeat(review.rating || 0);
    const textPreview = review.text?.slice(0, 100) || "No comment";

    const card = `
      <div class="card mb-3">
        <div class="card-body">
          <h6 class="card-title">${stars || "Unrated Review"}</h6>
          <p class="card-text">${textPreview}</p>
          <button class="btn btn-sm btn-outline-primary" onclick="openReviewConfirmModal('${docId}')">
            Confirm & Respond
          </button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML("beforeend", card);
  });
}

window.loadPendingReviews = loadPendingReviews;