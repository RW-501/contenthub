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
  const modalBody = document.querySelector("#notifModal .modal-body");
  const toggleBtn = document.getElementById("toggleGroupMode");

  let lastVisibleNotif = null;
  let loadingMore = false;
  let groupingMode = "day";
  let notificationsUnsub = null;

  // ✉️ Load notifications
  async function loadNotifications(initial = true) {
    if (loadingMore) return;
    loadingMore = true;

    const baseRef = collection(db, `users/${user.uid}/notifications`);
    let q = query(baseRef, orderBy("timestamp", "desc"), limit(20));

    if (!initial && lastVisibleNotif) {
      q = query(baseRef, orderBy("timestamp", "desc"), startAfter(lastVisibleNotif), limit(20));
    }

    const snap = await getDocs(q);
    if (snap.empty) {
      loadingMore = false;
      return;
    }

    lastVisibleNotif = snap.docs[snap.docs.length - 1];

    if (groupingMode === "day") {
      const groups = {};

      snap.forEach(docSnap => {
        const data = docSnap.data();
        const dayKey = getDayLabel(data.timestamp?.toDate?.());
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

  // 🗓 Grouping label logic
  function getDayLabel(date) {
    const now = new Date();
    const d = new Date(date);
    const today = now.toDateString();
    const yesterday = new Date(now.setDate(now.getDate() - 1)).toDateString();

    if (d.toDateString() === today) return "Today";
    if (d.toDateString() === yesterday) return "Yesterday";

    const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 7 ? "This Week" : "Older";
  }

  // 📅 Grouped UI
  function renderGroupedByDay(groups) {
    notifList.innerHTML = "";
    Object.entries(groups).forEach(([day, items]) => {
      const collapseId = `notif-group-${day.replace(/\s/g, "-")}`;

      notifList.insertAdjacentHTML("beforeend", `
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

  // 🧱 Flat list item render
  function renderNotificationItem(data, ref, id) {
    const item = createNotificationHTML(data, ref, id);
    notifList.appendChild(item);
  }

  // 🔔 HTML generator
  function createNotificationHTML(n, ref, id) {
    const item = document.createElement("div");
    const timestamp = n.timestamp?.toDate?.() ? new Date(n.timestamp.toDate()).toLocaleString() : "Just now";

    item.className = `list-group-item d-flex justify-content-between align-items-start ${n.read ? '' : 'fw-bold'}`;
    item.innerHTML = `
      <div>
        <div>
          <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${n.fromUid}" class="text-decoration-none">
            <img src="${n.fromuserAvatar}" class="avatar mb-2 me-2" style="width:32px;height:32px;border-radius:50%;" />
          </a>
        </div>
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

  // ❌ Dismiss handler
  window.dismissNotif = async (refPath) => {
    const notifRef = doc(db, refPath);
    await updateDoc(notifRef, { status: "removed", read: true });
    document.querySelector(`[onclick="dismissNotif('${refPath}')"]`)?.closest(".list-group-item")?.remove();
  };

  // 🔁 Scroll pagination
  modalBody.onscroll = () => {
    if (modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight - 10) {
      loadNotifications(false);
    }
  };

  // 🔴 Real-time glow effect on new
  notificationsUnsub = onSnapshot(
    query(collection(db, `users/${user.uid}/notifications`), where("read", "==", false)),
    (unreadSnap) => {
      const hasUnread = !unreadSnap.empty;
      avatar.style.boxShadow = hasUnread ? "0 0 8px 3px lime" : "none";
      avatar.classList.toggle("blink", hasUnread);
    }
  );

  // 🔘 Toggle group mode
  toggleBtn?.addEventListener("click", () => {
    groupingMode = groupingMode === "flat" ? "day" : "flat";
    toggleBtn.innerText = groupingMode === "flat" ? "Group by Day" : "Flat View";
    notifList.innerHTML = "";
    lastVisibleNotif = null;
    loadNotifications(true);
  });

  // 🔔 Open modal + load
  notifBtn?.addEventListener("click", () => {
    notifList.innerHTML = "";
    lastVisibleNotif = null;
    loadNotifications(true);
    new bootstrap.Modal(document.getElementById("notifModal")).show();
  });

  console.log("✅ Live notifications initialized");
}

window.initLiveNotifications = initLiveNotifications;



setTimeout(() => {
  initLiveNotifications();
}, 1000); // ⏱ 1 second = 1000ms


export const NOTIFICATION_TEMPLATES = {
  likePost: (user) => `🔥 ${user} liked your post.`,
  profileView: (user) => `👀 ${user} viewed your profile.`,
  collabRequest: (user) => `🤝 ${user} requested to collaborate.`,
  feedback: (user) => `📝 ${user} left you feedback.`,
  projectAdd: (user) => `📁 ${user} added a new project.`,
  profileUpdate: (user) => `🔧 ${user} updated their profile.`,
  updateProjectHistory: (user) => `🔧 ${user} updated their ProjectHistory.`,
};





export async function sendNotification({ toUid, fromUid, message, type = "general", fromDisplayName, fromuserAvatar }) {
  if (!toUid || !message) return;

  
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

window.markAllNotificationsRead = markAllNotificationsRead();
/*
if (hasUnread) notifBtn.innerHTML = '🔔 <span class="badge bg-danger">!</span>';

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


    const avatar = document.getElementById("userAvatar");
const viewerUserId = avatar.dataset.uid;
const viewerDisplayName = avatar.dataset.displayname;
const viewerRole = avatar.dataset.role;
const viewerUsername = avatar.dataset.username;
const viewerUserPhotoURL = avatar.dataset.photo;

  await sendNotification({
    toUid: viewerUserId,
    fromUid: viewerUserId,
    fromDisplayName: viewerDisplayName,
    fromuserAvatar: viewerUserPhotoURL,
    message: NOTIFICATION_TEMPLATES.profileView(viewerDisplayName),
    type: "updateProjectHistory",
  });
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


const rewardTasks = [
  {
    id: "referral-5",
    type: "referral",
    condition: { invitesJoined: 5 },
    reward: { badge: "Referral Lv.5", points: 50 },
    autoFeature: { days: 7, reason: "Referred 5 creators" }
  },
  {
    id: "referral-10",
    type: "referral",
    condition: { invitesJoined: 10 },
    reward: { badge: "Referral Lv.10", points: 100 }
  },
{
    id: "first-post",
    type: "post",
    condition: { postCount: 1 },
    reward: { badge: "First Post", points: 20 }
  },
  {
    id: "post-5",
    type: "post",
    condition: { postCount: 5 },
    reward: { badge: "5 Posts", points: 40 }
  },
  {
    id: "post-10",
    type: "post",
    condition: { postCount: 10 },
    reward: { badge: "10 Posts", points: 80 }
  },
  {
    id: "streak-3",
    type: "postStreak",
    condition: { postStreak: 3 },
    reward: { badge: "3 Day Streak", points: 100 }
  },
  {
    id: "post-25",
    type: "post",
    condition: { postCount: 25 },
    reward: { badge: "25 Posts", points: 200 }
  },
  {
    id: "first-collab",
    type: "collaboration",
    condition: { collabsCompleted: 1 },
    reward: { badge: "First Collab", points: 30 }
  }
];


export async function checkAndAwardTasks(uid, userData) {
  const userRef = doc(db, "users", uid);
  const completed = userData.rewardsCompleted || [];

  for (const task of rewardTasks) {
    if (completed.includes(task.id)) continue; // already done

    const condition = task.condition;
    const meetsRequirement = Object.keys(condition).every(key => {
      return (userData[key] || 0) >= condition[key];
    });

    if (meetsRequirement) {
      const updates = {
        rewardsCompleted: arrayUnion(task.id),
        points: (userData.points || 0) + (task.reward.points || 0)
      };

      if (task.reward.badge) {
        updates[`badges.${task.type}`] = {
          ...(userData.badges?.[task.type] || {}),
          levels: [
            ...new Set([
              ...(userData.badges?.[task.type]?.levels || []),
              parseInt(task.condition[Object.keys(task.condition)[0]])
            ])
          ],
          lastEarned: serverTimestamp()
        };
      }

      if (task.autoFeature) {
        const featuredUntil = new Date();
        featuredUntil.setDate(featuredUntil.getDate() + task.autoFeature.days);
        updates.featured = {
          isFeatured: true,
          reason: task.autoFeature.reason,
          featuredUntil: Timestamp.fromDate(featuredUntil),
          addedBy: "system",
          addedAt: serverTimestamp()
        };
      }

      await updateDoc(userRef, updates);
      console.log(`✅ Awarded task ${task.id} to ${uid}`);
    }
  }
}
