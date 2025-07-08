

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

//window.addEventListener("DOMContentLoaded", loadPostScript);
  console.log("🧠 Loading post.js ");


loadPostScript();