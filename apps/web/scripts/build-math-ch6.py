# -*- coding: utf-8 -*-
"""Generate chapter06.json — অধ্যায় ৬: মুদ্রা (book pages 121-124).

Two topics: মুদ্রা চিনি (recognising the coins and notes, page 121) and
টাকার বিনিময় ও হিসাব (exchanging money and money word problems, pages
122-124). Every exchange fact here (২টি ৫০ টাকা = ১০০ টাকা, and so on) is
multiplication or addition already covered in earlier chapters, and is
computed the same way — never typed by hand.

Run:  python scripts/build-math-ch6.py
"""
import json
import pathlib
import random

random.seed(106)


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


def intro_step(t, title, say, illustration=None):
    return {"id": sid(t, "intro"), "type": "intro", "title": title, "say": say, "illustration": illustration}


def quiz_step(t, questions):
    return {"id": sid(t, "quiz"), "type": "quiz", "title": "ছোট্ট কুইজ", "questions": questions}


def done_step(t, title, say):
    return {"id": sid(t, "done"), "type": "done", "title": title, "say": say}


def taka(v):
    return "৳%s" % bn_digits(v)


topics = []

# =========================================================================
# Topic 1 - মুদ্রা চিনি (book page 121)
# =========================================================================
T1 = "c6t1"
# Coins printed on page 121, plus the note denominations it prints or the
# exchange page (122-123) uses — ১০, ২০, ৫০, ১০০ টাকার নোট.
COINS = [1, 2, 5]
NOTES = [10, 20, 50, 100, 200, 500, 1000]
all_denoms = COINS + NOTES

recog_rounds = [
    rnd("d%d" % v, "এটি কত টাকা?", taka(v), [taka(w) for w in random.sample([x for x in all_denoms if x != v], 2)],
        illustration="taka-%d" % v, hint="সংখ্যাটি পড়ো।")
    for v in [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]
]
kind_rounds = [
    rnd("k%d" % v, "%s কি কয়েন না নোট?" % taka(v), "কয়েন" if v in COINS else "নোট", ["নোট" if v in COINS else "কয়েন"],
        illustration="taka-%d" % v)
    for v in [1, 5, 20, 100, 500]
]

topics.append({
    "id": T1, "chapterId": "c6", "number": 1, "title": "মুদ্রা চিনি", "shape": "money",
    "bookPages": [121], "objective": "বাংলাদেশি মুদ্রার কয়েন ও নোট চেনা।",
    "minutes": 9, "numbers": [],
    "steps": [
        intro_step(T1, "বাংলাদেশি মুদ্রা", "বাংলাদেশি মুদ্রার নাম টাকা এবং এর সাংকেতিক চিহ্ন '৳'।", "taka-5"),
        worked(sid(T1, "w1"), "দুই রকমের মুদ্রা", [
            {"text": "বাংলাদেশি মুদ্রা দুই রকমের: (ক) ধাতব মুদ্রা বা কয়েন (খ) কাগজের নোট।"},
            {"text": "ধাতব মুদ্রা বা কয়েন: ১ টাকা, ২ টাকা, ৫ টাকা।", "illustration": "taka-5"},
            {"text": "কাগজের নোট: ১০, ২০, ৫০, ১০০, ২০০, ৫০০, ১০০০ টাকা।", "illustration": "taka-1000"},
        ], "বাংলাদেশি মুদ্রা"),
        {"id": sid(T1, "table"), "type": "table", "bookActivity": "মুদ্রা চিনি",
         "title": "কয়েন ও নোটের মূল্য", "rows": [
            {"id": "row%d" % v, "illustration": "taka-%d" % v, "text": "%s%s" % (taka(v), " (কয়েন)" if v in COINS else " (নোট)")}
            for v in all_denoms
        ]},
        {"id": sid(T1, "game1"), "type": "game", "kind": "money", "bookActivity": "মুদ্রা চিনি",
         "title": "কত টাকা?", "rounds": recog_rounds},
        {"id": sid(T1, "game2"), "type": "game", "kind": "money", "bookActivity": "কয়েন না নোট?",
         "title": "কয়েন না নোট?", "rounds": kind_rounds},
        quiz_step(T1, [
            question("q1", "বাংলাদেশি মুদ্রার সাংকেতিক চিহ্ন কী?", "৳", ["$", "#"],
                     explain="বাংলাদেশি মুদ্রার সাংকেতিক চিহ্ন ৳।"),
            question("q2", "৫ টাকা কি কয়েন না নোট?", "কয়েন", ["নোট"], illustration="taka-5",
                     explain="৫ টাকা একটি ধাতব মুদ্রা বা কয়েন।"),
            question("q3", "১০০ টাকা কি কয়েন না নোট?", "নোট", ["কয়েন"], illustration="taka-100",
                     explain="১০০ টাকা একটি কাগজের নোট।"),
            question("q4", "সবচেয়ে বড় নোট কোনটি?", taka(1000), [taka(500), taka(200)],
                     explain="১০০০ টাকার নোট সবচেয়ে বড়।"),
            question("q5", "এটি কত টাকা?", taka(20), [taka(10), taka(50)], illustration="taka-20",
                     explain="এটি ২০ টাকার নোট।"),
        ]),
        done_step(T1, "দারুণ হয়েছে!", "তুমি এখন বাংলাদেশি টাকার কয়েন ও নোট চিনতে পারো!"),
    ],
})

# =========================================================================
# Topic 2 - টাকার বিনিময় ও হিসাব (book pages 122-124)
# =========================================================================
T2 = "c6t2"

exchange_rounds = [
    rnd("e200", "২০০ টাকা কয়টি ১০০ টাকার নোটের সমান?", "২টি", ["১টি", "৪টি"], illustration="taka-200",
        hint="২০০ ÷ ১০০ করো।"),
    rnd("e500", "৫০০ টাকা কয়টি ১০০ টাকার নোটের সমান?", "৫টি", ["৪টি", "১০টি"], illustration="taka-500",
        hint="৫০০ ÷ ১০০ করো।"),
    rnd("e1000", "১০০০ টাকা কয়টি ৫০০ টাকার নোটের সমান?", "২টি", ["৩টি", "৫টি"], illustration="taka-1000",
        hint="১০০০ ÷ ৫০০ করো।"),
    rnd("e5x20", "৫টি ২০ টাকার নোট একত্রে কত টাকা?", taka(100), [taka(80), taka(120)],
        hint="৫×২০ করো।"),
    rnd("e2x50", "২টি ৫০ টাকার নোট একত্রে কত টাকা?", taka(100), [taka(50), taka(150)],
        hint="২×৫০ করো।"),
]

quiz2 = [
    question("q1", "২০০ টাকা কয়টি ১০০ টাকার নোটের সমান?", "২টি", ["৩টি"], explain="২০০÷১০০=২টি।"),
    question("q2", "১টি ১০০ টাকার নোট ও ২টি ৫০ টাকার নোট একত্রে কত টাকা?", taka(200), [taka(150), taka(250)],
             explain="১০০+৫০+৫০=২০০ টাকা।"),
    question("q3", "মিরাজ ৩০ টাকা দামের কলম কিনতে ২টি ১ টাকা, ৪টি ২ টাকা, ২টি ৫ টাকা ও ১টি ১০ টাকার নোট দিল। মোট কত টাকা হলো?",
             taka(30), [taka(25), taka(35)], explain="২+৮+১০+১০=৩০ টাকা।"),
    question("q4", "ইভা ৪০ টাকায় ডিম এবং ৬৫ টাকায় বিস্কুট কিনল। সে মোট কত টাকা খরচ করল?", taka(105),
             [taka(95), taka(115)], explain="৪০+৬৫=১০৫ টাকা।"),
    question("q5", "মেহেরুলের কাছে ১০০ টাকা ছিল, বাবা তাকে আরও ৫০ টাকা দিলেন। সে ১২০ টাকার একটি জ্যামিতি বক্স কিনল। তার কাছে কত টাকা রইল?",
             taka(30), [taka(20), taka(50)], explain="১০০+৫০-১২০=৩০ টাকা।"),
]

topics.append({
    "id": T2, "chapterId": "c6", "number": 2, "title": "টাকার বিনিময় ও হিসাব", "shape": "money",
    "bookPages": [122, 123, 124],
    "objective": "একই মূল্যের টাকা বিভিন্নভাবে বিনিময় করা এবং টাকা সংক্রান্ত সমস্যার সমাধান করা।",
    "minutes": 11, "numbers": [],
    "steps": [
        intro_step(T2, "টাকার বিনিময়", "২০০ টাকাকে আমরা কীভাবে বিভিন্নভাবে বিনিময় করতে পারি?", "taka-200"),
        worked(sid(T2, "w1"), "একই টাকা বিভিন্নভাবে", [
            {"text": "২০০ টাকা = ২টি ১০০ টাকার নোট।", "illustration": "taka-100"},
            {"text": "৫০০ টাকা = ৫টি ১০০ টাকার নোট।", "illustration": "taka-100"},
            {"text": "১০০০ টাকা = ২টি ৫০০ টাকার নোট।", "illustration": "taka-500"},
        ], "টাকার বিনিময়"),
        worked(sid(T2, "w2"), "অন্য রকমে বিনিময়", [
            {"text": "আমরা ১টি ১০০ টাকার নোট এবং ২টি ৫০ টাকার নোটের মাধ্যমে ২০০ টাকা বিনিময় করতে পারি।", "speaker": "rafi"},
            {"text": "এছাড়া, ২০০ টাকাকে আমরা বিভিন্ন রকমে বিনিময় করতে পারি। যেমন, ২টি ৫০ টাকার নোট ও ৫টি ২০ টাকার নোটের মাধ্যমে ২০০ টাকা বিনিময় করতে পারি।", "speaker": "tuli"},
        ], "টাকার বিনিময়"),
        worked(sid(T2, "w3"), "৩০ টাকা কীভাবে পরিশোধ করি", [
            {"text": "মিরাজ ৩০ টাকা দামের ১টি কলম কিনল। নিম্নরূপে নোট ব্যবহার করে দাম পরিশোধ করা যায়: ১ টাকার নোট ২টি, ২ টাকার নোট ৪টি, ৫ টাকার নোট ২টি ও ১০ টাকার নোট ১টি।"},
            {"text": "অন্যভাবেও দাম পরিশোধ করা যায়।"},
        ], "মিরাজ ৩০ টাকা দামের কলম কিনল"),
        {"id": sid(T2, "game1"), "type": "game", "kind": "money", "bookActivity": "টাকার বিনিময়",
         "title": "কীভাবে বিনিময় করা যায়?", "rounds": exchange_rounds},
        quiz_step(T2, quiz2),
        done_step(T2, "দারুণ হয়েছে!", "তুমি এখন টাকা বিনিময় করতে ও টাকা সংক্রান্ত সমস্যার সমাধান করতে পারো!"),
    ],
})

chapter = {
    "id": "c6", "number": 6,
    "title": "মুদ্রা",
    "colour": "gold", "icon": "coin",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ৬, বই পৃষ্ঠা ১২১-১২৪।",
    "_note": ("কয়েন ও নোটের মূল্য, বিনিময়ের উদাহরণ, তুলি-রাফির কথোপকথন এবং "
              "শব্দসমস্যাগুলো বইয়ের পাতা থেকে হুবহু নেওয়া। প্রতিটি বিনিময় ও "
              "যোগ-বিয়োগের হিসাব কোডে গণনা করা। পৃ.১২৪-এর 'ইচ্ছামতো নোট ব্যবহার "
              "করে মূল্য পরিশোধ করো' অনুশীলনটি রাখা হয়নি, কারণ এর একাধিক সঠিক "
              "উত্তর আছে (কোনো একটি নির্দিষ্ট উত্তর নেই), যা এই অ্যাপের "
              "এক-উত্তরের কুইজ কাঠামোর সাথে মেলে না।"),
    "topics": topics,
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter06.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("chapter06.json: %d topic(s)" % len(topics))
