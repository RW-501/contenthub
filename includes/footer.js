

// /includes/footer.js

document.getElementById('footerYear').textContent = new Date().getFullYear();


function loadPostScript() {
  const targetBtn = document.getElementById("mainPostBtn");
  if (!targetBtn) return;

  console.log("🧠 Loading post.js because mainPostBtn exists");

  import("https://rw-501.github.io/contenthub/includes/post.js")
    .then(module => {
      module.initPostScript();
    })
    .catch(err => {
      console.error("❌ Failed to load post.js:", err);
    });
}




loadPostScript();

function loadNotificationScript() {

  import("https://rw-501.github.io/contenthub/includes/notifications.js")
    .then(module => {
      module.initLiveNotifications();
    })
    .catch(err => {
      console.error("❌ Failed to loadNotificationScript:", err);
    });
}




loadNotificationScript();