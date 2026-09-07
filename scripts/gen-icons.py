"""
gen-icons.py — vẽ lại bộ icon Ytube (khối đỏ bo góc + tam giác play trắng, nền tối
#0e0f13) với LOGO TO HƠN, CÂN ĐỐI HƠN — sửa lỗi icon nhỏ bị viền đen bao quanh trên
điện thoại/TV Android (đặc biệt icon "maskable" trước đây logo chỉ chiếm 50% khung,
launcher cắt tròn/bo góc là dư ra rất nhiều viền tối trống).

Không phải file build tự động của app (không đụng tới lúc `npm run build`/`build:webos`)
— chỉ chạy TAY 1 lần mỗi khi cần vẽ lại icon, rồi lưu thẳng đè lên các file .png có sẵn
trong public/icons/ và public/webos/. Cần thư viện Pillow: `pip install pillow`.
"""
from PIL import Image, ImageDraw

BG = (14, 15, 19, 255)  # #0e0f13 — đúng màu nền tối của app (theme.css, manifest.webmanifest)
RED = (224, 32, 32, 255)  # đỏ khối logo
WHITE = (255, 255, 255, 255)


def draw_logo(size: int, fill_ratio: float) -> Image.Image:
    """Vẽ 1 icon size x size: nền tối phủ kín, khối đỏ bo góc ở giữa chiếm đúng
    fill_ratio % bề ngang/dọc khung, tam giác trắng (nút play) nằm giữa khối đỏ."""
    img = Image.new("RGBA", (size, size), BG)
    draw = ImageDraw.Draw(img)

    box = round(size * fill_ratio)
    off = (size - box) // 2
    radius = round(box * 0.22)
    draw.rounded_rectangle([off, off, off + box, off + box], radius=radius, fill=RED)

    # Tam giác play trắng, hơi lệch phải 1 chút cho cân mắt (giống hệt icon play thật —
    # trọng tâm hình tam giác lệch trái so với hình bao ngoài, dịch phải mới thấy "giữa").
    tri_h = box * 0.46
    tri_w = tri_h * 0.86
    cx, cy = size / 2 + box * 0.035, size / 2
    p1 = (cx - tri_w / 2, cy - tri_h / 2)
    p2 = (cx - tri_w / 2, cy + tri_h / 2)
    p3 = (cx + tri_w / 2, cy)
    draw.polygon([p1, p2, p3], fill=WHITE)
    return img


# (đường dẫn, kích thước, tỉ lệ lấp đầy) — icon thường 84% (không bị hệ điều hành cắt
# viền), riêng bản "maskable" 68% (chừa khoảng an toàn cho Android tự cắt tròn/bo góc
# tuỳ launcher mà không mất góc logo, nhưng vẫn to hơn hẳn bản cũ 50%).
TARGETS = [
    ("public/icons/icon-192.png", 192, 0.84),
    ("public/icons/icon-512.png", 512, 0.84),
    ("public/icons/icon-512-maskable.png", 512, 0.68),
    ("public/icons/apple-touch-icon.png", 180, 0.84),
    ("public/webos/icon.png", 80, 0.84),
    ("public/webos/largeIcon.png", 130, 0.84),
]

for path, size, ratio in TARGETS:
    draw_logo(size, ratio).save(path)
    print(f"[icons] Đã vẽ lại {path} ({size}x{size}, logo {round(ratio*100)}%)")
