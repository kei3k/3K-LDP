#!/bin/bash
# Mac/Linux updater — pulls latest source from GitHub, preserves vertex-key.json + .env

cd "$(dirname "$0")"

BRANCH="claude/hardcore-payne-74b124"
REPO="kei3k/3K-LDP"
ZIP="/tmp/3K-LDP-update.zip"
EXTRACT="/tmp/3K-LDP-update"

echo ""
echo "========================================"
echo "  UPDATE TOOL TU GITHUB"
echo "========================================"
echo ""

echo "[0/6] Dung Vite dev server cu (neu dang chay)..."
pkill -f "vite" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2

echo "[1/6] Tai source moi tu GitHub (~1MB)..."
rm -f "$ZIP"
if command -v curl &> /dev/null; then
  curl -L -fsS -o "$ZIP" "https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}"
elif command -v wget &> /dev/null; then
  wget -q -O "$ZIP" "https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}"
else
  echo "[LOI] Khong tim thay curl hoac wget."
  read -p "An Enter de thoat..."
  exit 1
fi

if [ ! -s "$ZIP" ]; then
  echo "[LOI] Tai zip that bai."
  read -p "An Enter de thoat..."
  exit 1
fi
echo "      Da tai: $(stat -f %z "$ZIP" 2>/dev/null || stat -c %s "$ZIP") bytes"

echo "[2/6] Giai nen tam..."
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -q "$ZIP" -d "$EXTRACT"

SRC=$(find "$EXTRACT" -maxdepth 1 -type d -name "3K-LDP-*" | head -1)
if [ -z "$SRC" ]; then
  echo "[LOI] Khong tim thay folder source sau khi giai nen."
  read -p "An Enter de thoat..."
  exit 1
fi
echo "      Source: $SRC"

echo "[3/6] Ap dung file moi (giu nguyen vertex-key.json + .env)..."
# Backup keys
[ -f vertex-key.json ] && cp -p vertex-key.json /tmp/_vk.bak
[ -f .env ] && cp -p .env /tmp/_env.bak

# Strip node_modules + public/ffmpeg from source before copy (large + regenerable)
rm -rf "$SRC/node_modules" "$SRC/public/ffmpeg" "$SRC/.github" 2>/dev/null

# Copy ALL files from SRC into current folder (-R recursive, -p preserve, -v verbose)
echo "      Copying files..."
cp -Rp "$SRC/." ./ 2>&1 | tail -3

# Restore keys
[ -f /tmp/_vk.bak ] && cp -p /tmp/_vk.bak vertex-key.json
[ -f /tmp/_env.bak ] && cp -p /tmp/_env.bak .env
rm -f /tmp/_vk.bak /tmp/_env.bak

# Verify critical file exists
if [ ! -f "src/lib/templates/template2_raw.html" ]; then
  echo "[CANH BAO] template2_raw.html VAN BI THIEU! Copy that bai."
  echo "          Vui long lien he anh Kei."
fi

chmod +x *.command *.sh 2>/dev/null

echo "[4/6] Cap nhat dependencies (npm install)..."
npm install
if [ $? -ne 0 ]; then
  echo "[CANH BAO] npm install co loi. Tool van co the chay duoc."
fi

echo "[5/6] Luu version moi..."
date "+%Y-%m-%d %H:%M" > .update_version

echo "[6/6] Don dep..."
rm -rf "$EXTRACT" "$ZIP"

echo ""
echo "========================================"
echo "  UPDATE HOAN TAT!"
echo "========================================"
echo ""
echo "Bay gio chay START.command de mo tool voi phien ban moi."
echo ""
read -p "An Enter de thoat..."
