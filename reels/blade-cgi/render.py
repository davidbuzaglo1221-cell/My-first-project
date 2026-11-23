"""Render frames of blade.blend: python3 render.py -- blade.blend outdir percent samples"""
import bpy, sys
a = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
sc = bpy.context.scene
sc.render.resolution_percentage = int(a[2])
sc.cycles.samples = int(a[3])
sc.render.use_persistent_data = True
sc.render.use_overwrite = False  # resume: skip frames already on disk
sc.render.use_placeholder = True
sc.render.filepath = a[1].rstrip("/") + "/f_####"
bpy.ops.render.render(animation=True)
