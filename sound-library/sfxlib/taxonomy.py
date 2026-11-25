"""Categories (EN + HE), keyword rules for classifying sounds, and harvest queries per category.

A sound can sit in several categories. Classification scores each category by keyword hits in the
sound's title, tags, description and source category; the best ones (score >= 2, or the top one) win.
"""
from __future__ import annotations

import re

# id: (English, Hebrew, keywords (weight 2 if in tags/source category, 1 in title/description), Freesound queries)
CATEGORIES: dict[str, dict] = {
    "cinematic": {"en": "Cinematic", "he": "קולנועי",
                  "kw": "cinematic epic dramatic film movie orchestral hit braam boom sub tension suspense deep reveal title",
                  "fs": ["cinematic hit", "cinematic impact", "braam", "cinematic boom", "cinematic tension", "cinematic whoosh", "epic drum hit", "film trailer sound design"]},
    "trailer": {"en": "Trailer", "he": "טריילר",
                "kw": "trailer braam epic hit riser stinger slam drop logo sting intro outro reveal",
                "fs": ["trailer hit", "trailer riser", "trailer braam", "trailer drop", "stinger"]},
    "horror": {"en": "Horror", "he": "אימה",
               "kw": "horror scary creepy spooky ghost scream haunted dark eerie monster zombie demonic jumpscare suspense heartbeat",
               "fs": ["horror", "jumpscare", "creepy ambience", "ghost whisper", "monster growl", "horror stinger", "eerie drone"]},
    "comedy": {"en": "Comedy", "he": "קומדיה",
               "kw": "comedy funny comic laugh boing fail sad trombone honk squeak slide whistle cartoon kazoo rimshot cricket fart",
               "fs": ["funny", "comedy", "slide whistle", "sad trombone", "rimshot", "boing", "squeaky toy", "clown horn"]},
    "viral": {"en": "Viral TikTok", "he": "ויראלי טיקטוק",
              "kw": "meme viral tiktok bruh vine boom record scratch airhorn ding bonk wow oof notification sus emotional damage",
              "fs": ["vine boom", "record scratch", "air horn", "bonk", "meme", "anime wow", "bruh"]},
    "whoosh": {"en": "Whoosh", "he": "וושים",
               "kw": "whoosh woosh swoosh swish swoop swipe air fly pass by passby zip wind",
               "fs": ["whoosh", "swoosh", "swish", "fast whoosh", "pass by whoosh", "sword swish"]},
    "transitions": {"en": "Transitions", "he": "מעברים",
                    "kw": "transition swoosh whoosh reverse rewind tape stop zoom swipe glitch cut wipe scene change sweep",
                    "fs": ["transition", "reverse whoosh", "tape stop", "rewind", "zoom transition", "sweep"]},
    "bass": {"en": "Bass & Drops", "he": "בס ודרופים",
             "kw": "bass sub 808 drop boom rumble low thump subdrop deep",
             "fs": ["sub drop", "808", "bass drop", "low boom", "rumble", "sub bass hit"]},
    "impacts": {"en": "Impacts & Hits", "he": "פגיעות ומכות",
                "kw": "impact hit punch slam smash crash thud thump bang knock collision kick strike slap",
                "fs": ["impact", "punch", "slam", "thud", "body hit", "metal impact", "wood impact", "slap"]},
    "risers": {"en": "Risers & Fallers", "he": "עליות וירידות",
               "kw": "riser rise rising build buildup uplifter tension sweep upsweep downer faller falling",
               "fs": ["riser", "uplifter", "build up", "tension riser", "downlifter", "rising tone"]},
    "glitch": {"en": "Glitch & Digital", "he": "גליץ' ודיגיטל",
               "kw": "glitch digital static noise data computer error stutter bitcrush electronic scan beep processing hack",
               "fs": ["glitch", "digital glitch", "static noise", "data processing", "computer beep", "bitcrush"]},
    "foley": {"en": "Foley", "he": "פולי",
              "kw": "foley cloth fabric paper rustle handling grab pick put down bag zipper leather plastic movement",
              "fs": ["foley cloth", "paper rustle", "zipper", "plastic bag", "leather", "grab object"]},
    "drops": {"en": "Falls & Drops", "he": "נפילות",
              "kw": "drop dropped fall falling falls thud land landing bounce object tumble body fall",
              "fs": ["object drop", "body fall", "falling object", "drop on floor", "item drop", "keys drop"]},
    "breaking": {"en": "Glass & Breaking", "he": "שבירה וזכוכית",
                 "kw": "glass break shatter smash breaking crack ceramic plate bottle splinter wood break",
                 "fs": ["glass break", "glass shatter", "plate break", "bottle smash", "wood crack"]},
    "explosions": {"en": "Explosions", "he": "פיצוצים",
                   "kw": "explosion explode blast bomb detonation boom firework kaboom grenade debris",
                   "fs": ["explosion", "big explosion", "distant explosion", "bomb blast", "debris", "fireworks"]},
    "weapons": {"en": "Weapons FX", "he": "נשק ואפקטי קרב",
                "kw": "gun gunshot shot rifle pistol shotgun reload cock sword blade knife unsheathe laser blaster arrow bow battle",
                "fs": ["gunshot", "pistol", "shotgun", "gun reload", "sword unsheathe", "sword clash", "laser gun", "arrow"]},
    "scifi": {"en": "Sci-Fi", "he": "מדע בדיוני",
              "kw": "sci-fi scifi space laser robot spaceship alien futuristic teleport hologram force field engine hum warp",
              "fs": ["sci-fi", "spaceship", "robot", "teleport", "futuristic ui", "alien"]},
    "magic": {"en": "Magic & Shimmer", "he": "קסם ונצנוץ",
              "kw": "magic spell sparkle shimmer twinkle fairy chime glitter wand enchant mystic reveal positive",
              "fs": ["magic spell", "sparkle", "shimmer", "fairy dust", "magic wand"]},
    "cartoon": {"en": "Cartoon", "he": "מצויר",
                "kw": "cartoon toon boing bonk slip spring pop squeak bubble zany wacky goofy anime run",
                "fs": ["cartoon", "cartoon run", "cartoon bonk", "cartoon spring", "cartoon slip"]},
    "pops": {"en": "Pops & Appear", "he": "פופים והופעה",
             "kw": "pop bubble pluck appear disappear poof cork balloon",
             "fs": ["pop", "bubble pop", "cork pop", "balloon pop", "mouth pop"]},
    "ui": {"en": "UI & Interface", "he": "ממשק",
           "kw": "ui interface click tap button toggle switch menu hover select confirm cancel swipe app scroll",
           "fs": ["ui click", "button click", "interface", "mouse click", "toggle switch"]},
    "notifications": {"en": "Notifications & Alerts", "he": "התראות",
                      "kw": "notification alert message ding chime success error fail win correct wrong bell beep ping",
                      "fs": ["notification", "success chime", "error sound", "message alert", "ping"]},
    "gaming": {"en": "Gaming", "he": "משחקים",
               "kw": "game arcade 8bit 8-bit retro chiptune coin power up powerup level jump collect score lose win rpg pickup",
               "fs": ["8 bit", "arcade", "power up", "coin pickup", "game over", "level up"]},
    "cars": {"en": "Cars & Vehicles", "he": "רכבים",
             "kw": "car engine rev drift skid tire screech horn vehicle motorcycle motorbike truck brake door car racing traffic",
             "fs": ["car engine rev", "tire screech", "car horn", "car pass by", "motorcycle", "car door", "engine start"]},
    "transport": {"en": "Transport", "he": "תחבורה",
                  "kw": "train plane airplane jet helicopter boat ship subway bus airport",
                  "fs": ["train", "airplane flyby", "helicopter", "jet flyby", "boat horn"]},
    "nature": {"en": "Nature & Weather", "he": "טבע ומזג אוויר",
               "kw": "nature forest wind rain thunder storm water river stream ocean wave waves sea beach leaves birdsong fire crackle",
               "fs": ["thunder", "rain", "wind", "ocean waves", "river stream", "forest ambience", "fire crackle"]},
    "water": {"en": "Water", "he": "מים",
              "kw": "water splash drip drop pour bubble liquid underwater swim splashing",
              "fs": ["water splash", "water drip", "pouring water", "underwater", "big splash"]},
    "fire": {"en": "Fire", "he": "אש",
             "kw": "fire flame burn burning crackle ignite torch lighter match fireball",
             "fs": ["fire", "fire whoosh", "lighter", "match strike", "fireball"]},
    "animals": {"en": "Animals", "he": "חיות",
                "kw": "animal dog bark cat meow bird chirp cow horse lion roar wolf howl chicken rooster pig sheep goat duck frog monkey elephant owl crow insect bee fly cricket snake",
                "fs": ["dog bark", "cat meow", "bird chirp", "lion roar", "wolf howl", "rooster", "cow moo", "horse neigh", "monkey", "duck quack", "frog", "elephant", "owl", "crow", "bee buzz", "goat", "sheep", "pig"]},
    "human": {"en": "Human Sounds", "he": "קולות אנושיים",
              "kw": "human voice laugh laughing scream yell shout gasp breath breathing sigh cough sneeze kiss clap whistle cry crying baby footsteps heartbeat burp hum crowd cheer applause grunt male female",
              "fs": ["laugh", "scream", "gasp", "sigh", "cough", "sneeze", "kiss", "whistle", "heartbeat", "breathing", "footsteps", "crowd cheer", "applause", "baby laugh", "grunt", "wow voice"]},
    "voice": {"en": "Voice & Announcer", "he": "קריינות וקולות",
              "kw": "voice voiceover announcer fight round ko knockout go ready win lose game over countdown spoken word",
              "fs": ["announcer", "voice countdown", "fight announcer"]},
    "household": {"en": "Home & Everyday", "he": "בית ויומיום",
                  "kw": "door knock doorbell kitchen cooking fridge microwave toilet flush shower keys drawer cup coffee pour bottle can open chair furniture",
                  "fs": ["door open", "door close", "door knock", "keys", "coffee pour", "can open", "drawer", "microwave", "kitchen"]},
    "office": {"en": "Office & Tech", "he": "משרד וטכנולוגיה",
               "kw": "typing keyboard mouse printer camera shutter phone vibrate ringtone pen writing paper stapler",
               "fs": ["typing keyboard", "camera shutter", "phone vibrate", "pen writing", "printer"]},
    "money": {"en": "Money & Business", "he": "כסף ועסקים",
              "kw": "money cash coin coins register till cha-ching ka-ching payment card counting",
              "fs": ["cash register", "coins", "money counting", "cha ching"]},
    "sports": {"en": "Sports & Fitness", "he": "ספורט וכושר",
               "kw": "sport sports ball kick basketball football soccer tennis whistle referee gym weight dumbbell punch bag boxing bell stadium crowd",
               "fs": ["basketball bounce", "soccer kick", "referee whistle", "boxing bell", "gym weights", "punching bag", "tennis hit"]},
    "barber": {"en": "Barbershop", "he": "מספרה",
               "kw": "barber hair clipper clippers trimmer shaver razor scissors haircut spray bottle hairdryer hair dryer blow dryer comb brush shave foam",
               "fs": ["hair clipper", "electric trimmer", "scissors cutting", "spray bottle", "hair dryer", "razor shave", "shaving foam"]},
    "ambience": {"en": "Ambience", "he": "אווירה ורקע",
                 "kw": "ambience ambient atmosphere room tone city street cafe restaurant background drone",
                 "fs": ["city ambience", "cafe ambience", "room tone", "night ambience", "street ambience"]},
    "mechanical": {"en": "Mechanical", "he": "מכני",
                   "kw": "mechanical machine motor gear lock latch switch lever ratchet metal servo industrial tool drill saw hammer",
                   "fs": ["mechanical", "lock", "gear", "power tool", "hammer", "ratchet"]},
    "stings": {"en": "Stings & Jingles", "he": "ג'ינגלים וחתימות",
               "kw": "sting jingle logo intro outro fanfare tada win music short melody signature",
               "fs": ["logo sting", "jingle", "fanfare", "tada"]},
    "time": {"en": "Time & Countdown", "he": "זמן וספירה",
             "kw": "clock tick ticking countdown timer alarm stopwatch beep tick-tock",
             "fs": ["clock ticking", "countdown", "alarm clock", "timer beep"]},
}

# Source categories that map straight onto ours (weight like a tag).
SOURCE_MAP = {
    "whooshes": ["whoosh", "transitions"], "swishes-and-zips": ["whoosh", "transitions"], "swipes": ["ui", "transitions"],
    "reverse-whooshes": ["transitions", "risers"], "risers-and-fallers": ["risers", "trailer"], "bounce-spin-zoom": ["cartoon", "transitions"],
    "impacts": ["impacts"], "cinematic-hits": ["cinematic", "trailer", "impacts"], "booms-and-bass": ["bass", "cinematic"],
    "pops": ["pops"], "appear-and-vanish": ["pops", "magic"], "shape-changes": ["cartoon", "pops"], "interface": ["ui"],
    "keyboard": ["office"], "writing-and-drawing": ["office", "foley"], "phone": ["office", "notifications"],
    "mechanical": ["mechanical"], "foley": ["foley"], "everyday-props": ["household", "foley"], "notifications": ["notifications"],
    "tones": ["ui", "notifications"], "shimmers": ["magic"], "logo-stings": ["stings", "trailer"], "celebration": ["human", "stings"],
    "time": ["time"], "money": ["money"], "digital": ["glitch"], "data": ["glitch", "ui"],
    # Kenney packs
    "casino-audio": ["gaming", "money"], "digital-audio": ["gaming", "glitch"], "impact-sounds": ["impacts", "foley"],
    "interface-sounds": ["ui"], "music-jingles": ["stings", "gaming"], "rpg-audio": ["gaming", "foley"],
    "sci-fi-sounds": ["scifi", "weapons"], "ui-audio": ["ui"], "voiceover-pack": ["voice"], "voiceover-pack-fighter": ["voice", "gaming"],
}

STYLE_RULES = {  # style tags derived from words
    "cinematic": "cinematic epic dramatic trailer film braam orchestral",
    "cartoon": "cartoon toon comic funny goofy wacky",
    "realistic": "foley recording field real natural ambience recorded",
    "electronic": "synth electronic digital glitch 8bit chiptune bitcrush laser sci-fi",
    "retro": "8bit 8-bit retro chiptune arcade vintage tape vinyl",
    "dark": "dark horror scary creepy eerie ominous",
    "bright": "bright sparkle shimmer magic positive happy success",
    "soft": "soft gentle subtle light quiet",
    "hard": "hard heavy big huge strong powerful massive",
}

_word = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)?")


def _words(s: str) -> list[str]:
    return _word.findall((s or "").lower().replace("_", " "))


def classify(rec: dict) -> list[str]:
    tag_words = set()
    for t in rec.get("tags", []):
        tag_words |= set(_words(t))
        tag_words.add(t.lower())
    text_words = set(_words(rec.get("title", "") + " " + rec.get("description", "") + " " + " ".join(rec.get("use_for", []))))
    scores: dict[str, float] = {}
    for cid, c in CATEGORIES.items():
        kws = c["kw"].split()
        s = 0.0
        for k in kws:
            if k in tag_words:
                s += 2
            if k in text_words:
                s += 1
        if s:
            scores[cid] = s
    for c in SOURCE_MAP.get(rec.get("source_category", ""), []):
        scores[c] = scores.get(c, 0) + 4
    if not scores:
        return ["misc"]
    best = max(scores.values())
    return [c for c, s in sorted(scores.items(), key=lambda x: -x[1]) if s >= max(2, best * 0.5)][:4]


def styles(rec: dict) -> list[str]:
    words = set(_words(" ".join(rec.get("tags", [])) + " " + rec.get("title", "") + " " + rec.get("description", "")
                       + " " + (rec.get("character") or "")))
    out = [s for s, kws in STYLE_RULES.items() if words & set(kws.split())]
    if rec.get("tier") in ("soft", "hard"):
        out.append(rec["tier"])
    return sorted(set(out))


def freesound_queries() -> list[str]:
    qs = []
    for c in CATEGORIES.values():
        qs += c["fs"]
    return list(dict.fromkeys(qs))
