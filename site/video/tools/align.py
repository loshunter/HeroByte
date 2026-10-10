"""Word timings for a lesson's narration, from local Whisper (no ElevenLabs credits).

    python site/video/tools/align.py <lesson-slug>

Reads site/narration/out/lessons/<slug>/*.mp3 and writes
site/video/narration-timing/<slug>.json: per chapter, its audio file, duration and words
with start/end seconds. The edit uses it for captions and to pace the screen recording.
"""
import json
import pathlib
import subprocess
import sys

import whisper

REPO = pathlib.Path(__file__).resolve().parents[3]


def duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def main(slug):
    src = REPO / "site" / "narration" / "out" / "lessons" / slug
    model = whisper.load_model("large-v3-turbo")
    chapters = []
    for mp3 in sorted(src.glob("*.mp3")):
        result = model.transcribe(str(mp3), language="en", word_timestamps=True, fp16=False)
        words = [
            {"w": w["word"].strip(), "s": round(w["start"], 3), "e": round(w["end"], 3)}
            for seg in result["segments"]
            for w in seg["words"]
        ]
        chapters.append({"file": mp3.name, "duration": duration(mp3), "text": result["text"].strip(), "words": words})
        print(f"{mp3.name}: {len(words)} words", flush=True)
    dest = REPO / "site" / "video" / "narration-timing" / f"{slug}.json"
    dest.write_text(json.dumps({"lesson": slug, "chapters": chapters}, indent=1), encoding="utf-8")
    print(f"wrote {dest}")


if __name__ == "__main__":
    main(sys.argv[1])
