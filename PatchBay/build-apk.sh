#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
: "${ANDROID_HOME:?Set ANDROID_HOME to the Android SDK path}"
if [[ "${1:-}" != "--unsigned" ]]; then
  : "${PATCH_BAY_KEYSTORE:?Set PATCH_BAY_KEYSTORE to your signing key path}"
  : "${PATCH_BAY_KEY_ALIAS:?Set PATCH_BAY_KEY_ALIAS to your signing key alias}"
fi
tools="${ANDROID_BUILD_TOOLS:-$ANDROID_HOME/build-tools/35.0.0}"
platform="${ANDROID_PLATFORM_JAR:-$ANDROID_HOME/platforms/android-35/android.jar}"
mkdir -p build/classes build/dex
"$tools/aapt2" compile --dir res -o build/resources.zip
"$tools/aapt2" link -I "$platform" --manifest AndroidManifest.xml -A assets -o build/unsigned.apk build/resources.zip
if [[ -n "${ECJ_JAR:-}" ]]; then
  java -jar "$ECJ_JAR" -proc:none -source 8 -target 8 -classpath "$platform" -d build/classes java/*.java
else
  javac -source 8 -target 8 -classpath "$platform" -d build/classes java/*.java
fi
jar_files=()
while IFS= read -r -d '' class_file; do jar_files+=("$class_file"); done < <(find build/classes -name '*.class' -print0)
"$tools/d8" --release --min-api 29 --lib "$platform" --output build/dex "${jar_files[@]}"
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$tools/zipalign" -f 4 build/unsigned.apk build/aligned.apk
if [[ "${1:-}" == "--unsigned" ]]; then
  cp build/aligned.apk build/PatchBay-0.1.2-unsigned.apk
  exit 0
fi
signing_options=()
if [[ -n "${PATCH_BAY_KEY_PASS:-}" ]]; then signing_options+=(--ks-pass env:PATCH_BAY_KEY_PASS); fi
"$tools/apksigner" sign --ks "$PATCH_BAY_KEYSTORE" --ks-key-alias "$PATCH_BAY_KEY_ALIAS" "${signing_options[@]}" --out build/PatchBay-0.1.2.apk build/aligned.apk
"$tools/apksigner" verify --verbose build/PatchBay-0.1.2.apk
