(function() {
  if (!document.getElementById("disqus_thread")) return;

  document.addEventListener("DOMContentLoaded", function() {
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", function() {
        location.reload();
      });
    }
  });

  window.addEventListener("storage", function(e) {
    if (e.key === "theme" || e.key === "pref-theme") {
      location.reload();
    }
  });
})();