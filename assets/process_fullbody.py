"""
全身像自动分解脚本
处理AI生成的像素风职业角色全身像
- 裁剪每个角色
- 抠图去背景
- 提取各部位元素
"""

from PIL import Image
import os

# 目录配置
SOURCE_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/fullbody"
OUTPUT_DIR = r"c:/Users/Administrator/CodeBuddy/20260402085532/assets/sprites"
CLEAN_DIR = os.path.join(OUTPUT_DIR, "clean")  # 抠图后的角色
PARTS_DIR = os.path.join(OUTPUT_DIR, "parts")  # 分解的部位

os.makedirs(CLEAN_DIR, exist_ok=True)
os.makedirs(PARTS_DIR, exist_ok=True)

def remove_white_background(img, threshold=240):
    """去除白色背景，保留角色"""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # 获取数据
    datas = img.getdata()
    newData = []
    
    for item in datas:
        # 如果是接近白色的像素，变成透明
        if item[0] >= threshold and item[1] >= threshold and item[2] >= threshold:
            newData.append((255, 255, 255, 0))  # 透明
        else:
            newData.append(item)
    
    img.putdata(newData)
    return img

def crop_characters_from_grid(img, grid_size=4):
    """从格子布局中裁剪每个角色"""
    width, height = img.size
    tile_width = width // grid_size
    tile_height = height // grid_size
    
    characters = []
    for row in range(grid_size):
        for col in range(grid_size):
            left = col * tile_width
            top = row * tile_height
            right = left + tile_width
            bottom = top + tile_height
            
            char_img = img.crop((left, top, right, bottom))
            characters.append(char_img)
    
    return characters

def extract_parts(char_img):
    """从角色全身像中提取各部位"""
    width, height = char_img.size
    
    parts = {}
    
    # 头部：上半部分
    head_height = int(height * 0.35)
    parts['head'] = char_img.crop((0, 0, width, head_height))
    
    # 身体：中间部分
    body_top = int(height * 0.30)
    body_bottom = int(height * 0.65)
    parts['body'] = char_img.crop((0, body_top, width, body_bottom))
    
    # 腿部：下半部分
    leg_top = int(height * 0.60)
    parts['legs'] = char_img.crop((0, leg_top, width, height))
    
    # 头发：头部上方区域
    hair_height = int(height * 0.15)
    parts['hair'] = char_img.crop((0, 0, width, hair_height))
    
    # 脸部：头部中间区域
    face_top = int(height * 0.12)
    face_bottom = int(height * 0.28)
    parts['face'] = char_img.crop((0, face_top, width, face_bottom))
    
    # 眼睛：脸部中央
    eye_top = int(height * 0.18)
    eye_bottom = int(height * 0.24)
    parts['eyes'] = char_img.crop((0, eye_top, width, eye_bottom))
    
    # 服装
    cloth_top = int(height * 0.32)
    cloth_bottom = int(height * 0.62)
    parts['clothes'] = char_img.crop((0, cloth_top, width, cloth_bottom))
    
    return parts

def process_fullbody_images():
    """处理所有全身像"""
    files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.png')]
    print(f"Found {len(files)} fullbody images\n")
    
    total_chars = 0
    for i, filename in enumerate(files):
        filepath = os.path.join(SOURCE_DIR, filename)
        print(f"[{i+1}/{len(files)}] Processing: {filename}")
        
        img = Image.open(filepath)
        print(f"  Size: {img.size}")
        
        # 裁剪每个角色
        characters = crop_characters_from_grid(img)
        
        for j, char_img in enumerate(characters):
            total_chars += 1
            char_num = i * len(characters) + j + 1
            
            # 1. 保存原尺寸角色图
            char_name = f"char_{char_num:02d}"
            char_img.save(os.path.join(CLEAN_DIR, f"{char_name}_raw.png"))
            
            # 2. 抠图去背景
            char_clean = remove_white_background(char_img.copy())
            char_clean.save(os.path.join(CLEAN_DIR, f"{char_name}_clean.png"))
            
            # 3. 缩放到64x64用于游戏
            char_small = char_img.resize((64, 64), Image.Resampling.LANCZOS)
            char_small.save(os.path.join(CLEAN_DIR, f"{char_name}_64.png"))
            
            # 4. 抠图并缩放
            char_clean_small = char_clean.resize((64, 64), Image.Resampling.LANCZOS)
            char_clean_small.save(os.path.join(CLEAN_DIR, f"{char_name}_clean_64.png"))
            
            # 5. 提取各部位
            parts = extract_parts(char_img)
            for part_name, part_img in parts.items():
                part_dir = os.path.join(PARTS_DIR, part_name)
                os.makedirs(part_dir, exist_ok=True)
                part_img.save(os.path.join(part_dir, f"{char_name}_{part_name}.png"))
            
            print(f"  Character {char_num}: Done")
    
    print(f"\n[OK] Processing complete! Total: {total_chars} characters")
    print(f"   Characters: {CLEAN_DIR}/")
    print(f"   Parts: {PARTS_DIR}/")

if __name__ == "__main__":
    process_fullbody_images()
