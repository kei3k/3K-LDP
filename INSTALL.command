#!/bin/bash
# Mac/Linux installer — double-click on Mac, or `bash INSTALL.command` on Linux

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  CAI DAT TOOL AI VIDEO (1 lan duy nhat)"
echo "========================================"
echo ""

if ! command -v node &> /dev/null; then
  echo "[LOI] Chua co Node.js tren may."
  echo ""
  echo "Vui long cai Node.js v18+ tu: https://nodejs.org/"
  echo "Sau do chay lai INSTALL.command nay."
  echo ""
  read -p "An Enter de thoat..."
  exit 1
fi

echo "[OK] Node.js da co: $(node --version)"
echo ""
echo "Dang cai dat dependencies (mat khoang 2-3 phut, vui long cho)..."
echo ""

npm install
if [ $? -ne 0 ]; then
  echo ""
  echo "[LOI] npm install that bai. Kiem tra ket noi mang va thu lai."
  read -p "An Enter de thoat..."
  exit 1
fi

echo ""
echo "========================================"
echo "  CAI DAT HOAN TAT!"
echo "========================================"
echo ""
echo "Tu lan sau, chi can double-click START.command de chay tool."
echo ""
read -p "An Enter de thoat..."
