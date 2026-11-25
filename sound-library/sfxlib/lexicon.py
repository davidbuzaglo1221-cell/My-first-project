"""Bilingual lexicon for natural-language search (Hebrew -> English terms, English synonyms, modifiers).

Written to data/lexicon.json so the Python search and the browser preview use exactly the same rules.
"""
from __future__ import annotations

import json

from .common import DATA
from .taxonomy import CATEGORIES

HE = {
    # movement & transitions
    "מעבר": "transition whoosh swoosh", "מעברים": "transition whoosh", "וושים": "whoosh", "ווש": "whoosh", "וווש": "whoosh",
    "סווש": "swoosh swish", "שריקת": "whistle whoosh", "תנועה": "movement whoosh", "זום": "zoom", "סיבוב": "spin",
    "החלקה": "swipe slide", "גלילה": "scroll", "הרצה": "fast", "רוח": "wind air", "אוויר": "air whoosh",
    "עף": "fly whoosh", "טיסה": "fly flyby", "חולף": "pass by", "ריוורס": "reverse", "הפוך": "reverse", "אחורה": "rewind reverse",
    # cinematic
    "קולנועי": "cinematic epic", "קולנועית": "cinematic epic", "סרט": "cinematic film", "טריילר": "trailer", "אפי": "epic",
    "אפית": "epic", "דרמטי": "dramatic cinematic", "דרמה": "dramatic", "מתח": "tension suspense", "חשיפה": "reveal",
    "כותרת": "title hit", "לוגו": "logo sting", "פתיחה": "intro", "סיום": "outro", "בראם": "braam", "פגיעה": "hit impact",
    "מכה": "hit punch impact", "מכות": "hit punch", "אגרוף": "punch", "בעיטה": "kick", "סטירה": "slap", "התנגשות": "crash collision",
    "טריקה": "slam", "דפיקה": "knock", "בום": "boom", "בומים": "boom", "בס": "bass sub", "סאב": "sub", "דרופ": "drop",
    "רעם": "thunder rumble", "רעמים": "thunder", "רעידה": "rumble", "עלייה": "riser rise", "עולה": "riser rising",
    "ירידה": "faller downer", "בילדאפ": "build", "הצטברות": "build riser",
    # explosions / weapons
    "פיצוץ": "explosion blast", "פיצוצים": "explosion", "התפוצצות": "explosion", "פצצה": "bomb explosion", "זיקוקים": "fireworks",
    "ירייה": "gunshot shot", "יריות": "gunshot", "אקדח": "pistol gun", "רובה": "rifle gun", "טעינה": "reload", "חרב": "sword",
    "סכין": "knife blade", "לייזר": "laser", "חץ": "arrow", "קשת": "bow arrow", "קרב": "battle fight", "מלחמה": "battle war",
    # horror / comedy / viral
    "אימה": "horror scary", "מפחיד": "scary creepy horror", "מפחידה": "scary horror", "מצמרר": "creepy eerie", "רוח רפאים": "ghost",
    "רפאים": "ghost", "מפלצת": "monster growl", "זומבי": "zombie", "צרחה": "scream", "צעקה": "scream yell shout",
    "דופק": "heartbeat", "לב": "heartbeat heart", "מצחיק": "funny comedy", "מצחיקה": "funny", "קומי": "comedy funny",
    "קומדיה": "comedy funny", "צחוק": "laugh laughing", "צוחק": "laugh", "צחקוק": "giggle laugh", "כישלון": "fail sad trombone",
    "נכשל": "fail", "ממים": "meme", "מם": "meme", "ויראלי": "viral meme tiktok", "טיקטוק": "tiktok meme viral", "שריטה": "scratch record",
    "תקליט": "record vinyl scratch", "צופר": "horn", "צפצוף": "beep", "קריצה": "ding", "וואו": "wow",
    # cartoon / magic / pops
    "מצויר": "cartoon", "קריקטורה": "cartoon", "קפיץ": "spring boing", "קפיצה": "jump boing", "החלקה מצחיקה": "slip cartoon",
    "פופ": "pop", "פיצוץ בועה": "bubble pop", "בועה": "bubble", "בועות": "bubbles", "בלון": "balloon", "קסם": "magic spell",
    "קסום": "magic", "נצנוץ": "sparkle shimmer twinkle", "נצנצים": "sparkle glitter", "פיה": "fairy", "הופעה": "appear",
    "היעלמות": "disappear poof", "נעלם": "disappear", "מופיע": "appear",
    # digital / ui / games
    "גליץ": "glitch", "גליץ'": "glitch", "דיגיטלי": "digital", "דיגיטל": "digital", "רעש": "noise static", "סטטי": "static",
    "מחשב": "computer", "האקר": "hack computer", "סריקה": "scan", "שגיאה": "error fail", "הצלחה": "success win",
    "קליק": "click", "לחיצה": "click tap press button", "כפתור": "button click", "ממשק": "ui interface", "אפליקציה": "app ui",
    "התראה": "notification alert", "הודעה": "message notification", "פעמון": "bell", "צלצול": "ring bell ringtone",
    "דינג": "ding", "משחק": "game arcade", "משחקים": "game", "ארקייד": "arcade", "רטרו": "retro 8bit", "מטבע": "coin",
    "מטבעות": "coins coin", "ניצחון": "win victory fanfare", "הפסד": "lose game over", "שלב": "level", "בונוס": "power up bonus",
    "רובוט": "robot", "חללית": "spaceship", "חלל": "space sci-fi", "חייזר": "alien", "עתידני": "futuristic sci-fi", "טלפורט": "teleport",
    # objects / foley / everyday
    "נפילה": "fall drop", "נפילת": "fall drop", "נופל": "fall falling drop", "נופלת": "fall drop", "הפלה": "drop", "חפץ": "object",
    "חפצים": "object", "נחיתה": "land landing thud", "חבטה": "thud thump", "שבירה": "break smash", "נשבר": "break shatter",
    "זכוכית": "glass", "כוס": "glass cup", "צלחת": "plate", "בקבוק": "bottle", "עץ": "wood", "מתכת": "metal", "נייר": "paper",
    "בד": "cloth fabric", "רוכסן": "zipper zip", "שקית": "bag plastic", "מפתחות": "keys", "דלת": "door", "דלתות": "door",
    "נקישה": "knock click", "טריקת דלת": "door slam", "חריקה": "creak squeak", "מגירה": "drawer", "כיסא": "chair",
    "מטבח": "kitchen cooking", "בישול": "cooking", "קפה": "coffee", "מזיגה": "pour", "פחית": "can open", "אוכל": "eat food",
    "הקלדה": "typing keyboard", "מקלדת": "keyboard typing", "עכבר": "mouse click", "מצלמה": "camera shutter", "צילום": "camera shutter",
    "טלפון": "phone", "רטט": "vibrate vibration", "עט": "pen writing", "כתיבה": "writing pen", "שעון": "clock tick",
    "תקתוק": "tick ticking clock", "ספירה": "countdown", "ספירה לאחור": "countdown", "שעון מעורר": "alarm clock", "אזעקה": "alarm siren",
    "כסף": "money cash", "קופה": "cash register", "תשלום": "payment", "מכונה": "machine mechanical", "מנוע": "engine motor",
    "מנעול": "lock", "פטיש": "hammer", "מקדחה": "drill", "מסור": "saw",
    # vehicles
    "רכב": "car vehicle", "מכונית": "car", "מכוניות": "car", "אוטו": "car", "דריפט": "drift skid tire", "צמיגים": "tire screech",
    "חריקת בלמים": "brake screech", "בלמים": "brake", "אופנוע": "motorcycle", "משאית": "truck", "רכבת": "train", "מטוס": "airplane plane jet",
    "מסוק": "helicopter", "סירה": "boat", "אוטובוס": "bus", "תנועה בכביש": "traffic", "כביש": "traffic road",
    # nature
    "טבע": "nature", "יער": "forest", "גשם": "rain", "סערה": "storm thunder", "ברק": "thunder lightning", "מים": "water",
    "התזה": "splash", "שפריץ": "splash spray", "טפטוף": "drip", "טיפה": "drip drop water", "ים": "ocean sea waves", "גלים": "waves ocean",
    "נהר": "river stream", "אש": "fire", "להבה": "flame fire", "בוער": "burning fire", "מדורה": "campfire fire crackle", "שלג": "snow",
    "עלים": "leaves", "לילה": "night", "צרצרים": "crickets",
    # animals
    "חיה": "animal", "חיות": "animals animal", "כלב": "dog bark", "נביחה": "bark dog", "חתול": "cat meow", "מיאו": "meow cat",
    "ציפור": "bird chirp", "ציפורים": "birds bird", "ציוץ": "chirp tweet bird", "אריה": "lion roar", "שאגה": "roar", "זאב": "wolf howl",
    "יללה": "howl", "פרה": "cow moo", "סוס": "horse neigh", "תרנגול": "rooster", "תרנגולת": "chicken", "חזיר": "pig oink",
    "כבשה": "sheep", "עז": "goat", "ברווז": "duck quack", "צפרדע": "frog", "קוף": "monkey", "פיל": "elephant", "ינשוף": "owl",
    "עורב": "crow", "דבורה": "bee buzz", "זבוב": "fly buzz", "נחש": "snake hiss", "דוב": "bear growl", "דולפין": "dolphin",
    "מדברת": "talking voice speech", "מדבר": "talking voice speech", "מדברים": "talking voices", "דיבור": "speech voice talking",
    # human
    "אנושי": "human voice", "אנושיים": "human", "אדם": "human", "קול": "voice", "קולות": "voices", "נשימה": "breath breathing",
    "נשיפה": "blow breath", "אנחה": "sigh", "שיעול": "cough", "התעטשות": "sneeze", "נשיקה": "kiss", "מחיאות כפיים": "applause clap",
    "מחיאות": "applause clap", "כפיים": "clap applause", "קהל": "crowd", "עידוד": "cheer crowd", "שריקה": "whistle", "בכי": "cry crying",
    "תינוק": "baby", "צעדים": "footsteps steps", "הליכה": "footsteps walking", "ריצה": "running footsteps run", "גיהוק": "burp",
    "הפתעה": "gasp surprise wow", "התנשפות": "gasp", "גבר": "male man", "אישה": "female woman", "ילדים": "children kids",
    "קריין": "announcer voice", "קריינות": "voiceover announcer",
    # barber & fitness
    "מספרה": "barber", "ספר": "barber", "מכונת תספורת": "hair clipper trimmer", "מכונה לשיער": "clipper trimmer", "טרימר": "trimmer",
    "מספריים": "scissors", "תספורת": "haircut scissors clipper", "שיער": "hair", "ספריי": "spray", "מרסס": "spray bottle",
    "פן": "hair dryer blow dryer", "מייבש": "hair dryer", "גילוח": "shave razor", "סכין גילוח": "razor shave", "קצף": "foam",
    "מסרק": "comb", "מברשת": "brush", "חדר כושר": "gym weights", "כושר": "gym fitness", "משקולות": "weights dumbbell",
    "אימון": "workout gym", "אגרוף שק": "punching bag", "איגרוף": "boxing", "שופט": "referee whistle", "כדור": "ball",
    "כדורסל": "basketball", "כדורגל": "soccer football", "טניס": "tennis", "אצטדיון": "stadium crowd",
    # ambience
    "אווירה": "ambience atmosphere", "רקע": "ambience background", "עיר": "city", "רחוב": "street city", "בית קפה": "cafe",
    "מסעדה": "restaurant", "משרד": "office", "חדר": "room tone",
}

# modifiers: words that steer filters/scoring, not matching
MODS = {
    "deep": {"tone": "dark", "low": 1}, "עמוק": {"tone": "dark", "low": 1}, "עמוקה": {"tone": "dark", "low": 1},
    "low": {"tone": "dark", "low": 1}, "נמוך": {"tone": "dark", "low": 1},
    "bright": {"tone": "bright"}, "בהיר": {"tone": "bright"}, "חד": {"tone": "bright", "attack": "fast"},
    "short": {"length": ["micro", "short"]}, "קצר": {"length": ["micro", "short"]}, "קצרה": {"length": ["micro", "short"]},
    "quick": {"length": ["micro", "short"]}, "מהיר": {"length": ["micro", "short"]}, "מהירה": {"length": ["micro", "short"]},
    "long": {"length": ["medium", "long", "bed"]}, "ארוך": {"length": ["medium", "long", "bed"]}, "ארוכה": {"length": ["medium", "long", "bed"]},
    "loud": {"loud": "loud"}, "חזק": {"loud": "loud"}, "חזקה": {"loud": "loud"}, "big": {"loud": "loud"}, "גדול": {"loud": "loud"},
    "ענק": {"loud": "loud"}, "huge": {"loud": "loud"}, "massive": {"loud": "loud"}, "heavy": {"loud": "loud", "low": 1},
    "כבד": {"loud": "loud", "low": 1}, "soft": {"loud": "soft"}, "רך": {"loud": "soft"}, "עדין": {"loud": "soft"},
    "עדינה": {"loud": "soft"}, "שקט": {"loud": "soft"}, "subtle": {"loud": "soft"}, "gentle": {"loud": "soft"},
    "realistic": {"style": "realistic"}, "אמיתי": {"style": "realistic"}, "ריאליסטי": {"style": "realistic"},
    "מקצועי": {"quality": 4.0}, "איכותי": {"quality": 4.0}, "professional": {"quality": 4.0},
}

EN_SYN = {
    "whoosh": "woosh swoosh swish", "swoosh": "whoosh swish", "transition": "whoosh swoosh sweep", "hit": "impact",
    "impact": "hit thud", "explosion": "explode blast boom", "boom": "explosion bass", "drop": "fall thud",
    "fall": "drop falling", "falling": "fall drop", "object": "item", "talking": "speech voice talk", "talk": "talking speech",
    "laugh": "laughing laughter giggle", "scream": "yell shout", "punch": "hit fist", "gun": "gunshot pistol", "car": "vehicle engine",
    "funny": "comedy cartoon", "scary": "horror creepy", "riser": "rise build", "glitch": "digital static", "click": "tap button",
    "dog": "bark", "cat": "meow", "bird": "chirp", "clipper": "trimmer clippers", "scissors": "scissor cut", "spray": "sprayer",
    "door": "doors", "glass": "shatter", "break": "breaking smash", "magic": "sparkle spell", "money": "cash coin",
}

STOP = {"של", "עם", "את", "או", "גם", "צליל", "צלילים", "סאונד", "אפקט", "אפקטים", "קול", "sound", "sounds", "sfx",
        "effect", "effects", "a", "an", "the", "of", "with", "for", "some", "like", "and", "or", "in", "on", "to", "אני", "רוצה", "תן", "לי"}
PREFIXES = "הובלמשכ"


def build() -> dict:
    cats = {cid: {"en": c["en"], "he": c["he"], "kw": c["kw"]} for cid, c in CATEGORIES.items()}
    lex = {"he": HE, "mods": MODS, "en_syn": EN_SYN, "stop": sorted(STOP), "prefixes": PREFIXES, "categories": cats}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "lexicon.json").write_text(json.dumps(lex, ensure_ascii=False, indent=0))
    return lex


if __name__ == "__main__":
    lx = build()
    print(len(lx["he"]), "hebrew entries")
