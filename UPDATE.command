#!/bin/bash
# Mac/Linux updater — pulls latest source from GitHub, preserves vertex-key.json + .env

cd "$(dirname "$0")"

BRANCH="claude/hardcore-payne-74b124"
REPO="kei3k/3K-LDP"
ZIP="/tmp/3K-LDP-update.zip"
EXTRACT="/tmp/3K-LDP-update"
LOG="$(pwd)/update-log.txt"

# Mirror everything to log file so friend can send it back if fail
exec > >(tee -a "$LOG") 2>&1
echo "============================================"
echo "UPDATE LOG - $(date '+%Y-%m-%d %H:%M:%S')"
echo "Working dir: $(pwd)"
echo "Branch: $BRANCH"
echo "============================================"

echo ""
echo "========================================"
echo "  UPDATE TOOL TU GITHUB"
echo "========================================"
echo "Log: $LOG"
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
# macOS BSD unzip can't decode UTF-8 filenames (Vietnamese) → "Illegal byte sequence".
# Use ditto on macOS (native, UTF-8 safe), unzip with LANG override elsewhere.
if [[ "$OSTYPE" == "darwin"* ]] && command -v ditto &> /dev/null; then
  ditto -x -k "$ZIP" "$EXTRACT"
else
  LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 unzip -q "$ZIP" -d "$EXTRACT"
fi
if [ $? -ne 0 ]; then
  echo "[LOI] Giai nen that bai. Xem log: $LOG"
  read -p "An Enter de thoat..."
  exit 1
fi

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

# Fix file permissions so cp can overwrite (some users have read-only legacy files)
chmod -R u+w . 2>/dev/null

# Copy ALL files from SRC into current folder.
# Use rsync if available (most reliable, force overwrites), else fallback to cp+ditto+find.
echo "      Copying files..."
if command -v rsync &> /dev/null; then
  rsync -a --force --delete-after \
    --exclude='vertex-key.json' --exclude='.env' \
    --exclude='node_modules' --exclude='public/ffmpeg' \
    --exclude='.git' --exclude='.update_version' \
    "$SRC/" ./
elif command -v ditto &> /dev/null; then
  # macOS native — overwrites everything
  ditto "$SRC" ./
else
  # Pure cp fallback. Remove old src/ first so stale files don't linger.
  rm -rf src scripts public 2>/dev/null
  cp -Rfp "$SRC/." ./ 2>&1 | tail -3
fi

# Restore keys
[ -f /tmp/_vk.bak ] && cp -p /tmp/_vk.bak vertex-key.json
[ -f /tmp/_env.bak ] && cp -p /tmp/_env.bak .env
rm -f /tmp/_vk.bak /tmp/_env.bak

# ── Bake commit hash from GitHub API into src/version.js ─────────────
# No .git folder on customer machines, so vite can't run `git rev-parse`.
# Pull commit SHA from GitHub API and replace the 'dev' fallback in version.js.
echo "[3.5/6] Lay commit hash tu GitHub..."
COMMIT_SHA=$(curl -fsS --max-time 15 "https://api.github.com/repos/${REPO}/branches/${BRANCH}" 2>/dev/null | grep -oE '"sha":\s*"[a-f0-9]+"' | head -1 | grep -oE '[a-f0-9]+' | cut -c1-7)
COMMIT_SHA=${COMMIT_SHA:-dev}
BUILD_DT=$(date +%Y-%m-%d)
# macOS/BSD sed needs -i '' (empty backup); use a tmp file for portability
if [ -f src/version.js ]; then
  sed -i.bak "s/: 'dev';/: '${COMMIT_SHA}';/" src/version.js 2>/dev/null
  sed -i.bak "s/: new Date()\.toISOString()\.slice(0, 10);/: '${BUILD_DT}';/" src/version.js 2>/dev/null
  rm -f src/version.js.bak
fi
echo "      Da bake commit=${COMMIT_SHA} date=${BUILD_DT}"

# ── Verify the copy actually applied ──────────────────────────────
APPLIED_VER=$(grep -oE "APP_VERSION\s*=\s*['\"]([0-9]+\.[0-9]+\.[0-9]+)" src/version.js 2>/dev/null | grep -oE "[0-9]+\.[0-9]+\.[0-9]+")
echo "      Phien ban tren dia sau update: ${APPLIED_VER:-(khong doc duoc)} (${COMMIT_SHA})"

if [ ! -f "src/lib/templates/template2_raw.html" ]; then
  echo ""
  echo "[LOI NGHIEM TRONG] template2_raw.html bi mat. UPDATE that bai."
  echo "  -> Phuong an: tai zip moi tu anh Kei, giai nen DE LEN folder hien tai."
  read -p "An Enter de thoat..."
  exit 1
fi

chmod +x *.command *.sh 2>/dev/null

echo "[4/6] Cap nhat dependencies (npm install)..."
npm install
if [ $? -ne 0 ]; then
  echo "[CANH BAO] npm install co loi. Tool van co the chay duoc."
fi

echo "[5/6] Luu version moi..."
date "+%Y-%m-%d %H:%M" > .update_version

echo "[6/6] Xoa cache Vite + don dep..."
# Vite cache giu bundle CU - phai xoa de bundle moi co the lay tu source moi
rm -rf node_modules/.vite .vite 2>/dev/null
rm -rf "$EXTRACT" "$ZIP"

echo ""
echo "========================================"
echo "  UPDATE HOAN TAT!"
echo "========================================"
echo ""
echo "Bay gio chay START.command de mo tool voi phien ban moi."
echo ""
read -p "An Enter de thoat..."
