#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ZetaCP Build Script
===================
Tu dong build 2 phien ban ZetaCP:
  - STANDARD : dung g++/python tren PATH cua he thong (nguoi dung cai rieng)
  - PORTABLE : dong goi san MinGW-w64 GCC ben trong, path duoc cau hinh truoc

Cach dung:
    python build.py              # build ca 2
    python build.py standard     # chi build standard
    python build.py portable     # chi build portable
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path
from datetime import datetime

# Force UTF-8 output on Windows so unicode log symbols work
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# ===========================================================================
#  ╔═══════════════════════════════════════════════════╗
#  ║              CAU HINH — CHINH O DAY               ║
#  ╚═══════════════════════════════════════════════════╝
# ===========================================================================

# Thu muc goc project (noi co package.json) — khong can chinh
PROJECT_ROOT = Path(__file__).parent.resolve()

# Ten file .exe duoc tao ra
EXE_NAME = "ZetaCP.exe"

# ---------------------------------------------------------------------------
#  PORTABLE GCC (MinGW-w64)
# ---------------------------------------------------------------------------

# Duong dan toi folder MinGW-w64 ban da chuan bi san.
# Toan bo folder nay se duoc copy vao canh .exe trong ban portable.
# De trong ("") neu chua co hoac khong muon bundle GCC.
PORTABLE_GCC_SRC = r"E:\w64devkit"
# Vi du: PORTABLE_GCC_SRC = r"C:\tools\mingw64"
# Vi du: PORTABLE_GCC_SRC = r"D:\build-tools\mingw-w64-x86_64-13.2"

# Ten folder sau khi copy vao output (nam canh ZetaCP.exe)
PORTABLE_GCC_DEST_NAME = "w64devkit"

# Duong dan relative toi g++.exe ben trong PORTABLE_GCC_DEST_NAME
# App se duoc patch de dung: <exe_dir>/<DEST_NAME>/<BIN> luc runtime
PORTABLE_GCC_BIN_RELATIVE = r"bin\g++.exe"
# Ket qua trong app se la: "mingw64/bin/g++.exe"

# ---------------------------------------------------------------------------
#  PORTABLE PYTHON
# ---------------------------------------------------------------------------

# Python thuong duoc bundle san de chay pylsp/LSP.
# Dien duong dan neu ban co embedded Python rieng.
# De trong ("") neu Python da co san trong build output.
PORTABLE_PYTHON_SRC = r"C:\ZetaCP2\src-tauri\target\debug\python-3.12.7"
# Vi du: PORTABLE_PYTHON_SRC = r"C:\tools\python-3.12-embed-amd64"

# Ten folder sau khi copy vao output
PORTABLE_PYTHON_DEST_NAME = "python-3.12.7"

# Duong dan relative toi python.exe ben trong PORTABLE_PYTHON_DEST_NAME
PORTABLE_PYTHON_BIN_RELATIVE = r"python.exe"
# Ket qua trong app se la: "python/python.exe"

# ---------------------------------------------------------------------------
#  OFFLINE DOCUMENTATION
# ---------------------------------------------------------------------------

# Folder cp-algorithms da build san bang mkdocs.
# Se duoc copy vao canh .exe trong ca 2 ban build.
# De trong ("") de bo qua.
CP_ALGORITHMS_SRC = r"C:\ZetaCP2\src-tauri\target\debug\cp-algorithms"
# Vi du: CP_ALGORITHMS_SRC = r"C:\ZetaCP2\src-tauri\target\debug\cp-algorithms"

# Folder cppreference da extract san.
CPPREFERENCE_SRC = r"C:\ZetaCP2\src-tauri\target\debug\cppreference"
# Vi du: CPPREFERENCE_SRC = r"C:\ZetaCP2\src-tauri\target\debug\cppreference"

# ---------------------------------------------------------------------------
#  OUTPUT DIRECTORIES
# ---------------------------------------------------------------------------

# Thu muc goc chua ket qua build cuoi cung
OUT_ROOT         = PROJECT_ROOT / "dist-release"
OUT_STANDARD_DIR = OUT_ROOT / "standard"  # Ban thuong (g++ tu cai)
OUT_PORTABLE_DIR = OUT_ROOT / "portable"  # Ban co san GCC

# ---------------------------------------------------------------------------
#  PATCH FILE — thay doi default compiler paths cho ban portable
# ---------------------------------------------------------------------------
# Script se tam thoi sua file Rust nay truoc khi build portable
# de thay doi cac gia tri mac dinh compiler path trong app,
# roi tu dong khoi phuc lai sau khi build xong (du thanh cong hay that bai).

PATCH_FILE = PROJECT_ROOT / "src-tauri" / "src" / "commands" / "settings.rs"

# Cac cap (chuoi goc, chuoi thay the cho ban portable).
# Chuoi thay the su dung dau / thay \ (Rust xu ly duoc tren Windows).
# App se tu giai quyet duong dan relative voi exe dir luc runtime.
PATCH_RULES = [
    (
        'get_setting(pool, "compiler.gpp_path", "g++").await',
        'get_setting(pool, "compiler.gpp_path", "w64devkit/bin/g++.exe").await',
    ),
    (
        'get_setting(pool, "compiler.python_path", "python").await',
        'get_setting(pool, "compiler.python_path", "python-3.12.7/python.exe").await',
    ),
]

# ---------------------------------------------------------------------------
#  BUILD CONFIGURATION
# ---------------------------------------------------------------------------

# Lenh npm de chay Tauri build
NPM_BUILD_CMD = ["npm", "run", "tauri", "build"]

# Thu muc Tauri chua .exe sau khi cargo build xong
TAURI_RELEASE_EXE_DIR = PROJECT_ROOT / "src-tauri" / "target" / "release"

# ===========================================================================
#  HELPERS — khong can chinh
# ===========================================================================

RESET  = "\033[0m"
BOLD   = "\033[1m"
GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
CYAN   = "\033[96m"
GRAY   = "\033[90m"
SEP    = "-" * 62


def log(msg: str, color: str = RESET):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"{GRAY}[{ts}]{RESET} {color}{msg}{RESET}")


def log_step(msg: str):
    print(f"\n{BOLD}{CYAN}{SEP}{RESET}")
    print(f"{BOLD}{CYAN}  {msg}{RESET}")
    print(f"{BOLD}{CYAN}{SEP}{RESET}")


def log_ok(msg: str):   log(f"[OK] {msg}", GREEN)
def log_warn(msg: str): log(f"[!!] {msg}", YELLOW)
def log_err(msg: str):  log(f"[XX] {msg}", RED)


def run_cmd(cmd: list, cwd: Path = None, label: str = ""):
    """Chay lenh shell, in output truc tiep. Raise RuntimeError neu loi."""
    cwd = cwd or PROJECT_ROOT
    log("$ " + " ".join(str(c) for c in cmd), GRAY)
    # shell=True on Windows so npm/node can be found via PATH
    result = subprocess.run(cmd, cwd=str(cwd), shell=(sys.platform == "win32"))
    if result.returncode != 0:
        raise RuntimeError(
            f"{label or ' '.join(cmd)} that bai voi exit code {result.returncode}"
        )


def patch_file(path: Path, rules: list) -> str:
    """
    Thay the cac chuoi trong file theo rules.
    Tra ve noi dung goc de khoi phuc sau.
    """
    original = path.read_text(encoding="utf-8")
    patched = original
    for old, new in rules:
        if old not in patched:
            log_warn(f"  Khong tim thay chuoi: {old!r}")
        patched = patched.replace(old, new)
    path.write_text(patched, encoding="utf-8")
    log_ok(f"  Patch thanh cong: {path.name}")
    return original


def restore_file(path: Path, original_content: str):
    """Khoi phuc file ve noi dung goc."""
    path.write_text(original_content, encoding="utf-8")
    log_ok(f"  Khoi phuc: {path.name}")


def copy_resource(src, dest_parent: Path, dest_name: str):
    """Copy thu muc hoac file src vao dest_parent/dest_name."""
    src = Path(src)
    dest = dest_parent / dest_name
    if not src.exists():
        log_warn(f"  Bo qua (khong tim thay source): {src}")
        return
    if dest.exists():
        shutil.rmtree(dest) if dest.is_dir() else dest.unlink()
    if src.is_dir():
        shutil.copytree(src, dest)
        log_ok(f"  Copy folder: {src.name} -> {dest_parent.name}/{dest_name}")
    else:
        shutil.copy2(src, dest)
        log_ok(f"  Copy file: {src.name} -> {dest_parent.name}/{dest_name}")


def collect_output(output_dir: Path):
    """
    Gom cac file can thiet tu Tauri release dir sang output_dir.
    Bao gom .exe va cac .dll di kem.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    exe_src = TAURI_RELEASE_EXE_DIR / EXE_NAME
    if not exe_src.exists():
        raise FileNotFoundError(
            f"Khong tim thay {EXE_NAME} tai:\n  {TAURI_RELEASE_EXE_DIR}\n"
            "Build Tauri co the da that bai."
        )
    shutil.copy2(exe_src, output_dir / EXE_NAME)
    log_ok(f"  Copy {EXE_NAME} -> {output_dir.name}/")
    for dll in TAURI_RELEASE_EXE_DIR.glob("*.dll"):
        shutil.copy2(dll, output_dir / dll.name)
        log_ok(f"  Copy {dll.name}")


def copy_docs(output_dir: Path):
    """Copy thu muc tai lieu offline vao output (neu da cau hinh)."""
    if CP_ALGORITHMS_SRC:
        copy_resource(CP_ALGORITHMS_SRC, output_dir, "cp-algorithms")
    else:
        log_warn("  CP_ALGORITHMS_SRC chua cau hinh -- bo qua.")
    if CPPREFERENCE_SRC:
        copy_resource(CPPREFERENCE_SRC, output_dir, "cppreference")
    else:
        log_warn("  CPPREFERENCE_SRC chua cau hinh -- bo qua.")


# ===========================================================================
#  BUILD STANDARD
# ===========================================================================

def build_standard():
    log_step("BUILD STANDARD  (g++ / python lay tu PATH he thong)")

    run_cmd(NPM_BUILD_CMD, cwd=PROJECT_ROOT, label="tauri build [standard]")

    log_step("Thu thap output [standard]")
    if OUT_STANDARD_DIR.exists():
        shutil.rmtree(OUT_STANDARD_DIR)
    collect_output(OUT_STANDARD_DIR)
    copy_docs(OUT_STANDARD_DIR)

    log_ok(f"Build Standard hoan tat -> {OUT_STANDARD_DIR}")


# ===========================================================================
#  BUILD PORTABLE
# ===========================================================================

def build_portable():
    log_step("BUILD PORTABLE  (GCC duoc dong goi san, path cau hinh truoc trong app)")

    # Kiem tra GCC source
    if not PORTABLE_GCC_SRC:
        log_warn("PORTABLE_GCC_SRC chua duoc dien! Ban portable se khong co GCC di kem.")
    elif not Path(PORTABLE_GCC_SRC).exists():
        log_err(f"Khong tim thay GCC tai: {PORTABLE_GCC_SRC}")
        log_err("Hay kiem tra lai PORTABLE_GCC_SRC. Bo qua ban portable.")
        return

    # Backup va patch source
    log("Patching Rust source cho ban portable...")
    original_content = patch_file(PATCH_FILE, PATCH_RULES)

    try:
        run_cmd(NPM_BUILD_CMD, cwd=PROJECT_ROOT, label="tauri build [portable]")
    finally:
        # LUON khoi phuc source du thanh cong hay that bai
        log("Khoi phuc Rust source...")
        restore_file(PATCH_FILE, original_content)

    log_step("Thu thap output [portable]")
    if OUT_PORTABLE_DIR.exists():
        shutil.rmtree(OUT_PORTABLE_DIR)
    collect_output(OUT_PORTABLE_DIR)

    # Bundle GCC
    if PORTABLE_GCC_SRC:
        log("Copy MinGW-w64 GCC...")
        copy_resource(PORTABLE_GCC_SRC, OUT_PORTABLE_DIR, PORTABLE_GCC_DEST_NAME)

    # Bundle Python
    if PORTABLE_PYTHON_SRC:
        log("Copy Python...")
        copy_resource(PORTABLE_PYTHON_SRC, OUT_PORTABLE_DIR, PORTABLE_PYTHON_DEST_NAME)
    else:
        log_warn("PORTABLE_PYTHON_SRC chua cau hinh \u2014 bo qua bundle Python.")

    copy_docs(OUT_PORTABLE_DIR)
    log_ok(f"Build Portable hoan tat -> {OUT_PORTABLE_DIR}")


# ===========================================================================
#  MAIN
# ===========================================================================

def print_config():
    col_w = 18
    def row(k, v): return f"  {'  ' + k + ':':>{col_w}}  {v}"
    print(f"""
{BOLD}ZetaCP Build Script{RESET}
{CYAN}{SEP}{RESET}
{row('Project root', PROJECT_ROOT)}
{row('Output root', OUT_ROOT)}
{row('Standard dir', OUT_STANDARD_DIR)}
{row('Portable dir', OUT_PORTABLE_DIR)}
{row('Patch file', PATCH_FILE.relative_to(PROJECT_ROOT))}
{CYAN}{SEP}
{row('Portable GCC', PORTABLE_GCC_SRC or YELLOW + '(chua cau hinh)' + RESET)}
{row('Portable Python', PORTABLE_PYTHON_SRC or YELLOW + '(chua cau hinh)' + RESET)}
{row('CP-Algorithms', CP_ALGORITHMS_SRC or YELLOW + '(chua cau hinh)' + RESET)}
{row('CPPReference', CPPREFERENCE_SRC or YELLOW + '(chua cau hinh)' + RESET)}
{CYAN}{SEP}
""")


if __name__ == "__main__":
    print_config()

    mode = (sys.argv[1].lower() if len(sys.argv) > 1 else "all")
    if mode not in ("all", "standard", "portable"):
        print("Usage: python build.py [all|standard|portable]")
        sys.exit(1)

    start = datetime.now()
    try:
        if mode in ("all", "standard"):
            build_standard()
        if mode in ("all", "portable"):
            build_portable()
    except Exception as exc:
        log_err(str(exc))
        sys.exit(1)

    elapsed = (datetime.now() - start).seconds
    print(f"\n{BOLD}{GREEN}{SEP}")
    print(f"  Tat ca build hoan tat trong {elapsed}s")
    print(f"  Output: {OUT_ROOT}")
    print(f"{SEP}{RESET}\n")
