#!/usr/bin/env python3
"""
Slices mutant_fish_source.png into a professional 2D paper cutout skeletal puppet rig.
Ensures convex joint overlap caps so parts can rotate fluidly with ZERO gaps.
Packs the parts into mutant_cutout_atlas.png and generates the PixiJS rig definition.
"""

import zlib
import struct
import math
import os

def read_png(filepath):
    with open(filepath, "rb") as f:
        header = f.read(8)
        assert header == b"\x89PNG\r\n\x1a\n", "Not a valid PNG"
        idat = bytearray()
        w, h = 0, 0
        while True:
            data = f.read(8)
            if not data:
                break
            chunk_len, chunk_type = struct.unpack(">I4s", data)
            chunk_data = f.read(chunk_len)
            f.read(4) # crc
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

    def paeth_predictor(a, b, c):
        p = a + b - c
        pa = abs(p - a)
        pb = abs(p - b)
        pc = abs(p - c)
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
                pixels[curr_y + i] = (line[i] + paeth_predictor(left, up, up_left)) & 0xff

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

print("Loaded generate_mutant_rig module")
