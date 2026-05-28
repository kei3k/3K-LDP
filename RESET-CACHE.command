#!/bin/bash
# Quick fix: clear vite cache + restart. Use khi:
#  - Update xong nhung badge van show version cu
#  - Tool show "dev" hoac version cu trong khi anh Kei bao da push moi
# Chay xong roi mo START.command de chay lai.

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  RESET CACHE - Quick Fix"
echo "========================================"
echo ""

echo "[1/3] Dung Vite dev server cu (neu dang chay)..."
pkill -f "vite" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
pkill -f "node.*5173" 2>/dev/null
sleep 2

echo "[2/3] Xoa cache Vite (bundle CU bi giu o day)..."
rm -rf node_modules/.vite .vite
echo "      Done."

echo "[3/3] Xoa cache browser (Chrome/Safari) cho localhost..."
# Chi co the in hint - khong tu xoa duoc
echo ""
echo "========================================"
echo "  RESET XONG"
echo "========================================"
echo ""
echo "Bay gio:"
echo "  1. Double-click START.command de chay lai tool"
echo "  2. Trong browser, bam Cmd+Shift+R de hard refresh"
echo "  3. Kiem tra badge o goc phai - phai hien version moi"
echo ""
read -p "An Enter de thoat..."
