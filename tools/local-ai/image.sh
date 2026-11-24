#!/usr/bin/env bash
# Free local image generation (no API, no cost): stable-diffusion.cpp + Z-Image Turbo (Apache-2.0) on CPU.
# Usage: bash tools/local-ai/image.sh "prompt" out.png [width] [height] [seed]
# First run builds the engine and downloads ~6.7 GB of weights into /home/user/local-ai (outside the repo).
set -euo pipefail
ROOT="${LOCAL_AI_DIR:-/home/user/local-ai}"; M="$ROOT/models"; BIN="$ROOT/sdcpp/build/bin/sd-cli"
mkdir -p "$M"
if [ ! -x "$BIN" ]; then
  [ -d "$ROOT/sdcpp" ] || git clone -q --depth 1 --recurse-submodules --shallow-submodules https://github.com/leejet/stable-diffusion.cpp "$ROOT/sdcpp"
  (cd "$ROOT/sdcpp" && cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=ON >/dev/null && cmake --build build -j"$(nproc)" --config Release >/dev/null)
fi
get() { [ -s "$M/$(basename "$1")" ] || curl -sSL --fail --retry 3 -o "$M/$(basename "$1")" "$1"; }
get https://huggingface.co/leejet/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K.gguf
get https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF/resolve/main/Qwen3-4B-Instruct-2507-UD-Q4_K_XL.gguf
get https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors
"$BIN" --diffusion-model "$M/z_image_turbo-Q4_K.gguf" --vae "$M/ae.safetensors" \
  --llm "$M/Qwen3-4B-Instruct-2507-UD-Q4_K_XL.gguf" -p "$1" --cfg-scale 1.0 --steps 8 \
  -W "${3:-576}" -H "${4:-1024}" --seed "${5:-42}" -t "$(nproc)" -o "$2" 2>&1 | grep -E "saved|error|Error"
