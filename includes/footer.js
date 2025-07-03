

// /includes/footer.js

document.getElementById('footerYear').textContent = new Date().getFullYear();

  async function loadCollabModal() {
    const res = await fetch('https://rw-501.github.io/contenthub/includes/collabRequestModal.html');
    const text = await res.text();
    const template = document.createElement('div');
    template.innerHTML = text;
    document.body.appendChild(template.querySelector('template').content.cloneNode(true));
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://rw-501.github.io/contenthub/includes/collabRequestModal.js'; // put the logic part here
    document.body.appendChild(script);
  }

  // Call this when you know it might be used
  loadCollabModal();