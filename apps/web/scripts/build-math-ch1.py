# -*- coding: utf-8 -*-
"""Generate chapter01.json — অধ্যায় ১: সংখ্যা ও স্থানীয় মান.

This first delivery is Topic 1 only: "সংখ্যা পড়ি ও কথায় লিখি (২১ থেকে ১০০)"
(book pages 1-7). The remaining topics of chapter 1 (গণনা, সংখ্যার তুলনা,
স্থানীয় মান, জোড়-বিজোড় সংখ্যা ও প্যাটার্ন, ক্রমবাচক সংখ্যা) come later and are
appended to this same chapter file, the same way build-unit02.py through
build-unit09.py each added one more unit to the English course.

Same reason as every build-unit*.py: every game and quiz answer index is
*computed* from the correct option, never typed, so a mistake here cannot
reach a child as "the app says I'm wrong when I'm right".

The Bangla number words for 21-100 are transcribed word for word from the two
reading tables on book pages 1-6 (২১-৫০ across five pages, ৫১-১০০ in one
table on page 6). They are standard, but transcribed from the book rather
than generated, because the book is the authority here, not a spelling rule.

Run:  python scripts/build-math-ch1.py
"""
import json
import pathlib
import random

random.seed(101)  # stable output: regenerating must not reshuffle every quiz

# --- ২১ থেকে ১০০, word for word from book pages 1-6 -----------------------
WORDS = {
    21: "একুশ", 22: "বাইশ", 23: "তেইশ", 24: "চব্বিশ", 25: "পঁচিশ",
    26: "ছাব্বিশ", 27: "সাতাশ", 28: "আটাশ", 29: "উনত্রিশ", 30: "ত্রিশ",
    31: "একত্রিশ", 32: "বত্রিশ", 33: "তেত্রিশ", 34: "চৌত্রিশ", 35: "পঁয়ত্রিশ",
    36: "ছত্রিশ", 37: "সাঁইত্রিশ", 38: "আটত্রিশ", 39: "উনচল্লিশ", 40: "চল্লিশ",
    41: "একচল্লিশ", 42: "বিয়াল্লিশ", 43: "তেতাল্লিশ", 44: "চুয়াল্লিশ",
    45: "পঁয়তাল্লিশ", 46: "ছেচল্লিশ", 47: "সাতচল্লিশ", 48: "আটচল্লিশ",
    49: "ঊনপঞ্চাশ", 50: "পঞ্চাশ",
    51: "একান্ন", 52: "বায়ান্ন", 53: "তিপ্পান্ন", 54: "চুয়ান্ন", 55: "পঞ্চান্ন",
    56: "ছাপ্পান্ন", 57: "সাতান্ন", 58: "আটান্ন", 59: "উনষাট", 60: "ষাট",
    61: "একষট্টি", 62: "বাষট্টি", 63: "তেষট্টি", 64: "চৌষট্টি", 65: "পঁয়ষট্টি",
    66: "ছেষট্টি", 67: "সাতষট্টি", 68: "আটষট্টি", 69: "ঊনসত্তর", 70: "সত্তর",
    71: "একাত্তর", 72: "বাহাত্তর", 73: "তিয়াত্তর", 74: "চুয়াত্তর", 75: "পঁচাত্তর",
    76: "ছিয়াত্তর", 77: "সাতাত্তর", 78: "আটাত্তর", 79: "উনআশি", 80: "আশি",
    81: "একাশি", 82: "বিরাশি", 83: "তিরাশি", 84: "চুরাশি", 85: "পঁচাশি",
    86: "ছিয়াশি", 87: "সাতাশি", 88: "আটাশি", 89: "উননব্বই", 90: "নব্বই",
    91: "একানব্বই", 92: "বিরানব্বই", 93: "তিরানব্বই", 94: "চুরানব্বই",
    95: "পঁচানব্বই", 96: "ছিয়ানব্বই", 97: "সাতানব্বই", 98: "আটানব্বই",
    99: "নিরানব্বই", 100: "একশত",
}
# Which book page (1-6) each number was read from.
PAGE_OF = {}
for lo, hi, page in [(21, 24, 1), (25, 30, 2), (31, 36, 3), (37, 42, 4),
                      (43, 48, 5), (49, 100, 6)]:
    for v in range(lo, hi + 1):
        PAGE_OF[v] = page


def bn_digits(n):
    """A number written with Bangla digits, e.g. 54 -> '৫৪'."""
    table = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
    return str(n).translate(table)


def blocks_of(value):
    if value == 100:
        return {"hundreds": 1, "tens": 0, "ones": 0}
    return {"hundreds": 0, "tens": value // 10, "ones": value % 10}


def number_item(value):
    return {
        "id": "n%d" % value,
        "value": value,
        "blocks": blocks_of(value),
        "wordBn": WORDS[value],
        "bookPage": PAGE_OF[value],
    }


NUMBERS = [number_item(v) for v in range(21, 101)]
BY_ID = {n["id"]: n for n in NUMBERS}
ALL_WORDS = [n["wordBn"] for n in NUMBERS]


def others(word, pool, n=2):
    return random.sample([w for w in pool if w != word], n)


def labelled(correct, wrongs):
    labels = [correct] + list(wrongs)
    random.shuffle(labels)
    return [{"label": l} for l in labels], labels.index(correct)


def rnd(rid, ask, correct, wrongs, tests=None, illustration=None, speak=None, hint=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": rid, "ask": ask, "illustration": illustration, "speak": speak,
            "options": opts, "answer": answer, "hint": hint, "tests": tests}


def question(qid, ask, correct, wrongs, tests=None, illustration=None, speak=None, explain=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": qid, "ask": ask, "illustration": illustration, "speak": speak,
            "options": opts, "answer": answer, "explain": explain, "tests": tests}


def block_name(item):
    b = item["blocks"]
    # 1000 is the one four-digit value at this level; ten hundred-flats would
    # be an unreadable wall of squares, so it gets a plain number card instead
    # — the same escape hatch a real classroom uses when a manipulative stops
    # being clearer than just writing the numeral.
    if item["value"] == 1000:
        return "number-1000"
    return "blocks-%d-%d-%d" % (b["hundreds"], b["tens"], b["ones"])


def table_step(tid, title, values, activity=None):
    rows = []
    for v in values:
        item = BY_ID["n%d" % v]
        rows.append({
            "id": "row%d" % v,
            "illustration": block_name(item),
            "text": "%s = %s" % (bn_digits(v), item["wordBn"]),
            "tests": item["id"],
        })
    return {"id": tid, "type": "table", "bookActivity": activity, "title": title, "rows": rows}


topic1 = {
    "id": "c1t1", "chapterId": "c1", "number": 1,
    "title": "সংখ্যা পড়ি ও কথায় লিখি (২১ থেকে ১০০)",
    "shape": "number",
    "bookPages": [1, 2, 3, 4, 5, 6, 7],
    "objective": "রুক (ব্লক) দেখে ২১ থেকে ১০০ পর্যন্ত সংখ্যা পড়া ও কথায় লেখা।",
    "minutes": 10,
    "numbers": NUMBERS,
    "steps": [
        {
            "id": "c1t1-intro", "type": "intro",
            "title": "চলো সংখ্যা পড়ি!",
            "say": "রুকগুলো গণনা করে সংখ্যাটি পড়ি ও কথায় লিখি।",
            "illustration": "blocks-0-5-4",
        },
        table_step("c1t1-t21", "২১ থেকে ৩০", list(range(21, 31)), "গণনা করি"),
        table_step("c1t1-t31", "৩১ থেকে ৪০", list(range(31, 41)), "গণনা করি"),
        table_step("c1t1-t41", "৪১ থেকে ৫০", list(range(41, 51)), "গণনা করি"),
        table_step("c1t1-t51", "৫১ থেকে ৬০", list(range(51, 61)), "৫১ থেকে ১০০ পর্যন্ত"),
        table_step("c1t1-t61", "৬১ থেকে ৭০", list(range(61, 71)), "৫১ থেকে ১০০ পর্যন্ত"),
        table_step("c1t1-t71", "৭১ থেকে ৮০", list(range(71, 81)), "৫১ থেকে ১০০ পর্যন্ত"),
        table_step("c1t1-t81", "৮১ থেকে ৯০", list(range(81, 91)), "৫১ থেকে ১০০ পর্যন্ত"),
        table_step("c1t1-t91", "৯১ থেকে ১০০", list(range(91, 101)), "৫১ থেকে ১০০ পর্যন্ত"),
        {
            "id": "c1t1-game1", "type": "game", "kind": "count-blocks",
            "bookActivity": "রুক দেখে সংখ্যা", "title": "রুক দেখে সংখ্যাটি বলো",
            "rounds": [
                rnd("g%d" % v, "কয়টি রুক আছে?", BY_ID["n%d" % v]["wordBn"],
                    others(BY_ID["n%d" % v]["wordBn"], ALL_WORDS),
                    tests="n%d" % v, illustration=block_name(BY_ID["n%d" % v]),
                    hint="আগে দশ-এর দল গণনা করো, তারপর এক।")
                for v in [24, 36, 45, 58, 67, 79, 83, 96]
            ],
        },
        {
            "id": "c1t1-game2", "type": "game", "kind": "match-pairs",
            "bookActivity": "শুনে সংখ্যা বাছাই", "title": "শুনে সংখ্যাটি বাছাই করো",
            "rounds": [
                rnd("l%d" % v, "সংখ্যাটি শোনো।", bn_digits(v),
                    [bn_digits(w) for w in random.sample([x for x in range(21, 101) if x != v], 2)],
                    tests="n%d" % v, speak=BY_ID["n%d" % v]["wordBn"],
                    hint="আরেকবার শোনো, তারপর অঙ্কে সংখ্যাটি খোঁজো।")
                for v in [29, 42, 54, 65, 78, 89]
            ],
        },
        {
            "id": "c1t1-quiz", "type": "quiz", "title": "ছোট্ট কুইজ",
            "questions": [
                question("q1", "রুক দেখে সংখ্যাটি বলো।", BY_ID["n54"]["wordBn"],
                         others(BY_ID["n54"]["wordBn"], ALL_WORDS), tests="n54",
                         illustration=block_name(BY_ID["n54"]), explain="৫৪ = চুয়ান্ন"),
                question("q2", "শোনো। কোন সংখ্যাটি শুনলে?", bn_digits(75),
                         [bn_digits(w) for w in random.sample([x for x in range(21, 101) if x != 75], 2)],
                         tests="n75", speak=BY_ID["n75"]["wordBn"]),
                question("q3", "৮৯ কে কথায় লিখলে হয়:", BY_ID["n89"]["wordBn"],
                         others(BY_ID["n89"]["wordBn"], ALL_WORDS), tests="n89",
                         explain="৮৯ = উননব্বই"),
                question("q4", "১০০ সংখ্যাটিকে কথায় লিখি:", "একশত",
                         others("একশত", ALL_WORDS), tests="n100", illustration="blocks-1-0-0",
                         explain="১০০ = একশত"),
                question("q5", "রুক দেখে সংখ্যাটি বলো।", BY_ID["n32"]["wordBn"],
                         others(BY_ID["n32"]["wordBn"], ALL_WORDS), tests="n32",
                         illustration=block_name(BY_ID["n32"]), explain="৩২ = বত্রিশ"),
            ],
        },
        {
            "id": "c1t1-done", "type": "done", "title": "দারুণ হয়েছে!",
            "say": "তুমি এখন ২১ থেকে ১০০ পর্যন্ত সংখ্যা পড়তে ও কথায় লিখতে পারো!",
        },
    ],
}

# =========================================================================
# Topic 2 - গণনা (book pages 8-13)
# =========================================================================
def hto(value):
    h, t, o = value // 100, (value % 100) // 10, value % 10
    return {"hundreds": h, "tens": t, "ones": o}


# Standard, unambiguous Bangla words for 1-20 -- not book-page-cited on their
# own (the book starts its reading table at 21), but their composition into
# hundreds below is verified: applying HUNDRED_WORD[h] + "শত" (+ " " + this
# table's word for the remainder) reproduces all six of the book's own
# worked examples on page 13 exactly (একশত দশ, তিনশত ঊনপঞ্চাশ, পাঁচশত পঁচাশি,
# ছয়শত বাহাত্তর, আটশত পঞ্চাশ, নয়শত আট) — so the rule is the book's rule, even
# where a specific 3-digit value is not printed in it.
WORDS_1_20 = {
    1: "এক", 2: "দুই", 3: "তিন", 4: "চার", 5: "পাঁচ", 6: "ছয়", 7: "সাত", 8: "আট", 9: "নয়",
    10: "দশ", 11: "এগারো", 12: "বারো", 13: "তেরো", 14: "চৌদ্দ", 15: "পনেরো",
    16: "ষোলো", 17: "সতেরো", 18: "আঠারো", 19: "উনিশ", 20: "বিশ",
}
WORDS_1_100 = {**WORDS_1_20, **WORDS}
HUNDRED_WORD = {n: WORDS_1_20[n] for n in range(1, 10)}


def compose_word(value):
    if value == 1000:
        return "এক হাজার"
    if value <= 100:
        return WORDS_1_100[value]
    h, r = value // 100, value % 100
    base = HUNDRED_WORD[h] + "শত"
    return base if r == 0 else "%s %s" % (base, WORDS_1_100[r])


def t2_number(nid, value, word_bn, page):
    return {"id": nid, "value": value, "blocks": hto(value),
            "wordBn": word_bn if word_bn else compose_word(value), "bookPage": page}


def t2_block_name(value):
    if value == 1000:
        return "number-1000"
    b = hto(value)
    return "blocks-%d-%d-%d" % (b["hundreds"], b["tens"], b["ones"])


def worked(sid, title, lines, activity=None):
    return {"id": sid, "type": "worked", "bookActivity": activity, "title": title,
            "source": "textbook", "lines": lines}


# Own practice numbers for "count the blocks" (enrichment: the concept is the
# book's, these particular values are not printed in it).
PRACTICE_T2 = [128, 206, 350, 417, 509, 663]
practice_items_t2 = [t2_number("p%d" % v, v, None, 9) for v in PRACTICE_T2]

# The book's own list for "১০১ থেকে ৫০০" vs "৫০১ থেকে ১০০০" (book page 13),
# transcribed in the order printed.
RANGE_LIST = [112, 898, 304, 505, 712, 925, 134, 998, 1000, 888, 382, 750, 600, 333, 101, 590]
range_items_t2 = [t2_number("r%d" % v, v, None, 13) for v in RANGE_LIST]

# The book's own word -> numeral table (book page 13), word for word.
WORD_TABLE = [
    (110, "একশত দশ"), (349, "তিনশত ঊনপঞ্চাশ"), (585, "পাঁচশত পঁচাশি"),
    (672, "ছয়শত বাহাত্তর"), (850, "আটশত পঞ্চাশ"), (908, "নয়শত আট"),
]
word_items_t2 = [t2_number("w%d" % v, v, word, 13) for v, word in WORD_TABLE]

count_rounds_t2 = [
    rnd("c%d" % v, "রুক গণনা করে সংখ্যাটি অঙ্কে লিখি।", bn_digits(v),
        [bn_digits(w) for w in random.sample([x for x in range(100, 999) if x != v], 2)],
        tests="p%d" % v, illustration=t2_block_name(v),
        hint="আগে শত, তারপর দশ, শেষে এক গণনা করো।")
    for v in PRACTICE_T2
]

RANGE_LOW, RANGE_HIGH = "১০১ থেকে ৫০০", "৫০১ থেকে ১০০০"
range_rounds_t2 = [
    rnd("g%d" % v, "%s — এটি কোন দলে পড়ে?" % bn_digits(v),
        RANGE_LOW if v <= 500 else RANGE_HIGH,
        [RANGE_HIGH if v <= 500 else RANGE_LOW],
        tests="r%d" % v, hint="৫০০ পর্যন্ত হলে প্রথম দল, তার বেশি হলে দ্বিতীয় দল।")
    for v in [112, 505, 925, 1000, 382, 101]
]

word_rounds_t2 = [
    rnd("wq%d" % v, word, bn_digits(v),
        [bn_digits(w) for w in random.sample([x for x in range(100, 999) if x != v], 2)],
        tests="w%d" % v, speak=word, hint="প্রথমে শতকের অঙ্ক, তারপর বাকি অংশ ভাবো।")
    for v, word in WORD_TABLE
]

quiz_t2 = [
    question("q1", "রুক গণনা করে সংখ্যাটি অঙ্কে লিখি।", bn_digits(54),
             [bn_digits(w) for w in random.sample([x for x in range(21, 100) if x != 54], 2)],
             illustration="blocks-0-5-4", explain="৫ দশ ও ৪ এক = ৫৪"),
    question("q2", "রুক গণনা করে সংখ্যাটি অঙ্কে লিখি।", bn_digits(345),
             [bn_digits(w) for w in random.sample([x for x in range(100, 999) if x != 345], 2)],
             illustration="blocks-3-4-5", explain="৩ শত, ৪ দশ, ৫ এক = তিনশত পঁয়তাল্লিশ (৩৪৫)"),
    question("q3", "৯২৫ — এটি কোন দলে পড়ে?", RANGE_HIGH, [RANGE_LOW], tests="r925",
             explain="৯২৫, ৫০০-এর চেয়ে বড়, তাই ৫০১ থেকে ১০০০ দলে পড়ে।"),
    question("q4", "একশত দশ", bn_digits(110),
             [bn_digits(w) for w in random.sample([x for x in range(100, 999) if x != 110], 2)],
             tests="w110", speak="একশত দশ", explain="একশত দশ = ১১০"),
    question("q5", "১০০০ সংখ্যাটি কি ৫০১ থেকে ১০০০ দলে পড়ে?", "সত্যি", ["মিথ্যা"],
             tests="r1000", explain="১০০০, এই দলের শেষ সংখ্যা।"),
]

topic2 = {
    "id": "c1t2", "chapterId": "c1", "number": 2,
    "title": "গণনা",
    "shape": "number",
    "bookPages": list(range(8, 14)),
    "objective": "১০ ও ১০০-এর দল গঠন করে ১০০০ পর্যন্ত সংখ্যা গণনা করা এবং সংখ্যাকে ১০১-৫০০ ও ৫০১-১০০০ দলে ভাগ করা।",
    "minutes": 10,
    "numbers": practice_items_t2 + range_items_t2 + word_items_t2,
    "steps": [
        {
            "id": "c1t2-intro", "type": "intro", "title": "এতগুলো ফুল গণনা করি কীভাবে?",
            "say": "এতগুলো ফুল কীভাবে সহজে গণনা করা যায়?", "illustration": "flowers",
        },
        worked("c1t2-w1", "১০ এর দল গঠন করে গণনা করি", [
            {"text": "তোমার কী মনে আছে, কীভাবে আমরা ১০ এর দল গঠন করে ১ম শ্রেণিতে গণনা করেছি?", "speaker": "tuli"},
            {"text": "চলো, আমরা ১০ এর দল গঠন করে গণনা করি।", "speaker": "rafi"},
        ], "গণনা"),
        worked("c1t2-w2", "রুক দিয়ে গণনা করি", [
            {"text": "১০ এর রুক আছে ৫টি ও ১ এর রুক আছে ৪টি।", "illustration": "blocks-0-5-4"},
            {"text": "সংখ্যাটি হলো: চুয়ান্ন। অঙ্কে লিখতে পারি ৫৪।", "illustration": "number-54"},
        ], "ফুলের পরিবর্তে রুক ব্যবহার করে গণনা করি"),
        worked("c1t2-w3", "১০০ ও ১০ এর দল দিয়ে গণনা করি", [
            {"text": "তিনটি একশত এর দল = তিনশত।", "illustration": "blocks-3-0-0"},
            {"text": "চারটি দশ এর দল = চল্লিশ।", "illustration": "blocks-0-4-0"},
            {"text": "একটি করে পাঁচটি রুক = পাঁচ।", "illustration": "blocks-0-0-5"},
            {"text": "সংখ্যাটি হলো: তিনশত পঁয়তাল্লিশ। সংখ্যাটি অঙ্কে: ৩৪৫।", "illustration": "blocks-3-4-5"},
        ], "রুকের মাধ্যমে ১০০ ও ১০ এর দল তৈরি করে গণনা করি"),
        {
            "id": "c1t2-game1", "type": "game", "kind": "count-blocks",
            "bookActivity": "নিজে করি", "title": "রুক গণনা করে অঙ্কে লিখি",
            "rounds": count_rounds_t2,
        },
        {
            "id": "c1t2-game2", "type": "game", "kind": "order",
            "bookActivity": "১০১-৫০০ ও ৫০১-১০০০", "title": "কোন দলে পড়ে?",
            "rounds": range_rounds_t2,
        },
        {
            "id": "c1t2-game3", "type": "game", "kind": "match-pairs",
            "bookActivity": "পড়ি ও অঙ্কে লিখি", "title": "পড়ে অঙ্কে লিখি",
            "rounds": word_rounds_t2,
        },
        {"id": "c1t2-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t2},
        {
            "id": "c1t2-done", "type": "done", "title": "দারুণ হয়েছে!",
            "say": "তুমি এখন ১০০০ পর্যন্ত সংখ্যা রুক দিয়ে গণনা করতে পারো!",
        },
    ],
}

# =========================================================================
# Topic 3 - সংখ্যার তুলনা (book pages 14-16)
# =========================================================================
def cmp_item(nid, value, page):
    return t2_number(nid, value, None, page)


T3_NUMS = [62, 45, 434, 253, 354, 325]
t3_items = {v: cmp_item("cn%d" % v, v, 14) for v in T3_NUMS}

BIGGER_PAIRS = [(85, 57), (524, 348), (634, 670), (423, 428), (823, 540), (901, 972)]
SMALLER_PAIRS = [(75, 65), (423, 337), (557, 642), (876, 706), (678, 948), (785, 639)]
for a, b in BIGGER_PAIRS + SMALLER_PAIRS:
    for v in (a, b):
        if v not in t3_items:
            t3_items[v] = cmp_item("cn%d" % v, v, 16)

bigger_rounds_t3 = [
    rnd("b%d-%d" % (a, b), "কোনটি বড়ো?", bn_digits(max(a, b)), [bn_digits(min(a, b))],
        tests="cn%d" % max(a, b), hint="প্রথমে বড়ো ঘরের (শতক/দশক) অঙ্ক তুলনা করো।")
    for a, b in BIGGER_PAIRS
]
smaller_rounds_t3 = [
    rnd("s%d-%d" % (a, b), "কোনটি ছোটো?", bn_digits(min(a, b)), [bn_digits(max(a, b))],
        tests="cn%d" % min(a, b), hint="প্রথমে বড়ো ঘরের (শতক/দশক) অঙ্ক তুলনা করো।")
    for a, b in SMALLER_PAIRS
]

quiz_t3 = [
    question("q1", "৬২ ও ৪৫ এর মধ্যে কোনটি বড়ো?", bn_digits(62), [bn_digits(45)], tests="cn62",
             illustration="blocks-0-6-2", explain="৬২ তে ৬টি দশক, ৪৫ এ ৪টি দশক। তাই ৬২ বড়ো।"),
    question("q2", "৪৩৪ ও ২৫৩ এর মধ্যে কোনটি ছোটো?", bn_digits(253), [bn_digits(434)], tests="cn253",
             illustration="blocks-2-5-3", explain="২৫৩ তে ২টি শতক, ৪৩৪ এ ৪টি শতক। তাই ২৫৩ ছোটো।"),
    question("q3", "৩৫৪ ও ৩২৫ — শতকের অঙ্ক দুটি সমান। তাহলে কীসের অঙ্ক তুলনা করব?",
             "দশকের", ["এককের", "শতকের"], explain="শতকের অঙ্ক সমান হলে দশকের অঙ্ক তুলনা করতে হয়।"),
    question("q4", "কোনটি বড়ো?", bn_digits(428), [bn_digits(423)], tests="cn423",
             explain="৪২৮ ও ৪২৩ — শতক ও দশক সমান, একক তুলনায় ৮>৩।"),
    question("q5", "৯০১ কি ৯৭২ এর চেয়ে বড়ো?", "মিথ্যা", ["সত্যি"],
             explain="৯৭২ এর দশক ৭, ৯০১ এর দশক ০। তাই ৯৭২ বড়ো।"),
]

topic3 = {
    "id": "c1t3", "chapterId": "c1", "number": 3,
    "title": "সংখ্যার তুলনা",
    "shape": "number",
    "bookPages": [14, 15, 16],
    "objective": "দুটি সংখ্যার দল (শতক ও দশক) তুলনা করে কোনটি বড়ো বা ছোটো তা বলা।",
    "minutes": 9,
    "numbers": list(t3_items.values()),
    "steps": [
        {"id": "c1t3-intro", "type": "intro", "title": "কোনটি বড়ো?",
         "say": "৬২ ও ৪৫ এর মধ্যে কোন সংখ্যাটি বড়ো?", "illustration": "blocks-0-6-2"},
        worked("c1t3-w1", "দশকের দল তুলনা করি", [
            {"text": "৬২", "illustration": "blocks-0-6-2"},
            {"text": "৪৫", "illustration": "blocks-0-4-5"},
            {"text": "চলো, আমরা আগে দশক-এর দলের তুলনা করি।", "speaker": "rafi"},
            {"text": "৬২ এ দশক এর দল ৬টি ও ৪৫ এ দশক এর দল ৪টি। তাই ৬২ বড়ো।", "speaker": "tuli"},
        ], "সংখ্যার তুলনা"),
        worked("c1t3-w2", "শতকের দল তুলনা করি", [
            {"text": "৪৩৪", "illustration": "blocks-4-3-4"},
            {"text": "২৫৩", "illustration": "blocks-2-5-3"},
            {"text": "চলো, আমরা আগে শতক এর দলের তুলনা করি।", "speaker": "rafi"},
            {"text": "৪৩৪ এ শতক এর দল ৪টি ও ২৫৩ এ শতক এর দল ২টি। তাই ২৫৩ ছোটো।", "speaker": "tuli"},
        ], "সংখ্যার তুলনা"),
        worked("c1t3-w3", "শতক সমান হলে দশক তুলনা করি", [
            {"text": "৩৫৪", "illustration": "blocks-3-5-4"},
            {"text": "৩২৫", "illustration": "blocks-3-2-5"},
            {"text": "যদি শতক এর দল একই হয়, তবে আমরা দশক এর দলের তুলনা করি।", "speaker": "rafi"},
            {"text": "এখানে শতক এর দল একই হওয়ায় আমরা দশক এর দলের তুলনা করি। ৩৫৪ ও ৩২৫ এর মধ্যে ৩৫৪ এ ৩টি দশক এর দল বেশি আছে।", "speaker": "rafi"},
            {"text": "তাই বড়ো সংখ্যাটি: ৩৫৪।", "speaker": "tuli"},
        ], "সংখ্যার তুলনা"),
        {"id": "c1t3-game1", "type": "game", "kind": "compare",
         "bookActivity": "বড়ো সংখ্যাটিতে গোল দাগ দিই", "title": "বড়ো সংখ্যাটি বেছে নাও",
         "rounds": bigger_rounds_t3},
        {"id": "c1t3-game2", "type": "game", "kind": "compare",
         "bookActivity": "ছোটো সংখ্যাটিতে গোল দাগ দিই", "title": "ছোটো সংখ্যাটি বেছে নাও",
         "rounds": smaller_rounds_t3},
        {"id": "c1t3-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t3},
        {"id": "c1t3-done", "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন দুটি সংখ্যার মধ্যে কোনটি বড়ো বা ছোটো তা বলতে পারো!"},
    ],
}

# =========================================================================
# Topic 4 - স্থানীয় মান (book pages 17-21)
# =========================================================================
def decompose_words(value):
    if value == 1000:
        return "১ হাজার"
    h, t, o = value // 100, (value % 100) // 10, value % 10
    parts = []
    if h:
        parts.append("%s শতক" % bn_digits(h))
    if t:
        parts.append("%s দশক" % bn_digits(t))
    if o or not parts:
        parts.append("%s একক" % bn_digits(o))
    return " ".join(parts)


T4_NUMS = [14, 23, 47, 83, 120, 356, 352, 467, 976, 1000, 74, 108, 230, 782,
           24, 56, 73, 98, 105, 328, 639, 840, 957]
t4_items = {}
for v in T4_NUMS:
    page = 20 if v in (47, 352, 1000, 83, 120, 467, 976) else (21 if v in (74, 108, 230, 782, 24, 56, 73, 98, 105, 328, 639, 840, 957) else 17)
    t4_items[v] = t2_number("pv%d" % v, v, None, page)


def pv_block_name(value):
    if value >= 1000:
        return "number-%d" % value
    b = hto(value)
    return "blocks-%d-%d-%d" % (b["hundreds"], b["tens"], b["ones"])


def pv_rounds(values, ask_fmt):
    out = []
    for v in values:
        right = decompose_words(v)
        wrongs = []
        for delta in (10, -10, 100, -1):
            cand = v + delta
            if cand > 0 and cand != v:
                w = decompose_words(cand)
                if w != right and w not in wrongs:
                    wrongs.append(w)
            if len(wrongs) >= 2:
                break
        out.append(rnd("pv%d" % v, ask_fmt % bn_digits(v), right, wrongs[:2],
                       tests="pv%d" % v, illustration=pv_block_name(v),
                       hint="আগে শতক, তারপর দশক, শেষে একক গণনা করো।"))
    return out


def numeral_rounds(pairs):
    """(value, printed decomposition) -> a round asking for the numeral."""
    out = []
    values = [v for v, _ in pairs]
    for v, phrase in pairs:
        wrongs = [bn_digits(w) for w in random.sample(
            [x for x in range(max(1, v - 50), v + 50) if x != v and x not in values], 2)]
        out.append(rnd("num%d" % v, phrase, bn_digits(v), wrongs, tests="pv%d" % v,
                       hint="প্রথমে শতক, তারপর দশক, শেষে একক যোগ করো।"))
    return out


topic4 = {
    "id": "c1t4", "chapterId": "c1", "number": 4,
    "title": "স্থানীয় মান",
    "shape": "number",
    "bookPages": [17, 18, 19, 20, 21],
    "objective": "সংখ্যার প্রতিটি অঙ্কের স্থানীয় মান (শতক, দশক, একক) বলা এবং স্থানীয় মান থেকে সংখ্যা লেখা।",
    "minutes": 11,
    "numbers": list(t4_items.values()),
    "steps": [
        {"id": "c1t4-intro", "type": "intro", "title": "১০টি করে বাণ্ডিল করি",
         "say": "১০টি কাঠি গণনা করে বাণ্ডিল তৈরি করি। ১টি বাণ্ডিল = ১ দশক।",
         "illustration": "blocks-0-1-4"},
        worked("c1t4-w1", "স্থানীয় মান লিখি", [
            {"text": "১৪ = ১ দশক ৪ একক। স্থানীয় মানে লিখি: ১ দশক ও ৪ একক।", "illustration": "blocks-0-1-4"},
            {"text": "২৩ = ২ দশক ৩ একক। স্থানীয় মানে লিখি: ২ দশক ও ৩ একক।", "illustration": "blocks-0-2-3"},
        ], "স্থানীয় মান"),
        worked("c1t4-w2", "শতক, দশক ও একক দিয়ে লিখি", [
            {"text": "৩ শত = ৩ শতক। ৫ দশ = ৫ দশক। ৬ এক = ৬ একক।", "illustration": "blocks-3-5-6"},
            {"text": "সংখ্যাটি: ৩ শতক ৫ দশক ৬ একক = তিনশত ছাপ্পান্ন = ৩৫৬।", "illustration": "number-356"},
        ], "রুকের মাধ্যমে শত, দশের দল ও এক"),
        worked("c1t4-w3", "২৪৪২ এর প্রতিটি অঙ্কের স্থানীয় মান", [
            {"text": "২৪৪২ = ২ হাজার ৪ শতক ৪ দশক ২ একক।", "illustration": "number-2442"},
            {"text": "= ২ হাজার ৪৪২। অঙ্কে: ২৪৪২।", "illustration": "number-2442"},
        ], "স্থানীয় মান"),
        worked("c1t4-w4", "৪৭, ৩৫২ ও ১০০০ এর স্থানীয় মান", [
            {"text": "৪৭ = ৪ দশক (৪০) ৭ একক (৭)।", "illustration": "blocks-0-4-7"},
            {"text": "৩৫২ = ৩ শতক (৩০০) ৫ দশক (৫০) ২ একক (২)।", "illustration": "blocks-3-5-2"},
            {"text": "১০০০ = ১ হাজার, ০ শতক, ০ দশক, ০ একক।", "illustration": "number-1000"},
        ], "প্রত্যেকটি অঙ্কের স্থানীয় মান লিখি"),
        {"id": "c1t4-game1", "type": "game", "kind": "place-value",
         "bookActivity": "খালিঘর পূরণ করি", "title": "স্থানীয় মান বলো",
         "rounds": pv_rounds([83, 120, 467, 976, 1000], "%s এর স্থানীয় মান কী?")},
        {"id": "c1t4-game2", "type": "game", "kind": "place-value",
         "bookActivity": "খালিঘর পূরণ করি", "title": "সংখ্যাটি অঙ্কে লিখো",
         "rounds": numeral_rounds([
             (74, "৭ দশক ৪ একক"), (108, "১ শতক ৮ একক"), (230, "২ শতক ৩ দশক"),
             (782, "৭ শতক ৮ দশক ২ একক"), (1000, "১ হাজার"),
         ])},
        {"id": "c1t4-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": [
            question("q1", "২৪ এর স্থানীয় মান কী?", decompose_words(24),
                     [decompose_words(34), decompose_words(42)], tests="pv24",
                     illustration="blocks-0-2-4", explain="২৪ = ২ দশক ৪ একক।"),
            question("q2", "৩২৮ এর স্থানীয় মান কী?", decompose_words(328),
                     [decompose_words(382), decompose_words(238)], tests="pv328",
                     illustration="blocks-3-2-8", explain="৩২৮ = ৩ শতক ২ দশক ৮ একক।"),
            question("q3", "৭ শতক ৩ দশক ৯ একক = কত?", bn_digits(739),
                     [bn_digits(937), bn_digits(793)], explain="৭০০+৩০+৯ = ৭৩৯।"),
            question("q4", "১০০০ এর স্থানীয় মান কী?", "১ হাজার", ["১০ শতক", "১০০ দশক"],
                     tests="pv1000", illustration="number-1000", explain="১০০০ = ১ হাজার।"),
            question("q5", "৯৫৭ এর স্থানীয় মান কী?", decompose_words(957),
                     [decompose_words(579), decompose_words(795)], tests="pv957",
                     explain="৯৫৭ = ৯ শতক ৫ দশক ৭ একক।"),
        ]},
        {"id": "c1t4-done", "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন সংখ্যার স্থানীয় মান বলতে ও লিখতে পারো!"},
    ],
}

# =========================================================================
# Topic 5 - সংখ্যার তুলনা (স্থানীয় মানের সাহায্যে) (book pages 22-24)
# =========================================================================
T5_PAIRS = [(128, 235), (248, 226), (496, 469), (692, 594), (872, 858), (1000, 998)]
T5_SORT_PAIRS = [(430, 428), (678, 675), (827, 948), (985, 950), (944, 922)]
T5_TRIPLES = [(432, 328, 540), (529, 517, 549), (407, 603, 330), (929, 920, 926), (1000, 780, 949)]

t5_items = {}
for a, b in T5_PAIRS + T5_SORT_PAIRS:
    for v in (a, b):
        t5_items.setdefault(v, t2_number("cv%d" % v, v, None, 23))
for trio in T5_TRIPLES:
    for v in trio:
        t5_items.setdefault(v, t2_number("cv%d" % v, v, None, 24))
for v in (460, 630, 562, 548, 232, 223, 239):
    t5_items.setdefault(v, t2_number("cv%d" % v, v, None, 22))

pair_rounds_t5 = [
    rnd("pt%d-%d" % (a, b), "কোনটি বড়ো?", bn_digits(max(a, b)), [bn_digits(min(a, b))],
        tests="cv%d" % max(a, b), hint="প্রথমে শতকের অঙ্ক তুলনা করো, তারপর দরকার হলে দশক।")
    for a, b in T5_PAIRS
]
sort_rounds_t5 = [
    rnd("st%d-%d" % (a, b), "ছোটো থেকে বড়ো সাজালে কোনটি আগে?", bn_digits(min(a, b)), [bn_digits(max(a, b))],
        tests="cv%d" % min(a, b), hint="শতক সমান হলে দশক, দশক সমান হলে একক তুলনা করো।")
    for a, b in T5_SORT_PAIRS
]
triple_rounds_t5 = []
for trio in T5_TRIPLES:
    lo, hi = min(trio), max(trio)
    others_small = [bn_digits(x) for x in trio if x != lo]
    others_big = [bn_digits(x) for x in trio if x != hi]
    triple_rounds_t5.append(rnd("tmin%d" % lo, "সবচেয়ে ছোটো কোনটি?", bn_digits(lo), others_small,
                                tests="cv%d" % lo, hint="প্রতিটি সংখ্যার শতক-দশক-একক তুলনা করো।"))
    triple_rounds_t5.append(rnd("tmax%d" % hi, "সবচেয়ে বড়ো কোনটি?", bn_digits(hi), others_big,
                                tests="cv%d" % hi, hint="প্রতিটি সংখ্যার শতক-দশক-একক তুলনা করো।"))

quiz_t5 = [
    question("q1", "কোনটি বড়ো, ৪৬০ অথবা ৬৩০?", bn_digits(630), [bn_digits(460)], tests="cv630",
             explain="শতক স্থানের ৪ থেকে ৬ বড়ো। তাই ৬৩০ বড়ো।"),
    question("q2", "৫৬২ ও ৫৪৮ — শতক সমান (৫=৫)। কোনটি বড়ো?", bn_digits(562), [bn_digits(548)],
             tests="cv562", explain="দশক স্থানের ৪ থেকে ৬ বড়ো। তাই ৫৬২ বড়ো।"),
    question("q3", "২৩২, ২২৩, ২৩৯ — সবচেয়ে ছোটো কোনটি?", bn_digits(223),
             [bn_digits(232), bn_digits(239)], explain="দশক স্থানের ২, ৩ এর চেয়ে ছোটো। তাই ২২৩ সবচেয়ে ছোটো।"),
    question("q4", "কোনটি বড়ো?", bn_digits(1000), [bn_digits(998)], tests="cv1000",
             explain="১০০০ এ ১ হাজার আছে, ৯৯৮ এ নেই। তাই ১০০০ বড়ো।"),
    question("q5", "৮২৭ ও ৯৪৮ — কোনটি ছোটো?", bn_digits(827), [bn_digits(948)], tests="cv827",
             explain="শতক স্থানের ৮, ৯ এর চেয়ে ছোটো। তাই ৮২৭ ছোটো।"),
]

topic5 = {
    "id": "c1t5", "chapterId": "c1", "number": 5,
    "title": "সংখ্যার তুলনা (স্থানীয় মানের সাহায্যে)",
    "shape": "number",
    "bookPages": [22, 23, 24],
    "objective": "শতক, দশক ও একক স্থানের অঙ্ক তুলনা করে দুই বা তিনটি সংখ্যাকে ছোটো-বড়ো ক্রমে সাজানো।",
    "minutes": 10,
    "numbers": list(t5_items.values()),
    "steps": [
        {"id": "c1t5-intro", "type": "intro", "title": "কোনটি বড়ো, ৪৬০ অথবা ৬৩০?",
         "say": "আমরা কীভাবে তুলনা করতে পারি?", "illustration": "blocks-4-6-0"},
        worked("c1t5-w1", "শতকের স্থানীয় মান তুলনা করি", [
            {"text": "পূর্বে আমরা দল করে তুলনা করা শিখেছি। এবার স্থানীয় মানের সাহায্যে তুলনা করব।", "speaker": "rafi"},
            {"text": "এক্ষেত্রে শতক স্থানের ৪ থেকে ৬ বড়ো। কাজেই ৪৬০ থেকে ৬৩০ বড়ো।", "speaker": "tuli"},
            {"text": "তাহলে ৪৬০ ছোটো এবং ৬৩০ বড়ো।", "speaker": "rafi"},
        ], "দুটি সংখ্যার তুলনা"),
        worked("c1t5-w2", "শতক সমান হলে দশক তুলনা করি", [
            {"text": "৫৬২ ও ৫৪৮ এর শতক স্থানের অঙ্ক দুটি একই (৫ এবং ৫)।", "speaker": "tuli"},
            {"text": "দশক স্থানের অঙ্ক তুলনা করি। ৪ থেকে ৬ বড়ো।", "speaker": "rafi"},
            {"text": "কাজেই আমরা বলতে পারি ৫৪৮ থেকে ৫৬২ বড়ো। তাহলে ৫৬২ বড়ো এবং ৫৪৮ ছোটো।", "speaker": "tuli"},
        ], "দুটি সংখ্যার তুলনা"),
        worked("c1t5-w3", "তিনটি সংখ্যা ছোটো থেকে বড়ো সাজাই", [
            {"text": "২৩২, ২২৩, ২৩৯ — প্রথমে শতক স্থানের অঙ্ক তুলনা করি। শতক স্থানের সব অঙ্কই সমান।", "speaker": "rafi"},
            {"text": "এবার দশক স্থানের অঙ্ক তুলনা করি। ২৩২ ও ২৩৯ দুটি সংখ্যারই দশক স্থানের অঙ্ক দুটি সমান (৩)।", "speaker": "tuli"},
            {"text": "২২৩ এর দশক স্থানের অঙ্ক ২। তাহলে অপর দুটি সংখ্যা ২৩২, ২৩৯ এর চেয়ে ২২৩ ছোটো।", "speaker": "rafi"},
            {"text": "এখন ২৩২ ও ২৩৯ তুলনা করি। ২৩৯ এর একক স্থানের অঙ্ক ৯, যা ২৩২ এর একক স্থানের অঙ্ক ২ থেকে বড়ো। সুতরাং ২৩৯ সংখ্যাটি সবচেয়ে বড়ো।", "speaker": "tuli"},
            {"text": "তাহলে ছোটো থেকে বড়ো: ২২৩, ২৩২, ২৩৯।", "speaker": "rafi"},
        ], "তিনটি সংখ্যার তুলনা"),
        {"id": "c1t5-game1", "type": "game", "kind": "compare",
         "bookActivity": "ছোটো-বড়ো তুলনা করি", "title": "কোনটি বড়ো?", "rounds": pair_rounds_t5},
        {"id": "c1t5-game2", "type": "game", "kind": "compare",
         "bookActivity": "ছোটো থেকে বড়ো ও বড়ো থেকে ছোটো সাজাই", "title": "কোনটি ছোটো?",
         "rounds": sort_rounds_t5},
        {"id": "c1t5-game3", "type": "game", "kind": "order",
         "bookActivity": "ছোটো থেকে বড়ো ক্রমানুসারে সাজাই", "title": "তিনটি সংখ্যা সাজাও",
         "rounds": triple_rounds_t5[:6]},
        {"id": "c1t5-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t5},
        {"id": "c1t5-done", "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন স্থানীয় মান দিয়ে সংখ্যা তুলনা ও সাজাতে পারো!"},
    ],
}

# =========================================================================
# Topic 6 - জোড়-বিজোড় সংখ্যা ও সংখ্যা প্যাটার্ন (book pages 25-33)
# =========================================================================
def oe_word(v):
    return "জোড়" if v % 2 == 0 else "বিজোড়"


OE_LIST = [8, 13, 20, 11, 24, 9, 18, 7, 21, 16, 6, 15, 12, 25, 23, 32, 39, 43, 48, 50]
oe_items = {v: t2_number("oe%d" % v, v, None, 29) for v in OE_LIST}

oe_rounds = [
    rnd("oe%d" % v, "%s — জোড় না বিজোড়?" % bn_digits(v), oe_word(v), [w for w in ["জোড়", "বিজোড়"] if w != oe_word(v)],
        tests="oe%d" % v, hint="শেষ অঙ্কটি দেখো: ০,২,৪,৬,৮ হলে জোড়; ১,৩,৫,৭,৯ হলে বিজোড়।")
    for v in OE_LIST
]

# (sequence so far, step, next value, book page)
PATTERNS = [
    ([2, 4, 6, 8], 2, 10, 30), ([15, 20, 25], 5, 30, 30), ([21, 19, 17], -2, 15, 30),
    ([1, 3, 5, 7], 2, 9, 31), ([4, 6, 8, 10], 2, 12, 31), ([3, 7, 11, 15, 19], 4, 23, 31),
    ([0, 5, 10, 15, 20], 5, 25, 32), ([40, 42], 2, 44, 33), ([16, 18, 20], 2, 22, 33),
    ([37, 39, 41], 2, 43, 33),
]
pattern_items = {}
for seq, step, nxt, page in PATTERNS:
    pattern_items.setdefault(nxt, t2_number("pn%d-%d" % (seq[0], nxt), nxt, None, page))

pattern_rounds = []
for seq, step, nxt, page in PATTERNS:
    shown = ", ".join(bn_digits(x) for x in seq) + ", ___"
    wrongs = [bn_digits(nxt + step), bn_digits(nxt - step if nxt - step > 0 else nxt + 2 * step)]
    if wrongs[0] == wrongs[1]:
        wrongs[1] = bn_digits(nxt + 2 * step)
    pattern_rounds.append(rnd("pat%d-%d" % (seq[0], nxt), shown, bn_digits(nxt), wrongs,
                              tests="pn%d-%d" % (seq[0], nxt),
                              hint="পাশাপাশি দুটি সংখ্যার পার্থক্য সবসময় %s।" % bn_digits(abs(step))))

quiz_t6 = [
    question("q1", "৪৮ কি জোড় সংখ্যা?", "সত্যি", ["মিথ্যা"], tests="oe48",
             explain="৪৮ এর শেষ অঙ্ক ৮। তাই এটি জোড় সংখ্যা।"),
    question("q2", "২৩ — জোড় না বিজোড়?", "বিজোড়", ["জোড়"], tests="oe23",
             explain="২৩ এর শেষ অঙ্ক ৩। তাই এটি বিজোড় সংখ্যা।"),
    question("q3", "২, ৪, ৬, ৮, ___ — পরের সংখ্যা কত?", bn_digits(10), [bn_digits(9), bn_digits(12)],
             explain="প্রতি ক্ষেত্রে ২ করে বাড়ছে। তাই পরের সংখ্যা ১০।"),
    question("q4", "২১, ১৯, ১৭, ___ — পরের সংখ্যা কত?", bn_digits(15), [bn_digits(19), bn_digits(13)],
             explain="প্রতি ক্ষেত্রে ২ করে কমছে। তাই পরের সংখ্যা ১৫।"),
    question("q5", "জোড় সংখ্যার শেষে কোন অঙ্কগুলো থাকে?", "০, ২, ৪, ৬ বা ৮", ["১, ৩, ৫, ৭ বা ৯"],
             explain="জোড় সংখ্যার শেষে সবসময় ০, ২, ৪, ৬ বা ৮ থাকে।"),
]

topic6 = {
    "id": "c1t6", "chapterId": "c1", "number": 6,
    "title": "জোড়-বিজোড় সংখ্যা ও সংখ্যা প্যাটার্ন",
    "shape": "pattern",
    "bookPages": list(range(25, 34)),
    "objective": "একটি সংখ্যা জোড় না বিজোড় তা বলা এবং সংখ্যার প্যাটার্ন দেখে পরের সংখ্যা বলা।",
    "minutes": 11,
    "numbers": list(oe_items.values()) + list(pattern_items.values()),
    "steps": [
        {"id": "c1t6-intro", "type": "intro", "title": "২টি করে নিয়ে গোল দাগ দিই",
         "say": "২টি করে নিয়ে গোল দাগ দিলে কী দল তৈরি হয়?", "illustration": "pairs-14"},
        worked("c1t6-w1", "জোড়া তৈরি করে দেখি", [
            {"text": "২টি কানের দুল = ১ জোড়া। এটি জোড় সংখ্যা।", "illustration": "pairs-2"},
            {"text": "৩টি কানের দুল = ১ জোড়া ও ১টি বিজোড়। এটি বিজোড় সংখ্যা।", "illustration": "pairs-3"},
            {"text": "৬টি রুক = ৩ জোড়া, কিছু বাকি থাকে না। এটি জোড় সংখ্যা।", "illustration": "pairs-6"},
            {"text": "৭টি রুক = ৩ জোড়া ও ১টি বিজোড়। এটি বিজোড় সংখ্যা।", "illustration": "pairs-7"},
        ], "জোড় ও বিজোড় এর ধারণা"),
        worked("c1t6-rule", "নিয়মটি মনে রাখি", [
            {"text": "কোনো সংখ্যার শেষে ২, ৪, ৬, ৮ বা ০ থাকলে তা জোড় সংখ্যা বা জোড় সংখ্যার প্যাটার্ন।"},
            {"text": "কোনো সংখ্যার শেষে ১, ৩, ৫, ৭ বা ৯ থাকলে তা বিজোড় সংখ্যা বা বিজোড় সংখ্যার প্যাটার্ন।"},
        ], "জোড় ও বিজোড় সংখ্যা শনাক্ত করি"),
        {"id": "c1t6-game1", "type": "game", "kind": "odd-even",
         "bookActivity": "অনুশীলন", "title": "জোড় না বিজোড়?", "rounds": oe_rounds},
        worked("c1t6-w2", "সংখ্যা প্যাটার্ন", [
            {"text": "২, ৪, ৬, ৮ — এখানে সংখ্যা শুরু ২ দিয়ে এবং প্রতি ক্ষেত্রে ২ করে বাড়ছে।", "speaker": "rafi"},
            {"text": "পরপর দুটি সংখ্যার পার্থক্য সবসময়ই ২। তাই প্যাটার্ন: ২, ৪, ৬, ৮, ১০, ১২, ১৪...", "speaker": "tuli"},
            {"text": "২১, ১৯, ১৭, ১৫ — এখানে সংখ্যা শুরু ২১ দিয়ে এবং প্রতি ক্ষেত্রে ২ করে কমছে।", "speaker": "rafi"},
        ], "পরবর্তী সংখ্যাগুলো কত হবে?"),
        {"id": "c1t6-game2", "type": "game", "kind": "pattern",
         "bookActivity": "সংখ্যার প্যাটার্ন", "title": "পরের সংখ্যা কত?", "rounds": pattern_rounds},
        {"id": "c1t6-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t6},
        {"id": "c1t6-done", "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন জোড়-বিজোড় সংখ্যা চেনো আর সংখ্যার প্যাটার্ন খুঁজে বের করতে পারো!"},
    ],
}

# =========================================================================
# Topic 7 - ক্রমবাচক সংখ্যা (book pages 34-39)
# =========================================================================
ORDINALS = [
    (1, "প্রথম", "১ম"), (2, "দ্বিতীয়", "২য়"), (3, "তৃতীয়", "৩য়"), (4, "চতুর্থ", "৪র্থ"),
    (5, "পঞ্চম", "৫ম"), (6, "ষষ্ঠ", "৬ষ্ঠ"), (7, "সপ্তম", "৭ম"), (8, "অষ্টম", "৮ম"),
    (9, "নবম", "৯ম"), (10, "দশম", "১০ম"),
]
ord_items = {n: t2_number("o%d" % n, n, word, 34 if n <= 5 else 37) for n, word, _ in ORDINALS}
ORD_WORD = {n: word for n, word, _ in ORDINALS}
ORD_SHORT = {n: short for n, _, short in ORDINALS}
ord_words_list = list(ORD_WORD.values())


def ordinal_others(n, pool_max=10, k=2):
    choices = [x for x in range(1, pool_max + 1) if x != n]
    return [ORD_WORD[x] for x in random.sample(choices, k)]


line_rounds_left = [
    rnd("ordL%d" % n, "চিহ্নিত ঘরটি বাম থেকে কত তম?", ORD_WORD[n], ordinal_others(n, 8),
        tests="o%d" % n, illustration="line-8-%d-L" % n, hint="বাম দিক থেকে গণনা শুরু করো।")
    for n in [1, 2, 4, 6, 8]
]
line_rounds_right = [
    rnd("ordR%d" % n, "চিহ্নিত ঘরটি ডান থেকে কত তম?", ORD_WORD[n], ordinal_others(n, 8),
        tests="o%d" % n, illustration="line-8-%d-R" % n, hint="ডান দিক থেকে গণনা শুরু করো।")
    for n in [1, 3, 5, 7]
]

# The book's own line of animals (page 34), left to right: elephant, horse,
# tiger, rabbit, rooster.
ANIMAL_LINE = ["হাতি", "ঘোড়া", "বাঘ", "খরগোশ", "মোরগ"]
animal_rounds = [
    rnd("an1", "বাম থেকে দ্বিতীয় কে?", "ঘোড়া", ["হাতি", "খরগোশ"], hint="বাম থেকে গণনা করো: হাতি, ঘোড়া..."),
    rnd("an2", "ডান থেকে প্রথম কে?", "মোরগ", ["হাতি", "বাঘ"], hint="ডান দিকের একদম শেষেরটি।"),
    rnd("an3", "ডান থেকে পঞ্চম কে?", "হাতি", ["মোরগ", "খরগোশ"], hint="ডান থেকে পাঁচটি গুনে দেখো।"),
    rnd("an4", "বাম থেকে চতুর্থ কে?", "খরগোশ", ["বাঘ", "মোরগ"], hint="বাম থেকে চারটি গুনে দেখো।"),
    rnd("an5", "ডান থেকে তৃতীয় কে?", "বাঘ", ["ঘোড়া", "খরগোশ"], hint="ডান থেকে তিনটি গুনে দেখো।"),
]

quiz_t7 = [
    question("q1", "৩ সংখ্যাটির ক্রমবাচক রূপ কী?", "তৃতীয়", ["দ্বিতীয়", "চতুর্থ"], tests="o3",
             explain="৩ = তৃতীয় (৩য়)।"),
    question("q2", "চিহ্নিত ঘরটি বাম থেকে কত তম?", ORD_WORD[5], ordinal_others(5, 8),
             illustration="line-8-5-L", tests="o5", explain="বাম থেকে পঞ্চম ঘরটি চিহ্নিত।"),
    question("q3", "'৭ম' — এর পুরো রূপ কী?", "সপ্তম", ["ষষ্ঠ", "অষ্টম"], tests="o7",
             explain="৭ম-এর পুরো রূপ সপ্তম।"),
    question("q4", "চিহ্নিত ঘরটি ডান থেকে কত তম?", ORD_WORD[2], ordinal_others(2, 6),
             illustration="line-6-2-R", tests="o2", explain="ডান থেকে দ্বিতীয় ঘরটি চিহ্নিত।"),
    question("q5", "সারিতে প্রথম প্রাণীটি কোনটি (বাম থেকে)?", "হাতি", ["মোরগ", "বাঘ"],
             explain="বাম দিকের একদম প্রথমে হাতি।"),
]

topic7 = {
    "id": "c1t7", "chapterId": "c1", "number": 7,
    "title": "ক্রমবাচক সংখ্যা",
    "shape": "pattern",
    "bookPages": list(range(34, 40)),
    "objective": "১ম থেকে ১০ম পর্যন্ত ক্রমবাচক সংখ্যা বলা এবং বাম বা ডান দিক থেকে অবস্থান বলা।",
    "minutes": 10,
    "numbers": list(ord_items.values()),
    "steps": [
        {"id": "c1t7-intro", "type": "intro", "title": "অবস্থান কীভাবে বলি?",
         "say": "নিচের প্রাণীগুলোর অবস্থান কীভাবে প্রকাশ করা যায়?", "illustration": "line-5-1-L"},
        {
            "id": "c1t7-table1", "type": "table", "bookActivity": "ক্রমবাচক সংখ্যা (১ম-৫ম)",
            "title": "১ম থেকে ৫ম",
            "rows": [{"id": "ordrow%d" % n, "illustration": "line-10-%d-L" % n,
                      "text": "%s = %s" % (ORD_SHORT[n], ORD_WORD[n]), "tests": "o%d" % n}
                     for n in [1, 2, 3, 4, 5]],
        },
        {
            "id": "c1t7-table2", "type": "table", "bookActivity": "ক্রমবাচক সংখ্যা (৬ষ্ঠ-১০ম)",
            "title": "৬ষ্ঠ থেকে ১০ম",
            "rows": [{"id": "ordrow%d" % n, "illustration": "line-10-%d-L" % n,
                      "text": "%s = %s" % (ORD_SHORT[n], ORD_WORD[n]), "tests": "o%d" % n}
                     for n in [6, 7, 8, 9, 10]],
        },
        worked("c1t7-w1", "তুলি কোথায় বসে?", [
            {"text": "তুলি, তুমি শ্রেণিকক্ষে বেঞ্চের কোথায় বসো?", "speaker": "rafi"},
            {"text": "আমি সামনে থেকে তৃতীয় বেঞ্চের বাম থেকে দ্বিতীয় স্থানে বসি।", "speaker": "tuli"},
        ], "ক্রমবাচক সংখ্যা ব্যবহার করে অবস্থান বলি"),
        {"id": "c1t7-game1", "type": "game", "kind": "ordinal",
         "bookActivity": "প্রাণীগুলোর অবস্থান", "title": "প্রাণীটি কোথায়?", "rounds": animal_rounds},
        {"id": "c1t7-game2", "type": "game", "kind": "ordinal",
         "bookActivity": "বাম থেকে অবস্থান", "title": "বাম থেকে কত তম?", "rounds": line_rounds_left},
        {"id": "c1t7-game3", "type": "game", "kind": "ordinal",
         "bookActivity": "ডান থেকে অবস্থান", "title": "ডান থেকে কত তম?", "rounds": line_rounds_right},
        {"id": "c1t7-quiz", "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t7},
        {"id": "c1t7-done", "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন ১ম থেকে ১০ম পর্যন্ত ক্রমবাচক সংখ্যা বলতে পারো!"},
    ],
}

chapter = {
    "id": "c1", "number": 1,
    "title": "সংখ্যা ও স্থানীয় মান",
    "colour": "sky", "icon": "hash",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ১, বই পৃষ্ঠা ১-৩৯।",
    "_note": ("সংখ্যা, শব্দ, রুকের হিসাব, তুলি-রাফির কথোপকথন এবং নিজে করি-র "
              "সংখ্যাগুলো বইয়ের পাতা থেকে হুবহু নেওয়া। কয়েকটি জায়গায় নিজস্ব "
              "সংযোজন আছে, প্রতিটি সংশ্লিষ্ট স্ক্রিপ্টের মন্তব্যে চিহ্নিত: (ক) পাঠ "
              "২-এর 'রুক গণনা করে লিখি' অনুশীলনের সংখ্যাগুলো (১২৮, ২০৬...) — "
              "বইয়ের ছবির নির্দিষ্ট রুক-সংখ্যা স্ক্যান থেকে নিশ্চিতভাবে পড়া যায়নি "
              "বলে; (খ) পাঠ ৪-এ ১০০-এর বেশি সংখ্যার বাংলা বানান একটি নিয়ম দিয়ে "
              "তৈরি (শতক-শব্দ + \"শত\" + বাকি অংশ) — বইয়ের ৬টি উদাহরণের বিপরীতে "
              "নিয়মটি যাচাই করে সবকটি হুবহু মিলেছে। ক্রমবাচক সংখ্যার (পাঠ ৭) "
              "সংযোজন-নির্ভর শব্দসমস্যাগুলো (পৃ.৩৫-৩৬, ৩৮-৩৯, যেগুলোয় যোগ লাগে) "
              "এই সংস্করণে বাদ দেওয়া হয়েছে, কারণ সেগুলোর জন্য যোগ (অধ্যায় ২) "
              "লাগে। অধ্যায় ১-এর সবগুলো পাঠ (৭টি) এখন সম্পূর্ণ।"),
    "topics": [topic1, topic2, topic3, topic4, topic5, topic6, topic7],
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter01.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("chapter01.json: %d topic(s), %d numbers" % (len(chapter["topics"]), len(NUMBERS)))
