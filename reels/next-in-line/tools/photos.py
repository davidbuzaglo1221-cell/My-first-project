"""Cinematic stills for the 'next in line' reel, generated locally on CPU.

Model: RealVisXL V5.0 Lightning (OpenRAIL++, commercial use allowed), DPM++ SDE Karras, 6 steps, CFG 1.5.
Two seeds per shot; every image is then inspected at full size (hands, fingers, faces) and only clean ones are used.
Compositions keep hands out of frame or minimal on purpose.
Usage: python tools/photos.py [shot ...]   writes gen/<shot>_<seed>.png, skipping existing files.
"""
import os, sys, time
import torch
from diffusers import StableDiffusionXLPipeline, DPMSolverSDEScheduler

torch.set_num_threads(os.cpu_count() or 4)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'gen')
os.makedirs(OUT, exist_ok=True)
W, H = 768, 1344

LOOK = "cinematic film still, 35mm photo, Kodak Portra 400, moody low-key warm tungsten light, dark background, shallow depth of field, film grain"
BARBER = "stylish 27 year old mediterranean man, dark slicked back undercut, short trimmed dark beard, white t-shirt, black apron"
CLIENT = "20 year old mediterranean guy wearing a plain black nylon barber cape fastened at the neck"
NEG = ("cartoon, anime, illustration, 3d render, cgi, painting, deformed, bad anatomy, extra fingers, extra hands, extra arms, "
       "extra limbs, mutated hands, fused fingers, missing fingers, disfigured face, cross-eyed, text, watermark, logo, lowres, blurry")

SHOTS = {
    "s01": f"{LOOK}, extreme close-up of a man's eyes reflected in a barbershop mirror, focused intense gaze, dark eyebrows, warm light",
    "s02": f"{LOOK}, {CLIENT} with long messy curly brown hair, sitting in barber chair, skeptical raised eyebrow, looking into mirror, chest-up portrait",
    "s03": f"{LOOK}, mirror reflection, {BARBER} standing behind a seated client with long curly hair, calm confident half smile, studying the hair, chest-up",
    "s04": f"{LOOK}, macro product photo of vintage chrome hair clippers lying on a dark wooden barber counter among cut hair, single warm light beam, no people",
    "s05": f"{LOOK}, close-up of the back of a man's head with a fresh crisp skin fade and sharp neckline, warm side light, barber cape, no hands",
    "s06": f"{LOOK}, macro close-up of small clumps of cut dark hair falling through a warm beam of light, dust particles, black background, no people, no face",
    "s07": f"{LOOK}, two young men sitting on a leather bench in a barbershop leaning forward, curious, watching intently, chest-up",
    "s08": f"{LOOK}, close-up portrait of a young man with jaw dropped in disbelief, wide eyes, barbershop background",
    "s09": f"{LOOK}, {CLIENT} with a fresh high skin fade and short textured crop, looking at himself in a mirror, eyes wide in amazement, open-mouth smile, close-up",
    "s10": f"{LOOK}, two young friends laughing hysterically and excited, close-up of faces, barbershop, golden hour",
    "s11": f"{LOOK}, side profile of a young man with a fresh sharp skin fade and crisp line up, confident smile, golden backlight, close-up",
    "s12": f"{LOOK}, portrait of {BARBER}, looking over his shoulder at camera, slight confident smirk, golden rim light, barbershop out of focus, chest-up",
    "s13": f"{LOOK}, small barbershop at dusk, warm glowing window, a few people waiting outside on the sidewalk, street, wide shot",
}
SEEDS = tuple(int(s) for s in os.environ.get("SEEDS", "11,23").split(","))

def main():
    shots = sys.argv[1:] or list(SHOTS)
    t0 = time.time()
    pipe = StableDiffusionXLPipeline.from_pretrained("SG161222/RealVisXL_V5.0_Lightning", torch_dtype=torch.bfloat16, variant="fp16")
    pipe.scheduler = DPMSolverSDEScheduler.from_config(pipe.scheduler.config, use_karras_sigmas=True)
    print(f"loaded in {time.time() - t0:.0f}s", flush=True)
    for seed in SEEDS:
        for k in shots:
            path = os.path.join(OUT, f"{k}_{seed}.png")
            if os.path.exists(path):
                continue
            t = time.time()
            img = pipe(prompt=SHOTS[k], negative_prompt=NEG, width=W, height=H, num_inference_steps=6, guidance_scale=1.5,
                       generator=torch.Generator().manual_seed(seed)).images[0]
            img.save(path)
            print(k, seed, f"{time.time() - t:.0f}s", flush=True)
    print("ALLDONE", flush=True)

if __name__ == "__main__":
    main()
