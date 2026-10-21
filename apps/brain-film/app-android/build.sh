#!/usr/bin/env bash
# 脑洞放映厅 · 安卓 APK 一键构建(不需要 gradle,只用 Android SDK 自带工具)
set -e
# 中文路径会让 aapt2 找不到文件 → 自动搬到纯英文临时目录里构建,再把 APK 拷回来
if echo "$0" | grep -P '[^\x00-\x7F]' >/dev/null 2>&1; then
  TMPW="$LOCALAPPDATA/Temp/bhapp-build"; rm -rf "$TMPW"; mkdir -p "$TMPW"
  cp -r "$(cd "$(dirname "$0")" && pwd)/." "$TMPW/"
  bash "$TMPW/build.sh" "$@"
  STATUS=$?
  if [ -f "$TMPW/脑洞放映厅.apk" ]; then
    cp "$TMPW/脑洞放映厅.apk" "$(cd "$(dirname "$0")" && pwd)/脑洞放映厅.apk"
    echo "APK 已拷回:$(cd "$(dirname "$0")" && pwd)/脑洞放映厅.apk"
  fi
  exit $STATUS
fi
SDK="${ANDROID_SDK:-E:/android-sdk}"
BT="$SDK/build-tools/${BT_VER:-35.0.0}"    # 34 的 d8 在匿名内部类上会崩,用 35
PLATFORM="$SDK/platforms/android-34/android.jar"
APP="$(cd "$(dirname "$0")" && pwd)"
if command -v cygpath >/dev/null 2>&1; then APP="$(cygpath -m "$APP")"; fi   # 转成 Windows 路径给 SDK 工具用
SDK="$(cygpath -m "$SDK" 2>/dev/null || echo "$SDK")"
PLATFORM="$(cygpath -m "$PLATFORM" 2>/dev/null || echo "$PLATFORM")"
OUT="$APP/build"
export JAVA_HOME="${JAVA_HOME:-E:/java/jdk17}"   # d8 在 JDK 25 上会崩,必须 17
export PATH="$JAVA_HOME/bin:$PATH"

echo "[1/6] 清理 + 编译资源"
rm -rf "$OUT"; mkdir -p "$OUT/gen" "$OUT/classes" "$OUT/dex"
"$BT/aapt2.exe" compile --dir "$APP/res" -o "$OUT/res.zip"

echo "[2/6] 链接资源 + 打入 assets(网页)"
"$BT/aapt2.exe" link -o "$OUT/base.apk" -I "$PLATFORM" \
  --manifest "$APP/AndroidManifest.xml" -R "$OUT/res.zip" \
  --java "$OUT/gen" --min-sdk-version 24 --target-sdk-version 34 \
  -A "$APP/assets" --auto-add-overlay

echo "[3/6] 编译 Java"
find "$APP/src" "$OUT/gen" -name '*.java' > "$OUT/sources.txt"
javac -encoding UTF-8 -source 11 -target 11 -nowarn \
  -classpath "$PLATFORM" -d "$OUT/classes" @"$OUT/sources.txt"

echo "[4/6] 转成 dex 并塞进 APK"
find "$OUT/classes" -name '*.class' > "$OUT/classes.txt"
"$BT/d8.bat" --lib "$PLATFORM" --min-api 24 --output "$OUT/dex" @"$OUT/classes.txt"
python - "$OUT/base.apk" "$OUT/dex/classes.dex" <<'PY'
import sys, zipfile
apk, dex = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(apk, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(dex, 'classes.dex')
print('   classes.dex 已写入')
PY

echo "[5/6] 对齐 + 签名"
"$BT/zipalign.exe" -f 4 "$OUT/base.apk" "$OUT/aligned.apk"
if [ ! -f "$OUT/bh.keystore" ]; then
  keytool -genkeypair -keystore "$OUT/bh.keystore" -alias bh -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass android -keypass android \
    -dname "CN=BhFilm, O=Classroom, C=CN" > /dev/null 2>&1
fi
"$BT/apksigner.bat" sign --ks "$OUT/bh.keystore" --ks-pass pass:android --key-pass pass:android \
  --out "$APP/脑洞放映厅.apk" "$OUT/aligned.apk"

echo "[6/6] 校验"
"$BT/apksigner.bat" verify "$APP/脑洞放映厅.apk" && echo "   ✅ 签名有效"
"$BT/aapt2.exe" dump badging "$APP/脑洞放映厅.apk" | head -4
ls -lh "$APP/脑洞放映厅.apk" | awk '{print "   APK 大小: "$5}'
echo "完成 → $APP/脑洞放映厅.apk"
