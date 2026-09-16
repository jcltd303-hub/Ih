#!/usr/bin/env python3
"""
Slices mutant_fish_source.png into a professional 2D paper cutout skeletal puppet rig.
Ensures convex circular joint overlap caps so joints can rotate fluidly without gaps.
Packs the parts into mutant_cutout_atlas.png and writes TypeScript rig metadata.
"""

import zlib
import struct
import math
import os
import json

def read_png(filepath):
    with open(filepath, "rb") as f:
        f.read(8)
        idat = bytearray()
        w, h = 0, 0
        while True:
            data = f.read(8)
            if not data: break
            chunk_len, chunk_type = struct.unpack(">I4s", data)
            chunk_data = f.read(chunk_len)
            f.read(4)
            if chunk_type == b"IHDR":
                w, h = struct.unpack(">II", chunk_data[:8])
            elif chunk_type == b"IDAT":
                idat.extend(chunk_data)
            elif chunk_type == b"IEND":
                break

    raw = zlib.decompress(bytes(idat))
    bpp = 4
    stride = w * bpp
    pixels = bytearray(w * h * bpp)

    def paeth(a, b, c):
        p = a + b - c
        pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
        if pa <= pb and pa <= pc: return a
        elif pb <= pc: return b
        else: return c

    raw_offset = 0
    for y in range(h):
        filter_type = raw[raw_offset]
        raw_offset += 1
        line = raw[raw_offset : raw_offset + stride]
        raw_offset += stride
        curr_y = y * stride
        prev_y = (y - 1) * stride
        if filter_type == 0:
            pixels[curr_y : curr_y + stride] = line
        elif filter_type == 1:
            for i in range(stride):
                left = pixels[curr_y + i - bpp] if i >= bpp else 0
                pixels[curr_y + i] = (line[i] + left) & 0xff
        elif filter_type == 2:
            for i in range(stride):
                up = pixels[prev_y + i] if y > 0 else 0
                pixels[curr_y + i] = (line[i] + up) & 0xff
        elif filter_type == 3:
            for i in range(stride):
                left = pixels[curr_y + i - bpp] if i >= bpp else 0
                up = pixels[prev_y + i] if y > 0 else 0
                pixels[curr_y + i] = (line[i] + ((left + up) >> 1)) & 0xff
        elif filter_type == 4:
            for i in range(stride):
                left = pixels[curr_y + i - bpp] if i >= bpp else 0
                up = pixels[prev_y + i] if y > 0 else 0
                up_left = pixels[prev_y + i - bpp] if (y > 0 and i >= bpp) else 0
                pixels[curr_y + i] = (line[i] + paeth(left, up, up_left)) & 0xff

    return w, h, pixels

def write_png(filename, width, height, rgba_data):
    def make_chunk(chunk_type, data):
        crc = zlib.crc32(chunk_type + data) & 0xffffffff
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)
    
    raw = bytearray()
    bpp = 4
    stride = width * bpp
    for y in range(height):
        raw.append(0)
        raw.extend(rgba_data[y * stride : (y + 1) * stride])
    
    compressed = zlib.compress(bytes(raw), 9)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    
    with open(filename, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(make_chunk(b"IHDR", ihdr_data))
        f.write(make_chunk(b"IDAT", compressed))
        f.write(make_chunk(b"IEND", b""))

def point_in_polygon(x, y, poly):
    inside = False
    n = len(poly)
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def main():
    src_path = "./public/mutant_fish_source.png"
    w, h, px = read_png(src_path)
    print(f"Loaded source image {w}x{h}")

    # Define anatomical regions as polygons or bounding boxes with explicit pivot coordinates
    # and rounded joint expansion radii.
    # Coordinates derived from pixel density and feature mapping:
    parts_def = {
        "dorsal_fin": {
            "name": "Dorsal Fin",
            "pivot": (680, 270),
            "joint_radius": 50,
            "poly": [
                (450, 390), (480, 320), (540, 240), (660, 160), (780, 100), (840, 50),
                (890, 50), (920, 260), (800, 340), (680, 320), (550, 390)
            ],
            "z_order": 1,
            "parent": "torso",
            "attach_offset": (10, -140),
            "rotation_range": (-0.18, 0.22)
        },
        "tail_fin": {
            "name": "Tail Fin",
            "pivot": (1000, 440),
            "joint_radius": 60,
            "poly": [
                (960, 240), (1050, 200), (1247, 240), (1247, 720), (1140, 750), (1000, 680),
                (970, 560), (950, 440), (960, 320)
            ],
            "z_order": 2,
            "parent": "tail_peduncle",
            "attach_offset": (160, 0),
            "rotation_range": (-0.35, 0.35)
        },
        "tail_peduncle": {
            "name": "Tail Peduncle",
            "pivot": (830, 440),
            "joint_radius": 65,
            "poly": [
                (800, 280), (920, 240), (1010, 320), (1010, 620), (920, 660), (810, 620),
                (790, 480)
            ],
            "z_order": 3,
            "parent": "torso",
            "attach_offset": (220, 10),
            "rotation_range": (-0.25, 0.25)
        },
        "leg_rear_lower": {
            "name": "Rear Lower Leg & Clawed Foot",
            "pivot": (805, 685),
            "joint_radius": 40,
            "poly": [
                (780, 660), (850, 660), (900, 720), (940, 840), (880, 870), (810, 840),
                (780, 750)
            ],
            "z_order": 4,
            "parent": "leg_rear_upper",
            "attach_offset": (25, 120),
            "rotation_range": (-0.3, 0.4)
        },
        "leg_rear_upper": {
            "name": "Rear Upper Thigh",
            "pivot": (770, 560),
            "joint_radius": 45,
            "poly": [
                (740, 520), (830, 520), (850, 660), (780, 670), (740, 600)
            ],
            "z_order": 5,
            "parent": "torso",
            "attach_offset": (160, 140),
            "rotation_range": (-0.2, 0.3)
        },
        "arm_front_lower": {
            "name": "Front Forearm & Claws",
            "pivot": (595, 675),
            "joint_radius": 38,
            "poly": [
                (570, 650), (640, 650), (680, 740), (660, 920), (580, 920), (560, 760)
            ],
            "z_order": 9,
            "parent": "arm_front_upper",
            "attach_offset": (35, 130),
            "rotation_range": (-0.35, 0.35)
        },
        "arm_front_upper": {
            "name": "Front Upper Arm",
            "pivot": (540, 545),
            "joint_radius": 45,
            "poly": [
                (500, 500), (590, 500), (640, 660), (560, 670), (500, 580)
            ],
            "z_order": 8,
            "parent": "torso",
            "attach_offset": (-70, 130),
            "rotation_range": (-0.25, 0.35)
        },
        "ventral_finlet": {
            "name": "Ventral Finlet",
            "pivot": (500, 640),
            "joint_radius": 35,
            "poly": [
                (460, 610), (550, 610), (550, 740), (460, 740)
            ],
            "z_order": 7,
            "parent": "torso",
            "attach_offset": (-110, 160),
            "rotation_range": (-0.2, 0.25)
        },
        "jaw_lower": {
            "name": "Articulated Lower Jaw",
            "pivot": (410, 565),
            "joint_radius": 55, # Extra rounded joint cap ensuring ZERO gap at TMJ hinge
            "poly": [
                (20, 620), (140, 600), (260, 550), (370, 530), (430, 540), (430, 680),
                (380, 780), (260, 810), (140, 850), (60, 840), (10, 740)
            ],
            "z_order": 10,
            "parent": "head_upper",
            "attach_offset": (-40, 85),
            "rotation_range": (-0.05, 0.42) # Snaps open down to +0.42 rad (~24 deg)
        },
        "head_upper": {
            "name": "Head & Upper Cranium",
            "pivot": (450, 480),
            "joint_radius": 50,
            "poly": [
                (8, 420), (120, 360), (260, 300), (380, 300), (480, 360), (480, 540),
                (420, 560), (360, 520), (260, 520), (180, 560), (100, 560), (8, 500)
            ],
            "z_order": 6,
            "parent": "torso",
            "attach_offset": (-190, -10),
            "rotation_range": (-0.12, 0.12)
        },
        "torso": {
            "name": "Main Torso Body",
            "pivot": (640, 480), # Central master pivot
            "joint_radius": 0,
            "poly": [
                (420, 360), (550, 260), (680, 260), (810, 280), (840, 420), (840, 620),
                (740, 660), (580, 660), (440, 620), (420, 480)
            ],
            "z_order": 0,
            "parent": None,
            "attach_offset": (0, 0),
            "rotation_range": (-0.1, 0.1)
        }
    }

    extracted_parts = {}

    for part_id, pdef in parts_def.items():
        poly = pdef["poly"]
        piv_x, piv_y = pdef["pivot"]
        j_rad = pdef["joint_radius"]

        # Bounding box of polygon
        min_px = min(pt[0] for pt in poly)
        max_px = max(pt[0] for pt in poly)
        min_py = min(pt[1] for pt in poly)
        max_py = max(pt[1] for pt in poly)

        # Include joint circle in bounds
        if j_rad > 0:
            min_px = min(min_px, piv_x - j_rad)
            max_px = max(max_px, piv_x + j_rad)
            min_py = min(min_py, piv_y - j_rad)
            max_py = max(max_py, piv_y + j_rad)

        # Pad 10px
        min_px = max(0, int(min_px - 10))
        max_px = min(w - 1, int(max_px + 10))
        min_py = max(0, int(min_py - 10))
        max_py = min(h - 1, int(max_py + 10))

        part_w = max_px - min_px + 1
        part_h = max_py - min_py + 1
        part_data = bytearray(part_w * part_h * 4)

        # Cut out pixels matching polygon OR joint cap circle
        # Joint cap ensures seamless rotation without gaps
        for py in range(min_py, max_py + 1):
            row_idx = (py - min_py) * part_w
            for px_x in range(min_px, max_px + 1):
                in_poly = point_in_polygon(px_x, py, poly)
                in_joint = False
                if j_rad > 0:
                    dist_sq = (px_x - piv_x)**2 + (py - piv_y)**2
                    if dist_sq <= j_rad**2:
                        in_joint = True

                if in_poly or in_joint:
                    src_idx = (py * w + px_x) * 4
                    alpha = px[src_idx + 3]
                    if alpha > 10:
                        dst_idx = (row_idx + (px_x - min_px)) * 4
                        part_data[dst_idx : dst_idx + 4] = px[src_idx : src_idx + 4]

        # Tight trim transparent borders of the cutout part
        t_min_x, t_max_x = part_w, 0
        t_min_y, t_max_y = part_h, 0
        for y in range(part_h):
            for x in range(part_w):
                if part_data[(y * part_w + x) * 4 + 3] > 10:
                    if x < t_min_x: t_min_x = x
                    if x > t_max_x: t_max_x = x
                    if y < t_min_y: t_min_y = y
                    if y > t_max_y: t_max_y = y

        if t_min_x > t_max_x: # empty safeguard
            t_min_x, t_max_x, t_min_y, t_max_y = 0, part_w - 1, 0, part_h - 1

        final_w = t_max_x - t_min_x + 1
        final_h = t_max_y - t_min_y + 1
        trimmed_data = bytearray(final_w * final_h * 4)

        for y in range(final_h):
            src_row = (y + t_min_y) * part_w + t_min_x
            dst_row = y * final_w
            trimmed_data[dst_row * 4 : (dst_row + final_w) * 4] = part_data[src_row * 4 : (src_row + final_w) * 4]

        # Calculate pivot position relative to trimmed bounding box
        rel_piv_x = (piv_x - min_px) - t_min_x
        rel_piv_y = (piv_y - min_py) - t_min_y

        anchor_x = max(0.0, min(1.0, rel_piv_x / max(1, final_w)))
        anchor_y = max(0.0, min(1.0, rel_piv_y / max(1, final_h)))

        extracted_parts[part_id] = {
            "def": pdef,
            "width": final_w,
            "height": final_h,
            "data": trimmed_data,
            "pivot_rel": (rel_piv_x, rel_piv_y),
            "anchor": (round(anchor_x, 4), round(anchor_y, 4))
        }
        print(f"Extracted {part_id}: {final_w}x{final_h}, anchor=({anchor_x:.3f}, {anchor_y:.3f})")

    # Pack all parts onto a clean atlas (e.g. 2048x1536)
    atlas_w = 2048
    atlas_h = 1536
    atlas_data = bytearray(atlas_w * atlas_h * 4)

    cur_x, cur_y = 16, 16
    row_h = 0
    atlas_manifest = {}

    for part_id, pinfo in extracted_parts.items():
        pw = pinfo["width"]
        ph = pinfo["height"]

        if cur_x + pw + 16 > atlas_w:
            cur_x = 16
            cur_y += row_h + 16
            row_h = 0

        # Copy part into atlas
        for y in range(ph):
            src_start = y * pw * 4
            dst_start = ((cur_y + y) * atlas_w + cur_x) * 4
            atlas_data[dst_start : dst_start + pw * 4] = pinfo["data"][src_start : src_start + pw * 4]

        atlas_manifest[part_id] = {
            "name": pinfo["def"]["name"],
            "frame": { "x": cur_x, "y": cur_y, "w": pw, "h": ph },
            "anchor": { "x": pinfo["anchor"][0], "y": pinfo["anchor"][1] },
            "zOrder": pinfo["def"]["z_order"],
            "parent": pinfo["def"]["parent"],
            "attachOffset": { "x": pinfo["def"]["attach_offset"][0], "y": pinfo["def"]["attach_offset"][1] },
            "rotationRange": pinfo["def"]["rotation_range"]
        }

        cur_x += pw + 16
        if ph > row_h:
            row_h = ph

    # Save output atlas PNG in both public/ and src/assets/images/
    out_public = "./public/assets/mutant_cutout_atlas.png"
    out_assets = "./src/assets/images/mutant_cutout_atlas.png"
    os.makedirs("./public/assets", exist_ok=True)
    os.makedirs("./src/assets/images", exist_ok=True)

    write_png(out_public, atlas_w, atlas_h, atlas_data)
    write_png(out_assets, atlas_w, atlas_h, atlas_data)
    print(f"Saved packed atlas to {out_public} and {out_assets}")

    # Generate TypeScript definitions and runtime bone rig
    manifest_json = json.dumps(atlas_manifest, indent=2)
    ts_code = f"""/**
 * Generated Paper Cutout Skeletal Rig Metadata for Mutant Fish.
 * Sliced with convex joint overlap caps for 100% gapless fluid rotation.
 */

export interface PartFrame {{
  x: number;
  y: number;
  w: number;
  h: number;
}}

export interface PartRigDef {{
  name: string;
  frame: PartFrame;
  anchor: {{ x: number; y: number }};
  zOrder: number;
  parent: string | null;
  attachOffset: {{ x: number; y: number }};
  rotationRange: [number, number];
}}

export const MUTANT_RIG_ATLAS_SIZE = {{ width: {atlas_w}, height: {atlas_h} }};

export const MUTANT_RIG_PARTS: Record<string, PartRigDef> = {manifest_json};
"""

    with open("./src/engine/systems/mutantRigData.ts", "w") as f:
        f.write(ts_code)

    print("Saved mutantRigData.ts successfully!")

if __name__ == "__main__":
    main()
