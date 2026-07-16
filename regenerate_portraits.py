# -*- coding: utf-8 -*-
"""
批量重新生成三国角色 AI 半身立绘 — 统一 galgame/VN 风格
"""
import subprocess
import json
import time
import os
import sys
from urllib.request import urlopen

BASE = r"C:\Users\Administrator\AppData\Local\Programs\CodeBuddy CN\resources\app\extensions\genie\out\extension\builtin\buddy-multimodal-generation\scripts\buddy-cloud.py"
OUTPUT_DIR = r"C:\Users\Administrator\CodeBuddy\20260402085532\assets\pixel_chars"
TOKEN = os.environ.get("BUDDY_CLOUD_TOKEN", "")

# 统一的 galgame 半身立绘风格
STYLE = (
    "half-body portrait, waist-up, centered vertical composition, "
    "9:16 aspect ratio, pixel art, visual novel style portrait, "
    "clean pixel edges, rich contrasting colors, retro RPG art, "
    "semi-realistic pixel shading, game character sprite, "
    "dark atmospheric background with soft vignette, "
    "no watermark, no text, no logo, no signature"
)

CHARACTERS = [
    ("hero", "young Chinese warrior swordsman, handsome face, blue martial robes, high ponytail topknot, hand on sword hilt, confident smirk, age 20, waist-up portrait"),
    ("storyteller", "old Chinese storyteller sage, wide bamboo hat, long white beard, wise squinting eyes, holding folding fan, coarse brown robes, age 65, waist-up portrait"),
    ("hanbo", "elderly Chinese magistrate official, grey hair and eyebrows, dark official robes, holding scroll, worried but kind expression, age 60, waist-up portrait"),
    ("hualao", "elderly Chinese doctor physician, white hair topknot, green scholar robe, holding wooden cane, calm serene smile, age 70, waist-up portrait"),
    ("zuoci", "mysterious Chinese Taoist monk, purple dark robes, Taoist cap, long white beard, holding white whisk, piercing eyes, age 80, waist-up portrait"),
    ("shuijing", "wise Chinese strategist scholar, white scholar robes, headscarf, holding bamboo scroll, calm knowing expression, age 50, waist-up portrait"),
    ("captain", "Chinese military captain commander, silver helmet with red tassel, red scale armor, holding spear upright, stern determined face, age 35, waist-up portrait"),
    ("yellow_turban", "Yellow Turban rebel bandit soldier, yellow headband cloth, tattered brown clothes, holding short blade, fierce aggressive expression, age 30, waist-up portrait"),
    ("xiliang_soldier", "Xiliang frontier barbarian soldier, wild unkempt hair, fur collar leather armor, holding long spear, rugged scarred face, age 35, waist-up portrait"),
    ("deputy_general", "armored Chinese deputy general, iron grey helmet, grey heavy plate armor, battle-worn face with scar, holding sword, age 40, waist-up portrait"),
    ("boss", "mighty Chinese warlord Hua Xiong, imposing dark red heavy armor, large horned helmet with crimson plume, massive glaive polearm, intimidating glare, age 45, waist-up portrait"),
]

def _clean_json(text):
    import re
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    text = text.replace('\r', '')
    for start in reversed(range(len(text))):
        if text[start] == '{':
            depth = 0
            for i in range(start, len(text)):
                if text[i] == '{':
                    depth += 1
                elif text[i] == '}':
                    depth -= 1
                    if depth == 0:
                        return text[start:i+1]
    return None

def submit(prompt):
    cmd = [
        "python", BASE, "image", prompt,
        "--token", TOKEN,
        "--no-poll"
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    raw = result.stdout + "\n" + result.stderr
    json_str = _clean_json(raw)
    if not json_str:
        print("Submit failed, no JSON found:")
        print("STDOUT:", result.stdout[:500])
        print("STDERR:", result.stderr[:500])
        return None
    try:
        return json.loads(json_str)
    except Exception as e:
        print("JSON parse failed:", e)
        print("JSON string:", json_str[:500])
        return None

def check_status(job_id):
    cmd = [
        "python", BASE, "status", job_id,
        "--type", "image",
        "--token", TOKEN
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    raw = result.stdout + "\n" + result.stderr
    json_str = _clean_json(raw)
    if not json_str:
        return None
    try:
        return json.loads(json_str)
    except Exception:
        return None

def download(url, path):
    with urlopen(url) as resp:
        with open(path, "wb") as f:
            f.write(resp.read())

if __name__ == "__main__":
    if not TOKEN:
        print("Set BUDDY_CLOUD_TOKEN env var")
        sys.exit(1)

    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--end", type=int, default=len(CHARACTERS))
    parser.add_argument("--force", action="store_true", help="Overwrite existing files")
    args = parser.parse_args()

    subset = CHARACTERS[args.start:args.end]
    print(f"Regenerating characters {args.start} to {args.end-1}, total {len(subset)}")
    print(f"Style: {STYLE[:80]}...")

    for name, desc in subset:
        out_path = os.path.join(OUTPUT_DIR, f"{name}_ai.png")
        if os.path.exists(out_path) and not args.force:
            print(f"\n[{name}] already exists, skipping (use --force to overwrite): {out_path}")
            continue
        prompt = f"{desc}, {STYLE}"
        print(f"\n[{name}] Submitting... ({len(prompt)} chars)")
        job_id = None
        retries = 0
        while True:
            resp = submit(prompt)
            if resp and resp.get("job_id"):
                job_id = resp["job_id"]
                print(f"  job_id={job_id}, waiting...")
                break
            err = resp.get("error", "") if resp else ""
            msg = resp.get("message", "") if resp else ""
            if any(k in (err+msg).lower() for k in ["concurrent","limit","上限","达到"]):
                retries += 1
                wait = 30 * retries
                print(f"  task limit, retry {retries} in {wait}s...")
                time.sleep(wait)
            else:
                print(f"  FAILED: {resp}")
                retries += 1
                if retries < 3:
                    print(f"  retrying in 30s...")
                    time.sleep(30)
                else:
                    break
        if not job_id:
            continue
        while True:
            time.sleep(10)
            status = check_status(job_id)
            if not status:
                print(f"  [{name}] status check failed, retrying...")
                continue
            st = status.get("status")
            print(f"  [{name}] {st}")
            if st == "DONE":
                urls = status.get("result_url", [])
                if urls:
                    if os.path.exists(out_path):
                        os.rename(out_path, out_path.replace(".png", "_old.png"))
                    download(urls[0], out_path)
                    print(f"  downloaded -> {out_path}")
                break
            elif st == "FAIL":
                print(f"  FAILED: {status}")
                break
        time.sleep(5)

    print("\nAll done!")
