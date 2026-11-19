"""Hebrew narration with Phonikud (diacritics + phonemes) and Piper voices."""
import re, numpy as np
from phonikud_onnx import Phonikud
from he_phonemes import phonemize, normalize
from piper_onnx import Piper
D = '/home/user/tts/he'
_nik = None
_voices = {}
VOICES = {
    'shaul': (f'{D}/shaul.onnx', f'{D}/model.config.json'),
    'michael': (f'{D}/michael.onnx', f'{D}/model.config.json'),
    'medium': (f'{D}/piper_medium_male.onnx', f'{D}/medium.config.json'),
    'phonikud': (f'{D}/vits_phonikud.onnx', f'{D}/model.config.json'),
    'enhanced': (f'{D}/enhanced.onnx', f'{D}/model.config.json'),
    'noa': (f'{D}/piper_medium_female.onnx', f'{D}/medium.config.json'),
}
def nik():
    global _nik
    if _nik is None: _nik = Phonikud(f'{D}/phonikud-1.0.int8.onnx')
    return _nik
def voice(name):
    if name not in _voices: _voices[name] = Piper(*VOICES[name])
    return _voices[name]
import json as _json, os as _os
_CACHE_PATH = '/home/user/tts/phoneme_cache.json'
_cache = _json.load(open(_CACHE_PATH)) if _os.path.exists(_CACHE_PATH) else {}
def phonemes(text):
    """Diacritize + phonemize once per sentence; shared by every voice."""
    if text not in _cache:
        _cache[text] = phonemize(nik().add_diacritics(normalize(text)))
        if len(_cache) % 20 == 0: _json.dump(_cache, open(_CACHE_PATH, 'w'), ensure_ascii=False)
    return _cache[text]
def flush_cache():
    _json.dump(_cache, open(_CACHE_PATH, 'w'), ensure_ascii=False)
def say(text, name, pace=1.12, ns=None, nw=None):
    ph = phonemes(text)
    v = voice(name)
    samples, sr = v.create(ph, is_phonemes=True, length_scale=pace, noise_scale=ns, noise_w=nw)
    return np.asarray(samples, dtype=np.float32), sr
