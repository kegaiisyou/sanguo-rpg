#!/usr/bin/env python3
# 处理拳印素材：去白底 + 去右下角水印 + 压缩 + 轻微增强血色
import cv2, numpy as np
from PIL import Image

SRC = r'c:/Users/Administrator/CodeBuddy/20260402085532/assets/impacts/fist.png'
OUT = r'c:/Users/Administrator/CodeBuddy/20260402085532/assets/impacts/fist_clean.png'

img = cv2.imread(SRC, cv2.IMREAD_COLOR)  # BGR
h, w = img.shape[:2]

# 1) 去白底：纯白/近白区域 -> 透明
#    用亮度高且饱和度低判定为白底
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
white_mask = (gray > 242).astype(np.uint8) * 255

# 2) 右下角水印去除：在该 ROI 内，凡比纯白略暗的（文字/残影）做 inpaint 还原成白底
roi_x0, roi_y0 = int(w*0.62), int(h*0.86)
roi = img[roi_y0:h, roi_x0:w]
roi_gray = gray[roi_y0:h, roi_x0:w]
wm_mask = (roi_gray < 250).astype(np.uint8) * 255  # 水印文字比白底暗
# 膨胀一点点，保证文字边缘被覆盖
wm_mask = cv2.dilate(wm_mask, np.ones((3,3), np.uint8), iterations=2)
roi_inpaint = cv2.inpaint(roi, wm_mask, 3, cv2.INPAINT_TELEA)
img[roi_y0:h, roi_x0:w] = roi_inpaint
# 重算白底（修复后该区域应是纯白）
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
white_mask = (gray > 242).astype(np.uint8) * 255

# 3) 轻微增强血色：淤青本为红紫，提升红、压一点绿蓝，让它更"皮下淤血"
b, g, r = cv2.split(img.astype(np.float32))
r = np.clip(r * 1.06, 0, 255)
g = np.clip(g * 0.97, 0, 255)
b = np.clip(b * 0.97, 0, 255)
img = cv2.merge([b, g, r]).astype(np.uint8)

# 4) 合成 alpha：白底透明，并对边缘做抗锯齿（alpha 模糊）
alpha = (255 - white_mask).astype(np.uint8)
# 给非透明的淤青区一点基础不透明，避免太淡
alpha = cv2.GaussianBlur(alpha, (3,3), 0)
# 阈值化保证实心区完全不透明，只在边缘渐变
_, alpha = cv2.threshold(alpha, 235, 255, cv2.THRESH_BINARY)

b, g, r = cv2.split(img)
rgba = cv2.merge([r, g, b, alpha])  # PIL 用 RGBA

# 5) 压缩尺寸到 1024 最长边（网页用，省体积）
pil = Image.fromarray(rgba, 'RGBA')
scale = 1024 / max(pil.size)
if scale < 1:
    pil = pil.resize((int(pil.size[0]*scale), int(pil.size[1]*scale)), Image.LANCZOS)
pil.save(OUT, 'PNG', optimize=True)
print('saved', OUT, 'size', pil.size, 'bytes', __import__('os').path.getsize(OUT))
