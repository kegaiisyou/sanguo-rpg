"""
三国像素风角色立绘 v2 - 逐像素手绘模板
48×72 身体画布，圆形头部，大眼睛，三角袍摆，4x 放大输出
"""

from PIL import Image, ImageDraw
import os, math

CANVAS_W = 48
CANVAS_H = 72
SCALE = 4
OUT_DIR = "assets/pixel_chars"
os.makedirs(OUT_DIR, exist_ok=True)

# ─── 调色板 ─────────────────────────────────────────
# 通用
TRANSP = (0, 0, 0, 0)
BLACK  = (15, 12, 18, 255)
DKGRY  = (55, 50, 55, 255)
WHITE  = (250, 248, 242, 255)
GRAY   = (180, 175, 178, 255)

# 肤色
SKIN   = (242, 198, 155, 255)
SKIN_L = (252, 218, 180, 255)
SKIN_D = (200, 155, 115, 255)
SKIN_S = (170, 125, 90, 255)  # shadow

# 金属
SILVER = (195, 198, 205, 255)
GOLD   = (235, 190, 50, 255)
DGOLD  = (180, 140, 30, 255)
COPPER = (210, 140, 60, 255)

# 布料常用
RED    = (195, 40, 35, 255)
DRED   = (140, 22, 18, 255)
LRED   = (235, 80, 70, 255)
BLUE   = (50, 95, 195, 255)
DBLUE  = (30, 60, 140, 255)
LBLUE  = (90, 140, 235, 255)
GREEN  = (60, 155, 60, 255)
DGREEN = (35, 110, 35, 255)
LGREEN = (100, 195, 100, 255)
PURPLE = (135, 45, 175, 255)
DPURPLE= (90, 25, 130, 255)
LPURPLE= (175, 85, 215, 255)
BROWN  = (130, 85, 45, 255)
DBROWN = (85, 50, 25, 255)
LBROWN = (180, 130, 80, 255)
YELLOW = (230, 185, 30, 255)
DYELLOW= (185, 140, 18, 255)
TEAL   = (50, 150, 150, 255)
DTEAL  = (25, 110, 110, 255)
LTAN   = (220, 200, 165, 255)
DTAN   = (175, 150, 110, 255)
IVORY  = (245, 240, 225, 255)
DKIVORY= (210, 200, 180, 255)

# ─── 像素画布工具 ───────────────────────────────────
def make_canvas():
    return Image.new("RGBA", (CANVAS_W, CANVAS_H), TRANSP)

# ─── 通用身体模板 ───
def body_base(draw, skin=SKIN, skin_l=SKIN_L, skin_d=SKIN_D):
    """绘制基础人体比例：圆头 + 梯形身体 + 腿 + 手臂位置"""
    from itertools import product
    SC=skin; SL=skin_l; SD=skin_d; SS=SKIN_S; K=BLACK; W=WHITE

    # ==== 头部：圆形 17×18（在 15-32 x 2-20 区域）====
    # 用椭圆近似圆头
    head_cx, head_cy = 23.5, 10
    for x in range(CANVAS_W):
        for y in range(CANVAS_H):
            # 椭圆距离
            rx, ry = 8.5, 9
            d = ((x - head_cx) / rx)**2 + ((y - head_cy) / ry)**2
            if d <= 1.0:
                color = SC
                # 脸部高光：左上方
                if x >= 17 and x <= 23 and y >= 4 and y <= 10:
                    color = SL
                # 脸部阴影：右下方
                if x >= 26 and x <= 30 and y >= 14 and y <= 18:
                    color = SS
                draw.point((x, y), fill=color)

    # ==== 眼睛（大！4×2 白底+瞳孔）====
    # 左眼 (18-21, 8-9)
    for x in range(18, 22):
        for y in range(8, 10):
            draw.point((x, y), fill=W)
    # 左瞳孔
    draw.point((19, 8), fill=K)
    draw.point((20, 8), fill=K)
    draw.point((20, 9), fill=K)

    # 右眼 (27-30, 8-9)
    for x in range(27, 31):
        for y in range(8, 10):
            draw.point((x, y), fill=W)
    # 右瞳孔
    draw.point((28, 8), fill=K)
    draw.point((29, 8), fill=K)
    draw.point((28, 9), fill=K)

    # ==== 眉毛 ====
    for x in range(17, 22): draw.point((x, 6), fill=K)
    for x in range(16, 21): draw.point((x, 5), fill=DKGRY)
    for x in range(26, 31): draw.point((x, 6), fill=K)
    for x in range(27, 32): draw.point((x, 5), fill=DKGRY)

    # ==== 鼻子 ====
    draw.point((23, 11), fill=SS)
    draw.point((24, 12), fill=SS)

    # ==== 嘴 ====
    for x in range(21, 28): draw.point((x, 15), fill=(160, 90, 60, 255))
    draw.point((24, 14), fill=(170, 100, 70, 255))

    # ==== 脖子 ====
    for x in range(20, 28):
        for y in range(19, 22):
            draw.point((x, y), fill=SD)

    # ==== 身体（梯形）====
    # 肩膀
    for x in range(14, 34):
        for y in range(22, 28):
            draw.point((x, y), fill=SC)
    # 躯干
    for y in range(28, 46):
        w = 10 + (46 - y) // 2  # 下摆逐渐加宽
        l = 24 - w
        r = 24 + w
        for x in range(max(15, l), min(34, r)):
            draw.point((x, y), fill=SC)

    # ==== 腿 ====
    for y in range(46, 62):
        # 左腿
        for x in range(18, 25):
            draw.point((x, y), fill=SD)
        # 右腿
        for x in range(25, 32):
            draw.point((x, y), fill=SD)
    # 脚/鞋
    for x in range(16, 26):
        for y in range(62, 68):
            draw.point((x, y), fill=DBROWN)
    for x in range(24, 34):
        for y in range(62, 68):
            draw.point((x, y), fill=DBROWN)

    return draw


# ────────── 11 个角色定义 ──────────

def make_hero():
    """少侠：蓝衣剑客，束发，佩剑"""
    img = make_canvas()
    d = ImageDraw.Draw(img)
    body_base(d)

    B=BLUE; Bd=DBLUE; Bl=LBLUE; W=WHITE; G=GOLD; Gd=DGOLD; S=SILVER; K=BLACK

    # ── 头发 ──
    for x in range(14, 34):
        for y in range(2, 6):
            d.point((x, y), fill=K)
    for x in range(13, 35):
        d.point((x, 2), fill=K)
    for x in range(12, 36):
        d.point((x, 3), fill=K)
    # 两侧
    for y in range(4, 10):
        for x in range(13, 16): d.point((x, y), fill=K)
        for x in range(32, 35): d.point((x, y), fill=K)
    # 发髻
    for x in range(20, 28):
        for y in range(0, 3): d.point((x, y),fill=K)
    # 冠
    for x in range(21, 27):
        d.point((x, 0), fill=G)
    d.point((22, -1), fill=Gd); d.point((24,-1),fill=Gd)

    # ── 衣领 ──
    for x in range(20, 28): d.point((x, 23), fill=Bd)

    # ── 蓝袍 ──
    for y in range(25, 45):
        w = 9 + (45 - y) // 2
        l = 24 - w; r = 24 + w
        for x in range(max(14, l), min(35, r)):
            if y < 30:
                d.point((x, y), fill=Bl if (x+y)%2==0 else B)
            else:
                d.point((x, y), fill=B)
    # 高光中线
    for y in range(26, 36):
        d.point((24, y), fill=Bl)

    # ── 腰带 ──
    for y in range(40, 44):
        for x in range(16, 33):
            d.point((x, y), fill=G)
        d.point((15, y), fill=Gd)
        d.point((33, y), fill=Gd)

    # ── 袍下摆 ──
    for x in range(12, 36):
        for y in range(45, 48):
            d.point((x, y), fill=B)

    # ── 右臂（持剑）──
    for y in range(25, 42):
        for x in range(32, 38):
            d.point((x, y), fill=B)
        for x in range(38, 41):
            d.point((x, y), fill=Bl)
    # 右手
    for x in range(35, 42):
        for y in range(39, 45):
            d.point((x, y), fill=SKIN)

    # ── 剑 ──
    for y in range(22, 58):
        d.point((40, y), fill=S)
        d.point((41, y), fill=S)
    # 剑尖
    d.point((40, 19), fill=S); d.point((41, 19), fill=W)
    d.point((40, 20), fill=W); d.point((41, 20), fill=S)
    # 剑格
    for x in range(38, 43):
        d.point((x, 42), fill=G)
    # 剑柄
    for y in range(43, 48):
        for x in range(39, 42):
            d.point((x, y), fill=Gd)

    # ── 左臂 ──
    for y in range(24, 43):
        for x in range(8, 14):
            d.point((x, y), fill=B)
    for x in range(8, 16):
        for y in range(40, 45):
            d.point((x, y), fill=SKIN)

    # ── 腿裤 ──
    for y in range(48, 62):
        for x in range(18, 25):
            d.point((x, y), fill=W)
        for x in range(25, 32):
            d.point((x, y), fill=W)
    # 布料褶皱
    for y in range(50, 56):
        if y%3==0:
            d.point((21, y), fill=(210,210,215,255))
            d.point((29, y), fill=(210,210,215,255))

    return img


def make_storyteller():
    """说书人：斗笠、褐袍、白须、折扇"""
    img = make_canvas()
    d = ImageDraw.Draw(img)
    body_base(d)

    B=BROWN; Bd=DBROWN; Bl=LBROWN; W=WHITE; K=BLACK; G=GRAY

    # ── 白胡子（覆盖脸下半部）──
    for x in range(17, 32):
        for y in range(13, 20):
            d.point((x, y), fill=W)
    # 须尖
    for x in range(15, 18):
        for y in range(15, 19):
            d.point((x, y), fill=W)
    for x in range(31, 34):
        for y in range(15, 19):
            d.point((x, y), fill=W)
    # 重画眼睛（在胡子上）
    for x in range(18, 22):
        for y in range(8, 10):
            d.point((x, y), fill=W)
    d.point((19, 8), fill=K); d.point((20, 8), fill=K); d.point((20, 9), fill=K)
    for x in range(27, 31):
        for y in range(8, 10):
            d.point((x, y), fill=W)
    d.point((28, 8), fill=K); d.point((29, 8), fill=K); d.point((28, 9), fill=K)

    # ── 斗笠 ──
    for row in range(9):
        y = 0 + row
        hw = 5 + row * 2
        for x in range(24 - hw, 25 + hw):
            if y >= 0:
                d.point((x, y), fill=Bl)
    # 斗笠暗边
    for row in range(7):
        y = 1 + row
        for x in range(24-row*2-5, 24-row*2-2):
            if x >= 0: d.point((x, y), fill=Bd)
        for x in range(24+row*2+2, 24+row*2+5):
            if x < 48: d.point((x, y), fill=Bd)
    # 斗笠纹理
    for y in range(3, 7):
        for x in range(22, 27):
            if (x+y)%2==0:
                d.point((x, y), fill=Bd)
    # 斗笠尖顶
    d.point((24, -1), fill=Bd)
    d.point((23, 0), fill=Bd); d.point((25, 0), fill=Bd)

    # ── 褐袍 ──
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        l = 24 - w; r = 24 + w
        for x in range(max(14, l), min(35, r)):
            c = B if (x+y)%3!=0 else Bd
            d.point((x, y), fill=c)
    # 交领
    for i in range(6):
        for x in range(21 - i, 27 + i, 2):
            d.point((x, 26 + i), fill=Bd)

    # ── 腰带 ──
    for y in range(40, 43):
        for x in range(16, 33):
            d.point((x, y), fill=Bd)

    # ── 左臂 ──
    for y in range(26, 44):
        for x in range(7, 14):
            d.point((x, y), fill=B)
    for x in range(8, 16):
        for y in range(41, 46):
            d.point((x, y), fill=SKIN)

    # ── 折扇 ──
    for x in range(0, 5):
        for y in range(38, 44):
            d.point((x, y), fill=(220, 210, 180, 255))
    # 扇骨
    for x in range(1, 4, 2):
        for y in range(38, 44):
            d.point((x, y), fill=BROWN)

    # ── 右臂 ──
    for y in range(26, 44):
        for x in range(34, 41):
            d.point((x, y), fill=B)
    for x in range(34, 42):
        for y in range(41, 46):
            d.point((x, y), fill=SKIN)

    # ── 腿 ──
    for y in range(46, 62):
        for x in range(18, 25):
            d.point((x, y), fill=Bd)
        for x in range(25, 32):
            d.point((x, y), fill=Bd)

    return img


def make_hanbo():
    """韩伯：灰袍、白发、拐杖"""
    img, d = make_canvas(), ImageDraw.Draw(make_canvas())
    img = make_canvas(); d = ImageDraw.Draw(img)
    body_base(d)

    B=GRAY; Bd=DKGRY; Bl=(200,195,190,255); W=WHITE; K=BLACK

    # 白发
    for x in range(15, 34):
        for y in range(2, 7): d.point((x, y), fill=W)
    for y in range(4, 11):
        for x in range(13, 16): d.point((x, y), fill=W)
        for x in range(32, 35): d.point((x, y), fill=W)
    # 白眉
    for x in range(16, 23): d.point((x, 5), fill=W)
    for x in range(26, 33): d.point((x, 5), fill=W)
    # 白胡
    for x in range(19, 30):
        for y in range(13, 20): d.point((x, y), fill=W)
    for x in range(17, 20):
        for y in range(15, 19): d.point((x, y), fill=W)
    for x in range(29, 32):
        for y in range(15, 19): d.point((x, y), fill=W)
    # 重绘眼睛
    for x in range(18, 22):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((20, 8), fill=K); d.point((20, 9), fill=K)
    for x in range(27, 31):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((28, 8), fill=K); d.point((28, 9), fill=K)

    # 灰袍
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            d.point((x, y), fill=B if (x+y)%3!=0 else Bd)

    # 腰带
    for y in range(40, 43):
        for x in range(16, 33): d.point((x, y), fill=BROWN)

    # 手臂
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=B)
        for x in range(34, 41): d.point((x, y), fill=B)
    for x in range(8, 16):
        for y in range(41, 46): d.point((x, y), fill=SKIN)
    for x in range(34, 42):
        for y in range(41, 46): d.point((x, y), fill=SKIN)

    # 拐杖
    for y in range(38, 68):
        d.point((1, y), fill=BROWN); d.point((2, y), fill=DBROWN)
    for x in range(0, 5):
        for y in range(36, 39):
            d.point((x, y), fill=BROWN)

    return img


def make_hualao():
    """华老：绿袍、白发、拄杖"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(240,210,175,255), skin_l=(250,225,195,255), skin_d=(200,170,135,255))

    B=GREEN; Bd=DGREEN; Bl=LGREEN; W=WHITE; K=BLACK; G=GOLD

    # 白发髻
    for x in range(16, 33):
        for y in range(1, 6): d.point((x, y), fill=W)
    for y in range(3, 10):
        for x in range(14, 17): d.point((x, y), fill=W)
        for x in range(31, 34): d.point((x, y), fill=W)
    # 白须
    for x in range(19, 30):
        for y in range(13, 20): d.point((x, y), fill=W)
    for x in range(17, 20):
        for y in range(15, 19): d.point((x, y), fill=W)
    for x in range(29, 32):
        for y in range(15, 19): d.point((x, y), fill=W)
    # 眼
    for x in range(18, 22):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((20, 8), fill=K); d.point((20, 9), fill=K)
    for x in range(27, 31):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((28, 8), fill=K); d.point((28, 9), fill=K)

    # 绿袍
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            c = Bl if (x+y)%3==0 else (B if (x+y)%4!=1 else Bd)
            d.point((x, y), fill=c)
    d.point((24, 27), fill=Bl)

    # 金边
    for x in range(16, 33):
        d.point((x, 39), fill=G)
    for x in range(15, 34):
        d.point((x, 40), fill=DGOLD)

    # 手臂+杖
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=B)
        for x in range(34, 41): d.point((x, y), fill=B)
    for y in range(40, 68):
        d.point((1, y), fill=BROWN); d.point((2, y), fill=DBROWN)

    return img


def make_zuoci():
    """左慈：紫袍、方士冠、拂尘、八卦"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(245,215,175,255), skin_l=(252,228,195,255), skin_d=(205,175,135,255))

    B=PURPLE; Bd=DPURPLE; Bl=LPURPLE; W=WHITE; K=BLACK; G=GOLD

    # 白发
    for x in range(16, 33):
        for y in range(1, 5): d.point((x, y), fill=W)
    for y in range(2, 9):
        for x in range(14, 17): d.point((x, y), fill=W)
        for x in range(31, 34): d.point((x, y), fill=W)
    # 方士冠
    for x in range(19, 29):
        d.point((x, 0), fill=Bd); d.point((x, 1), fill=Bd)
    d.point((20, -1), fill=G); d.point((24, -1), fill=G); d.point((27, -1), fill=G)
    # 白眉长扬
    for x in range(15, 20): d.point((x, 5), fill=W)
    for x in range(28, 33): d.point((x, 5), fill=W)
    # 山羊胡
    for y in range(13, 18):
        for x in range(22, 27): d.point((x, y), fill=W)
    d.point((23, 18), fill=W); d.point((25, 18), fill=W)
    # 眼
    for x in range(18, 22):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((20, 8), fill=K)
    for x in range(27, 31):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((29, 8), fill=K)

    # 紫袍
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            c = Bl if (x+y)%5==0 else (B if (x+y)%3!=1 else Bd)
            d.point((x, y), fill=c)
    # 八卦盘
    for x in range(22, 27):
        for y in range(34, 38):
            d.point((x, y), fill=G)
    d.point((24, 35), fill=DGOLD); d.point((24, 36), fill=DGOLD)
    d.point((25, 36), fill=Bl)

    # 腰带
    for y in range(40, 43):
        for x in range(16, 33):
            d.point((x, y), fill=DGOLD)

    # 手臂
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=B)
        for x in range(34, 41): d.point((x, y), fill=B)
    # 拂尘
    for y in range(38, 52):
        d.point((0, y), fill=SILVER); d.point((1, y), fill=SILVER)
    for x in range(0, 3):
        d.point((x, 36), fill=G)
    # 拂尾
    for row in range(16):
        y = 52 + row; hw = min(6, 1 + row // 2)
        for x in range(1 - hw, 2 + hw):
            c = W if row % 2 == 0 else (220, 215, 210, 255)
            d.point((x, y), fill=c)

    return img


def make_shuijing():
    """水镜：白衣、纶巾、书卷"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(248,220,180,255), skin_l=(252,232,200,255), skin_d=(210,175,135,255))

    B=IVORY; Bd=DKIVORY; Bl=WHITE; W=WHITE; K=BLACK; H=TEAL; Hd=DTEAL

    # 纶巾
    for x in range(16, 33):
        for y in range(2, 7): d.point((x, y), fill=B)
    for y in range(3, 12):
        for x in range(13, 16): d.point((x, y), fill=Bd)
        for x in range(32, 35): d.point((x, y), fill=Bd)
    # 纶巾带
    for x in range(18, 31):
        d.point((x, 4), fill=H)
    d.point((17, 5), fill=H); d.point((31, 5), fill=H)
    # 白发梢
    for y in range(8, 12):
        for x in range(14, 17): d.point((x, y), fill=W)
        for x in range(31, 34): d.point((x, y), fill=W)
    # 白须
    for x in range(21, 28):
        for y in range(13, 18): d.point((x, y), fill=W)
    d.point((22, 17), fill=(230,228,224,255))
    # 眼
    for x in range(18, 22):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((20, 8), fill=K)
    for x in range(27, 31):
        for y in range(8, 10): d.point((x, y), fill=W)
    d.point((28, 8), fill=K)

    # 白衣
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            c = Bl if (x+y)%5 in (0,3) else B
            d.point((x, y), fill=c)

    # 腰带
    for y in range(39, 42):
        for x in range(16, 33):
            d.point((x, y), fill=H)

    # 手臂
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=B)
        for x in range(34, 41): d.point((x, y), fill=B)
    # 书卷
    for x in range(36, 46):
        for y in range(30, 36):
            d.point((x, y), fill=(235, 228, 210, 255))
    for y in range(30, 36):
        d.point((36, y), fill=BROWN); d.point((45, y), fill=BROWN)

    return img


def make_captain():
    """校尉：赤甲、头盔红缨、长枪"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d)

    R=RED; Rd=DRED; Rl=LRED; G=GOLD; Gd=DGOLD; S=SILVER; K=BLACK; W=WHITE; SK=SKIN

    # 头盔（覆盖头部上部分）
    for y in range(2, 12):
        w = 8 + (y <= 6) * 1
        for x in range(24 - w, 25 + w):
            d.point((x, y), fill=S)
    # 盔护耳
    for y in range(5, 12):
        for x in range(13, 16): d.point((x, y), fill=S)
        for x in range(32, 35): d.point((x, y), fill=S)
    # 红缨
    for row in range(12):
        y = -4 + row; hw = max(1, 10 - row)
        for x in range(24 - hw // 2, 25 + hw // 2):
            d.point((x, y), fill=Rd)
    d.point((24, -8), fill=R); d.point((24, -7), fill=R); d.point((25, -7), fill=R)
    # 黄金饰带
    for x in range(18, 31):
        d.point((x, 4), fill=G)
        d.point((x, 6), fill=Gd)
    # 眉毛（浓）
    for x in range(16, 23): d.point((x, 7), fill=K)
    for x in range(26, 33): d.point((x, 7), fill=K)
    # 嘴（坚毅）
    for x in range(21, 28):
        d.point((x, 15), fill=(140, 70, 45, 255))
    d.point((24, 14), fill=K)

    # 赤甲
    for y in range(26, 47):
        w = 10 + (47 - y) // 2
        for x in range(max(14, 24 - w), min(36, 24 + w)):
            c = R if (x+y)%3!=1 else Rd
            d.point((x, y), fill=c)
    # 护心镜
    for x in range(20, 29):
        for y in range(28, 35):
            d.point((x, y), fill=G if (x+y)%2==0 else Gd)
    # 甲片
    for r in range(4):
        y = 37 + r * 3; x0 = 18 - r
        for c in range(6 + r):
            for dx in range(2):
                d.point((x0 + c * 3 + dx, y), fill=Rd)

    # 腰带
    for y in range(43, 46):
        for x in range(16, 34):
            d.point((x, y), fill=DGOLD)

    # 战裙
    for x in range(14, 36):
        for y in range(47, 52):
            d.point((x, y), fill=Rd)

    # 手臂（带护腕）
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=R)
        for x in range(35, 42): d.point((x, y), fill=R)
    for x in range(7, 14):
        d.point((x, 44), fill=G); d.point((x, 45), fill=G)
    for x in range(35, 42):
        d.point((x, 44), fill=G); d.point((x, 45), fill=G)
    # 手
    for x in range(8, 16):
        for y in range(46, 50): d.point((x, y), fill=SK)
    for x in range(36, 44):
        for y in range(46, 50): d.point((x, y), fill=SK)

    # 长枪
    for y in range(20, 62):
        d.point((0, y), fill=BROWN)
        d.point((1, y), fill=DBROWN)
    # 枪缨
    for x in range(0, 5):
        for y in range(58, 63):
            d.point((x, y), fill=R)
    # 枪尖
    d.point((0, 16), fill=S); d.point((1, 16), fill=S)
    d.point((0, 17), fill=W); d.point((1, 17), fill=S)
    d.point((1, 15), fill=S)

    # 腿甲
    for y in range(52, 62):
        for x in range(18, 25):
            d.point((x, y), fill=Rd)
        for x in range(25, 32):
            d.point((x, y), fill=Rd)

    return img


def make_yellow_turban():
    """黄巾贼：黄巾包头、粗布衣、短刀"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(225,185,145,255), skin_l=(235,200,165,255), skin_d=(185,145,110,255))

    Y=YELLOW; Yd=DYELLOW; B=DBROWN; Bd=(60,35,18,255); K=BLACK; S=SILVER; W=WHITE

    # 黄巾
    for y in range(1, 11):
        w = 9 + (y <= 6) * 1
        for x in range(24 - w, 25 + w):
            d.point((x, y), fill=Y if (x+y)%3!=1 else Yd)
    # 巾结
    d.point((22, 0), fill=Yd); d.point((24, 0), fill=Y)
    d.point((26, 0), fill=Yd); d.point((28, 0), fill=Y)
    d.point((23, 1), fill=Yd)
    # 散发
    for y in range(8, 12):
        for x in range(12, 15): d.point((x, y), fill=K)
        for x in range(33, 36): d.point((x, y), fill=K)
    # 凶眉
    for x in range(16, 22): d.point((x, 6), fill=K)
    for x in range(27, 33): d.point((x, 6), fill=K)
    d.point((16, 5), fill=K); d.point((32, 5), fill=K)

    # 粗布衣
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            c = B if (x+y)%4!=2 else Bd
            d.point((x, y), fill=c)
    # 补丁
    for x in range(16, 21):
        for y in range(30, 34):
            d.point((x, y), fill=Bd)
    # 破洞
    d.point((28, 32), fill=(20, 20, 20, 255))
    # 绳腰带
    for x in range(17, 33):
        d.point((x, 40), fill=LBROWN)
    d.point((18, 39), fill=LBROWN); d.point((31, 39), fill=LBROWN)

    # 手臂
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=B)
        for x in range(35, 42): d.point((x, y), fill=B)
    for x in range(10, 17):
        for y in range(44, 48): d.point((x, y), fill=SKIN)
    for x in range(36, 43):
        for y in range(44, 48): d.point((x, y), fill=SKIN)

    # 短刀
    for y in range(38, 52):
        d.point((42, y), fill=S)
    d.point((42, 34), fill=S); d.point((42, 35), fill=S)
    d.point((42, 33), fill=W)
    d.point((41, 37), fill=B); d.point((43, 37), fill=B)

    return img


def make_xiliang_soldier():
    """西凉兵：皮甲、毛领、长矛"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(228,188,146,255), skin_l=(240,205,168,255), skin_d=(188,148,108,255))

    L=LBROWN; Ld=BROWN; Lb=DBROWN; F=LTAN; Fd=DTAN; K=BLACK; S=SILVER

    # 乱发
    for x in range(14, 34):
        for y in range(2, 6): d.point((x, y), fill=K)
    for y in range(4, 10):
        for x in range(12, 15): d.point((x, y), fill=K)
        for x in range(33, 36): d.point((x, y), fill=K)
    # 络腮胡
    for x in range(18, 31):
        for y in range(14, 20): d.point((x, y), fill=K)
    for x in range(16, 19):
        for y in range(15, 18): d.point((x, y), fill=K)
    for x in range(30, 33):
        for y in range(15, 18): d.point((x, y), fill=K)
    # 眼
    for x in range(18, 22):
        for y in range(8, 10): d.point((x, y), fill=WHITE)
    d.point((19, 8), fill=K); d.point((20, 8), fill=K)
    for x in range(27, 31):
        for y in range(8, 10): d.point((x, y), fill=WHITE)
    d.point((28, 8), fill=K); d.point((29, 8), fill=K)
    # 粗眉
    for x in range(16, 23): d.point((x, 5), fill=K)
    for x in range(26, 33): d.point((x, 5), fill=K)

    # 皮甲
    for y in range(26, 45):
        w = 10 + (45 - y) // 2
        for x in range(max(14, 24 - w), min(35, 24 + w)):
            d.point((x, y), fill=L if (x+y)%3!=1 else Lb)
    # 毛领
    for x in range(14, 35):
        for y in range(24, 27):
            c = F if (x+y)%3==0 else Fd
            d.point((x, y), fill=c)
    # 甲钉
    for r in range(3):
        y = 33 + r * 4
        for c in range(4 + r):
            d.point((18 + c * 4, y), fill=GOLD)

    # 腰带
    for y in range(40, 43):
        for x in range(16, 34):
            d.point((x, y), fill=Lb)

    # 手臂
    for y in range(26, 44):
        for x in range(7, 14): d.point((x, y), fill=L)
        for x in range(34, 41): d.point((x, y), fill=L)

    # 长矛
    for y in range(22, 64):
        d.point((0, y), fill=BROWN); d.point((1, y), fill=DBROWN)
    for y in range(19, 23):
        d.point((0, y), fill=S); d.point((1, y), fill=S)
    d.point((0, 17), fill=S); d.point((1, 17), fill=S)
    d.point((0, 16), fill=WHITE)

    return img


def make_deputy_general():
    """偏将：铁灰甲、头盔、佩剑"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d)

    E=(85,82,95,255); Ed=(55,52,62,255); El=(115,112,125,255)
    G=GOLD; Gd=DGOLD; S=SILVER; K=BLACK; R=RED

    # 头盔
    for y in range(2, 11):
        w = 8
        for x in range(24 - w, 25 + w):
            d.point((x, y), fill=S)
    for y in range(4, 10):
        for x in range(13, 16): d.point((x, y), fill=S)
        for x in range(32, 35): d.point((x, y), fill=S)
    # 小盔缨
    for y in range(-2, 3):
        d.point((23, y), fill=R); d.point((25, y), fill=R)
        d.point((24, y), fill=R)
    d.point((23, -3), fill=R); d.point((25, -3), fill=R)
    # 金饰
    for x in range(18, 31):
        d.point((x, 5), fill=G)
    # 面甲
    for x in range(22, 27):
        for y in range(10, 12): d.point((x, y), fill=S)

    # 铁灰甲
    for y in range(26, 47):
        w = 10 + (47 - y) // 2
        for x in range(max(14, 24 - w), min(36, 24 + w)):
            c = E if (x+y)%3!=1 else Ed
            d.point((x, y), fill=c)
    # 肩甲
    for x in range(10, 16):
        for y in range(26, 32): d.point((x, y), fill=Ed)
    for x in range(34, 40):
        for y in range(26, 32): d.point((x, y), fill=Ed)
    # 护心镜
    for x in range(21, 28):
        for y in range(28, 34):
            d.point((x, y), fill=G if (x+y)%2==0 else Gd)
    # 甲片
    for r in range(3):
        y = 37 + r * 3; x0 = 18 - r
        for c in range(6 + r):
            for dx in range(2):
                d.point((x0 + c * 3 + dx, y), fill=Ed)

    # 腰带
    for y in range(43, 46):
        for x in range(14, 36):
            d.point((x, y), fill=DGOLD)

    # 手臂
    for y in range(26, 44):
        for x in range(6, 13): d.point((x, y), fill=E)
        for x in range(35, 42): d.point((x, y), fill=E)

    # 剑
    for y in range(32, 56):
        d.point((0, y), fill=S); d.point((1, y), fill=S)
    for y in range(28, 32):
        d.point((0, y), fill=G); d.point((1, y), fill=Gd)
    d.point((0, 26), fill=S); d.point((1, 26), fill=S)
    d.point((0, 27), fill=WHITE)

    return img


def make_boss_huaxiong():
    """华雄 Boss：暗红重甲、巨盔高缨、青龙大刀"""
    img=make_canvas(); d=ImageDraw.Draw(img)
    body_base(d, skin=(235,192,148,255), skin_l=(242,210,170,255), skin_d=(195,152,110,255))

    D=DRED; Dd=(25,8,8,255); Dl=LRED
    G=GOLD; Gd=DGOLD; S=SILVER; K=BLACK; W=WHITE; O=COPPER

    # ── 巨盔 ──
    for y in range(-2, 12):
        w = 9
        for x in range(24 - w, 25 + w):
            d.point((x, y), fill=S)
    # 护耳
    for y in range(3, 13):
        for x in range(12, 15): d.point((x, y), fill=S)
        for x in range(33, 36): d.point((x, y), fill=S)
    # 面甲遮脸
    for x in range(18, 31):
        for y in range(10, 13): d.point((x, y), fill=S)
    d.point((17, 10), fill=S); d.point((31, 10), fill=S)
    # 巨缨
    for row in range(16):
        y = -8 + row; hw = max(2, 14 - row)
        for x in range(24 - hw // 2, 25 + hw // 2):
            d.point((x, y), fill=Dd)
    for y in range(-12, -6):
        for x in range(22, 27):
            d.point((x, y), fill=D)
    d.point((24, -14), fill=D); d.point((24, -13), fill=D)
    # 金饰
    for x in range(16, 33):
        d.point((x, 2), fill=G)
        d.point((x, 5), fill=Gd)

    # 浓眉（露出头盔外）
    for x in range(15, 21): d.point((x, 7), fill=K)
    for x in range(28, 34): d.point((x, 7), fill=K)
    # 络腮胡
    for x in range(14, 35):
        for y in range(16, 24): d.point((x, y), fill=K)
    for y in range(20, 25):
        for x in range(12, 15): d.point((x, y), fill=K)
        for x in range(34, 37): d.point((x, y), fill=K)
    for x in range(18, 31):
        for y in range(23, 27): d.point((x, y), fill=DKGRY)
    # 眼
    for x in range(17, 21):
        for y in range(9, 11): d.point((x, y), fill=W)
    d.point((18, 9), fill=K); d.point((19, 9), fill=K)
    for x in range(27, 31):
        for y in range(9, 11): d.point((x, y), fill=W)
    d.point((28, 9), fill=K); d.point((29, 9), fill=K)

    # ── 重甲 ──
    # 身体更宽大
    for y in range(26, 48):
        w = 11 + (48 - y) // 2
        for x in range(max(12, 24 - w), min(37, 24 + w)):
            c = D if (x+y)%3!=1 else Dd
            d.point((x, y), fill=c)
    # 肩甲巨兽
    for x in range(8, 14):
        for y in range(24, 34):
            d.point((x, y), fill=S)
        d.point((x, 25), fill=G)
        d.point((x, 33), fill=G)
    for x in range(35, 41):
        for y in range(24, 34):
            d.point((x, y), fill=S)
        d.point((x, 25), fill=G)
        d.point((x, 33), fill=G)
    # 胸甲双金纹
    for y in range(28, 38):
        d.point((20, y), fill=G); d.point((28, y), fill=G)
    for y in range(29, 37):
        d.point((21, y), fill=Gd); d.point((29, y), fill=Gd)
    # 护心镜
    for x in range(22, 27):
        for y in range(30, 36):
            d.point((x, y), fill=O)
    d.point((23, 32), fill=DGOLD); d.point((24, 32), fill=DGOLD); d.point((25, 32), fill=DGOLD)

    # 腰甲片
    for r in range(3):
        y = 40 + r * 3; x0 = 16 - r
        for c in range(8 + r):
            for dx in range(2):
                d.point((x0 + c * 3 + dx, y), fill=O)

    # 手臂
    for y in range(26, 50):
        for x in range(4, 11): d.point((x, y), fill=D)
        for x in range(37, 44): d.point((x, y), fill=D)
    for y in range(46, 50):
        for x in range(4, 11): d.point((x, y), fill=G)
        for x in range(37, 44): d.point((x, y), fill=G)
    # 手
    for x in range(4, 12):
        for y in range(50, 55): d.point((x, y), fill=SKIN)
    for x in range(38, 46):
        for y in range(50, 55): d.point((x, y), fill=SKIN)

    # ── 青龙大刀 ──
    for y in range(20, 60):
        d.point((44, y), fill=BROWN); d.point((45, y), fill=DBROWN)
        d.point((46, y), fill=BROWN)
    # 刀握柄
    for y in range(24, 28):
        for x in range(43, 47): d.point((x, y), fill=G)
    # 刀头
    for x in range(40, 48):
        for y in range(14, 18): d.point((x, y), fill=S)
    for x in range(42, 47):
        for y in range(12, 15): d.point((x, y), fill=S)
    d.point((43, 10), fill=S); d.point((44, 11), fill=S)
    d.point((44, 9), fill=W)
    for x in range(41, 48):
        for y in range(17, 19):
            d.point((x, y), fill=S)
            if x % 2 == 0: d.point((x, y), fill=W)

    # ── 腿 ──
    for y in range(48, 62):
        for x in range(16, 24):
            d.point((x, y), fill=Dd)
        for x in range(25, 33):
            d.point((x, y), fill=Dd)

    return img


# ─── 后处理 ─────────────────────────────────────────
def add_outline(img):
    """给像素画加外轮廓"""
    w, h = img.size
    px = img.load()
    result = img.copy()
    rpx = result.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 100:
                for dx, dy in [(-1,0),(1,0),(0,-1),(0,1),(-1,-1),(1,-1),(-1,1),(1,1)]:
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < w and 0 <= ny < h and rpx[nx, ny][3] < 30:
                        rpx[nx, ny] = (12, 10, 15, 255)
    return result


def upscale(img, s=SCALE):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


# ─── 主流程 ─────────────────────────────────────────
def main():
    chars = {
        "hero":             ("少侠", make_hero),
        "storyteller":      ("说书人", make_storyteller),
        "hanbo":            ("韩伯", make_hanbo),
        "hualao":           ("华老", make_hualao),
        "zuoci":            ("左慈", make_zuoci),
        "shuijing":         ("水镜", make_shuijing),
        "captain":          ("校尉", make_captain),
        "yellow_turban":    ("黄巾贼", make_yellow_turban),
        "xiliang_soldier":  ("西凉兵", make_xiliang_soldier),
        "deputy_general":   ("偏将", make_deputy_general),
        "boss":             ("华雄", make_boss_huaxiong),
    }

    for key, (name, fn) in chars.items():
        img = fn()
        img = add_outline(img)
        img = upscale(img)
        path = f"{OUT_DIR}/{key}.png"
        img.save(path)
        print(f"[OK] {name:6s} -> {path}")

    # 拼图预览
    preview = Image.new("RGBA", (CANVAS_W * 11 + 12, CANVAS_H + 12), (35, 35, 40, 255))
    for i, key in enumerate(chars.keys()):
        img = chars[key][1]()
        img = add_outline(img)
        preview.paste(img, (6 + i * (CANVAS_W + 1), 6), img)
    upscale(preview).save(f"{OUT_DIR}/_preview_all.png")
    print(f"\n[DONE] 全部 11 个角色已生成到 {OUT_DIR}/")

if __name__ == "__main__":
    main()
