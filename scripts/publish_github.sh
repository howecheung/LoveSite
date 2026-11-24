#!/usr/bin/env bash
# LoveSite 发布流水线：从运行工作区构建公开仓库副本（脱敏）并推送 GitHub
# 用法：bash publish_github.sh [--push]
set -euo pipefail
SRC=/vol1/@apphome/hermes-webui/data/workspace/ai-couple
OUT=/vol1/@apphome/hermes-webui/data/workspace/LoveSite
ENV_FILE=/vol1/@apphome/hermes-webui/data/.env
TOKEN="$(grep -m1 -E '^(GITHUB_TOKEN|GH_TOKEN)=' "$ENV_FILE" | cut -d= -f2- | tr -d '"'"'"' ')"

echo "== 1. 同步干净副本 =="
mkdir -p "$OUT"
rsync -a --delete --exclude '.env*' --exclude __pycache__ --exclude '*.pyc' \
  --exclude node_modules --exclude dist --exclude pb_data --exclude pb_public \
  --exclude shots --exclude pocketbase --exclude pb.log --exclude CREDENTIALS.txt \
  --exclude backup.py --exclude deploy.sh --exclude build.sh --exclude buildonly.sh \
  "$SRC/app" "$SRC/pb_migrations" "$SRC/tests" "$OUT/"
rm -rf "$OUT/pb_hooks"
mkdir -p "$OUT/scripts"
rsync -a --delete --exclude publish_github.sh --exclude __pycache__ --exclude "*.pyc" "$SRC/scripts/" "$OUT/scripts/"
rm -f "$OUT/scripts/publish_github.sh"
cp "$SRC/CHANGELOG.md" "$SRC/README_public.md" "$SRC/LICENSE" "$SRC/THIRD_PARTY_LICENSES.md" "$OUT/" 2>/dev/null || true

echo "== 2. 脱敏 =="
sed -i "s/12345678/<BOY_PW>/g; s/87654321/<GIRL_PW>/g" "$OUT"/tests/*.py "$OUT"/scripts/schema/*.py 2>/dev/null || true
python3 - "$OUT" <<'PYEOF2'
import sys, pathlib, re
out = pathlib.Path(sys.argv[1])
for f in list((out / "tests").glob("*.py")) + list((out / "scripts" / "schema").glob("*.py")):
    txt = f.read_text()
    txt = txt.replace("password:'123'", "password:E2E_PW").replace("'123'", "'<TEST_PW>'")
    f.write_text(txt)
PYEOF2
if grep -rEn "password:.123" "$OUT"/tests "$OUT"/scripts; then echo "!! 测试口令残留，拒推"; exit 1; fi
if grep -rn "123" "$OUT"/tests/*.py | grep -vE "TEST_PW|E2E_PW|len|slice|1234" | grep -E "'123'|\\"123\\"" ; then echo "!! 口令字面量残留，拒推"; exit 1; fi
echo "测试口令已净化"
sed -i "/CREDENTIALS.txt/d; /局域网 /d; /远程 https/d" "$OUT"/CHANGELOG.md 2>/dev/null || true
SCANPAT="12345678\\|87654321\\|aicouple2026\\|Couple2026\\|tail5816f3"
KEYVAL=$(grep -h "^VITE_AMAP" "$SRC/app/.env.local" 2>/dev/null | cut -d= -f2 | tr '\n' '\\' | sed 's/.$//')
[ -n "$KEYVAL" ] && SCANPAT="$SCANPAT\\|$KEYVAL"
grep -rn "$SCANPAT" "$OUT" --include="*.py" --include="*.md" --include="*.ts*" && { echo "!! 仍有敏感残留"; exit 1; } || echo "敏感扫描通过"


echo "== 2.5 凭据引用改环境变量（公开仓可独立运行） =="
python3 - "$OUT" <<'PYEOF'
import re, glob, os, sys
out = sys.argv[1]
for f in glob.glob(out + "/scripts/**/*.py", recursive=True) + glob.glob(out + "/tests/*.py"):
    s = open(f).read()
    s = re.sub(r'txt = open\([^)]*CREDENTIALS\.txt"[^)]*\)\.read\(\)',
               'import os\ntxt = os.environ.get("PB_CREDENTIALS", "")  # 超管邮箱与口令两行，自行注入', s)
    s = re.sub(r'W = "/vol1/[^"]+"', 'W = os.environ.get("PBSITE_DIR", ".")', s)
    s = re.sub(r'"/vol1/@apphome/hermes-webui/data/workspace/ai-couple"', '"."', s)
    s = re.sub(r'OUT = "/vol1/[^"]+"', 'OUT = os.environ.get("PB_OUT_DIR", ".")', s)
    s = re.sub(r'src = open\("[^"]*gk_v2\.py"\)\.read\(\)', 'src = open("gk_v2.py").read()', s)
    open(f, "w").write(s)
PYEOF
if grep -rIn "CREDENTIALS.txt\|/vol1/" "$OUT" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude=README.md --exclude=.gitignore; then echo "!! 本机路径/凭据文件引用残留"; exit 1; else echo "路径重写完成"; fi

echo "== 3. 公开文档 =="
cp "$OUT/README_public.md" "$OUT/README.md" && rm -f "$OUT/README_public.md"

echo "== 4. git 提交推送 =="
cd "$OUT"
[ -d .git ] || git init -q -b main
cat > .gitignore <<'EOF'
node_modules/
dist/
pb_data/
pb_public/
pb.log
CREDENTIALS.txt
*.env
EOF
git add -A
git -c user.name=howecheung -c user.email=howecheung@users.noreply.github.com commit -qm "LoveSite v57: Animal-Crossing-style couple site (React + PocketBase)" || true
if [ "${1:-}" = "--push" ]; then
  OWNER="$(curl -sf -H "Authorization: Bearer $TOKEN" https://api.github.com/user | grep -o '"login": *"[^"]*"' | cut -d'"' -f4)"
  echo "以 $OWNER 身份发布"
  curl -sf -X POST -H "Authorization: Bearer $TOKEN" https://api.github.com/user/repos \
    -d "{\"name\":\"LoveSite\",\"description\":\"Self-hosted couple site: React + PocketBase + animal-island-ui\",\"private\":false,\"has_issues\":true}" >/dev/null || echo "(仓库可能已存在)"
  git remote remove origin 2>/dev/null || true
  git remote add origin "https://x-access-token:${TOKEN}@github.com/${OWNER}/LoveSite.git"
  git push -q -f -u origin main
  echo "== 推送完成 =="
fi
