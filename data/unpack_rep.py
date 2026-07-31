#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CANN .rep 二进制解析脚本
读取 pack_rep.py 生成的 .rep 文件,解析 CannRepHead + CannRepFileInfo[] + file_data[],
并把每个文件还原到输出目录。

布局与结构体见 pack_rep.py,本脚本是其逆操作。
"""
import os
import sys
import struct

HEAD_MAGIC = b"cann-rep"
FILE_MAGIC = b"rep-file"
VERSION = 0x00010000

HEAD_SIZE = 36
FILEINFO_SIZE = 160

TYPE_NAME = {0: "raw", 1: "csv", 2: "json", 3: "txt", 4: "ini"}
ORIGIN_NAME = {0: "default", 1: "profile", 2: "sanitizer"}

def unpack_head(buf: bytes):
    """解析 CannRepHead (36 字节)"""
    if len(buf) < HEAD_SIZE:
        sys.exit("[ERROR] buffer too small for head")
    (magic, version, count, file_length, rep_length, offset) = struct.unpack_from(
        "<8sII I Q Q", buf, 0
    )
    if magic != HEAD_MAGIC:
        sys.exit(f"[ERROR] head magic mismatch: {magic!r} != {HEAD_MAGIC!r}")
    return {
        "magic": magic,
        "version": version,
        "fileInfoCount": count,
        "fileLength": file_length,
        "repLength": rep_length,
        "offset": offset,
    }

def unpack_fileinfo(buf: bytes, pos: int):
    """解析单个 CannRepFileInfo (160 字节),从 buf[pos] 开始"""
    (magic, name_b, ftype, origin, resv, length, offset) = struct.unpack_from(
        "<8s128sHHI Q Q", buf, pos
    )
    if magic != FILE_MAGIC:
        sys.exit(f"[ERROR] fileinfo magic mismatch: {magic!r} != {FILE_MAGIC!r}")
    # name 是 128 字节, 去 \0
    name = name_b.split(b"\x00", 1)[0].decode("utf-8", errors="replace")
    return {
        "magic": magic,
        "name": name,
        "type": ftype,
        "origin": origin,
        "resv": resv,
        "length": length,
        "offset": offset,
    }

def parse(rep_file: str, out_dir: str = None):
    with open(rep_file, "rb") as fp:
        buf = fp.read()

    # 1. 解析 Head
    head = unpack_head(buf)
    print("=== CannRepHead ===")
    print(f"  magic         : {head['magic'].decode()}")
    print(f"  version       : 0x{head['version']:08x}")
    print(f"  fileInfoCount : {head['fileInfoCount']}")
    print(f"  fileLength    : {head['fileLength']}  (Head 自身长度)")
    print(f"  repLength     : {head['repLength']}  (文件总长)")
    print(f"  offset        : {head['offset']}  (数据区起始)")

    if head["version"] != VERSION:
        print(f"[WARN] version 0x{head['version']:08x} != expected 0x{VERSION:08x}")
    if head["repLength"] != len(buf):
        print(f"[WARN] repLength {head['repLength']} != actual file size {len(buf)}")

    # 2. 解析 FileInfo 数组
    n = head["fileInfoCount"]
    data_start = head["offset"]
    expected_data_start = HEAD_SIZE + n * FILEINFO_SIZE
    if data_start != expected_data_start:
        print(f"[WARN] head.offset {data_start} != computed {expected_data_start}")

    fileinfos = []
    print(f"\n=== CannRepFileInfo[] (count={n}) ===")
    print(f"  {'name':<32} {'type':>5} {'origin':>10} {'offset':>10} {'length':>8}")
    for i in range(n):
        pos = HEAD_SIZE + i * FILEINFO_SIZE
        fi = unpack_fileinfo(buf, pos)
        fileinfos.append(fi)
        tname = TYPE_NAME.get(fi["type"], f"?{fi['type']}")
        oname = ORIGIN_NAME.get(fi["origin"], f"?{fi['origin']}")
        print(f"  {fi['name']:<32} {tname:>5} {oname:>10} {fi['offset']:>10} {fi['length']:>8}")

    # 3. 校验数据区连续性
    print("\n=== Data Region Check ===")
    for fi in fileinfos:
        end = fi["offset"] + fi["length"]
        if end > len(buf):
            print(f"  [ERROR] {fi['name']}: offset {fi['offset']}+length {fi['length']} "
                  f"exceeds file size {len(buf)}")
        if fi["offset"] < data_start:
            print(f"  [ERROR] {fi['name']}: offset {fi['offset']} < data_start {data_start}")

    # 4. 还原文件
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        print(f"\n=== Extracting to: {out_dir} ===")
        for fi in fileinfos:
            data = buf[fi["offset"]:fi["offset"] + fi["length"]]
            out_path = os.path.join(out_dir, fi["name"])
            with open(out_path, "wb") as fp:
                fp.write(data)
            # 校验写入大小
            actual = os.path.getsize(out_path)
            ok = "OK" if actual == fi["length"] else "MISMATCH"
            print(f"  {fi['name']:<32} -> {out_path}  ({actual} bytes) [{ok}]")
    else:
        print("\n(no out_dir given, skip extraction)")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: {sys.argv[0]} <in.rep> [out_dir]")
        sys.exit(1)
    out_dir = sys.argv[2] if len(sys.argv) >= 3 else None
    parse(sys.argv[1], out_dir)
