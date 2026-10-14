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
    let ready = false;
    const load = () =>
      (loading ??= (async () => {
        // Without H.264 neither way below can play it, so do not download it first.
        if (!video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) throw new Error("no H.264");
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
          if (total) status.textContent = `LOADING ${Math.min(100, Math.floor((got * 100) / total))}%`;
        }
        // preload "none" (until the press) would leave the second src unloaded, so ask for it;
        // and give up on a source that has neither loaded nor failed in a minute.
        const open = (src) => {
          let timer;
          const loaded = new Promise((resolve, reject) => {
            video.addEventListener("loadedmetadata", resolve, { once: true });
            video.addEventListener("error", reject, { once: true });
            timer = setTimeout(reject, 60000);
          }).finally(() => clearTimeout(timer));
          video.preload = "auto";
          video.src = src;
          return loaded;
        };
        const blob = URL.createObjectURL(new Blob(parts, { type: "video/mp4" }));
        // A browser that will not play a blob: video (WebKit's Windows build, for one) gets the
        // file itself: it plays, though it may not seek.
        await open(blob).catch(() => (URL.revokeObjectURL(blob), open(video.dataset.src)));
        ready = true;
        video.controls = true;
        status.textContent = "";
        // A keyboard press on the button would leave focus on nothing once it hides.
        const hadFocus = document.activeElement === start;
        start.hidden = true;
        if (hadFocus) video.focus({ preventScroll: true });
      })().catch((err) => {
        loading = null;
        video.removeAttribute("src");
        video.load();
        start.disabled = false;
        status.textContent =
          err?.message === "no H.264"
            ? "THIS BROWSER CANNOT PLAY IT. USE THE DOWNLOAD LINK"
            : "COULD NOT LOAD IT. PRESS TO TRY AGAIN";
        throw err;
      }));
    // play() inside the press, before the download: Safari then allows the play() after it.
    const play = (t) => {
      if (ready) {
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
  // The last chapter starting at or before t (no findLast: iOS before 15.4 lacks it).
  const chapterAt = (t) => [...buttons].reverse().find((o) => Number(o.dataset.t) <= t) ?? buttons[0];
  const seek = (t) => {
    if (video) whole.get(video)?.(t);
    else if (frame) frame.src = `${frame.dataset.base}?start=${Math.floor(t)}&autoplay=1`;
  };
  buttons.forEach((b) => b.addEventListener("click", () => (mark(b), seek(Number(b.dataset.t)))));
  document.querySelectorAll("[data-seek]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = Number(b.dataset.seek);
      mark(chapterAt(t));
      seek(t);
      (video ?? frame)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }),
  );
  video?.addEventListener("timeupdate", () => {
    if (!video.controls) return;
    const now = chapterAt(video.currentTime + 0.25);
    if (now && now.getAttribute("aria-current") !== "true") mark(now);
  });
})();
