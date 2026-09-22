# -*- coding: utf-8 -*-
"""Generate chapter04.json — অধ্যায় ৪: জ্যামিতিক আকৃতি ও প্যাটার্ন (book pages 102-106).

A short chapter, and read in full (every page). Two topics, matching the
book's own two headings: জ্যামিতিক আকৃতি (shapes, pages 102-104) and প্যাটার্ন
(patterns, pages 105-106).

Pattern "next shape" answers are computed from the repeating unit itself
(e.g. "circle, square, square, square" repeats every 4), never guessed by
eye — the same discipline as every other chapter here.

Run:  python scripts/build-math-ch4.py
"""
import json
import pathlib
import random

random.seed(104)


def bn_digits(n):
    table = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
    return str(n).translate(table)


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


def worked(sid, title, lines, activity=None):
    return {"id": sid, "type": "worked", "bookActivity": activity, "title": title,
            "source": "textbook", "lines": lines}


def sid(t, name):
    return t + "-" + name


SHAPE_WORD = {"c": "গোলাকার", "s": "চারকোনা", "t": "তিনকোনা"}
SHAPE_ILLUS = {"c": "shape-circle", "s": "shape-square", "t": "shape-triangle"}


def pattern_illustration(code):
    return "pattern-%s-%d" % (code, len(code))  # highlight is out of range -> no box drawn on the base strip


def next_in_pattern(code):
    """The repeating unit is the shortest prefix that tiles the whole string."""
    n = len(code)
    for unit_len in range(1, n + 1):
        unit = code[:unit_len]
        if (unit * (n // unit_len + 1))[:n] == code:
            return unit[n % unit_len]
    return code[0]


# =========================================================================
# Topic 1 - জ্যামিতিক আকৃতি (book pages 102-104)
# =========================================================================
T1 = "c4t1"
match_pairs = [
    ("obj-coin", "গোলাকার", "shape-circle"),
    ("obj-samosa", "তিনকোনা", "shape-triangle"),
    ("obj-brick", "চারকোনা", "shape-rectangle"),
    ("obj-ring", "গোলাকার", "shape-circle"),
    ("obj-matchbox", "চারকোনা", "shape-rectangle"),
]
shape_words = ["গোলাকার", "তিনকোনা", "চারকোনা"]

match_rounds = [
    rnd("m-%s" % obj, "এটি কোন আকৃতির?", word, [w for w in shape_words if w != word],
        illustration=obj, hint="বস্তুটির বাইরের রূপরেখা দেখো।")
    for obj, word, _ in match_pairs
]

food_pairs = [("obj-samosa", "সমুচা", "তিনকোনা"), ("obj-bread", "পাউরুটি", "চারকোনা"),
              ("obj-sweet-round", "রসগোল্লা", "গোলাকার")]
food_rounds = [
    rnd("f-%s" % obj, "%s কোন আকৃতির?" % name, shape, [w for w in shape_words if w != shape], illustration=obj)
    for obj, name, shape in food_pairs
]

topics = [{
    "id": T1, "chapterId": "c4", "number": 1, "title": "জ্যামিতিক আকৃতি", "shape": "shape",
    "bookPages": [102, 103, 104],
    "objective": "চারপাশের জিনিসকে গোলাকার, তিনকোনা ও চারকোনা আকৃতি হিসেবে চেনা।",
    "minutes": 9, "numbers": [],
    "steps": [
        {"id": sid(T1, "intro"), "type": "intro", "title": "আকৃতি খুঁজে বের করি",
         "say": "নিকট পরিবেশে যে সকল জ্যামিতিক আকৃতি আমরা দেখতে পাই, চলো খুঁজে বের করি।", "illustration": "shape-circle"},
        worked(sid(T1, "w1"), "তিনটি আকৃতি চিনি", [
            {"text": "ফুটবল ও কয়েনের মতো গোল জিনিস — গোলাকার আকৃতি।", "illustration": "shape-circle"},
            {"text": "সমুচার মতো তিনটি কোনাওয়ালা জিনিস — তিনকোনা আকৃতি (ত্রিভুজ)।", "illustration": "shape-triangle"},
            {"text": "বই বা ইটের মতো চারটি কোনাওয়ালা জিনিস — চারকোনা আকৃতি (চতুর্ভুজ)।", "illustration": "shape-rectangle"},
        ], "জ্যামিতিক আকৃতি"),
        worked(sid(T1, "w2"), "রাফি ও তুলি যা খুঁজে পেল", [
            {"text": "১ টাকার কয়েন গোলাকৃতি।", "speaker": "rafi", "illustration": "obj-coin"},
            {"text": "ম্যাচ বাক্সের পৃষ্ঠদেশ চারকোনা।", "speaker": "tuli", "illustration": "obj-matchbox"},
        ], "জ্যামিতিক আকৃতি"),
        {"id": sid(T1, "game1"), "type": "game", "kind": "shape", "bookActivity": "বস্তুর সাথে আকৃতিসমূহের মিল করি",
         "title": "কোন আকৃতির?", "rounds": match_rounds},
        {"id": sid(T1, "game2"), "type": "game", "kind": "shape", "bookActivity": "মজাদার খাদ্যগুলোর জ্যামিতিক আকৃতি বলি",
         "title": "খাবারটি কোন আকৃতির?", "rounds": food_rounds},
        {"id": sid(T1, "quiz"), "type": "quiz", "title": "ছোট্ট কুইজ", "questions": [
            question("q1", "সমুচা কোন আকৃতির?", "তিনকোনা", ["গোলাকার", "চারকোনা"], illustration="obj-samosa",
                     explain="সমুচার তিনটি কোনা আছে, তাই এটি তিনকোনা আকৃতি।"),
            question("q2", "১ টাকার কয়েন কোন আকৃতির?", "গোলাকার", ["তিনকোনা", "চারকোনা"], illustration="obj-coin",
                     explain="কয়েন গোল, তাই এটি গোলাকার আকৃতি।"),
            question("q3", "ইট কোন আকৃতির?", "চারকোনা", ["গোলাকার", "তিনকোনা"], illustration="obj-brick",
                     explain="ইটের চারটি কোনা আছে, তাই এটি চারকোনা আকৃতি।"),
            question("q4", "তিনকোনা আকৃতির আরেক নাম কী?", "ত্রিভুজ", ["চতুর্ভুজ", "বৃত্ত"],
                     explain="তিনকোনা আকৃতিকে ত্রিভুজও বলা হয়।"),
            question("q5", "রসগোল্লা কোন আকৃতির?", "গোলাকার", ["তিনকোনা", "চারকোনা"], illustration="obj-sweet-round",
                     explain="রসগোল্লা গোল, তাই এটি গোলাকার আকৃতি।"),
        ]},
        {"id": sid(T1, "done"), "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন চারপাশের জিনিসের জ্যামিতিক আকৃতি চিনতে পারো!"},
    ],
}]

# =========================================================================
# Topic 2 - প্যাটার্ন (book pages 105-106)
# =========================================================================
T2 = "c4t2"
PATTERNS = ["csss", "tsss"]  # book's own two patterns: ○□□□○□□□... and △□□□△□□□...
pattern_rounds = []
for code in PATTERNS:
    shown = code * 2  # the book shows two full repeats
    nxt = next_in_pattern(shown)
    pattern_rounds.append(rnd("p-%s" % code, "পরের আকৃতিটি কী হবে?", SHAPE_WORD[nxt],
                              [w for w in shape_words if w != SHAPE_WORD[nxt]],
                              illustration=pattern_illustration(shown),
                              hint="প্যাটার্নটি কয়টি আকৃতি পরপর ফিরে আসে, তা খেয়াল করো।"))

# A few fresh patterns for more practice, computed the same way, since the
# book itself gives only these two worked examples plus an open "make your
# own pattern" task that has no single correct answer.
EXTRA_PATTERNS = ["cs", "ct", "sct", "cctt"]
for code in EXTRA_PATTERNS:
    shown = code * 3
    nxt = next_in_pattern(shown)
    pattern_rounds.append(rnd("p-%s" % code, "পরের আকৃতিটি কী হবে?", SHAPE_WORD[nxt],
                              [w for w in shape_words if w != SHAPE_WORD[nxt]],
                              illustration=pattern_illustration(shown),
                              hint="একটি ছোট অংশ বারবার ফিরে আসছে।"))

quiz_t2 = []
for i, code in enumerate((PATTERNS + EXTRA_PATTERNS)[:5], start=1):
    shown = code * (2 if code in PATTERNS else 3)
    nxt = next_in_pattern(shown)
    quiz_t2.append(question("q%d" % i, "পরের আকৃতিটি কী হবে?", SHAPE_WORD[nxt],
                            [w for w in shape_words if w != SHAPE_WORD[nxt]],
                            illustration=pattern_illustration(shown),
                            explain="প্যাটার্নটি %s করে ফিরে আসে।" % bn_digits(len(code))))

topics.append({
    "id": T2, "chapterId": "c4", "number": 2, "title": "প্যাটার্ন", "shape": "pattern",
    "bookPages": [105, 106],
    "objective": "আকৃতি দিয়ে তৈরি প্যাটার্ন চেনা এবং পরের আকৃতিটি বলা।",
    "minutes": 8, "numbers": [],
    "steps": [
        {"id": sid(T2, "intro"), "type": "intro", "title": "প্যাটার্ন কী?",
         "say": "আমি রাস্তায় 'জেব্রা ক্রসিং' দেখেছি। এতে প্যাটার্ন আছে। আমরা জেব্রা ক্রসিং দিয়ে রাস্তা পার হই।",
         "illustration": "shape-square"},
        worked(sid(T2, "w1"), "জেব্রার গায়ে প্যাটার্ন", [
            {"text": "জেব্রার শরীরে এ রকম সাদা-কালো প্যাটার্ন আছে।", "speaker": "tuli"},
        ], "প্যাটার্ন"),
        worked(sid(T2, "w2"), "আকৃতি দিয়ে প্যাটার্ন তৈরি করি", [
            {"text": "গোলাকার ও চারকোনা আকৃতি ব্যবহার করে একটি প্যাটার্ন: গোল, চারকোনা, চারকোনা, চারকোনা — আবার গোল...",
             "illustration": pattern_illustration("csss" * 2)},
            {"text": "তিনকোনা ও চারকোনা আকৃতি ব্যবহার করে আরেকটি প্যাটার্ন: তিনকোনা, চারকোনা, চারকোনা, চারকোনা — আবার তিনকোনা...",
             "illustration": pattern_illustration("tsss" * 2)},
        ], "আমাদের চারপাশ থেকে আরও প্যাটার্ন খুঁজে বের করি"),
        {"id": sid(T2, "game1"), "type": "game", "kind": "pattern", "bookActivity": "প্যাটার্নে সাজাই",
         "title": "পরের আকৃতিটি কী?", "rounds": pattern_rounds},
        {"id": sid(T2, "quiz"), "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_t2},
        {"id": sid(T2, "done"), "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন আকৃতির প্যাটার্ন দেখে পরের আকৃতিটি বলতে পারো!"},
    ],
})

chapter = {
    "id": "c4", "number": 4,
    "title": "জ্যামিতিক আকৃতি ও প্যাটার্ন",
    "colour": "green", "icon": "shapes",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ৪, বই পৃষ্ঠা ১০২-১০৬।",
    "_note": ("প্রতিটি বস্তু-আকৃতি জোড় ও দুটি প্যাটার্ন উদাহরণ বইয়ের পাতা থেকে "
              "হুবহু নেওয়া। প্যাটার্নে 'পরের আকৃতি' সবসময় পুনরাবৃত্ত অংশ (repeating "
              "unit) থেকে কোডে হিসাব করা, অনুমান করা নয়। অতিরিক্ত চারটি প্যাটার্ন "
              "অনুশীলন (গোল-চারকোনা, গোল-তিনকোনা ইত্যাদি) নিজস্ব সংযোজন, একই ধরনের "
              "আরও অনুশীলনের জন্য — বইয়ে শুধু দুটি উদাহরণ ও একটি খোলা "
              "'নিজের প্যাটার্ন বানাও' কাজ আছে, যার কোনো একক সঠিক উত্তর নেই। "
              "কার্টুন ছবিতে আকৃতি গোনার (পৃ.১০৪) প্রশ্নটি এই সংস্করণে রাখা হয়নি, "
              "কারণ স্ক্যান থেকে প্রতিটি আকৃতির সঠিক সংখ্যা নিশ্চিতভাবে গোনা যায়নি।"),
    "topics": topics,
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter04.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("chapter04.json: %d topic(s)" % len(topics))
