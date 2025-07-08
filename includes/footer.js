

// /includes/footer.js

document.getElementById('footerYear').textContent = new Date().getFullYear();


function loadPostScript() {
    const existing = document.querySelector('script[src="https://rw-501.github.io/contenthub/includes/post.js"]');
    if (existing) return;
  console.log("?post JS ???");

    const script = document.createElement('script');
    script.src = "https://rw-501.github.io/contenthub/includes/post.js";
    script.type = "module";  // 💥 THIS IS REQUIRED
    document.head.appendChild(script);
  }
console.log(" loadPostScript post area");

  // Load it when needed
  loadPostScript();

window.addEventListener("load", () => {
  // same loadPostScript() function inside here
  console.log("window loadPostScript");

});
  console.log("??????????????????");


