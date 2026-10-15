"""Temp narration in Wren's voice, made locally with VibeVoice (no ElevenLabs credits).

    D:/AI/VibeVoiceTTS/.venv/Scripts/python.exe site/narration/vibevoice.py "Player path 3" ["Player path 4" ...]
        [--chapters 1,3] [--model 1.5B|Large] [--voice Wren] [--force]
    ... "DM path 5#1,3,4" voices only that video's chapters 1, 3 and 4.

Several videos in one run share one model load (minutes).

Reads the lesson's chapters from docs/website/narration-wren.md (the same "## video" / "### N. chapter" /
```text blocks that narrate.mjs reads) and writes each one where narrate.mjs would:
site/narration/out/lessons/<video-slug>/<chapter-slug>-take1.mp3. So align.py, pick-takes.py,
frames-to-mp4.mjs and the edit all take a temp track exactly as they take a real one, and a real take
from narrate.mjs later simply replaces it.

Temp tracks are listed, with their hashes, in that folder's temp-narration.json. This tool only
overwrites a file it made and nobody replaced since: a real ElevenLabs take (narrate.mjs writes the
same names) is never replaced (pass --force to replace one anyway).

Wren here is a VibeVoice clone of 24 s of her ElevenLabs narration (the DM quick start's first
chapter), installed as <VibeVoiceTTS>/demo/voices/en-Wren_woman.wav. VibeVoice cannot read the
script's delivery tags ([Warm, clear tutorial narration]) or IPA, so tags are dropped and the IPA
the script uses is respelled (RESPELL below). The owner's verdict on the clone (2026-10-11): "quite
close", slightly lower quality, without the real voice's acting choices: more than good enough for
a temp track. Run with the VibeVoiceTTS venv's python; the model loads once per run (minutes).
"""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import sys
import time

REPO = pathlib.Path(__file__).resolve().parents[2]
VIBEVOICE = pathlib.Path("D:/AI/VibeVoiceTTS")
MANIFEST = "temp-narration.json"
SAMPLE_RATE = 24000

# The script pins words ElevenLabs may misread with IPA in quotes ("/ˈɪnɪt/"). VibeVoice reads text.
RESPELL = {
    "/ˈɪnɪt/": "in-it",
    "/prɛv/": "prev",
    "/koʊ diː ˈɛm/": "co-D-M",
    "/ˈhɪəroʊˌbaɪt/": "HeroByte",
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_temp(target, manifest):
    """A file this tool made and nobody has replaced since (narrate.mjs writes the same names)."""
    entry = manifest.get(target.name)
    return bool(entry) and entry.get("sha256") == sha256(target)


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def chapters_of(video_words):
    """(video title, [(number, chapter title, text)]) for the first video whose title contains the words."""
    md = (REPO / "docs" / "website" / "narration-wren.md").read_text(encoding="utf-8")
    for part in re.split(r"\n(?=## )", md):
        title = part.splitlines()[0][3:].strip() if part.startswith("## ") else ""
        if title and video_words.lower() in title.lower():
            found = re.findall(r"### ((\d+)\. [^\n]*)\n+```text\n(.*?)\n```", part, re.S)
            return title, [(int(n), heading.strip(), text.strip()) for heading, n, text in found]
    sys.exit(f'No "## ..." video in narration-wren.md matches "{video_words}".')


def speakable(text):
    """The chapter as VibeVoice should read it: no delivery tags, IPA respelled, one line."""
    text = re.sub(r"\[[^\]]*\]", " ", text)
    for ipa, word in RESPELL.items():
        text = text.replace(f'"{ipa}"', word)
    left = re.findall(r'"/[^/]*/"', text)
    if left:
        sys.exit(f"IPA with no respelling: {left}. Add it to RESPELL in {pathlib.Path(__file__).name}.")
    text = text.replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", text).strip()


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("videos", nargs="+", help='words from "## ..." video titles, e.g. "Player path 3"')
    parser.add_argument("--chapters", help="comma-separated chapter numbers (default: all)")
    parser.add_argument("--model", default="1.5B", choices=["1.5B", "Large"])
    parser.add_argument("--voice", default="Wren", help="a voice file in VibeVoiceTTS/demo/voices")
    parser.add_argument("--cfg", type=float, default=1.3, help="VibeVoice's CFG scale")
    parser.add_argument("--force", action="store_true", help="replace real (non-temp) takes too")
    args = parser.parse_args()

    plan = []
    for video in args.videos:
        # "DM path 5#1,3,4" picks that video's own chapters, so one run (one model load) can voice
        # different chapters of several videos; --chapters applies to the videos without one.
        video, hash_, own = video.partition("#")
        title, chapters = chapters_of(video)
        spec = own if hash_ else args.chapters
        if spec is not None:
            try:
                wanted = {int(n) for n in spec.split(",") if n.strip()}
            except ValueError:
                sys.exit(f'"{spec}" is not a list of chapter numbers ({title}).')
            known = {c[0] for c in chapters}
            if not wanted:
                sys.exit(f"{title}: no chapter numbers given; it has {sorted(known)}.")
            if not wanted <= known:
                sys.exit(f"{title}: chapters {sorted(wanted - known)} do not exist; it has {sorted(known)}.")
            chapters = [c for c in chapters if c[0] in wanted]
        folder = REPO / "site" / "narration" / "out" / "lessons" / slug(title)
        folder.mkdir(parents=True, exist_ok=True)
        manifest = json.loads((folder / MANIFEST).read_text(encoding="utf-8")) if (folder / MANIFEST).exists() else {}
        made = 0
        for number, heading, text in chapters:
            target = folder / f"{slug(heading)}-take1.mp3"
            if target.exists() and not is_temp(target, manifest) and not args.force:
                print(f"skip {title} / {target.name}: a real take is there (--force replaces it)")
                continue
            plan.append((heading, speakable(text), target))
            made += 1
        print(f"{title}: {made} chapter(s)")
    if not plan:
        print("Nothing to make.")
        return
    print(f"{len(plan)} chapter(s) with {args.voice} on VibeVoice-{args.model}")

    sys.path.insert(0, str(VIBEVOICE))
    import torch
    from vibevoice.modular.modeling_vibevoice_inference import VibeVoiceForConditionalGenerationInference
    from vibevoice.processor.vibevoice_processor import VibeVoiceProcessor

    voices = sorted((VIBEVOICE / "demo" / "voices").glob("*.wav"))
    voice = next((v for v in voices if args.voice.lower() in v.stem.lower()), None)
    if voice is None:
        sys.exit(f"No voice file matching {args.voice} in {VIBEVOICE / 'demo' / 'voices'}.")
    model_path = VIBEVOICE / "models" / f"VibeVoice-{args.model}"

    started = time.time()
    processor = VibeVoiceProcessor.from_pretrained(str(model_path))
    model = VibeVoiceForConditionalGenerationInference.from_pretrained(
        str(model_path),
        torch_dtype=torch.bfloat16,
        device_map="cuda",
        attn_implementation="flash_attention_2",
    )
    model.eval()
    model.set_ddpm_inference_steps(num_steps=10)
    print(f"model loaded in {time.time() - started:.0f} s", flush=True)

    for heading, text, target in plan:
        started = time.time()
        inputs = processor(
            text=[f"Speaker 1: {text}"],
            voice_samples=[[str(voice)]],
            padding=True,
            return_tensors="pt",
            return_attention_mask=True,
        )
        outputs = model.generate(
            **inputs,
            max_new_tokens=None,
            cfg_scale=args.cfg,
            tokenizer=processor.tokenizer,
            generation_config={"do_sample": False},
            verbose=False,
        )
        wav = target.with_suffix(".wav")
        processor.save_audio(outputs.speech_outputs[0], output_path=str(wav))
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-b:a", "128k", str(target)], check=True
        )
        wav.unlink()
        seconds = outputs.speech_outputs[0].shape[-1] / SAMPLE_RATE
        manifest_path = target.parent / MANIFEST
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        manifest[target.name] = {
            "chapter": heading,
            "engine": f"VibeVoice-{args.model}",
            "voice": voice.name,
            "cfg": args.cfg,
            "made": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "sha256": sha256(target),
        }
        manifest_path.write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
        print(f"  {target.parent.name}/{target.name}: {seconds:.1f} s of audio in {time.time() - started:.0f} s", flush=True)


if __name__ == "__main__":
    main()
