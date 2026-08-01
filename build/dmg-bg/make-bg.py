#!/usr/bin/env python3
"""Generate a standard macOS drag-and-drop DMG background image."""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 600, 420
img = Image.new('RGB', (W, H), '#F7F3EE')
draw = ImageDraw.Draw(img)

# subtle gradient / rounded card feel
for y in range(H):
    factor = y / H
    r = int(0xF7 - factor * 12)
    g = int(0xF3 - factor * 10)
    b = int(0xEE - factor * 8)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# title
try:
    font_title = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 26)
    font_body = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 18)
    font_hint = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 14)
except Exception:
    font_title = ImageFont.load_default()
    font_body = font_title
    font_hint = font_title

title = "WorkBuddy 皮肤管理器"
bbox = draw.textbbox((0, 0), title, font=font_title)
tw = bbox[2] - bbox[0]
draw.text(((W - tw) / 2, 28), title, fill="#5C4A3D", font=font_title)

# two dashed drop zones
zone_w, zone_h = 170, 170
left_center = (160, 180)
right_center = (440, 180)
for cx, cy in [left_center, right_center]:
    x0, y0 = cx - zone_w/2, cy - zone_h/2
    x1, y1 = cx + zone_w/2, cy + zone_h/2
    for i in range(0, int(zone_w), 12):
        draw.line([(x0+i, y0), (x0+i+6, y0)], fill="#D4C8BB", width=2)
        draw.line([(x0+i, y1), (x0+i+6, y1)], fill="#D4C8BB", width=2)
    for i in range(0, int(zone_h), 12):
        draw.line([(x0, y0+i), (x0, y0+i+6)], fill="#D4C8BB", width=2)
        draw.line([(x1, y0+i), (x1, y0+i+6)], fill="#D4C8BB", width=2)

# arrow between zones
ax, ay = (left_center[0] + zone_w/2 + 18), left_center[1]
draw.polygon([(ax, ay-8), (ax+36, ay-8), (ax+36, ay-16), (ax+52, ay), (ax+36, ay+16), (ax+36, ay+8), (ax, ay+8)], fill="#A66E4E")

# labels below zones
draw.text((left_center[0]-zone_w/2+18, left_center[1]+zone_h/2+14), "App", fill="#7D6B5D", font=font_body)
draw.text((right_center[0]-zone_w/2+6, right_center[1]+zone_h/2+14), "Applications", fill="#7D6B5D", font=font_body)

# bottom hint
hint = "把左侧 App 图标拖到右侧 Applications 文件夹即可安装"
bbox = draw.textbbox((0, 0), hint, font=font_hint)
tw = bbox[2] - bbox[0]
draw.text(((W - tw) / 2, H - 46), hint, fill="#8E7D6D", font=font_hint)

out = os.path.join(os.path.dirname(__file__), "background.png")
img.save(out, "PNG")
print(f"Saved: {out} ({W}x{H})")
