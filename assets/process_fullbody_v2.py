"""
全身像智能分解脚本 v2
每张图片 = 1个完整角色
- 智能抠图去背景
- 根据角色轮廓分解部位
"""

from PIL import Image
import os
import numpy as np

# 目录配置
SOURCE_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/fullbody"
OUTPUT_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/sprites"
CLEAN_DIR = os.path.join(OUTPUT_DIR, "clean")
PARTS_DIR = os.path.join(OUTPUT_DIR, "parts")

# 清理旧文件
import shutil
if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(CLEAN_DIR, exist_ok=True)
os.makedirs(PARTS_DIR, exist_ok=True)

def remove_background(img, bg_threshold=240):
    """去除白色/浅色背景"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    data = np.array(img)
    # 找到接近白色的像素
    white_mask = (data[:,:,0] >= bg_threshold) & \
                 (data[:,:,1] >= bg_threshold) & \
                 (data[:,:,2] >= bg_threshold)
    # 设为透明
    data[white_mask] = [255, 255, 255, 0]
    
    return Image.fromarray(data)

def find_content_bounds(img):
    """找到角色内容的边界框"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    data = np.array(img)
    alpha = data[:,:,3]
    
    # 找到非透明像素的行列
    rows = np.any(alpha > 0, axis=1)
    cols = np.any(alpha > 0, axis=0)
    
    if not np.any(rows) or not np.any(cols):
        return None
    
    top = np.argmax(rows)
    bottom = len(rows) - np.argmax(rows[::-1])
    left = np.argmax(cols)
    right = len(cols) - np.argmax(cols[::-1])
    
    return (left, top, right, bottom)

def extract_parts_smart(char_img, char_name):
    """智能提取角色各部位 - 基于实际角色比例"""
    width, height = char_img.size
    
    parts = {}
    
    # 头部区域 (顶部30% - 包含完整头部和发型)
    head_top = 0
    head_bottom = int(height * 0.30)
    parts['head'] = char_img.crop((0, head_top, width, head_bottom))
    
    # 脸部区域 (头部中间偏下，包含完整五官)
    face_top = int(height * 0.08)
    face_bottom = int(height * 0.28)
    parts['face'] = char_img.crop((0, face_top, width, face_bottom))
    
    # 眼睛区域 (脸部中央)
    eyes_top = int(height * 0.14)
    eyes_bottom = int(height * 0.22)
    parts['eyes'] = char_img.crop((0, eyes_top, width, eyes_bottom))
    
    # 头发/头饰 (头部上方)
    hair_top = 0
    hair_bottom = int(height * 0.14)
    parts['hair'] = char_img.crop((0, hair_top, width, hair_bottom))
    
    # 身体/躯干 (30%-70%)
    body_top = int(height * 0.28)
    body_bottom = int(height * 0.70)
    parts['body'] = char_img.crop((0, body_top, width, body_bottom))
    
    # 服装 (躯干部分)
    clothes_top = int(height * 0.30)
    clothes_bottom = int(height * 0.68)
    parts['clothes'] = char_img.crop((0, clothes_top, width, clothes_bottom))
    
    # 腿部 (65%-100%)
    legs_top = int(height * 0.65)
    legs_bottom = height
    parts['legs'] = char_img.crop((0, legs_top, width, legs_bottom))
    
    # 手臂/武器区域
    arms_top = int(height * 0.32)
    arms_bottom = int(height * 0.60)
    parts['arms'] = char_img.crop((0, arms_top, width, arms_bottom))
    
    return parts

def process_single_character(img_path, char_index):
    """处理单个角色全身像"""
    filename = os.path.basename(img_path)
    print(f"  Processing: {filename}")
    
    # 1. 加载原图
    img = Image.open(img_path)
    print(f"    Original size: {img.size}")
    
    # 2. 抠图去背景
    img_clean = remove_background(img)
    
    # 3. 找到内容边界并裁剪
    bounds = find_content_bounds(img_clean)
    if bounds:
        left, top, right, bottom = bounds
        # 添加一点边距
        margin = 20
        left = max(0, left - margin)
        top = max(0, top - margin)
        right = min(img.width, right + margin)
        bottom = min(img.height, bottom + margin)
        
        img_clean = img_clean.crop((left, top, right, bottom))
        print(f"    Cropped to: {img_clean.size}")
    
    # 4. 保存处理后的角色图
    char_name = f"char_{char_index:02d}"
    
    # 原尺寸透明背景
    img_clean.save(os.path.join(CLEAN_DIR, f"{char_name}_clean.png"))
    
    # 64x64 游戏尺寸
    img_64 = img_clean.resize((64, 64), Image.Resampling.LANCZOS)
    img_64.save(os.path.join(CLEAN_DIR, f"{char_name}_64.png"))
    
    # 128x128 高清尺寸
    img_128 = img_clean.resize((128, 128), Image.Resampling.LANCZOS)
    img_128.save(os.path.join(CLEAN_DIR, f"{char_name}_128.png"))
    
    # 5. 提取各部位
    parts = extract_parts_smart(img_clean, char_name)
    for part_name, part_img in parts.items():
        part_dir = os.path.join(PARTS_DIR, part_name)
        os.makedirs(part_dir, exist_ok=True)
        
        # 保存原尺寸部位
        part_img.save(os.path.join(part_dir, f"{char_name}_{part_name}.png"))
        
        # 保存缩放后的部位 (用于游戏)
        if part_name in ['head', 'face']:
            part_small = part_img.resize((32, 32), Image.Resampling.LANCZOS)
        elif part_name in ['body', 'clothes']:
            part_small = part_img.resize((32, 48), Image.Resampling.LANCZOS)
        else:
            part_small = part_img.resize((32, 32), Image.Resampling.LANCZOS)
        
        part_small.save(os.path.join(part_dir, f"{char_name}_{part_name}_32.png"))
    
    print(f"    [OK] {char_name} processed")
    return char_name

def main():
    """主函数"""
    files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.png')]
    print(f"Found {len(files)} character images\n")
    
    for i, filename in enumerate(files):
        filepath = os.path.join(SOURCE_DIR, filename)
        print(f"[{i+1}/{len(files)}]")
        process_single_character(filepath, i + 1)
        print()
    
    print(f"[DONE] Processed {len(files)} characters")
    print(f"  Output: {OUTPUT_DIR}/")
    print(f"    - clean/: Full character images")
    print(f"    - parts/: Decomposed body parts")

if __name__ == "__main__":
    main()
