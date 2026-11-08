"""Generate the Hebrew narration with ElevenLabs (one clip per scene + word timings).

Needs network access to api.elevenlabs.io and an API key, either in the
environment as ELEVENLABS_API_KEY or injected by the cloud proxy.

usage: python3 make_narration.py OUT_DIR [VOICE_ID]
writes OUT_DIR/scene_N.wav and OUT_DIR/scene_N.json ([[word, start_seconds], ...])
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request

# Same text as the page (SCENES[].narr).
SCENES = [
    'כשאנחנו מתחילים להתאמן, השרירים שלנו זקוקים לאנרגיה כדי להתכווץ. אחד ממקורות האנרגיה שהגוף יכול לנצל הוא השומן המאוחסן.',
    'בזמן פעילות גופנית, שינויים באותות ההורמונליים ובדרישות האנרגיה יכולים להגביר את פירוק השומן המאוחסן. בתהליך שנקרא ליפוליזה, טריגליצרידים מתפרקים לחומצות שומן ולגליצרול.',
    'חומצות השומן משתחררות למחזור הדם ומגיעות לרקמות שזקוקות לאנרגיה, ובהן השרירים הפעילים.',
    'בתוך התאים, חומצות השומן עוברות חמצון. האנרגיה המשתחררת מאפשרת לגוף לייצר ATP, המטבע האנרגטי של התא. בתהליך נוצרים גם פחמן דו־חמצני ומים.',
    'והנה החלק המפתיע: רוב המסה של השומן שעבר חמצון עוזבת את הגוף בסופו של דבר דרך הריאות, בצורת פחמן דו־חמצני. חלק נוסף יוצא בצורת מים.',
    'כשאנחנו מאבדים שומן, הוא לא הופך לשריר ולא פשוט נעלם. האטומים שלו עוברים תהליכים כימיים, ורוב המסה עוזבת את הגוף דרך הנשימה. הפעילות הגופנית מגדילה את ההוצאה האנרגטית, אבל ירידה בשומן תלויה במאזן האנרגיה לאורך זמן.',
]
# A deep, documentary-style male voice from the ElevenLabs library; override with argv[2].
DEFAULT_VOICE = 'nPczCjzI2devNBz1zQrb'


def words_from_alignment(al):
    chars, starts = al['characters'], al['character_start_times_seconds']
    out, cur, t0 = [], '', None
    for c, t in zip(chars, starts):
        if c.isspace():
            if cur:
                out.append([cur, round(t0, 3)])
            cur, t0 = '', None
        else:
            if not cur:
                t0 = t
            cur += c
    if cur:
        out.append([cur, round(t0, 3)])
    return out


def main():
    out = sys.argv[1]
    voice = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_VOICE
    os.makedirs(out, exist_ok=True)
    key = os.environ.get('ELEVENLABS_API_KEY', 'proxy-injected')
    for i, text in enumerate(SCENES, 1):
        body = json.dumps({
            'text': text,
            'model_id': 'eleven_v3',
            'language_code': 'he',
            'voice_settings': {'stability': 0.5, 'similarity_boost': 0.8, 'style': 0.25},
        }).encode()
        req = urllib.request.Request(
            f'https://api.elevenlabs.io/v1/text-to-speech/{voice}/with-timestamps?output_format=mp3_44100_192',
            data=body, headers={'xi-api-key': key, 'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.load(r)
        mp3 = os.path.join(out, f'scene_{i}.mp3')
        with open(mp3, 'wb') as f:
            f.write(base64.b64decode(res['audio_base64']))
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', mp3, '-ac', '1', '-ar', '44100',
                        os.path.join(out, f'scene_{i}.wav')], check=True)
        al = res.get('normalized_alignment') or res.get('alignment')
        with open(os.path.join(out, f'scene_{i}.json'), 'w') as f:
            json.dump(words_from_alignment(al) if al else [], f, ensure_ascii=False)
        print('scene', i, 'ok')


if __name__ == '__main__':
    main()
