// Videos from site/media/: Cloudflare Pages ignores Range requests, so a video streamed from it
// cannot seek and Safari may not play it at all. The first press of play (or of a chapter)
// downloads the whole file and plays it from memory, where seeking always works.
// Lesson pages: a chapter button (or a step's time) plays the video from that chapter, and the
// chapter playing is the one marked. A YouTube lesson reloads its player at that second instead.
(() => {
  const whole = new Map();
  for (const video of document.querySelectorAll("video[data-src]")) {
    const start = video.parentElement.querySelector(".video-start");
    const status = start.querySelector(".video-status");
    let loading = null;
    const load = () =>
      (loading ??= (async () => {
        start.disabled = true;
        status.textContent = "LOADING…";
        const res = await fetch(video.dataset.src);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const total = Number(res.headers.get("content-length")) || 0;
        const reader = res.body.getReader();
        const parts = [];
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          parts.push(value);
          got += value.length;
          if (total) status.textContent = `LOADING ${Math.floor((got * 100) / total)}%`;
        }
        const loaded = new Promise((resolve, reject) => {
          video.addEventListener("loadedmetadata", resolve, { once: true });
          video.addEventListener("error", reject, { once: true });
        });
        video.src = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
        await loaded;
        video.controls = true;
        start.hidden = true;
      })().catch((err) => {
        loading = null;
        start.disabled = false;
        status.textContent = "COULD NOT LOAD IT. PRESS TO TRY AGAIN";
        throw err;
      }));
    // play() inside the press, before the download: Safari then allows the play() after it.
    const play = (t) => {
      if (video.src) {
        video.currentTime = t;
        video.play().catch(() => {});
        return;
      }
      video.play().catch(() => {});
      load()
        .then(() => {
          video.currentTime = t;
          return video.play();
        })
        .catch(() => {});
    };
    start.addEventListener("click", () => play(0));
    whole.set(video, play);
  }

  const video = document.querySelector(".screen video");
  const frame = document.querySelector(".screen iframe[data-base]");
  const buttons = [...document.querySelectorAll(".chapters button[data-t]")];
  const mark = (b) => buttons.forEach((o) => o.setAttribute("aria-current", String(o === b)));
  const seek = (t) => {
    if (video) whole.get(video)?.(t);
    else if (frame) frame.src = `${frame.dataset.base}?start=${Math.floor(t)}&autoplay=1`;
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
    if (!video.src) return;
    const now = buttons.findLast((o) => Number(o.dataset.t) <= video.currentTime + 0.25) ?? buttons[0];
    if (now && now.getAttribute("aria-current") !== "true") mark(now);
  });
})();
