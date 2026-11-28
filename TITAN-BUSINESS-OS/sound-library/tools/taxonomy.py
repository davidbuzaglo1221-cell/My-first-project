"""Categories of the studio sound library: slug -> Hebrew name, search words, default character.

Every sound in index.json has exactly one `category` (a slug below) plus free `tags` and `mood`.
`queries` are the words used when fetching more sounds from Freesound/Openverse for that category.
`cue_types` map editing moments to categories, so a plan can ask for "scene_cut" and get a whoosh.
"""

CATEGORIES = {
    "whoosh":          {"he": "וווש וסווש",            "queries": ["whoosh", "swoosh", "swish fast pass by"], "words": ["whoosh", "woosh", "swoosh", "swish", "swosh", "swipe", "pass", "air", "fly", "whip"]},
    "impact":          {"he": "אימפקט קולנועי",          "queries": ["cinematic impact", "trailer hit", "dramatic hit"], "words": ["impact", "hit", "cinematic", "trailer", "slam", "boom", "dramatic", "thud"]},
    "riser":           {"he": "רייזר (בנייה למתח)",      "queries": ["riser", "tension riser", "uplifter sweep"], "words": ["riser", "rise", "rising", "build", "tension", "uplifter", "swell", "crescendo"]},
    "drop":            {"he": "דרופ ונפילה",             "queries": ["bass drop", "downlifter", "sub drop"], "words": ["drop", "downlifter", "fall", "dive", "down"]},
    "transition":      {"he": "מעברים",                 "queries": ["transition sweep", "swipe transition", "zoom transition"], "words": ["transition", "sweep", "swipe", "zoom", "slide", "wipe"]},
    "bass-hit":        {"he": "באס עמוק ובום",           "queries": ["sub bass hit", "deep boom", "low impact"], "words": ["bass", "sub", "boom", "low", "deep", "808", "rumble", "thump"]},
    "glitch":          {"he": "גליץ' ודיגיטלי",          "queries": ["glitch", "digital glitch", "data corruption"], "words": ["glitch", "digital", "data", "corrupt", "stutter", "bitcrush", "error", "static", "computer", "sci-fi"]},
    "ui":              {"he": "ממשק וקליקים",            "queries": ["ui click", "button click", "interface tap"], "words": ["ui", "click", "button", "interface", "tap", "menu", "blip", "select", "toggle", "mouse"]},
    "typing":          {"he": "הקלדה ומקלדת",            "queries": ["keyboard typing", "mechanical keyboard", "typewriter"], "words": ["typing", "keyboard", "type", "typewriter", "keys", "keystroke"]},
    "camera":          {"he": "צמצם מצלמה ופלאש",        "queries": ["camera shutter", "camera click", "flash camera"], "words": ["camera", "shutter", "photo", "snapshot", "flash", "polaroid", "dslr"]},
    "footsteps":       {"he": "צעדים",                  "queries": ["footsteps", "footsteps concrete", "walking shoes"], "words": ["footstep", "footsteps", "step", "walk", "walking", "shoes", "heels", "run"]},
    "ambience-nature": {"he": "טבע ואווירה",             "queries": ["forest ambience", "rain ambience", "ocean waves", "wind ambience"], "words": ["ambience", "ambient", "nature", "forest", "rain", "wind", "birds", "ocean", "waves", "water", "night", "crickets", "atmosphere"]},
    "ambience-urban":  {"he": "עיר וחללים",              "queries": ["city ambience", "cafe ambience", "room tone"], "words": ["city", "street", "traffic", "cafe", "restaurant", "room", "tone", "crowd", "urban", "shop"]},
    "dark":            {"he": "אווירה קולנועית אפלה",     "queries": ["dark drone", "dark ambience cinematic", "horror atmosphere"], "words": ["dark", "drone", "horror", "eerie", "ominous", "suspense", "tension", "creepy", "cinematic", "low"]},
    "luxury":          {"he": "יוקרה (זכוכית, ניצוץ, מתכת)", "queries": ["glass clink", "shimmer sparkle", "lighter zippo", "champagne cork"], "words": ["glass", "clink", "shimmer", "sparkle", "chime", "crystal", "zippo", "lighter", "champagne", "cork", "metal", "jewelry", "watch", "luxury", "gold"]},
    "explosion":       {"he": "פיצוצים",                "queries": ["explosion", "distant explosion", "blast"], "words": ["explosion", "explode", "blast", "bomb", "detonation", "firework"]},
    "punch":           {"he": "מכות ואגרופים",           "queries": ["punch", "body hit", "kick impact"], "words": ["punch", "hit", "kick", "slap", "smack", "fight", "body", "fist"]},
    "reverse":         {"he": "ריברס",                  "queries": ["reverse cymbal", "reverse swell", "reversed"], "words": ["reverse", "reversed", "backwards", "rewind", "suck"]},
    "pop":             {"he": "פופ והופעה",              "queries": ["pop", "bubble pop", "mouth pop"], "words": ["pop", "plop", "bubble", "blob", "appear", "boop"]},
    "tick":            {"he": "טיקים ושעון",             "queries": ["clock tick", "tick", "ticking"], "words": ["tick", "clock", "ticking", "tock", "metronome", "timer"]},
    "ding":            {"he": "דינג והתראה",             "queries": ["ding", "notification", "bell chime"], "words": ["ding", "bell", "notification", "chime", "success", "alert", "confirm"]},
    "barber":          {"he": "מספרה (מכונה, מספריים, ספריי)", "queries": ["hair clipper", "scissors cutting hair", "spray bottle", "razor shave"], "words": ["clipper", "trimmer", "scissors", "hair", "barber", "razor", "shave", "spray", "comb", "dryer", "buzz"]},
    "human":           {"he": "אנשים (מחיאות, קהל, נשימה, לב)", "queries": ["applause", "crowd cheer", "heartbeat", "breath"], "words": ["applause", "clap", "cheer", "crowd", "laugh", "heartbeat", "heart", "breath", "gasp", "wow"]},
    "foley":           {"he": "פולי (נייר, בד, דלת, רוכסן)", "queries": ["paper", "page turn", "zipper", "door"], "words": ["paper", "page", "fabric", "cloth", "zipper", "door", "drawer", "keys", "coin", "cash", "register", "bag"]},
    "music-stinger":   {"he": "סטינגר מוזיקלי",          "queries": ["stinger", "logo sting", "brass hit"], "words": ["stinger", "sting", "logo", "brass", "orchestra", "piano", "hit"]},
}

# Editing moments -> categories (first is preferred, rest are alternatives).
CUE_TYPES = {
    "scene_cut":   ["whoosh", "transition"],
    "movement":    ["whoosh", "transition"],
    "zoom_in":     ["whoosh", "reverse"],
    "appear":      ["pop", "ui"],
    "click":       ["ui", "tick"],
    "typing":      ["typing"],
    "build_up":    ["riser", "reverse"],
    "reveal":      ["impact", "bass-hit"],
    "drop":        ["drop", "bass-hit"],
    "hit":         ["punch", "impact"],
    "success":     ["ding", "pop"],
    "error_or_tech": ["glitch"],
    "photo":       ["camera"],
    "walk":        ["footsteps"],
    "premium":     ["luxury"],
    "bed":         ["ambience-urban", "ambience-nature", "dark"],
    "tension_bed": ["dark"],
    "barber":      ["barber"],
    "boom":        ["explosion", "bass-hit"],
    "tick":        ["tick", "ui"],
    "logo":        ["music-stinger", "impact"],
}

# Character words a search can ask for (matched against tags/description/mood).
MOODS = ["dark", "bright", "soft", "hard", "heavy", "light", "fast", "slow", "short", "long", "deep",
         "airy", "metallic", "wooden", "warm", "cold", "cinematic", "playful", "cartoon", "luxury",
         "clean", "dirty", "distorted", "reverb", "dry", "close", "distant", "epic", "subtle", "aggressive"]


def guess_category(text):
    """Best category slug for a free-text title/tags string (used for imports)."""
    t = text.lower()
    best, score = None, 0
    for slug, c in CATEGORIES.items():
        s = sum(1 for w in c["words"] if w in t)
        if s > score:
            best, score = slug, s
    return best or "foley"
