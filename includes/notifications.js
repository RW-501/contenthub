// notifications.js (Global Notification System)

import { db, auth, confetti } from 'https://rw-501.github.io/contenthub/js/firebase-config.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc, increment,
  doc,
  getDocs,
  getDoc,
  where,
  writeBatch,arrayUnion,
  limit, Timestamp, 
  startAfter
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

//confetti();


let notificationsUnsub;

// Call this on every page after auth is loaded
let lastVisibleNotif = null;
let loadingMore = false;

let groupingMode = "flat"; // or "day"

export async function initLiveNotifications() {
  const user = auth.currentUser;
  if (!user) return;
  
  checkDailyLoginReward(user);

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

item.className = `position-relative list-group-item ${n.read ? '' : 'fw-bold'} p-3`;

item.innerHTML = `
  <!-- Dismiss button -->
  <button class="btn btn-sm btn-link text-danger position-absolute top-0 end-0 me-1 mt-1 p-0" 
          style="font-size: 1rem;" 
          title="Dismiss" 
          onclick="dismissNotif('${ref.path}')">✖</button>

  <!-- Content row -->
  <div class="d-flex align-items-start">
    <a href="https://rw-501.github.io/contenthub/pages/profile.html?uid=${n.fromUid}" class="me-2">
      <img src="${n.fromuserAvatar}" class="avatar" style="width:32px;height:32px;border-radius:50%;" />
    </a>
    <div class="flex-grow-1">
      <div class="mb-1">${n.message}</div>
      <small class="text-muted">${timestamp}</small>
    </div>

    <!-- Read button aligned right -->
    <div class="ms-3">
      <button class="btn btn-sm btn-outline-secondary"
              onclick="markAsRead('${ref.path}')">
        Mark as Read
      </button>
    </div>
  </div>
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
const viewerDisplayName = avatar.dataset.;
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


export const rewardTasks = [ 
  {
    id: "referral-5",
    type: "referral",
    condition: { invitesJoined: 5 },
    reward: { badge: "Referral Lv.5", points: 50 },
    autoFeature: { rank: 1, days: 7, reason: "Referred 5 creators" }
  },
  {
    id: "referral-10",
    type: "referral",
    condition: { invitesJoined: 10 },
    reward: { badge: "Referral Lv.10", points: 100 },
    autoFeature: { rank: 1, days: 7, reason: "Referred 10 creators" }
  },
    {
    id: "streak-3",
    type: "postStreak",
    condition: { postStreak: 3 },
    reward: { badge: "3 Day Streak", points: 100 }
  },    {
    id: "streak-7",
    type: "postStreak",
    condition: { postStreak: 7 },
    reward: { badge: "7 Day Streak", points: 200 }
  },    {
    id: "streak-14",
    type: "postStreak",
    condition: { postStreak: 14 },
    reward: { badge: "14 Day Streak", points: 500 },
    autoFeature: { rank: 1, days: 7, reason: "Posted for 14 Days" }
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
    id: "post-25",
    type: "post",
    condition: { postCount: 25 },
    reward: { badge: "25 Posts", points: 200 },
    autoFeature: { rank: 1, days: 7, reason: "Made 25 Post" }

  },
 {
    id: "feedback-1",
    type: "feedback",
    condition: { feedbackCount: 1 },
    reward: { badge: "First Feedback", points: 20 }
  },
  {
    id: "feedback-5",
    type: "feedback",
    condition: { feedbackCount: 5 },
    reward: { badge: "Feedback Giver Lv.1", points: 50 }
  },
  {
    id: "feedback-10",
    type: "feedback",
    condition: { feedbackCount: 10 },
    reward: { badge: "Feedback Giver Lv.2", points: 100 }
  },{
  id: "collab-request-1",
  type: "collab",
  condition: { collabRequestsSent: 1 },
  reward: { badge: "First Collab Request", points: 10 }
},
{
  id: "collab-request-5",
  type: "collab",
  condition: { collabRequestsSent: 5 },
  reward: { badge: "Collab Seeker Lv.1", points: 30 }
},
 { id: "login-1",   type: "dailyLogin", condition: { dailyLogins: 1 },   reward: { badge: "Logged In 1 Day", points: 10 } },
  { id: "login-2",   type: "dailyLogin", condition: { dailyLogins: 2 },   reward: { badge: "2-Day Streak", points: 15 } },
  { id: "login-3",   type: "dailyLogin", condition: { dailyLogins: 3 },   reward: { badge: "3-Day Streak", points: 20 } },
  { id: "login-4",   type: "dailyLogin", condition: { dailyLogins: 4 },   reward: { badge: "4-Day Streak", points: 25 } },
  { id: "login-5",   type: "dailyLogin", condition: { dailyLogins: 5 },   reward: { badge: "5-Day Streak", points: 30 } },
  { id: "login-6",   type: "dailyLogin", condition: { dailyLogins: 6 },   reward: { badge: "6-Day Streak", points: 35 } },
  { id: "login-7",   type: "dailyLogin", condition: { dailyLogins: 7 },   reward: { badge: "7-Day Champion", points: 40 } },

  { id: "login-14",  type: "dailyLogin", condition: { dailyLogins: 14 },  reward: { badge: "2 Weeks Strong", points: 60 } },
  { id: "login-20",  type: "dailyLogin", condition: { dailyLogins: 20 },  reward: { badge: "20 Days Logged", points: 80 } },
  { id: "login-30",  type: "dailyLogin", condition: { dailyLogins: 30 },  reward: { badge: "30-Day Warrior", points: 100 } },
  { id: "login-100", type: "dailyLogin", condition: { dailyLogins: 100 }, reward: { badge: "Century Club", points: 200 } },
  { id: "login-200", type: "dailyLogin", condition: { dailyLogins: 200 }, reward: { badge: "Login Legend", points: 400 } }
,{
  id: "profile-complete",
  type: "profile",
  condition: { profileComplete: true },
  reward: { badge: "Profile Pro", points: 20 }
},
{
  id: "avatar-uploaded",
  type: "profile",
  condition: { avatarUploaded: true },
  reward: { badge: "Face of the Hub", points: 10 }
},
{
  id: "social-links-added",
  type: "profile",
  condition: { socialLinksCount: 2 },
  reward: { badge: "Plugged In", points: 15 }
},

{
  id: "profile-updated",
  type: "profile",
  condition: { profileUpdated: true },
  reward: { badge: "Profile Updated", points: 5 }
},
{
  id: "niche-master",
  type: "profile",
  condition: { nicheCount: 3 },
  reward: { badge: "Niche Master", points: 25 }
},
// ✅ Viewed other profiles
{ id: "viewed-1",  type: "viewsGiven",  condition: { profilesViewed: 1 },  reward: { badge: "Explorer Lv.1", points: 5 } },
{ id: "viewed-5",  type: "viewsGiven",  condition: { profilesViewed: 5 },  reward: { badge: "Explorer Lv.2", points: 10 } },
{ id: "viewed-10", type: "viewsGiven",  condition: { profilesViewed: 10 }, reward: { badge: "Explorer Lv.3", points: 20 } },
{ id: "viewed-25", type: "viewsGiven",  condition: { profilesViewed: 25 }, reward: { badge: "Explorer Lv.4", points: 40 } },

// ✅ Got your profile viewed
{ id: "viewed-by-1",  type: "viewsReceived",  condition: { profileViews: 1 },  reward: { badge: "Noticed", points: 5 } },
{ id: "viewed-by-5",  type: "viewsReceived",  condition: { profileViews: 5 },  reward: { badge: "Turning Heads", points: 10 } },
{ id: "viewed-by-10", type: "viewsReceived",  condition: { profileViews: 10 }, reward: { badge: "Getting Popular", points: 20 } },
{ id: "viewed-by-50", type: "viewsReceived",  condition: { profileViews: 50 }, reward: { badge: "Fan Favorite", points: 50 } }
,
  // 🌙 Night Owl Badge
  {
    id: "night-owl",
    type: "special",
    condition: { loggedInAtNight: true },
    reward: { badge: "Night Owl", points: 10 }
  },

  // 📅 Weekend Poster Badge
  {
    id: "weekend-builder",
    type: "special",
    condition: { postedOnWeekend: true },
    reward: { badge: "Weekend Warrior", points: 15 }
  },

  // 🚀 Early Adopter Badge
  {
    id: "early-user",
    type: "special",
    condition: { isEarlyUser: true },
    reward: { badge: "Founding Member", points: 100 }
  },
  {
  id: "received-helpful-5",
  type: "reaction",
  condition: { "receivedReactions.helpful": 5 },
  reward: { badge: "Helpful Lv.1", points: 30 }
},
{
  id: "received-helpful-15",
  type: "reaction",
  condition: { "receivedReactions.helpful": 15 },
  reward: { badge: "Helpful Lv.2", points: 60 }
},
{
  id: "received-helpful-30",
  type: "reaction",
  condition: { "receivedReactions.helpful": 30 },
  reward: { badge: "Helpful Lv.3", points: 100 }
},
{
  id: "received-interested-5",
  type: "reaction",
  condition: { "receivedReactions.interested": 5 },
  reward: { badge: "Interesting Content Lv.1", points: 30 }
},
{
  id: "received-interested-15",
  type: "reaction",
  condition: { "receivedReactions.interested": 15 },
  reward: { badge: "Interesting Content Lv.2", points: 60 }
},
{
  id: "received-interested-30",
  type: "reaction",
  condition: { "receivedReactions.interested": 30 },
  reward: { badge: "Interesting Content Lv.3", points: 100 }
},
{
  id: "received-like-10",
  type: "reaction",
  condition: { "receivedReactions.like": 10 },
  reward: { badge: "Liked By Many Lv.1", points: 50 }
},
{
  id: "received-like-25",
  type: "reaction",
  condition: { "receivedReactions.like": 25 },
  reward: { badge: "Liked By Many Lv.2", points: 90 }
},
{
  id: "received-like-50",
  type: "reaction",
  condition: { "receivedReactions.like": 50 },
  reward: { badge: "Liked By Many Lv.3", points: 150 }
}
,
  {
    id: "commentMade-1",
    type: "commentMade",
    condition: { 'commentMade': 1 },
    reward: { badge: "First Comment", points: 10 }
  },
  {
    id: "commentMade-5",
    type: "commentMade",
    condition: { 'commentMade': 5 },
    reward: { badge: "Talkative", points: 25 }
  },
  {
    id: "commentMade-10",
    type: "commentMade",
    condition: { 'commentMade': 10 },
    reward: { badge: "Contributor", points: 50 }
  },
  {
    id: "commentMade-25",
    type: "commentMade",
    condition: { 'commentMade': 25 },
    reward: { badge: "Engaged Voice", points: 100 }
  },
  {
    id: "commentMade-50",
    type: "commentMade",
    condition: { 'commentMade': 50 },
    reward: { badge: "Community Leader", points: 200 }
  }




];


const rewardQueue = [];
let isShowingReward = false;

function queueRewardToast(task, userData, newTotalPoints) {
  rewardQueue.push({ task, userData, newTotalPoints });
  processRewardQueue();
}

async function processRewardQueue() {
  if (isShowingReward || rewardQueue.length === 0) return;

  const { task, userData, newTotalPoints } = rewardQueue.shift();
  isShowingReward = true;

  await runRewardToast(task, userData, newTotalPoints);

  isShowingReward = false;

  // Wait a moment before showing the next one
  setTimeout(processRewardQueue, 800);
}

function runRewardToast(task, userData = {}, newTotalPoints = 0) {
  return new Promise((resolve) => {
    const msg = task.reward.badge
      ? `🎉 You earned the "${task.reward.badge}" badge!`
      : `🎁 You earned ${task.reward.points} points!`;

      
      const myConfetti = confetti.create(document.createElement('canvas'), {
        resize: true,
        useWorker: true
      });
      
      document.body.appendChild(myConfetti.canvas);
      
      // Style the canvas to always be on top
      myConfetti.canvas.style.position = "fixed";
      myConfetti.canvas.style.top = "0";
      myConfetti.canvas.style.left = "0";
      myConfetti.canvas.style.width = "100%";
      myConfetti.canvas.style.height = "100%";
      myConfetti.canvas.style.pointerEvents = "none";
      myConfetti.canvas.style.zIndex = "9999999"; // 👈 Very high to beat Bootstrap modals
      
      
    // Confetti
    confetti({
      particleCount: 250,
      spread: 80,
      origin: { y: 0.6 }
    });

    // Show reward modal
    showModal({
      title: "Reward Earned",
      message: msg,
      autoClose: 4000
    });

    // Milestone logic
    setTimeout(async () => {
      const uid = userData.uid;
      const userRef = doc(db, "users", uid);
      const now = new Date();
      const featuredUntil = new Date(now);
      featuredUntil.setDate(featuredUntil.getDate() + 7);

      const notYetFeatured = !userData.featured?.isFeatured;

      if (newTotalPoints >= 200 && newTotalPoints < 500 && notYetFeatured) {
        showModal({
          title: "🎉 You're Featured!",
          message: "You've earned over 200 points and have been featured for a week! 🚀",
          autoClose: 5000
        });

        await updateDoc(userRef, {
          featured: {
            isFeatured: true,
            reason: "1000+ Points Earned",
            startDate: Timestamp.fromDate(now),
            featuredUntil: Timestamp.fromDate(featuredUntil),
            rank: 2,
            addedBy: "system",
            addedAt: serverTimestamp()
          }
        });
      }

      if (newTotalPoints >= 1000 && !userData.milestones?.includes("star")) {
        showModal({
          title: "🌟 You're a Content Star!",
          message: "You've earned over 1000 points. You're rising fast! 🌠",
          autoClose: 6000
        });

        await updateDoc(userRef, {
          milestones: arrayUnion("star")
        });
      }

      if (newTotalPoints >= 2000 && !userData.milestones?.includes("elite")) {
        showModal({
          title: "🚀 Elite Creator Unlocked!",
          message: "2,000+ points! You're one of the top creators on the platform 🔥",
          autoClose: 6000
        });

        await updateDoc(userRef, {
          milestones: arrayUnion("elite")
        });
      }

      // Finish this reward toast
      resolve();
    }, 4500); // enough time for first modal to auto-close
  });
}


export async function checkAndAwardTasks(uid, userData) {
    if (!uid) {
    return;
  }
  const userRef = doc(db, "users", uid);
  const completed = userData.rewardsCompleted || [];

  for (const task of rewardTasks) {
    if (completed.includes(task.id)) continue;

    const condition = task.condition;
    const meetsRequirement = Object.keys(condition).every(key => {
      return (userData[key] || 0) >= condition[key];
    });

    if (meetsRequirement) {
      const updates = {
        rewardsCompleted: arrayUnion(task.id),
        points: (userData.points || 0) + (task.reward.points || 0)
      };

      // Badge handling
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

      // Auto-feature logic from task
      if (task.autoFeature) {
        const now = new Date();
        const featuredUntil = new Date(now);
        featuredUntil.setDate(featuredUntil.getDate() + task.autoFeature.days);

        updates.featured = {
          isFeatured: true,
          reason: task.autoFeature.reason,
          startDate: Timestamp.fromDate(now),
          featuredUntil: Timestamp.fromDate(featuredUntil),
          rank: task.autoFeature.rank || 3,
          addedBy: "system",
          addedAt: serverTimestamp()
        };
      }

      await updateDoc(userRef, updates);

      // Calculate new total points & trigger reward modal
      const newTotalPoints = updates.points;
queueRewardToast(task, { ...userData, uid }, newTotalPoints);

      console.log(`✅ Awarded task ${task.id} to ${uid}`);
    }
  }
}




async function checkDailyLoginReward(user) {
  const uid = user.uid;
  const todayKey = `dailyLoginCheck_${uid}_${new Date().toDateString()}`;
    checkAndSetSpecialFlags(uid); // new one

  // ✅ Already checked today? Skip
  if (localStorage.getItem(todayKey)) {
    console.log("🟡 Daily login already checked in this session.");
    return;
  }

  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);
  const userData = userSnap.exists() ? userSnap.data() : {};
  const lastLogin = userData.lastLogin?.toDate?.();
  const todayStr = new Date().toDateString();

  // 🟡 Check if user already logged in today in Firestore
  if (lastLogin && new Date(lastLogin).toDateString() === todayStr) {
    console.log("✅ Already logged in today (Firestore).");
    localStorage.setItem(todayKey, "true"); // ✅ Save local flag
    return;
  }

  // ✅ Update Firestore and localStorage
  await updateDoc(userRef, {
    lastLogin: serverTimestamp(),
    dailyLogins: increment(1)
  });

  const updatedSnap = await getDoc(userRef);
  await checkAndAwardTasks(uid, updatedSnap.data());

  localStorage.setItem(todayKey, "true");
  console.log("🎉 Daily login reward recorded!");
}


export async function checkAndSetSpecialFlags(uid) {
  const userRef = doc(db, "users", uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  const updates = {};

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sun, 6 = Sat

  // 🌙 Night Owl: Between 12am–5am
  if (hour >= 0 && hour <= 5 && !userData.loggedInAtNight) {
    updates.loggedInAtNight = true;
  }

  // 📅 Weekend Builder: Saturday or Sunday
  if ((day === 0 || day === 6) && !userData.postedOnWeekend) {
    updates.postedOnWeekend = true;
  }

  // 🚀 Early User: Joined before a certain date (change as needed)
  const cutoffDate = new Date("2025-08-01");
  const createdAt = userData.createdAt?.toDate?.();

  if (createdAt && createdAt < cutoffDate && !userData.isEarlyUser) {
    updates.isEarlyUser = true;
  }

  // If any updates exist, apply them and check for rewards
  if (Object.keys(updates).length > 0) {
    await updateDoc(userRef, updates);

    const updatedSnap = await getDoc(userRef);
    const updatedData = updatedSnap.data();
    await checkAndAwardTasks(uid, updatedData);

    console.log("🎯 Special flags updated and tasks checked:", updates);
  }
}








