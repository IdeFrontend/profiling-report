#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CANN .rep 二进制打包脚本
按 CannRepHead + CannRepFileInfo[] + file_data[] 布局生成二进制 .rep 文件

布局:
  [CannRepHead]
  [CannRepFileInfo_1] ... [CannRepFileInfo_n]
  [file1_data] ... [filen_data]

结构体(小端,紧凑无填充):
  CannRepHead  (36 字节):
    magic[8]         = "cann-rep"  (8字符填满,无\0)
    version          = 0x00010000  (1.0.0)
    fileInfoCount    = 文件个数
    fileLength       = CannRepHead 自身长度 (36)
    repLength        = 整个 .rep 文件总长
    offset           = 数据区起始绝对偏移 (head + n*fileinfo)
  CannRepFileInfo (160 字节):
    magic[8]         = "rep-file"  (8字符填满,无\0)
    name[128]        = 文件名(仅 basename,不足128补\0)
    type             = raw=0, csv=1, json=2, txt=3, ini=4
    origin           = default=0, profile=1, sanitizer=2
    resv             = 0
    length           = 文件内容字节数
    offset           = 文件数据起始绝对偏移
"""
import os
import sys
import struct

# ---------- 常量 ----------
HEAD_MAGIC = b"cann-rep"          # 8 字节
FILE_MAGIC = b"rep-file"          # 8 字节
VERSION = 0x00010000              # 1.0.0

HEAD_SIZE = 36                    # 8+4+4+4+8+8
FILEINFO_SIZE = 160               # 8+128+2+2+4+8+8

# type 枚举
TYPE_MAP = {
    "raw":  0,
    "csv":  1,
    "json": 2,
    "txt":  3,
    "ini":  4,
}
# origin 枚举
ORIGIN_MAP = {
    "default":   0,
    "profile":   1,
    "sanitizer": 2,
}

# ---------- 工具函数 ----------
def ext_to_type(filename: str) -> int:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "raw"
    return TYPE_MAP.get(ext, 0)

def name_to_origin(filename: str) -> int:
    low = filename.lower()
    if "sanitizer" in low:
        return ORIGIN_MAP["sanitizer"]
    if "prof" in low or "trace" in low:
        return ORIGIN_MAP["profile"]
    return ORIGIN_MAP["default"]

def pack_name(name: str) -> bytes:
    """文件名编码为 128 字节,仅取 basename,不足补 \\0,超出截断"""
    bn = os.path.basename(name).encode("utf-8")
    if len(bn) >= 128:
        bn = bn[:127] + b"\x00"     # 保留一个 \0 结尾
    else:
        bn = bn.ljust(128, b"\x00")
    return bn

# ---------- 主打包逻辑 ----------
def pack(data_dir: str, out_file: str):
    # 1. 收集文件(按文件名排序,保证可重现)
    if not os.path.isdir(data_dir):
        sys.exit(f"[ERROR] data dir not found: {data_dir}")
    files = sorted(
        f for f in os.listdir(data_dir)
        if os.path.isfile(os.path.join(data_dir, f))
    )
    if not files:
        sys.exit(f"[ERROR] no files in: {data_dir}")

    # 2. 读取每个文件内容,计算布局
    file_infos = []   # (name, type, origin, data)
    for fn in files:
        path = os.path.join(data_dir, fn)
        with open(path, "rb") as fp:
            data = fp.read()
        file_infos.append((fn, ext_to_type(fn), name_to_origin(fn), data))

    n = len(file_infos)
    head_size = HEAD_SIZE
    info_region_size = n * FILEINFO_SIZE
    data_start = head_size + info_region_size   # 数据区绝对偏移

    # 3. 计算每个文件数据区的绝对偏移
    cur_offset = data_start
    layout = []   # (name, type, origin, data, offset, length)
    for (fn, t, ori, data) in file_infos:
        length = len(data)
        layout.append((fn, t, ori, data, cur_offset, length))
        cur_offset += length
    rep_length = cur_offset   # 整个文件总长

    # 4. 打包 CannRepHead
    head = struct.pack(
        "<8sIIIIQ",          # 小端: 8s, uint32, uint32, uint32, uint32(高32), uint64
        HEAD_MAGIC,
        VERSION,
        n,                   # fileInfoCount
        head_size,           # fileLength = Head 自身长度
        rep_length,          # repLength
        data_start,          # offset
    )
    # 注意: fileLength 是 uint32_t, repLength/offset 是 uint64_t
    # struct 格式: 8s I I I Q Q (8+4+4+4+8+8 = 36)
    # 上面误写了 7 个格式符, 重新打包:
    head = struct.pack(
        "<8sII I Q Q",
        HEAD_MAGIC, VERSION, n, head_size, rep_length, data_start,
    )
    assert len(head) == HEAD_SIZE, f"head size mismatch: {len(head)} != {HEAD_SIZE}"

    # 5. 打包 CannRepFileInfo 数组
    info_blocks = []
    for (fn, t, ori, data, off, length) in layout:
        info = struct.pack(
            "<8s128sHHI Q Q",
            FILE_MAGIC,
            pack_name(fn),
            t,                  # type  uint16
            ori,                # origin uint16
            0,                  # resv  uint32
            length,             # length uint64
            off,                # offset uint64
        )
        assert len(info) == FILEINFO_SIZE, f"fileinfo size mismatch: {len(info)}"
        info_blocks.append(info)

    # 6. 拼接: Head + FileInfo[] + Data[]
    with open(out_file, "wb") as fp:
        fp.write(head)
        for b in info_blocks:
            fp.write(b)
        for (fn, t, ori, data, off, length) in layout:
            fp.write(data)

    # 7. 打印汇总
    print(f"[OK] packed {n} files -> {out_file}")
    print(f"     Head size        : {HEAD_SIZE}")
    print(f"     FileInfo count   : {n} (each {FILEINFO_SIZE} bytes, region {info_region_size})")
    print(f"     Data start offset: 0x{data_start:x} ({data_start})")
    print(f"     Total rep length : {rep_length} bytes")
    print(f"     {'File':<32} {'type':>4} {'origin':>9} {'offset':>10} {'length':>8}")
    for (fn, t, ori, data, off, length) in layout:
        tname = [k for k, v in TYPE_MAP.items() if v == t][0]
        oname = [k for k, v in ORIGIN_MAP.items() if v == ori][0]
        print(f"     {fn:<32} {tname:>4} {oname:>9} {off:>10} {length:>8}")

# ---------- 入口 ----------
if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <data_dir> <out.rep>")
        sys.exit(1)
    pack(sys.argv[1], sys.argv[2])
