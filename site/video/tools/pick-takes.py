"""Pick the best take of each chapter by how closely Wren read the script (local Whisper).

    python site/video/tools/pick-takes.py <lesson-slug> "<video title words>"

Transcribes every take in site/narration/out/lessons/<slug>/, scores it against the chapter's
text in docs/website/narration-wren.md (word error rate, delivery tags removed), keeps the best
take of each chapter in place and moves the others to <slug>/alt/. Prints the scores.
"""
import difflib
import pathlib
import re
import shutil
import sys

import whisper

REPO = pathlib.Path(__file__).resolve().parents[3]


def words(text):
    text = re.sub(r"\[[^\]]*\]", " ", text)
    text = re.sub(r'"/[^/]*/"', " ", text)
    return re.findall(r"[a-z0-9']+", text.lower().replace("-", " "))


def script_chapters(title_words):
    md = (REPO / "docs" / "website" / "narration-wren.md").read_text(encoding="utf-8")
    sections = re.split(r"\n## ", md)
    section = next(s for s in sections if title_words.lower() in s.splitlines()[0].lower())
    return re.findall(r"### (\d+)\. [^\n]*\n+```text\n(.*?)```", section, re.S)


def wer(ref, hyp):
    sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    errors = sum(max(i2 - i1, j2 - j1) for op, i1, i2, j1, j2 in sm.get_opcodes() if op != "equal")
    return errors / max(1, len(ref))


def main(slug, title_words):
    folder = REPO / "site" / "narration" / "out" / "lessons" / slug
    texts = {int(n): words(t) for n, t in script_chapters(title_words)}
    model = whisper.load_model("large-v3-turbo")
    best = {}
    for mp3 in sorted(folder.glob("*-take*.mp3")):
        n = int(mp3.name.split("-")[0])
        heard = words(model.transcribe(str(mp3), language="en", fp16=False)["text"])
        score = wer(texts[n], heard)
        print(f"{mp3.name}: {score:.3f} word error rate", flush=True)
        if n not in best or score < best[n][0]:
            best[n] = (score, mp3)
    alt = folder / "alt"
    alt.mkdir(exist_ok=True)
    keep = {mp3 for _, mp3 in best.values()}
    for mp3 in sorted(folder.glob("*-take*.mp3")):
        if mp3 not in keep:
            shutil.move(str(mp3), str(alt / mp3.name))
    for n in sorted(best):
        print(f"chapter {n}: kept {best[n][1].name} ({best[n][0]:.3f})")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
