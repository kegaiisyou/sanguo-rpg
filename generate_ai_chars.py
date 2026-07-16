# -*- coding: utf-8 -*-
"""
批量生成三国角色 AI 像素画（半身/头像风格）
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

STYLE = (
    "pixel art portrait, Chinese Three Kingdoms character, "
    "anime-style face, big expressive eyes, clean pixel edges, "
    "soft color palette, retro RPG portrait, centered composition, "
    "shoulder-up portrait, neutral background, game asset, high quality"
)

CHARACTERS = [
    ("hero", "young Chinese hero swordsman, hair bun topknot, blue robes, confident expression"),
    ("storyteller", "old Chinese storyteller, large straw hat, white beard, holding a folding fan, wise expression"),
    ("hanbo", "elderly Chinese man, white hair and eyebrows, simple grey robes, carrying a wooden staff, kind face"),
    ("hualao", "elderly Chinese scholar, white hair topknot, green robe, holding a cane, serene expression"),
    ("zuoci", "mysterious Chinese Taoist mage, purple robes, Taoist cap, long white beard, holding a whisk and talisman"),
    ("shuijing", "wise Chinese strategist, white robes, scholar headscarf, holding a bamboo scroll, calm expression"),
    ("captain", "Chinese military captain, silver helmet with red tassel, red scale armor, spear, stern expression"),
    ("yellow_turban", "Yellow Turban rebel soldier, yellow head cloth, ragged clothes, fierce expression, short blade"),
    ("xiliang_soldier", "Xiliang barbarian soldier, wild hair, fur collar leather armor, long spear, rugged face"),
    ("deputy_general", "armored Chinese deputy general, iron helmet, grey plate armor, sword at waist, battle-worn face"),
    ("boss", "mighty Chinese warrior Hua Xiong, dark red heavy armor, large helmet with red plume, massive polearm, intimidating"),
]

def _clean_json(text):
    # Strip ANSI escape codes and normalize whitespace
    import re
    text = re.sub(r'\x1b\[[0-9;]*m', '', text)
    text = text.replace('\r', '')
    # Find the last valid JSON object with balanced braces
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
    args = parser.parse_args()

    subset = CHARACTERS[args.start:args.end]
    print(f"Generating characters {args.start} to {args.end-1}, total {len(subset)}")

    for name, desc in subset:
        out_path = os.path.join(OUTPUT_DIR, f"{name}_ai.png")
        if os.path.exists(out_path):
            print(f"\n[{name}] already exists, skipping: {out_path}")
            continue
        prompt = f"{desc}, {STYLE}"
        print(f"\nSubmitting {name}...")
        job_id = None
        while True:
            resp = submit(prompt)
            if resp and resp.get("job_id"):
                job_id = resp["job_id"]
                print(f"  job_id={job_id}, waiting...")
                break
            err = resp.get("error", "") if resp else ""
            if "concurrent" in err.lower() or "limit" in err.lower():
                print(f"  concurrency limit, waiting 60s...")
                time.sleep(60)
            else:
                print(f"  FAILED: {resp}")
                break
        if not job_id:
            continue
        while True:
            time.sleep(8)
            status = check_status(job_id)
            if not status:
                print(f"  [{name}] status check failed, retrying...")
                continue
            st = status.get("status")
            print(f"  [{name}] {st}")
            if st == "DONE":
                urls = status.get("result_url", [])
                if urls:
                    download(urls[0], out_path)
                    print(f"  downloaded -> {out_path}")
                break
            elif st == "FAIL":
                print(f"  FAILED: {status}")
                break
        # small delay between jobs to respect API limits
        time.sleep(3)

    print("\nAll done!")

