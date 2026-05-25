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

echo "[1/5] Tai source moi tu GitHub..."
if command -v curl &> /dev/null; then
  curl -L -s -o "$ZIP" "https://codeload.github.com/${REPO}/zip/refs/heads/${BRANCH}"
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

echo "[2/5] Giai nen tam..."
rm -rf "$EXTRACT"
mkdir -p "$EXTRACT"
unzip -q "$ZIP" -d "$EXTRACT"

# Find extracted subfolder
SRC=$(find "$EXTRACT" -maxdepth 1 -type d -name "3K-LDP-*" | head -1)
if [ -z "$SRC" ]; then
  echo "[LOI] Khong tim thay folder source sau khi giai nen."
  read -p "An Enter de thoat..."
  exit 1
fi

echo "[3/5] Ap dung file moi (giu nguyen vertex-key.json + .env)..."
# Use rsync if available (preserves perms + exclude), else cp -r with exclude
if command -v rsync &> /dev/null; then
  rsync -a --exclude="vertex-key.json" --exclude=".env" --exclude=".github" "$SRC/" ./
else
  # Fallback: cp -r then restore keys
  cp -p vertex-key.json /tmp/_vk.bak 2>/dev/null
  cp -p .env /tmp/_env.bak 2>/dev/null
  cp -R "$SRC/." ./
  cp -p /tmp/_vk.bak vertex-key.json 2>/dev/null
  cp -p /tmp/_env.bak .env 2>/dev/null
  rm -f /tmp/_vk.bak /tmp/_env.bak
fi

# Make sure shell scripts are executable
chmod +x *.command *.sh 2>/dev/null

echo "[4/5] Cap nhat dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "[CANH BAO] npm install loi nhung file da update. Thu chay lai sau."
fi

echo "[5/5] Don dep..."
rm -rf "$EXTRACT" "$ZIP"

echo ""
echo "========================================"
echo "  UPDATE HOAN TAT!"
echo "========================================"
echo ""
echo "Chay START.command de mo tool voi phien ban moi."
echo ""
read -p "An Enter de thoat..."
