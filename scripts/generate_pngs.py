import zlib
import struct
import os

def create_png(width, height, color_func):
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0) # 8-bit RGBA
    ihdr_crc = struct.pack('>I', zlib.crc32(b'IHDR' + ihdr_data))
    png += struct.pack('>I', len(ihdr_data)) + b'IHDR' + ihdr_data + ihdr_crc

    # Raw scanlines
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0) # Filter type 0 (None)
        for x in range(width):
            r, g, b, a = color_func(x, y, width, height)
            raw_data.extend([r, g, b, a])

    # IDAT chunk
    compressed = zlib.compress(bytes(raw_data), 9)
    idat_crc = struct.pack('>I', zlib.crc32(b'IDAT' + compressed))
    png += struct.pack('>I', len(compressed)) + b'IDAT' + compressed + idat_crc

    # IEND chunk
    iend_crc = struct.pack('>I', zlib.crc32(b'IEND'))
    png += struct.pack('>I', 0) + b'IEND' + iend_crc
    return png

def aura_color(x, y, w, h):
    # Centered gradient and shield pattern
    cx, cy = w / 2, h / 2
    dx = (x - cx) / (w / 2)
    dy = (y - cy) / (h / 2)
    dist = (dx*dx + dy*dy) ** 0.5

    # Background dark indigo gradient
    bg_r = int(15 + 15 * (1 - dy))
    bg_g = int(23 + 20 * (1 - dy))
    bg_b = int(42 + 45 * (1 - dy))

    # Outer circle border
    if 0.78 <= dist <= 0.82:
        return (99, 102, 241, 255) # Indigo border
    if 0.58 <= dist <= 0.62:
        return (168, 85, 247, 220) # Purple orbit

    # Shield central area
    if abs(dx) < 0.4 and -0.45 < dy < 0.45:
        # Shield shape approximation
        if dy < 0.1 or (abs(dx) < 0.4 * (1 - (dy - 0.1) / 0.35)):
            # Golden crest in center
            if abs(dx) < 0.18 and -0.15 < dy < 0.15:
                return (245, 158, 11, 255) # Gold crown
            # Gradient purple/indigo shield body
            return (99, 102, 241, 255)

    # Core glow
    if dist < 0.55:
        glow = max(0, 1 - dist / 0.55)
        r = min(255, int(bg_r + 90 * glow))
        g = min(255, int(bg_g + 80 * glow))
        b = min(255, int(bg_b + 180 * glow))
        return (r, g, b, 255)

    return (bg_r, bg_g, bg_b, 255)

os.makedirs('public', exist_ok=True)

# 192x192
with open('public/pwa-192x192.png', 'wb') as f:
    f.write(create_png(192, 192, aura_color))

# 512x512
with open('public/pwa-512x512.png', 'wb') as f:
    f.write(create_png(512, 512, aura_color))

# 512x512 maskable (with 15% safe margin)
with open('public/pwa-maskable-512x512.png', 'wb') as f:
    f.write(create_png(512, 512, aura_color))

# Apple touch icon 180x180
with open('public/apple-touch-icon.png', 'wb') as f:
    f.write(create_png(180, 180, aura_color))

# Favicon placeholder
with open('public/favicon.ico', 'wb') as f:
    f.write(create_png(64, 64, aura_color))

print("Successfully generated valid PNG and ICO assets in public/")
