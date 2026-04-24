"""
单人物全身像处理脚本
直接缩放为游戏尺寸，不分解部位
"""

from PIL import Image
import os

# 目录配置
SOURCE_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/fullbody"
OUTPUT_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/characters"

# 创建输出目录
os.makedirs(OUTPUT_DIR, exist_ok=True)

def process_character(img_path, index):
    """处理单个角色全身像"""
    filename = os.path.basename(img_path)
    name = f"char_{index:02d}"
    print(f"[{index}] {filename}")
    
    # 加载原图
    img = Image.open(img_path)
    
    # 保存原图
    img.save(os.path.join(OUTPUT_DIR, f"{name}_orig.png"))
    
    # 缩放为64x64
    img_64 = img.resize((64, 64), Image.Resampling.LANCZOS)
    img_64.save(os.path.join(OUTPUT_DIR, f"{name}_64.png"))
    
    # 缩放为128x128
    img_128 = img.resize((128, 128), Image.Resampling.LANCZOS)
    img_128.save(os.path.join(OUTPUT_DIR, f"{name}_128.png"))
    
    # 缩放为32x32
    img_32 = img.resize((32, 32), Image.Resampling.LANCZOS)
    img_32.save(os.path.join(OUTPUT_DIR, f"{name}_32.png"))
    
    print(f"    -> {name}_64.png, {name}_128.png, {name}_32.png")
    return name

def main():
    files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.png')]
    print(f"Found {len(files)} character images\n")
    
    for i, filename in enumerate(files):
        filepath = os.path.join(SOURCE_DIR, filename)
        process_character(filepath, i + 1)
    
    print(f"\n[DONE] Processed {len(files)} characters")
    print(f"Output: {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()