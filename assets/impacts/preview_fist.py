#!/usr/bin/env python3
# 模拟前端 mix-blend-mode:multiply + alpha 的合成，生成预览图供检查抠图质量
import numpy as np
from PIL import Image

fist = Image.open(r'c:/Users/Administrator/CodeBuddy/20260402085532/assets/impacts/fist_clean.png').convert('RGBA')
S = 420
# 角色卡肤色渐变背景（暖肤）
base = np.zeros((S, S, 3), dtype=np.float32)
for y in range(S):
    t = y / S
    for x in range(S):
        tt = (x / S) * 0.3 + t * 0.7
        base[y, x] = [205 - tt*40, 165 - tt*35, 130 - tt*30]

fb = np.array(fist.resize((S, S), Image.LANCZOS), dtype=np.float32) / 255.0
fr, fg, fb_ = fb[:,:,0], fb[:,:,1], fb[:,:,2]
fa = fb[:,:,3]
out = np.zeros((S, S, 3), dtype=np.float32)
# CSS multiply then alpha-composite over base
for c in range(3):
    base_c = base[:,:,c] / 255.0
    fist_c = fb[:,:,c]
    blended = base_c * fist_c
    out[:,:,c] = (base_c * (1 - fa) + blended * fa) * 255.0
# 拼左(原底)右(叠加)对照
left = (base).astype(np.uint8)
right = np.clip(out, 0, 255).astype(np.uint8)
pad = 24
canvas = np.zeros((S, S*2 + pad*3, 3), dtype=np.uint8) + 235
canvas[:, pad:pad+S] = left
canvas[:, S+pad*2:S*2+pad*2] = right
Image.fromarray(canvas).save(r'c:/Users/Administrator/CodeBuddy/20260402085532/assets/impacts/preview_fist.png')
print('preview saved')
