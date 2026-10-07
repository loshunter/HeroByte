// Lesson pages: the chapter buttons switch the still under the "video coming soon" screen.
(() => {
  const img = document.querySelector(".screen img");
  const cap = document.querySelector(".screen-over .cap");
  const buttons = document.querySelectorAll(".chapters button[data-img]");
  buttons.forEach((b, i) =>
    b.addEventListener("click", () => {
      buttons.forEach((o) => o.setAttribute("aria-current", String(o === b)));
      if (img) {
        img.src = b.dataset.img;
        img.alt = b.dataset.alt || "";
      }
      if (cap) cap.textContent = `Chapter ${i + 1}: ${b.dataset.title}`;
    }),
  );
})();
