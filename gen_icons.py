from PIL import Image, ImageDraw

BG = (251, 243, 214)        # 淡黄 #fbf3d6
CARD = (255, 253, 244)      # 卡片白
PURPLE = (156, 106, 222)    # 紫 #9c6ade
PURPLE_D = (125, 79, 196)
GOLD = (201, 162, 75)

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def make(size):
    img = Image.new('RGB', (size, size), BG)
    d = ImageDraw.Draw(img)
    m = int(size*0.13)
    # 卡片
    rounded(d, [m, m, size-m, size-m], int(size*0.12), CARD)
    # 紫色书脊（左侧竖条）
    spine = int(size*0.07)
    d.rectangle([m, m, m+spine, size-m], fill=PURPLE)
    # 文字线
    lx0 = m + spine + int(size*0.07)
    lx1 = size - m - int(size*0.07)
    ly = m + int(size*0.16)
    lh = int(size*0.05)
    gap = int(size*0.045)
    for i in range(4):
        col = PURPLE if i % 2 == 0 else GOLD
        d.rounded_rectangle([lx0, ly + i*(lh+gap), lx1 - (i*int(size*0.04)), ly + i*(lh+gap) + lh], radius=lh//2, fill=col)
    # 底部一颗小爱心/书签
    cx, cy = size//2, size - m - int(size*0.14)
    r = int(size*0.05)
    d.ellipse([cx-r*1.8, cy-r, cx-r, cy], fill=PURPLE)
    d.ellipse([cx+r*0.8, cy-r, cx+r*1.8, cy], fill=PURPLE)
    d.polygon([(cx-r*1.8, cy+int(r*0.2)), (cx+r*1.8, cy+int(r*0.2)), (cx, cy+r*2.4)], fill=PURPLE)
    return img

for s in (192, 512):
    make(s).save(f'E:/work Buddy工作空间/diary-app/icons/icon-{s}.png')
print('icons generated')
