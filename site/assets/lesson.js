// Videos from site/media/: Cloudflare Pages ignores Range requests, so a video streamed from it
// cannot seek and Safari may not play it at all. The first press of play (or of a chapter)
// downloads the whole file and plays it from memory, where seeking always works.
// Lesson pages: a chapter button (or a step's time) plays the video from that chapter, and the
// chapter playing is the one marked. A YouTube lesson reloads its player at that second instead.
(() => {
  const whole = new Map();
  for (const video of document.querySelectorAll("video[data-src]")) {
    const start = video.parentElement.querySelector(".video-start");
    const status = video.parentElement.querySelector(".video-status");
    let loading = null;
    let ready = false;
    let cannot = false;
    // The button is never disabled (that would drop a keyboard user's focus); while it loads it is
    // aria-busy and ignores presses.
    // Without H.264 neither way below can play it, so it is never downloaded.
    const cannotPlay = () => {
      if (cannot || video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')) return cannot;
      cannot = true;
      start.classList.add("cannot");
      start.setAttribute("aria-disabled", "true");
      status.textContent = "THIS BROWSER CANNOT PLAY IT. USE THE DOWNLOAD LINK";
      return true;
    };
    const load = () =>
      (loading ??= (async () => {
        start.setAttribute("aria-busy", "true");
        status.textContent = "LOADING…";
        // A download that stalls for 30 seconds is given up, so a press can try again.
        const ctl = new AbortController();
        let idle;
        const bump = () => {
          clearTimeout(idle);
          idle = setTimeout(() => ctl.abort(), 30000);
        };
        const parts = [];
        try {
          bump();
          const res = await fetch(video.dataset.src, { signal: ctl.signal });
          if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
          const total = Number(res.headers.get("content-length")) || 0;
          const reader = res.body.getReader();
          let got = 0;
          for (;;) {
            bump();
            const { done, value } = await reader.read();
            if (done) break;
            parts.push(value);
            got += value.length;
            if (total) status.textContent = `LOADING ${Math.min(100, Math.floor((got * 100) / total))}%`;
          }
        } finally {
          clearTimeout(idle);
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
        start.removeAttribute("aria-busy");
        // Focus on the button would be lost when it hides; hand it to the video.
        const hadFocus = document.activeElement === start;
        start.hidden = true;
        if (hadFocus) video.focus({ preventScroll: true });
      })().catch((err) => {
        loading = null;
        start.removeAttribute("aria-busy");
        video.removeAttribute("src");
        video.load();
        status.textContent = "COULD NOT LOAD IT. PRESS TO TRY AGAIN";
        throw err;
      }));
    // play() inside the press, before the download: Safari then allows the play() after it.
    const play = (t) => {
      if (cannotPlay()) return false;
      if (ready) {
        video.currentTime = t;
        video.play().catch(() => {});
        return true;
      }
      video.play().catch(() => {});
      load()
        .then(() => {
          video.currentTime = t;
          return video.play();
        })
        .catch(() => {});
      return true;
    };
    // A press while it loads would put a chosen chapter back to 0:00.
    start.addEventListener("click", () => loading || play(0));
    whole.set(video, play);
  }

  const video = document.querySelector(".screen video");
  const frame = document.querySelector(".screen iframe[data-base]");
  const buttons = [...document.querySelectorAll(".chapters button[data-t]")];
  const mark = (b) => buttons.forEach((o) => o.setAttribute("aria-current", String(o === b)));
  // The last chapter starting at or before t (no findLast: iOS before 15.4 lacks it).
  const chapterAt = (t) => [...buttons].reverse().find((o) => Number(o.dataset.t) <= t) ?? buttons[0];
  // false when the video cannot play here, so nothing is marked as playing.
  const seek = (t) => {
    if (video) return whole.get(video)?.(t) ?? false;
    if (frame) frame.src = `${frame.dataset.base}?start=${Math.floor(t)}&autoplay=1`;
    return !!frame;
  };
  buttons.forEach((b) => b.addEventListener("click", () => seek(Number(b.dataset.t)) && mark(b)));
  document.querySelectorAll("[data-seek]").forEach((b) =>
    b.addEventListener("click", () => {
      const t = Number(b.dataset.seek);
      if (seek(t)) mark(chapterAt(t));
      (video ?? frame)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }),
  );
  video?.addEventListener("timeupdate", () => {
    if (!video.controls) return;
    const now = chapterAt(video.currentTime + 0.25);
    if (now && now.getAttribute("aria-current") !== "true") mark(now);
  });
})();
