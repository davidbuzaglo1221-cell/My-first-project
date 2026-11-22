import time, torch, json, sys
from diffusers import AutoPipelineForText2Image
torch.set_num_threads(4)
pipe=AutoPipelineForText2Image.from_pretrained("stabilityai/sdxl-turbo", torch_dtype=torch.bfloat16, variant="fp16", low_cpu_mem_usage=True)
STYLE="semi-realistic graphic novel illustration, painterly digital painting, fine ink linework, cinematic lighting, muted warm palette, highly detailed, realistic proportions"
ROOK="a young barber about 22 with dark curly hair and light stubble, white t-shirt, black barber apron"
MAST="a master barber about 55 with short grey hair and a neat grey beard, rolled-up dark sleeves, tattooed forearms, brown leather apron"
S={
 "p01":(f"barbershop mirror reflection: a seated client in a black cape scowling at his crooked uneven fade haircut with a bald patch on the side, behind him {ROOK} holding clippers, eyes wide and worried",21),
 "p02":(f"close-up: {ROOK} nervously pressing hair clippers too deep into the side of a client's head, leaving a bald gap, cut hair falling, dramatic side light",22),
 "p03":(f"an annoyed young man in a grey hoodie with an uneven haircut walking out of a barbershop glass door, {ROOK} standing sadly by the barber chair in the background",11),
 "p04":(f"night, empty barbershop lit by one warm lamp, {ROOK} sweeping cut hair off the floor alone, head down, blue street light through the window, long shadows",12),
 "p05":(f"night, {MAST} leaning in a barbershop doorway with arms crossed, calm half smile, warm light behind him",13),
 "p06":(f"close-up of hands: an older tattooed hand resting over a young barber's hand, guiding hair clippers up a client's fade, comb in the other hand, warm lamp light",14),
 "p07":(f"late night, {ROOK} cutting the hair of a mannequin training head on the counter with intense focus, wall clock, {MAST} watching in the soft background",15),
 "p08":("extreme close-up of steady hands holding a straight razor drawing a perfectly sharp hairline at a man's temple, crisp edge, dramatic light",16),
 "p09":(f"barbershop mirror reflection: a seated client in a black cape grinning at his perfect sharp skin fade, behind him {ROOK} with a small proud smile",17),
 "p10":(f"busy stylish barbershop at golden hour, {ROOK} confidently cutting a client's hair, three clients waiting on a leather bench, {MAST} by the window nodding proudly",18),
}
only=sys.argv[1:] or list(S)
for k in only:
    p,seed=S[k]; t=time.time()
    img=pipe(prompt=f"{STYLE}, {p}", num_inference_steps=4, guidance_scale=0.0, width=576, height=1024, generator=torch.Generator().manual_seed(seed)).images[0]
    img.save(f"{k}.png"); print(k, round(time.time()-t),"s", flush=True)
print("ALLDONE",flush=True)
