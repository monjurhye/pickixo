# -*- coding: utf-8 -*-
"""Generate unit02.json from the word lists read off the textbook pages.

Hand-typing thirteen lessons of JSON is where a quiz answer silently points at
the wrong option. Generating it means every answer index is *computed* from the
correct word rather than typed, so the class of bug that a child would
experience as "the app says I'm wrong when I'm right" cannot occur.

Run:  python scripts/build-unit02.py
"""
import json
import pathlib
import random

random.seed(2)   # stable output: regenerating must not reshuffle every quiz

# --- verified word for word from the pages --------------------------------
# lesson id, number, title, letters, book page, [(word, bangla, pron, category)]
GROUPS = [
    ("u2l1", 1, "Words with a A - e E", "a-e", 6, [
        ("ant", "পিঁপড়া", "অ্যান্ট", "animal"),
        ("boat", "নৌকা", "বোট", "vehicle"),
        ("crow", "কাক", "ক্রো", "bird"),
        ("deer", "হরিণ", "ডিয়ার", "animal"),
        ("ear", "কান", "ইয়ার", "body"),
    ]),
    ("u2l3", 3, "Words for f F - j J", "f-j", 11, [
        ("frog", "ব্যাঙ", "ফ্রগ", "animal"),
        ("garlic", "রসুন", "গার্লিক", "food"),
        ("honey", "মধু", "হানি", "food"),
        ("island", "দ্বীপ", "আইল্যান্ড", "place"),
        ("jute", "পাট", "জুট", "plant"),
    ]),
    ("u2l6", 6, "Words for k K - o O", "k-o", 17, [
        ("kitten", "বিড়ালছানা", "কিটেন", "animal"),
        ("ladder", "মই", "ল্যাডার", "object"),
        ("monkey", "বানর", "মাংকি", "animal"),
        ("nest", "পাখির বাসা", "নেস্ট", "nature"),
        ("orange", "কমলা", "অরেঞ্জ", "food"),
    ]),
    ("u2l8", 8, "Words for p P - t T", "p-t", 21, [
        ("pen", "কলম", "পেন", "object"),
        ("quilt", "কাঁথা", "কুইল্ট", "object"),
        ("robot", "রোবট", "রোবট", "object"),
        ("star", "তারা", "স্টার", "nature"),
        ("telescope", "দূরবীন", "টেলিস্কোপ", "object"),
    ]),
    ("u2l10", 10, "Words for u U - z Z", "u-z", 25, [
        ("uniform", "স্কুল পোশাক", "ইউনিফর্ম", "object"),
        ("vase", "ফুলদানি", "ভেইজ", "object"),
        ("whale", "তিমি", "হোয়েল", "animal"),
        ("x-ray", "এক্স-রে", "এক্স-রে", "object"),
        ("yoke", "জোয়াল", "ইয়োক", "object"),
        ("zebra", "জেব্রা", "জেব্রা", "animal"),
    ]),
]

NUMBER_WORDS = [
    ("one", "এক", "ওয়ান"), ("two", "দুই", "টু"), ("three", "তিন", "থ্রি"),
    ("four", "চার", "ফোর"), ("five", "পাঁচ", "ফাইভ"), ("six", "ছয়", "সিক্স"),
    ("seven", "সাত", "সেভেন"), ("eight", "আট", "এইট"), ("nine", "নয়", "নাইন"),
    ("ten", "দশ", "টেন"),
]

BN_NUMBER = {
    11: "এগারো", 12: "বারো", 13: "তেরো", 14: "চৌদ্দ", 15: "পনেরো",
    16: "ষোলো", 17: "সতেরো", 18: "আঠারো", 19: "উনিশ", 20: "বিশ",
    21: "একুশ", 22: "বাইশ", 23: "তেইশ", 24: "চব্বিশ", 25: "পঁচিশ",
    26: "ছাব্বিশ", 27: "সাতাশ", 28: "আটাশ", 29: "ঊনত্রিশ", 30: "ত্রিশ",
}


ASK_WHAT_IS_THIS_BN = "এটি কী?"
ASK_HOW_MANY_BN = "কয়টা আছে?"


def vocab(word, bangla, pron, page, category, image=None, example=None):
    return {
        "id": word.lower().replace(" ", "-"),
        "word": word,
        "bangla": bangla,
        "banglaPronunciation": pron,
        "banglaSource": "enrichment",
        "bookPage": page,
        "category": category,
        "image": image or word.lower().replace(" ", "-"),
        "audio": None,
        "example": example,
        "exampleSource": "textbook" if example else None,
    }


def distractors(correct, pool, n=2):
    others = [w for w in pool if w != correct]
    return random.sample(others, min(n, len(others)))


def options(labels):
    return [{"label": str(l)} for l in labels]


lessons = []

# ------------------------------------------------------------ letter lessons
for lid, number, title, letters, page, words in GROUPS:
    items = [vocab(w, bn, pr, page, cat) for (w, bn, pr, cat) in words]
    names = [w for (w, _, _, _) in words]

    rounds = []
    for (w, bn, _, _), item in zip(words, items):
        opts = [w] + distractors(w, names)
        random.shuffle(opts)
        # The picture is the question. Reading the word aloud here would have
        # answered it for the child before they had looked at anything.
        rounds.append({
            "id": "r-" + w,
            "ask": "Which word is this?",
            "askBn": "এটি কোন শব্দ?",
            "image": item["image"],
            "options": options(opts),
            "answer": opts.index(w),
            "hint": "It starts with " + w[0] + ".",
            "tests": w,
        })

    scramble = []
    for (w, _, _, _) in words[:3]:
        plain = w.replace("-", "")
        shuffled = list(plain)
        if len(set(plain)) > 1:
            while "".join(shuffled) == plain:
                random.shuffle(shuffled)
        opts = [w] + distractors(w, names)
        random.shuffle(opts)
        scramble.append({
            "id": "s-" + w,
            "ask": "Make a word: " + " ".join(shuffled),
            "askBn": "অক্ষর সাজিয়ে শব্দ বানাও",
            # No "speak" here either: hearing "ant" solves "n t a" instantly.
            "options": options(opts),
            "answer": opts.index(w),
            "hint": "It has " + str(len(plain)) + " letters.",
            "tests": w,
        })

    # Alternating listening and looking. A quiz made only of "which word did
    # you hear?" cannot be finished on a muted phone, or by a child who is hard
    # of hearing, and it tests only the one skill.
    questions = []
    for qi, ((w, bn, _, _), item) in enumerate(zip(words[:4], items[:4])):
        opts = [w] + distractors(w, names)
        random.shuffle(opts)
        questions.append({
            "id": "q-" + w,
            "type": "listen-choose" if qi % 2 == 0 else "tap-picture",
            "ask": ("Listen. Which word did you hear?" if qi % 2 == 0
                    else "What is this?"),
            "askBn": ("শোনো। কোন শব্দটি শুনলে?" if qi % 2 == 0 else ASK_WHAT_IS_THIS_BN),
            "speak": w if qi % 2 == 0 else None,
            "image": None if qi % 2 == 0 else item["image"],
            "options": options(opts),
            "answer": opts.index(w),
            "explain": None if qi % 2 == 0 else w + " = " + bn,
            "tests": w,
        })
    target, target_bn = words[0][0], words[0][1]
    opts = [target] + distractors(target, names)
    random.shuffle(opts)
    questions.append({
        "id": "q-meaning",
        "type": "tap-word",
        "ask": "Which word means " + target_bn + "?",
        "askBn": "কোন শব্দের অর্থ " + target_bn + "?",
        "options": options(opts),
        "answer": opts.index(target),
        "explain": target + " = " + target_bn,
        "tests": target,
    })

    lessons.append({
        "id": lid, "unitId": "u2", "number": number, "title": title,
        "titleBn": letters + " অক্ষরের শব্দ",
        "shape": "vocabulary",
        "bookPages": [page, page + 1, page + 2],
        "objective": "Read and say the words for letters " + letters + ".",
        "objectiveBn": letters + " অক্ষরের শব্দ পড়া ও বলা।",
        "minutes": 7,
        "vocabulary": items,
        "steps": [
            {"id": lid + "-intro", "type": "intro",
             "title": "Letters " + letters, "titleBn": "নতুন অক্ষর",
             "say": "Here are words for " + letters + ".",
             "sayBn": "এই অক্ষরগুলোর শব্দ শিখি।",
             "illustration": items[0]["image"]},
            {"id": lid + "-words", "type": "vocab", "bookActivity": "B",
             "title": "Look, listen and say", "titleBn": "দেখো, শোনো, বলো",
             "items": [i["id"] for i in items]},
            {"id": lid + "-game", "type": "game", "kind": "picture-to-word",
             "bookActivity": "F", "title": "Find the word",
             "titleBn": "শব্দ খুঁজে বের করো", "rounds": rounds},
            {"id": lid + "-scramble", "type": "game", "kind": "unscramble",
             "bookActivity": "D", "title": "Make the word",
             "titleBn": "শব্দ বানাও", "rounds": scramble},
            {"id": lid + "-quiz", "type": "quiz", "title": "Quick quiz",
             "titleBn": "ছোট্ট কুইজ", "questions": questions},
            {"id": lid + "-done", "type": "done", "title": "Great job!",
             "titleBn": "দারুণ হয়েছে!",
             "say": "You learned " + str(len(items)) + " new words!",
             "sayBn": "তুমি নতুন শব্দ শিখেছ!"},
        ],
    })

# ------------------------------------------------------------ number lessons
NUMBER_LESSONS = [
    ("u2l2", 2, 1, 5, 9), ("u2l4", 4, 6, 10, 14),
    ("u2l7", 7, 11, 15, 20), ("u2l9", 9, 16, 20, 24),
    ("u2l11", 11, 21, 25, 28), ("u2l13", 13, 26, 30, 30),
]
for lid, number, lo, hi, page in NUMBER_LESSONS:
    spelled = hi <= 10          # the book spells only 1-10
    items = []
    for n in range(lo, hi + 1):
        if spelled:
            word, bn, pron = NUMBER_WORDS[n - 1]
            items.append(vocab(word, bn, pron, page, "number",
                               image="number-" + str(n)))
        else:
            # The book prints the figure, not an English word. Recording the
            # figure keeps the claim true; the Bangla name is our addition.
            items.append({
                "id": "n" + str(n), "word": str(n), "bangla": BN_NUMBER[n],
                "banglaPronunciation": None, "banglaSource": "enrichment",
                "bookPage": page, "category": "number",
                "image": "number-" + str(n), "audio": None,
                "example": None, "exampleSource": None,
            })

    counting = []
    for n in range(lo, hi + 1):
        pool = [x for x in range(max(1, lo - 2), hi + 3) if x != n]
        opts = [str(n)] + [str(x) for x in random.sample(pool, 2)]
        random.shuffle(opts)
        # Without this picture the round asked "How many?" of nothing at all.
        counting.append({
            "id": "c" + str(n),
            "image": "count-" + str(n),
            "ask": "How many?",
            "askBn": "কয়টা আছে?",
            "options": [{"label": o, "image": "number-" + o} for o in opts],
            "answer": opts.index(str(n)),
            "hint": "Count them one by one.",
            "tests": items[n - lo]["id"],
        })

    questions = []
    for n in range(lo, min(lo + 4, hi + 1)):
        item = items[n - lo]
        pool = [x for x in range(max(1, lo - 2), hi + 3) if x != n]
        picks = random.sample(pool, 2)
        wrong = [NUMBER_WORDS[x - 1][0] if (spelled and x <= 10) else str(x)
                 for x in picks]
        opts = [item["word"]] + wrong
        random.shuffle(opts)
        listening = (n - lo) % 2 == 0
        questions.append({
            "id": "q" + str(n),
            "type": "listen-choose" if listening else "tap-picture",
            "ask": "Listen. Which number is it?" if listening else "How many?",
            "askBn": "শোনো। কোন সংখ্যা?" if listening else ASK_HOW_MANY_BN,
            "speak": item["word"] if listening else None,
            "image": None if listening else "count-" + str(n),
            "options": options(opts),
            "answer": opts.index(item["word"]),
            "tests": item["id"],
        })
    last = items[-1]
    opts = [last["word"], items[0]["word"]]
    questions.append({
        "id": "q-last", "type": "tap-word",
        "ask": "Which one is " + last["bangla"] + "?",
        "askBn": "কোনটি " + last["bangla"] + "?",
        "options": options(opts), "answer": 0,
        "explain": last["word"] + " = " + last["bangla"],
        "tests": last["id"],
    })

    lessons.append({
        "id": lid, "unitId": "u2", "number": number,
        "title": "Numbers " + str(lo) + "-" + str(hi),
        "titleBn": "সংখ্যা " + str(lo) + "-" + str(hi),
        "shape": "numbers", "bookPages": [page],
        "objective": ("Count and read the numbers " + str(lo) + " to "
                      + str(hi) + "."
                      + ("" if spelled
                         else " The textbook shows these as figures only.")),
        "objectiveBn": str(lo) + " থেকে " + str(hi) + " পর্যন্ত গোনা ও পড়া।",
        "minutes": 6,
        "vocabulary": items,
        "steps": [
            {"id": lid + "-intro", "type": "intro",
             "title": "Numbers " + str(lo) + " to " + str(hi),
             "titleBn": "সংখ্যা " + str(lo) + "-" + str(hi),
             "say": "Let us count together.",
             "sayBn": "চলো একসাথে গুনি।",
             "illustration": "number-" + str(lo)},
            {"id": lid + "-words", "type": "vocab", "bookActivity": "A",
             "title": "Listen and count", "titleBn": "শোনো আর গোনো",
             "items": [i["id"] for i in items]},
            {"id": lid + "-count", "type": "game", "kind": "count-objects",
             "bookActivity": "A", "title": "Count them!",
             "titleBn": "গুনে বলো!", "rounds": counting},
            {"id": lid + "-quiz", "type": "quiz", "title": "Quick quiz",
             "titleBn": "ছোট্ট কুইজ", "questions": questions},
            {"id": lid + "-done", "type": "done", "title": "Well counted!",
             "titleBn": "ঠিক গুনেছ!",
             "say": "You can count to " + str(hi) + "!",
             "sayBn": "তুমি " + str(hi) + " পর্যন্ত গুনতে পারো!"},
        ],
    })

# ---------------------------------------------------- lesson 5: Little Seed
lessons.append({
    "id": "u2l5", "unitId": "u2", "number": 5,
    "title": "Rhyme - Little seed", "titleBn": "ছড়া - ছোট্ট বীজ",
    "shape": "rhyme", "bookPages": [16],
    "objective": "Say the rhyme and tell how a plant grows.",
    "objectiveBn": "ছড়া বলা আর গাছ কীভাবে বড় হয় তা বলা।",
    "minutes": 6,
    "vocabulary": [
        vocab("seed", "বীজ", "সিড", 16, "plant", image="seed",
              example="I plant a little seed."),
        vocab("sun", "সূর্য", "সান", 16, "nature", image="sunrise",
              example="Out comes the sun, big and round."),
        vocab("rain", "বৃষ্টি", "রেইন", 16, "nature", image="rain",
              example="Down come the rain drops, soft and slow."),
        vocab("flower", "ফুল", "ফ্লাওয়ার", 16, "plant", image="flower",
              example="Up comes a flower, grow, grow, grow!"),
    ],
    "steps": [
        {"id": "u2l5-intro", "type": "intro", "title": "How a plant grows",
         "titleBn": "গাছ কীভাবে বড় হয়", "say": "A seed grows into a flower.",
         "sayBn": "একটি বীজ থেকে ফুল হয়।", "illustration": "seed"},
        {"id": "u2l5-words", "type": "vocab", "title": "New words",
         "titleBn": "নতুন শব্দ", "items": ["seed", "sun", "rain", "flower"]},
        {"id": "u2l5-rhyme", "type": "rhyme", "bookActivity": "B",
         "title": "Little Seed", "titleBn": "ছড়া: Little Seed",
         "source": "textbook",
         "verses": [
             ["I plant a little seed", "In the ground."],
             ["Out comes the sun,", "Big and round."],
             ["Down come the rain drops,", "Soft and slow."],
             ["Up comes a flower,", "Grow, grow, grow!"],
         ]},
        {"id": "u2l5-order", "type": "game", "kind": "order-the-scenes",
         "bookActivity": "A", "title": "What comes first?",
         "titleBn": "কোনটা আগে?",
         "rounds": [
             {"id": "o1", "ask": "What do we plant first?",
              "askBn": "প্রথমে কী লাগাই?",
              "options": [{"label": "seed", "image": "seed"},
                          {"label": "flower", "image": "flower"}],
              "answer": 0, "hint": "A plant starts very small.",
              "tests": "seed"},
             {"id": "o2", "ask": "What comes out big and round?",
              "askBn": "বড় আর গোল হয়ে কী ওঠে?",
              "speak": "Out comes the sun, big and round.",
              "options": [{"label": "rain", "image": "rain"},
                          {"label": "sun", "image": "sunrise"}],
              "answer": 1, "hint": "It is in the sky by day.", "tests": "sun"},
             {"id": "o3", "ask": "What comes last?", "askBn": "শেষে কী হয়?",
              "options": [{"label": "flower", "image": "flower"},
                          {"label": "seed", "image": "seed"}],
              "answer": 0, "hint": "Grow, grow, grow!", "tests": "flower"},
         ]},
        {"id": "u2l5-quiz", "type": "quiz", "title": "Quick quiz",
         "titleBn": "ছোট্ট কুইজ",
         "questions": [
             {"id": "q1", "type": "fill-blank", "ask": "I plant a little ___ .",
              "options": options(["seed", "sun", "rain"]), "answer": 0,
              "explain": "The rhyme says: I plant a little seed.",
              "tests": "seed"},
             {"id": "q2", "type": "listen-choose", "ask": "Listen. Which word?",
              "askBn": "শোনো। কোন শব্দ?", "speak": "rain",
              "options": options(["rain", "sun", "seed"]), "answer": 0,
              "tests": "rain"},
             {"id": "q3", "type": "true-false",
              "ask": "A flower comes up at the end.",
              "askBn": "শেষে ফুল ফোটে।",
              "options": options(["True", "False"]), "answer": 0,
              "explain": "Up comes a flower, grow, grow, grow!",
              "tests": "flower"},
             {"id": "q4", "type": "tap-word",
              "ask": "Which word means সূর্য?", "askBn": "কোন শব্দের অর্থ সূর্য?",
              "options": options(["sun", "rain", "seed"]), "answer": 0,
              "explain": "sun = সূর্য", "tests": "sun"},
         ]},
        {"id": "u2l5-done", "type": "done", "title": "Lovely rhyme!",
         "titleBn": "সুন্দর ছড়া!", "say": "You know how a plant grows!",
         "sayBn": "গাছ কীভাবে বড় হয় তুমি জানো!"},
    ],
})

# ---------------------------------------------- lesson 12: Eating vegetables
VEG = [("tomato", "টমেটো", "টমেটো"), ("carrot", "গাজর", "ক্যারট"),
       ("cabbage", "বাঁধাকপি", "ক্যাবেজ"), ("peas", "মটরশুঁটি", "পিজ")]
veg_items = [vocab(w, bn, pr, 29, "food") for (w, bn, pr) in VEG]
veg_names = [w for (w, _, _) in VEG]
veg_rounds = []
for (w, bn, _), veg_item in zip(VEG, veg_items):
    opts = [w] + distractors(w, veg_names)
    random.shuffle(opts)
    veg_rounds.append({
        "id": "v-" + w, "ask": "Which vegetable is this?",
        "askBn": "এটি কোন সবজি?", "image": veg_item["image"],
        "options": options(opts), "answer": opts.index(w),
        "hint": "Its Bangla name is " + bn + ".", "tests": w,
    })

lessons.append({
    "id": "u2l12", "unitId": "u2", "number": 12, "title": "Eating vegetables",
    "titleBn": "সবজি খাওয়া", "shape": "rhyme", "bookPages": [29],
    "objective": "Name vegetables and say the rhyme.",
    "objectiveBn": "সবজির নাম বলা আর ছড়া বলা।", "minutes": 6,
    "vocabulary": veg_items,
    "steps": [
        {"id": "u2l12-intro", "type": "intro", "title": "Vegetables",
         "titleBn": "সবজি", "say": "Vegetables help you grow strong.",
         "sayBn": "সবজি খেলে শরীর শক্ত হয়।", "illustration": "vegetables"},
        {"id": "u2l12-words", "type": "vocab", "bookActivity": "A",
         "title": "Name the vegetables", "titleBn": "সবজির নাম বলো",
         "items": [i["id"] for i in veg_items]},
        {"id": "u2l12-rhyme", "type": "rhyme", "bookActivity": "B",
         "title": "Vegetables", "titleBn": "ছড়া: Vegetables",
         "source": "textbook",
         "verses": [
             ["Tomatoes and carrots", "Cabbage and peas",
              "Look so yummy", "All red and green."],
             ["So little children", "Eat them everyday",
              "To make you grow", "Strong and smart."],
         ]},
        {"id": "u2l12-game", "type": "game", "kind": "picture-to-word",
         "title": "Find the vegetable", "titleBn": "সবজি খুঁজে বের করো",
         "rounds": veg_rounds},
        {"id": "u2l12-quiz", "type": "quiz", "title": "Quick quiz",
         "titleBn": "ছোট্ট কুইজ",
         "questions": [
             {"id": "q1", "type": "fill-blank", "ask": "Tomatoes and ___ .",
              "options": options(["carrots", "peas", "cabbage"]), "answer": 0,
              "explain": "The rhyme says: Tomatoes and carrots.",
              "tests": "carrot"},
             {"id": "q2", "type": "listen-choose", "ask": "Listen. Which one?",
              "askBn": "শোনো। কোনটি?", "speak": "cabbage",
              "options": options(["cabbage", "tomato", "peas"]), "answer": 0,
              "tests": "cabbage"},
             {"id": "q3", "type": "tap-word",
              "ask": "Which word means গাজর?", "askBn": "কোন শব্দের অর্থ গাজর?",
              "options": options(["carrot", "peas", "tomato"]), "answer": 0,
              "explain": "carrot = গাজর", "tests": "carrot"},
             {"id": "q4", "type": "true-false",
              "ask": "Vegetables help you grow strong.",
              "askBn": "সবজি খেলে শরীর শক্ত হয়।",
              "options": options(["True", "False"]), "answer": 0,
              "explain": "To make you grow strong and smart.", "tests": "peas"},
         ]},
        {"id": "u2l12-done", "type": "done", "title": "Yummy!",
         "titleBn": "মজার!", "say": "You can name four vegetables!",
         "sayBn": "তুমি চারটি সবজির নাম বলতে পারো!"},
    ],
})

lessons.sort(key=lambda l: l["number"])

unit = {
    "id": "u2", "number": 2,
    "title": "The Alphabet, Words and Numbers",
    "titleBn": "বর্ণমালা, শব্দ ও সংখ্যা",
    "colour": "amber", "icon": "abc",
    "_source": "English for Today, Class Two (NCTB). Unit 2, book pages 6-30.",
    "_note": ("Words and rhymes are transcribed from the textbook. Bangla "
              "meanings are Pickixo's addition - the book carries no glosses. "
              "Numbers 11-30 appear in the book as figures only, so no English "
              "spelling is claimed for them."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit02.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n",
               encoding="utf-8")

words = sum(len(l["vocabulary"]) for l in lessons)
print("unit02.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
