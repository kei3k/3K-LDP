#!/bin/bash
# Mac/Linux launcher — double-click on Mac, or `bash START.command` on Linux

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  3K-LDP AI VIDEO TOOL"
echo "========================================"
echo ""

if [ ! -d "node_modules" ]; then
  echo "[LOI] Chua cai dat. Hay chay INSTALL.command truoc."
  echo ""
  read -p "An Enter de thoat..."
  exit 1
fi

echo "Mo browser sau 3 giay..."
sleep 3

# Detect OS — Mac uses 'open', Linux 'xdg-open'
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:5173
else
  xdg-open http://localhost:5173 2>/dev/null
fi

echo ""
echo "Tool dang chay. KHONG dong cua so nay khi su dung."
echo "Khi muon thoat, an Ctrl+C trong cua so nay roi dong."
echo "----------------------------------------"

npm run dev
