# -*- coding: utf-8 -*-
"""兵种立绘裁切管线（可复现）

输入：shared/img/art/units/<中文名>.png   （AI 生成的 2048x2048 全身水墨立绘，米白宣纸底）
输出：assets/battlefield/token_<key>.webp （256x256 头肩特写，供 30~46px 棋子/头像使用）

用法：
    python tools/process_unit_art.py              # 生成 9 张成品
    python tools/process_unit_art.py --sheet     # 额外输出一张 3x3 检查拼图

说明：
- 豆包这批原图无水印（右下角为空白或人物道具延伸），故不做抹水印；
  若以后批次带水印，请在 crop 之前对右下角做背景色填充，切勿无脑覆盖
  （攻城兵/陷阵死士的梯子与飘带会伸到右下角）。
- CROP 为逐张标定的归一化裁框 (cx, cy, size)：以 (cx,cy) 为中心、
  边长 size*短边 的正方形。全身像必须逐张定位头部，统一裁 0~55% 会切掉
  弓骑兵的马头、床弩手的弩机、辎重兵的车轮。
- 原图不入库（见 .gitignore），仅保留在本地供本脚本重跑。
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'shared', 'img', 'art', 'units')
DST = os.path.join(ROOT, 'assets', 'battlefield')
SHEET = os.path.join(ROOT, '_unit_art_sheet.png')

# 中文名 -> 兵种 key（与 shared/data/troops.js 的 LF.TROOPS 一致）
MAP = {
    '长枪兵': 'changqiang',
    '刀盾兵': 'daodun',
    '弓弩兵': 'gongnu',
    '骑兵': 'qibing',
    '攻城兵': 'gongcheng',
    '辎重兵': 'qizhong',
    '民夫': 'minfu',
    '大戟士': 'daji',
    '陷阵死士': 'xianzhen',
    '弓骑兵': 'gongqi',
    '床弩手': 'chuangnu',
    '火矢手': 'huoshi',
    # 兵种扩展（v20261111）
    '藤甲兵': 'tengjia',
    '象兵': 'xiangbing',
    '黄巾力士': 'huangjin_lishi',
    '黄巾军': 'huangjinjun',
    '中军': 'zhongjun',
}

# 归一化裁框，按 2048x2048 原图目视标定
CROP = {
    '长枪兵':   (0.50, 0.29, 0.58),
    '刀盾兵':   (0.52, 0.28, 0.58),
    '弓弩兵':   (0.52, 0.28, 0.58),
    '骑兵':     (0.45, 0.30, 0.64),
    '攻城兵':   (0.48, 0.30, 0.62),
    '辎重兵':   (0.45, 0.28, 0.60),
    '民夫':     (0.55, 0.28, 0.60),
    '大戟士':   (0.52, 0.30, 0.60),
    '陷阵死士': (0.40, 0.32, 0.62),
    '弓骑兵':   (0.40, 0.32, 0.68),
    '床弩手':   (0.50, 0.34, 0.62),
    '火矢手':   (0.52, 0.30, 0.60),
    # 兵种扩展（v20261111）：象兵裁象头主体，尺寸略大
    '藤甲兵':   (0.48, 0.28, 0.60),
    '象兵':     (0.50, 0.40, 0.78),
    '黄巾力士': (0.50, 0.28, 0.60),
    '黄巾军':   (0.46, 0.28, 0.60),
    '中军':     (0.33, 0.30, 0.66),
}

OUT_SIZE = 256
QUALITY = 82


def crop_box(w, h, cx, cy, size):
    side = size * min(w, h)
    x0 = cx * w - side / 2.0
    y0 = cy * h - side / 2.0
    # 越界时整体平移裁框，不缩放，保证 9 张成品视觉尺度一致
    x0 = max(0.0, min(x0, w - side))
    y0 = max(0.0, min(y0, h - side))
    return (int(round(x0)), int(round(y0)),
            int(round(x0 + side)), int(round(y0 + side)))


def main():
    make_sheet = '--sheet' in sys.argv
    thumbs = []
    for name, key in MAP.items():
        src = os.path.join(SRC, name + '.png')
        if not os.path.exists(src):
            print('[SKIP] 缺少原图 ' + src)
            continue
        im = Image.open(src).convert('RGB')
        w, h = im.size
        box = crop_box(w, h, *CROP[name])
        out = im.crop(box).resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
        dst = os.path.join(DST, 'token_%s.webp' % key)
        out.save(dst, 'WEBP', quality=QUALITY, method=6)
        print('%-6s -> token_%-12s crop=%s  %5.1fKB' %
              (name, key + '.webp', box, os.path.getsize(dst) / 1024.0))
        thumbs.append((name, out))

    if make_sheet and thumbs:
        cell = 272
        cols = 4
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new('RGB', (cell * cols, (cell + 30) * rows), (238, 232, 218))
        d = ImageDraw.Draw(sheet)
        try:
            font = ImageFont.truetype(r'C:\Windows\Fonts\msyh.ttc', 20)
        except Exception:
            font = ImageFont.load_default()
        for i, (name, im) in enumerate(thumbs):
            x, y = (i % cols) * cell, (i // cols) * (cell + 30)
            sheet.paste(im, (x + 8, y + 4))
            d.text((x + 10, y + cell + 2), name, fill=(40, 30, 20), font=font)
        sheet.save(SHEET)
        print('SHEET -> ' + SHEET)


if __name__ == '__main__':
    main()
