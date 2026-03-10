#!/bin/bash

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   LDP Generator - Landing Page Clone     ║"
echo "║   Clone & Localize Landing Pages with AI ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js chưa được cài đặt!"
    echo ""
    echo "Cài đặt Node.js:"
    echo "  macOS:   brew install node"
    echo "  Ubuntu:  sudo apt install nodejs npm"
    echo "  Hoặc:    https://nodejs.org/"
    echo ""
    exit 1
fi

NODE_VER=$(node -v)
echo "[OK] Node.js $NODE_VER"

# Install dependencies
if [ ! -d "node_modules" ]; then
    echo ""
    echo "[1/2] Đang cài đặt thư viện... (lần đầu mất 1-2 phút)"
    npm install
    if [ $? -ne 0 ]; then
        echo "[ERROR] Cài đặt thất bại! Kiểm tra kết nối mạng."
        exit 1
    fi
    echo "[OK] Cài đặt thành công!"
else
    echo "[OK] Thư viện đã có sẵn"
fi

echo ""
echo "[2/2] Đang khởi chạy..."
echo ""
echo "================================================"
echo " Mở trình duyệt tại: http://localhost:5173"
echo " Nhấn Ctrl+C để dừng server"
echo "================================================"
echo ""

# Start dev server
npm run dev
