// notifications.js (Global Notification System)

import { db, auth } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  where,
  writeBatch,
  limit,
  startAfter
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let notificationsUnsub;

// Call this on every page after auth is loaded
let lastVisibleNotif = null;
let loadingMore = false;

let groupingMode = "flat"; // or "day"


export async function initLiveNotifications() {
  const user = auth.currentUser;
  if (!user) return;

  const notifList = document.getElementById("notificationList");
  const avatar = document.getElementById("userAvatar");
  const notifBtn = document.getElementById("notifBellBtn");

 async function loadNotifications(initial = true) {
  if (loadingMore) return;
  loadingMore = true;

  const baseRef = collection(db, `users/${user.uid}/notifications`);
  let q = query(baseRef, orderBy("timestamp", "desc"), limit(20));

  if (!initial && lastVisibleNotif) {
    q = query(baseRef, orderBy("timestamp", "desc"), startAfter(lastVisibleNotif), limit(20));
  }

  const snap = await getDocs(q);
  if (snap.empty) return;

  lastVisibleNotif = snap.docs[snap.docs.length - 1];

  if (groupingMode === "day") {
    const groups = {};

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const dayKey = getDayLabel(data.timestamp?.toDate());
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push({ ...data, id: docSnap.id, ref: docSnap.ref });
    });

    renderGroupedByDay(groups);
  } else {
    snap.forEach(docSnap => {
      renderNotificationItem(docSnap.data(), docSnap.ref, docSnap.id);
    });
  }

  loadingMore = false;
}

  window.dismissNotif = async (refPath) => {
    const notifRef = doc(db, refPath);
    await updateDoc(notifRef, { status: "removed", read: true });
    document.querySelector(`[onclick="dismissNotif('${refPath}')"]`)?.closest(".list-group-item")?.remove();
  };

notifBtn.onclick = () => {
  document.getElementById("notificationList").innerHTML = "";
  lastVisibleNotif = null;
  loadNotifications(true);

  const modal = new bootstrap.Modal(document.getElementById("notifModal"));
  modal.show();
};


  function getDayLabel(date) {
  const now = new Date();
  const d = new Date(date);

  const isToday = d.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === d.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";

  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  return diff <= 7 ? "This Week" : "Older";
}

function renderGroupedByDay(groups) {
  const container = document.getElementById("notificationList");
  container.innerHTML = "";

  Object.entries(groups).forEach(([day, items]) => {
    const collapseId = `notif-group-${day.replace(/\s/g, '-')}`;

    container.insertAdjacentHTML("beforeend", `
      <button class="btn btn-light w-100 text-start mb-2" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
        ${day} (${items.length})
      </button>
      <div id="${collapseId}" class="collapse show"></div>
    `);

    const groupEl = document.getElementById(collapseId);
    items.forEach(n => {
      const item = createNotificationHTML(n, n.ref, n.id);
      groupEl.appendChild(item);
    });
  });
}

function renderNotificationItem(data, ref, id) {
  const container = document.getElementById("notificationList");
  const item = createNotificationHTML(data, ref, id);
  container.appendChild(item);
}

function createNotificationHTML(n, ref, id) {
  const item = document.createElement("div");
  const timestamp = n.timestamp?.toDate ? new Date(n.timestamp.toDate()).toLocaleString() : "Just now";

  item.className = `list-group-item d-flex justify-content-between align-items-start ${n.read ? '' : 'fw-bold'}`;
  item.innerHTML = `
    <div>
      <div>${n.message}</div>
      <small class="text-muted">${timestamp}</small>
    </div>
    <button class="btn btn-sm btn-link text-danger" title="Dismiss" onclick="dismissNotif('${ref.path}')">✖</button>
  `;

  item.onclick = async () => {
    await updateDoc(ref, { read: true });
    item.classList.remove("fw-bold");
  };

  return item;
}

  // Scroll pagination
  const modalBody = document.querySelector("#notifModal .modal-body");
  modalBody.onscroll = () => {
    if (modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight - 10) {
      loadNotifications(false);
    }
  };

  // Live glow
notificationsUnsub = onSnapshot(
  query(collection(db, `users/${user.uid}/notifications`), where("read", "==", false)),
  (unreadSnap) => {
    const hasUnread = !unreadSnap.empty;
    avatar.style.boxShadow = hasUnread ? "0 0 8px 3px lime" : "none";
    avatar.classList.toggle("blink", hasUnread);
  }
);

document.getElementById("toggleGroupMode").addEventListener("click", () => {
  groupingMode = groupingMode === "flat" ? "day" : "flat";
  document.getElementById("toggleGroupMode").innerText =
    groupingMode === "flat" ? "Group by Day" : "Flat View";
  document.getElementById("notificationList").innerHTML = "";
  lastVisibleNotif = null;
  loadNotifications(true);
});


}

export const NOTIFICATION_TEMPLATES = {
  likePost: (user) => `🔥 @${user} liked your post.`,
  profileView: (user) => `👀 @${user} viewed your profile.`,
  collabRequest: (user) => `🤝 @${user} requested to collaborate.`,
  feedback: (user) => `📝 @${user} left you feedback.`,
  projectAdd: (user) => `📁 @${user} added a new project.`,
  profileUpdate: (user) => `🔧 @${user} updated their profile.`,
};

const muteCache = {};

async function isMuted(toUid, type) {
  if (!muteCache[toUid]) {
    const settingsDoc = await getDoc(doc(db, `users/${toUid}/notificationSettings`));
    muteCache[toUid] = settingsDoc.exists() ? settingsDoc.data() : {};
  }

  return muteCache[toUid]?.mutedTypes?.includes(type);
}


export async function sendNotification({ toUid, fromUid, message, type = "general", fromDisplayName, fromuserAvatar }) {
  if (!toUid || !message) return;

  const muted = await isMuted(toUid, type);
  if (muted) return; // Skip if user muted this type

  await addDoc(collection(db, `users/${toUid}/notifications`), {
    message,
    fromUid,
    fromDisplayName,
    fromuserAvatar,
    type,
    read: false,
    status: "active",
    timestamp: serverTimestamp(),
  });
}

// Later for SMS or Email, call additional logic from this central function

// Optional utility for marking all as read

export async function markAllNotificationsRead() {
  const user = auth.currentUser;
  if (!user) return;

  const snap = await getDocs(collection(db, `users/${user.uid}/notifications`));
  const batch = writeBatch(db);

  snap.forEach((docSnap) => {
    if (!docSnap.data().read) {
      batch.update(docSnap.ref, { read: true });
    }
  });

  await batch.commit();
}


/*

import { sendNotification } from "https://rw-501.github.io/contenthub/includes/notifications.js";

// Example: User A liked user B's post
await sendNotification({
  toUid: "userBId",
  fromUid: "userAId",
      fromDisplayName,
    fromuserAvatar,
  message: "🔥 @AlexFlare liked your post!",
  type: "like",
});

export const NOTIFICATION_TEMPLATES = {
  likePost: (user) => `🔥 @${user} liked your post.`,
  profileView: (user) => `👀 @${user} viewed your profile.`,
  collabRequest: (user) => `🤝 @${user} requested to collaborate.`,
  feedback: (user) => `📝 @${user} left you feedback.`,
  projectAdd: (user) => `📁 @${user} added a new project.`,
  profileUpdate: (user) => `🔧 @${user} updated their profile.`,
};


  await sendNotification({
    toUid: viewedUserId,
    fromUid: viewer.uid,
    fromDisplayName: name,
    fromuserAvatar: fromuserAvatar,
    message: NOTIFICATION_TEMPLATES.profileView(name),
    type: "profileView",
  });
*/



// Add to CSS
/*
export function stopLiveNotifications() {
  if (notificationsUnsub) notificationsUnsub();
}


document.getElementById("saveNotifSettingsBtn").addEventListener("click", async () => {
  const user = auth.currentUser;
  const muted = [];
  if (document.getElementById("muteProfileView").checked) muted.push("profileView");
  // Add other checkboxes...
  await setDoc(doc(db, `users/${user.uid}/notificationSettings`), { mutedTypes: muted });
  alert("Notification settings saved");
});

<div class="form-check">
  <input class="form-check-input" type="checkbox" value="profileView" id="muteProfileView">
  <label class="form-check-label" for="muteProfileView">Mute profile view notifications</label>
</div>
<!-- Repeat for other types -->

*/
