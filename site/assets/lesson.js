// Lesson pages: a chapter button (or a step's time) plays the video from that chapter, and the
// chapter playing is the one marked. A YouTube lesson reloads its player at that second instead.
(() => {
  const video = document.querySelector(".screen video");
  const frame = document.querySelector(".screen iframe[data-base]");
  const buttons = [...document.querySelectorAll(".chapters button[data-t]")];
  const mark = (b) => buttons.forEach((o) => o.setAttribute("aria-current", String(o === b)));
  const seek = (t) => {
    if (video) {
      video.currentTime = t;
      video.play().catch(() => {});
    } else if (frame) {
      frame.src = `${frame.dataset.base}?start=${Math.floor(t)}&autoplay=1`;
    }
  };
  buttons.forEach((b) => b.addEventListener("click", () => (mark(b), seek(Number(b.dataset.t)))));
  document.querySelectorAll("[data-seek]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = Number(b.dataset.seek);
      mark(buttons.findLast((o) => Number(o.dataset.t) <= t) ?? buttons[0]);
      seek(t);
      (video ?? frame)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }),
  );
  video?.addEventListener("timeupdate", () => {
    const now = buttons.findLast((o) => Number(o.dataset.t) <= video.currentTime + 0.25) ?? buttons[0];
    if (now && now.getAttribute("aria-current") !== "true") mark(now);
  });
})();
