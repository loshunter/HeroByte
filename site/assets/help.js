// Help center: the All / Player / DM topic filter, and search over every guide section.
(() => {
  const tabs = document.querySelectorAll(".tabs [data-track]");
  const topics = document.querySelectorAll(".topic[data-aud]");
  tabs.forEach((tab) =>
    tab.addEventListener("click", () => {
      const track = tab.dataset.track;
      tabs.forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
      topics.forEach((topic) => {
        const aud = topic.dataset.aud;
        topic.hidden = !(track === "all" || aud === "everyone" || aud === track);
      });
    }),
  );

  const form = document.getElementById("help-search-form");
  const input = document.getElementById("help-search");
  const box = document.getElementById("search-results");
  if (!form || !input || !box) return;

  let index = null;
  const load = () =>
    (index ??= fetch("search-index.json")
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []));

  const words = (q) => q.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
  const score = (entry, ws) => {
    const t = entry.t.toLowerCase();
    const x = entry.x.toLowerCase();
    let s = 0;
    for (const w of ws) {
      if (t.includes(w)) s += 5;
      else if (x.includes(w)) s += 1;
      else return 0; // every word must appear somewhere
    }
    if (entry.g === "Lessons") s += 2;
    return s;
  };
  const snippet = (text, ws) => {
    const lower = text.toLowerCase();
    const at = Math.max(0, Math.min(...ws.map((w) => lower.indexOf(w)).filter((i) => i >= 0)) - 40);
    const cut = text.slice(at, at + 180).trim();
    return (at > 0 ? "…" : "") + cut + (at + 180 < text.length ? "…" : "");
  };
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  async function run() {
    const q = input.value.trim();
    const ws = words(q);
    if (!ws.length) {
      box.hidden = true;
      box.replaceChildren();
      return;
    }
    const all = await load();
    const hits = all
      .map((e) => ({ e, s: score(e, ws) }))
      .filter((h) => h.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 8);
    box.replaceChildren();
    if (!hits.length) {
      box.append(el("p", "", `Nothing matches “${q}”. Try one word, like fog, invite or dice.`));
    } else {
      for (const { e } of hits) {
        const a = el("a");
        a.href = e.u;
        a.append(el("span", "r-where", e.g), el("span", "r-title", e.t));
        if (e.x) a.append(el("span", "r-text", snippet(e.x, ws)));
        box.append(a);
      }
    }
    box.hidden = false;
  }

  let timer = 0;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 120);
  });
  input.addEventListener("focus", load, { once: true });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    run().then(() => box.querySelector("a")?.focus());
  });
})();
