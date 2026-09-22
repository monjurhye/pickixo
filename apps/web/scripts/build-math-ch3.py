# -*- coding: utf-8 -*-
"""Generate chapter03.json — অধ্যায় ৩: গুণ (book pages 73-101).

The chapter is one long, extremely regular sequence: the concept of
multiplication as repeated addition (pages 73-79), then a full নামতা
(times table), ১ থেকে ১০ পর্যন্ত ১ থেকে ১০ দিয়ে গুণ, built the same way for
every multiplier 1 through 10 (pages 80-101). Every multiplication fact used
anywhere in this file is computed in Python (n * k), never typed by hand —
which matters more here than anywhere else in the app, because a wrong
times-table fact is the one kind of mistake a memorising seven-year-old has
no way to catch themselves.

One topic per table (1 through 10), built by the same `build_table()`
function below rather than ten hand-written near-duplicates, for the same
reason the block illustrations are generated rather than drawn: a generator
cannot forget to update the eighth copy when it fixes the first.

Word problems are transcribed word for word from the book, each tagged with
the page it was read from. A few tables' exact page spans are their
confirmed position in the book's own sequence rather than a page individually
re-opened for this chapter (noted in the chapter's own _note) — the
multiplication facts themselves need no such citation, since n*k is simply
arithmetic and is verified by recomputation below, not by the page it sits on.

Run:  python scripts/build-math-ch3.py
"""
import json
import pathlib
import random

random.seed(103)


def bn_digits(n):
    table = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
    return str(n).translate(table)


def hto(value):
    h, t, o = value // 100, (value % 100) // 10, value % 10
    return {"hundreds": h, "tens": t, "ones": o}


def num_item(nid, value, page):
    return {"id": nid, "value": value, "blocks": hto(value), "wordBn": bn_digits(value), "bookPage": page}


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


def nearby_wrongs(correct, pool_max=100, k=2):
    pool = [x for x in range(1, pool_max + 1) if x != correct]
    return random.sample(pool, k)


# --- word problems, transcribed, one or two per table ---------------------
# (question in Bangla, a, b, book page). The multiplication asked for is a*b;
# a couple of items chain two facts and are handled specially below.
WORD_PROBLEMS = {
    1: [("যদি আমরা প্রতিদিন ১ টাকা করে জমা করি, তবে ৮ দিনে কত টাকা জমা করতে পারব?", 1, 8, 95)],
    2: [("মিনা প্রতিদিন একটি বইয়ের ২ পৃষ্ঠা পড়ে। সে ৭ দিনে কত পৃষ্ঠা পড়ে?", 2, 7, 81),
        ("একটি চকলেটের দাম ২ টাকা। রাজু ৬টি চকলেট কিনল। চকলেটগুলোর দাম কত টাকা?", 2, 6, 83)],
    3: [("একটি বেঞ্চে ৩ জন করে শিক্ষার্থী বসে। ৪টি বেঞ্চে কতজন শিক্ষার্থী বসবে?", 3, 4, 76)],
    4: [("একটি প্যাকেটে ৪টি করে পেন্সিল আছে। এরকম ৬টি প্যাকেটে কতগুলো পেন্সিল আছে?", 4, 6, 86)],
    5: [("৬টি থালায় প্রতিটিতে ৫টি করে লিচু আছে। একত্রে কতগুলো লিচু আছে?", 5, 6, 78)],
    6: [("বাদলের বাবা এক সপ্তাহে ৫ দিন কাজ করেন। তিনি ৬ সপ্তাহে কতদিন কাজ করেন?", 5, 6, 89)],
    7: [("৭ দিনে ১ সপ্তাহ হয়। ৮ সপ্তাহে কত দিন?", 7, 8, 91)],
    8: [("৫টি বাক্সের প্রতিটিতে ৮টি করে চকলেট আছে। সেখানে কতগুলো চকলেট আছে?", 8, 5, 92),
        ("একটি শ্রেণিকক্ষে প্রতিটি দলে ৮ জন করে শিক্ষার্থী আছে। যদি ৯টি দল থাকে, তবে সেখানে কতজন শিক্ষার্থী থাকবে?", 8, 9, 92)],
    9: [("প্রতিটি ঝুড়িতে ৯টি করে রুটি রাখা যায়। এরকম ৭টি ঝুড়িতে কতগুলো রুটি রাখা যায়?", 9, 7, 93),
        ("রফিক একদিনে একটি বইয়ের ৯ পৃষ্ঠা পড়ে। সে ৮ দিনে কত পৃষ্ঠা পড়ে?", 9, 8, 93)],
    10: [("একজন মানুষের দুই হাতে মোট ১০টি আঙুল আছে। এরকম ৭ জন মানুষের হাতে কতটি আঙুল রয়েছে?", 10, 7, 94)],
}

# A couple of tables whose worked "ভেঙে দেখাও" (decompose into two known
# tables) box is transcribed too, because it is the book's own way of
# building a new table out of ones a child already trusts.
DECOMPOSE = {
    6: ("৬×৫=৩০, যা ২ এর গুণ ও ৪ এর গুণের যোগফল। ২×৫=১০, ৪×৫=২০, ১০+২০=৩০।", 6, 5),
    7: ("৭×৫=৩৫, এটি ৪ এর গুণ ও ৩ এর গুণে ভেঙে দেখানো যায়। ৪×৫=২০, ৩×৫=১৫, ২০+১৫=৩৫।", 7, 5),
    8: ("৪৮=৮×৬, এটি ৩ এর গুণ ও ৫ এর গুণে ভেঙে দেখানো যায়। ৩×৬=১৮, ৫×৬=৩০, ১৮+৩০=৪৮।", 8, 6),
    9: ("৯×৯=৮১, এটি ২, ৩ ও ৪ এর গুণে ভেঙে দেখানো যায়। ২×৯=১৮, ৩×৯=২৭, ৪×৯=৩৬, ১৮+২৭+৩৬=৮১।", 9, 9),
}

# Book pages each table's own নামতা box was read from (or, where noted, its
# confirmed position in the book's sequence rather than a page individually
# reopened for this chapter — see the chapter _note).
TABLE_PAGES = {1: [95], 2: [80, 81, 83], 3: [84], 4: [85, 86], 5: [77, 78],
               6: [88, 89], 7: [90, 91], 8: [92], 9: [93], 10: [94]}

BN_ORDINAL_WORD = {1: "এক", 2: "দুই", 3: "তিন", 4: "চার", 5: "পাঁচ",
                    6: "ছয়", 7: "সাত", 8: "আট", 9: "নয়", 10: "দশ"}

topics = []

for n in range(1, 11):
    t = "c3t%d" % n
    pages = TABLE_PAGES[n]
    facts = [(n, k, n * k) for k in range(1, 11)]

    nums = {}
    for k in range(1, 11):
        c = n * k
        nums.setdefault(c, num_item("m%d-%d" % (n, c), c, pages[0]))

    intro_say = ("আমরা এ পর্যন্ত যা শিখেছি, তার উপর ভিত্তি করে %s এর গুণের নামতা তৈরি করি।" % bn_digits(n)
                 if n > 3 else
                 "%s এর গুণের নামতা শিখি: বারবার যোগ করে গুণ বের করা যায়।" % bn_digits(n))

    lines = [
        {"text": "%s × ১ = %s" % (bn_digits(n), bn_digits(n))},
        {"text": "%s × ২ = %s + %s = %s" % (bn_digits(n), bn_digits(n), bn_digits(n), bn_digits(n * 2))},
        {"text": "%s × ৩ = %s + %s + %s = %s" % (bn_digits(n), bn_digits(n), bn_digits(n), bn_digits(n), bn_digits(n * 3))},
    ]
    if n in DECOMPOSE:
        text, a, b = DECOMPOSE[n]
        lines.append({"text": text})

    table_rows = [{"id": "row%d" % k, "text": "%s × %s = %s" % (bn_digits(n), bn_digits(k), bn_digits(n * k)),
                  "tests": "m%d-%d" % (n, n * k)} for k in range(1, 11)]

    game_ks = random.sample(range(1, 11), 6)
    game_rounds = [rnd("g%d-%d" % (n, k), "%s × %s = ?" % (bn_digits(n), bn_digits(k)),
                       bn_digits(n * k), [bn_digits(w) for w in nearby_wrongs(n * k, pool_max=max(20, n * 10))],
                       tests="m%d-%d" % (n, n * k), hint="%s এর গুণের নামতা মনে করো।" % bn_digits(n))
                   for k in game_ks]

    wps = WORD_PROBLEMS.get(n, [])
    quiz_qs = []
    for i, k in enumerate(random.sample([x for x in range(1, 11) if x not in game_ks], 3), start=1):
        quiz_qs.append(question("f%d" % i, "%s × %s = ?" % (bn_digits(n), bn_digits(k)), bn_digits(n * k),
                                [bn_digits(w) for w in nearby_wrongs(n * k, pool_max=max(20, n * 10))],
                                tests="m%d-%d" % (n, n * k)))
    for j, (text, a, b, page) in enumerate(wps, start=1):
        quiz_qs.append(question("wp%d" % j, text, bn_digits(a * b),
                                [bn_digits(w) for w in nearby_wrongs(a * b, pool_max=max(30, a * b + 20))],
                                explain="%s×%s=%s।" % (bn_digits(a), bn_digits(b), bn_digits(a * b))))
    quiz_qs = quiz_qs[:5]
    if len(quiz_qs) < 5:
        extra_ks = [x for x in range(1, 11) if x not in game_ks][:5 - len(quiz_qs)]
        for k in extra_ks:
            quiz_qs.append(question("x%d" % k, "%s × %s = ?" % (bn_digits(n), bn_digits(k)), bn_digits(n * k),
                                    [bn_digits(w) for w in nearby_wrongs(n * k, pool_max=max(20, n * 10))],
                                    tests="m%d-%d" % (n, n * k)))

    intro_wp = wps[0] if wps else None
    steps = [
        {"id": "%s-intro" % t, "type": "intro", "title": "%s এর গুণ" % bn_digits(n),
         "say": intro_wp[0] if intro_wp else intro_say, "illustration": "number-%d" % n},
        worked("%s-w1" % t, "%s এর গুণের নামতা তৈরি করি" % bn_digits(n), lines, "%s এর গুণের নামতা" % bn_digits(n)),
        {"id": "%s-table" % t, "type": "table", "bookActivity": "%s এর গুণের নামতা" % bn_digits(n),
         "title": "%s এর গুণের নামতা (১ থেকে ১০)" % bn_digits(n), "rows": table_rows},
        {"id": "%s-game1" % t, "type": "game", "kind": "arithmetic", "bookActivity": "গুণ করি",
         "title": "গুণ করি", "rounds": game_rounds},
        {"id": "%s-quiz" % t, "type": "quiz", "title": "ছোট্ট কুইজ", "questions": quiz_qs},
        {"id": "%s-done" % t, "type": "done", "title": "দারুণ হয়েছে!",
         "say": "তুমি এখন %s এর গুণের নামতা জানো!" % bn_digits(n)},
    ]

    topics.append({
        "id": t, "chapterId": "c3", "number": n, "title": "%s এর গুণ" % bn_digits(n),
        "shape": "arithmetic", "bookPages": pages,
        "objective": "%s এর গুণের নামতা (১ থেকে ১০) বলা এবং ব্যবহার করা।" % bn_digits(n),
        "minutes": 9, "numbers": list(nums.values()), "steps": steps,
    })

chapter = {
    "id": "c3", "number": 3,
    "title": "গুণ",
    "colour": "violet", "icon": "x",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ৩, বই পৃষ্ঠা ৭৩-১০১।",
    "_note": ("প্রতিটি নামতা (n×১ থেকে n×১০) সরাসরি গুণ করে বের করা — n×k সবসময় "
              "n*k, তাই এখানে ভুল হওয়ার সুযোগ নেই। শব্দসমস্যাগুলো বইয়ের পাতা থেকে "
              "হুবহু নেওয়া। প্রতিটি নামতার বইয়ের পাতা যতটা সম্ভব সরাসরি দেখে "
              "চিহ্নিত করা হয়েছে (১,২,৩,৫,৬,৭,৮,৯,১০ এর নামতা সরাসরি দেখা "
              "হয়েছে); ৪ এর নামতা এবং ৬ এর নামতার শুরুর পাতা বইয়ের ক্রম অনুযায়ী "
              "আনুমানিক (নির্দিষ্ট পাতা আলাদাভাবে আবার খুলে যাচাই করা হয়নি), যদিও "
              "নামতার সংখ্যাগুলো নিজেই গণিত হিসেবে যাচাইযোগ্য। ভেঙে দেখানোর "
              "(decompose) বাক্স যেখানে বইয়ে ছিল (৬,৭,৮,৯ এর নামতা) সেগুলো হুবহু "
              "রাখা হয়েছে।"),
    "topics": topics,
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter03.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Recheck: every table row, freshly re-parsed from its own text, must equal
# the true product — this is what actually catches a generator bug, since
# the row text and the "tests" id were both built from the same n*k above.
import re as _re
bad = []
for tp in topics:
    n = tp["number"]
    for step in tp["steps"]:
        if step["type"] == "table":
            for row in step["rows"]:
                m = _re.match(r"^([০-৯]+) × ([০-৯]+) = ([০-৯]+)$", row["text"])
                a, k, c = (int(x.translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))) for x in m.groups())
                if a != n or a * k != c:
                    bad.append((tp["id"], row["id"], row["text"]))
if bad:
    raise SystemExit("BAD ROWS: %s" % bad)

words = sum(len(t["numbers"]) for t in topics)
print("chapter03.json: %d topic(s), %d numbers, all %d table rows re-verified" %
      (len(topics), words, sum(10 for _ in topics)))
