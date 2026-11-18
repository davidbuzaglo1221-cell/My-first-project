"""Hebrew narration with Phonikud (diacritics + phonemes) and Piper voices."""
import re, numpy as np
from phonikud_onnx import Phonikud
from phonikud import phonemize
from piper_onnx import Piper
D = '/home/user/tts/he'
_nik = None
_voices = {}
VOICES = {
    'shaul': (f'{D}/shaul.onnx', f'{D}/model.config.json'),
    'michael': (f'{D}/michael.onnx', f'{D}/model.config.json'),
    'medium': (f'{D}/piper_medium_male.onnx', f'{D}/medium.config.json'),
}
def nik():
    global _nik
    if _nik is None: _nik = Phonikud(f'{D}/phonikud-1.0.int8.onnx')
    return _nik
def voice(name):
    if name not in _voices: _voices[name] = Piper(*VOICES[name])
    return _voices[name]
def say(text, name, pace=1.12):
    vocal = nik().add_diacritics(text)
    ph = phonemize(vocal)
    v = voice(name)
    samples, sr = v.create(ph, is_phonemes=True, length_scale=pace)
    return np.asarray(samples, dtype=np.float32), sr
