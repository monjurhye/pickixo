# -*- coding: utf-8 -*-
"""Generate chapter07.json — অধ্যায় ৭: উপাত্ত (book pages 125-127).

The shortest chapter, and the last one — the book itself ends at page 127
with "সমাপ্ত" (the end); the 137-page PDF's remaining page is the back cover.
One topic: উপাত্ত সংগ্রহ ও সাজানো (collecting and organising data) — reading
and comparing a ট্যালি চিহ্ন (tally mark) table.

The book's fruit table (page 126) prints its counts directly: আম ৭, কলা ৬,
লিচু ৮, আপেল ৫ — these are used as printed. Every tally mark drawn, and every
comparison between the four counts (which is more, which is fewer, by how
much), is computed from those four printed numbers, never guessed from a
scattered picture. The traffic picture on page 126 and the personal-opinion
surveys on page 127 are open classroom activities with no single correct
answer (how many buses passed, which colour a child prefers) and are not
turned into quiz questions here.

Run:  python scripts/build-math-ch7.py
"""
import json
import pathlib
import random

random.seed(107)


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


T1 = "c7t1"

# The book's own fruit table (page 126), printed counts.
FRUITS = [("আম", 7), ("কলা", 6), ("লিচু", 8), ("আপেল", 5)]
FRUIT_ILLUS = {"আম": "obj-sweet-round", "কলা": "flowers", "লিচু": "obj-sweet-round", "আপেল": "shape-circle"}
counts = [c for _, c in FRUITS]
names = [n for n, _ in FRUITS]

read_rounds = [
    rnd("r-%s" % name, "%s কয়টি আছে?" % name, bn_digits(c),
        [bn_digits(w) for w in random.sample([x for x in counts if x != c] + [c + 1, c + 2], 2)],
        illustration="tally-%d" % c, hint="ট্যালি চিহ্নগুলো গণনা করো — একটি আড়াআড়ি দাগ মানে ৫টি।")
    for name, c in FRUITS
]

most = max(FRUITS, key=lambda x: x[1])
fewest = min(FRUITS, key=lambda x: x[1])
compare_rounds = [
    rnd("cmp1", "কোন ফল সবচেয়ে বেশি আছে?", most[0], [n for n in names if n != most[0]][:2]),
    rnd("cmp2", "কোন ফল সবচেয়ে কম আছে?", fewest[0], [n for n in names if n != fewest[0]][:2]),
    rnd("cmp3", "লিচুর চেয়ে আপেল কতটি কম আছে?", bn_digits(8 - 5), [bn_digits(2), bn_digits(4)],
        hint="৮-৫ করো।"),
    rnd("cmp4", "আমের চেয়ে কলা কতটি কম আছে?", bn_digits(7 - 6), [bn_digits(2), bn_digits(3)],
        hint="৭-৬ করো।"),
    rnd("cmp5", "আম ও আপেল একত্রে কতটি?", bn_digits(7 + 5), [bn_digits(11), bn_digits(13)],
        hint="৭+৫ করো।"),
]

quiz1 = [
    question("q1", "ট্যালি চিহ্নে কয়টি ফল দেখানো হয়েছে?", bn_digits(7), [bn_digits(6), bn_digits(8)],
             illustration="tally-7", explain="৭টি ফল দেখানো হয়েছে।"),
    question("q2", "চারটি খাড়া দাগের উপর দিয়ে আড়াআড়ি দাগ টানলে কয়টি বোঝায়?", "৫টি", ["৪টি", "৬টি"],
             explain="৪টি খাড়া দাগ ও একটি আড়াআড়ি দাগ মিলে ৫টির একটি দল হয়।"),
    question("q3", "কোন ফল সবচেয়ে বেশি আছে?", most[0], [n for n in names if n != most[0]][:2],
             explain="%s সবচেয়ে বেশি, %s টি।" % (most[0], bn_digits(most[1]))),
    question("q4", "কোন ফল সবচেয়ে কম আছে?", fewest[0], [n for n in names if n != fewest[0]][:2],
             explain="%s সবচেয়ে কম, %s টি।" % (fewest[0], bn_digits(fewest[1]))),
    question("q5", "লিচু কয়টি আছে?", bn_digits(8), [bn_digits(7), bn_digits(5)], illustration="tally-8",
             explain="লিচু ৮টি আছে।"),
]

chapter = {
    "id": "c7", "number": 7,
    "title": "উপাত্ত",
    "colour": "rose", "icon": "chart",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ৭, বই পৃষ্ঠা ১২৫-১২৭ (বইয়ের শেষ অধ্যায়)।",
    "_note": ("ট্যালি চিহ্নের ব্যাখ্যা এবং ফলের তালিকা (আম ৭, কলা ৬, লিচু ৮, "
              "আপেল ৫) বইয়ের পাতা থেকে হুবহু — এই চারটি সংখ্যা বইয়ে ছাপা আছে, "
              "কোনো ছবি থেকে গোনা হয়নি। তুলনার (কোনটি বেশি, কম, একত্রে কত) "
              "প্রতিটি উত্তর এই চারটি ছাপা সংখ্যা থেকে যোগ-বিয়োগ করে বের করা। "
              "পৃ.১২৬-এর যানবাহনের ছবি গোনা এবং পৃ.১২৭-এর ব্যক্তিগত পছন্দের "
              "জরিপ (প্রিয় বিষয়, প্রিয় পাখি, প্রিয় রং) এই সংস্করণে রাখা হয়নি — "
              "প্রথমটি একটি জটলা ছবি থেকে নিশ্চিতভাবে গোনা যায় না, দ্বিতীয়টির "
              "কোনো একক সঠিক উত্তর নেই।"),
    "topics": [{
        "id": T1, "chapterId": "c7", "number": 1, "title": "উপাত্ত সংগ্রহ ও সাজানো", "shape": "data",
        "bookPages": [125, 126],
        "objective": "ট্যালি চিহ্ন পড়া এবং একটি তালিকার সংখ্যা তুলনা করা।",
        "minutes": 10, "numbers": [],
        "steps": [
            {"id": sid(T1, "intro"), "type": "intro", "title": "ফলের সংখ্যা কীভাবে বের করি?",
             "say": "ছবিতে কোন ফল কতটি আছে, তার সংখ্যা কীভাবে বের করা যায় তা চিন্তা করি।", "illustration": "tally-5"},
            worked(sid(T1, "w1"), "ট্যালি চিহ্ন কী", [
                {"text": "প্রথমে প্রতিটি ফলের জন্য একটি করে খাড়া দাগ টানি। এভাবে পাশাপাশি চারটি দাগ টানি।"},
                {"text": "পঞ্চমটির জন্য চারটি দাগের উপর দিয়ে আড়াআড়ি একটি দাগ টানি। এখন পাঁচটির একটি দল তৈরি হলো।",
                 "illustration": "tally-5"},
                {"text": "এভাবে দাগ টেনে প্রতিটি ফলের সংখ্যা বের করা যায়। এই দাগগুলোকে বলা হয় ট্যালি চিহ্ন।"},
            ], "উপাত্ত সংগ্রহ এবং সাজানো"),
            {"id": sid(T1, "table"), "type": "table", "bookActivity": "ট্যালি চিহ্ন ব্যবহার করে ফলের সংখ্যা দেখানো হলো",
             "title": "ফলের তালিকা", "rows": [
                {"id": "row-%s" % name, "illustration": "tally-%d" % c, "text": "%s = %s টি" % (name, bn_digits(c))}
                for name, c in FRUITS
            ]},
            {"id": sid(T1, "game1"), "type": "game", "kind": "tally", "bookActivity": "ট্যালি চিহ্ন",
             "title": "কয়টি আছে?", "rounds": read_rounds},
            {"id": sid(T1, "game2"), "type": "game", "kind": "tally", "bookActivity": "তুলনা করি",
             "title": "তুলনা করি", "rounds": compare_rounds},
            {"id": sid(T1, "quiz"), "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz1},
            {"id": sid(T1, "done"), "type": "done", "title": "দারুণ হয়েছে!",
             "say": "তুমি এখন ট্যালি চিহ্ন পড়তে ও তালিকার সংখ্যা তুলনা করতে পারো! তুমি দ্বিতীয় শ্রেণির পুরো গণিত বই শেষ করেছ। 🎉"},
        ],
    }],
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter07.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("chapter07.json: 1 topic")
