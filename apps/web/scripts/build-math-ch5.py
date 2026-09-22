# -*- coding: utf-8 -*-
"""Generate chapter05.json — অধ্যায় ৫: পরিমাপ (book pages 107-120).

Four topics, matching the book's own four headings: দৈর্ঘ্য পরিমাপ (length),
ওজন পরিমাপ (weight), তরলের আয়তন পরিমাপ (liquid volume), সময় পরিমাপ (time).

The day-of-week and month-of-year questions are pure modular arithmetic once
the book's own cycles (7 days, 12 months) are entered as data, so "the day
after Wednesday" or "five months after October" is computed from the cycle,
never guessed. Clock times are drawn from the hour and minute given, so the
hands are always at the angle that hour and minute actually make.

Run:  python scripts/build-math-ch5.py
"""
import json
import pathlib
import random

random.seed(105)


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


topics = []

# =========================================================================
# Topic 1 - দৈর্ঘ্য পরিমাপ (book pages 107-110)
# =========================================================================
T1 = "c5t1"
length_rounds = [
    rnd("r%d" % v, "স্কেলে পেনসিলটির দৈর্ঘ্য কত সেন্টিমিটার?", "%s সে.মি." % bn_digits(v),
        ["%s সে.মি." % bn_digits(w) for w in random.sample([x for x in range(1, 20) if x != v], 2)],
        illustration="ruler-%d" % v, hint="যে দাগে পেনসিলের ডান প্রান্ত মিলে যায়, সেই সংখ্যাটি পড়ো।")
    for v in [8, 12, 5, 15]
]

topics.append({
    "id": T1, "chapterId": "c5", "number": 1, "title": "দৈর্ঘ্য পরিমাপ", "shape": "measurement",
    "bookPages": [107, 108, 109, 110],
    "objective": "স্কেল ব্যবহার করে দৈর্ঘ্য মিটার বা সেন্টিমিটারে পরিমাপ করা।",
    "minutes": 10, "numbers": [],
    "steps": [
        intro_step(T1, "কতটুকু লম্বা?", "একটি বস্তু কতটুকু লম্বা তা আমরা কীভাবে পরিমাপ করি?"),
        worked(sid(T1, "w1"), "দৈর্ঘ্যের একক", [
            {"text": "আমরা সকলে দৈর্ঘ্য পরিমাপের জন্য মিটার বা সেন্টিমিটার ব্যবহার করি। বড়ো বস্তুর জন্য মিটার এবং ছোটো বস্তুর জন্য সেন্টিমিটার ব্যবহার করি।"},
            {"text": "১০০ সেন্টিমিটার সমান ১ মিটার। বস্তুর দৈর্ঘ্য পরিমাপ করতে স্কেল বা ফিতা ব্যবহার করা হয়।"},
        ], "দৈর্ঘ্য পরিমাপ"),
        worked(sid(T1, "w2"), "স্কেল কীভাবে ব্যবহার করি", [
            {"text": "বস্তুর যেকোনো প্রান্ত স্কেলের শূন্য প্রান্তে স্থাপন করি।"},
            {"text": "বস্তুর অন্য প্রান্ত স্কেলের কোন সংখ্যার সাথে মিলে যায় তা দেখি। পেনসিলের দৈর্ঘ্য ৮ সেন্টিমিটার।", "illustration": "ruler-8"},
        ], "পেনসিলের দৈর্ঘ্য মাপি"),
        {"id": sid(T1, "game1"), "type": "game", "kind": "measure", "bookActivity": "খালি ঘর পূরণ করো",
         "title": "স্কেলে দৈর্ঘ্য পড়ি", "rounds": length_rounds},
        quiz_step(T1, [
            question("q1", "১ মিটার সমান কত সেন্টিমিটার?", "১০০ সে.মি.", ["১০ সে.মি.", "১০০০ সে.মি."],
                     explain="১০০ সেন্টিমিটার সমান ১ মিটার।"),
            question("q2", "স্কেলে পেনসিলটির দৈর্ঘ্য কত সেন্টিমিটার?", "৮ সে.মি.", ["৫ সে.মি.", "১২ সে.মি."],
                     illustration="ruler-8", explain="পেনসিলের দৈর্ঘ্য ৮ সেন্টিমিটার।"),
            question("q3", "বড়ো বস্তুর দৈর্ঘ্য পরিমাপের একক কী?", "মিটার", ["সেন্টিমিটার"],
                     explain="বড়ো বস্তুর দৈর্ঘ্য মিটারে মাপা হয়।"),
            question("q4", "স্কেল ব্যবহার করার সময় বস্তুর প্রান্ত কোথায় রাখতে হয়?", "স্কেলের শূন্য প্রান্তে",
                     ["স্কেলের ১০ নম্বর দাগে"], explain="বস্তুর প্রান্ত সবসময় স্কেলের শূন্য প্রান্তে রাখতে হয়।"),
            question("q5", "স্কেলে দৈর্ঘ্য কত?", "১৫ সে.মি.", ["৮ সে.মি.", "১২ সে.মি."], illustration="ruler-15",
                     explain="দৈর্ঘ্য ১৫ সেন্টিমিটার।"),
        ]),
        done_step(T1, "দারুণ হয়েছে!", "তুমি এখন স্কেল দিয়ে দৈর্ঘ্য পরিমাপ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 2 - ওজন পরিমাপ (book pages 111-113)
# =========================================================================
T2 = "c5t2"
# The book's own বাটখারা (standard weight) combinations, transcribed.
WEIGHT_COMBOS = [
    (25, [20, 5]), (50, [20, 20, 10]), (50, [10, 10, 5]), (50, [20, 5]),
    (100, [50, 50]), (100, [50, 20, 20, 10]),
]
weight_rounds = [
    rnd("w%d-%d" % (total, i), "%s গ্রাম বাটখারা তৈরি করতে কোন বাটখারাগুলো লাগবে?" % bn_digits(total),
        " + ".join(bn_digits(x) for x in combo),
        [" + ".join(bn_digits(x) for x in bad) for bad in
         random.sample([c for t2, c in WEIGHT_COMBOS if t2 != total or c != combo], min(2, len(WEIGHT_COMBOS) - 1))],
        hint="যোগ করে মোট %s গ্রাম হতে হবে।" % bn_digits(total))
    for i, (total, combo) in enumerate(WEIGHT_COMBOS)
]

topics.append({
    "id": T2, "chapterId": "c5", "number": 2, "title": "ওজন পরিমাপ", "shape": "measurement",
    "bookPages": [111, 112, 113],
    "objective": "কিলোগ্রাম ও গ্রাম এককে ওজন পরিমাপ করা এবং বাটখারা দিয়ে ওজন তৈরি করা।",
    "minutes": 9, "numbers": [],
    "steps": [
        intro_step(T2, "কোনটি ভারী?", "কোন বস্তুটি ভারী? ১টি ডাস্টার না ১টি কলম?"),
        worked(sid(T2, "w1"), "ওজনের একক", [
            {"text": "আমরা এক হাতে ডাস্টার ও অন্য হাতে কলম নিয়ে ওজন তুলনা করি। ডাস্টারের ওজন বেশি মনে হয়।", "speaker": "rafi"},
            {"text": "এগুলোকে দাঁড়িপাল্লা দিয়ে পরিমাপ করতে পারি। ওজন পরিমাপের একক হলো কিলোগ্রাম বা কেজি। কম ওজনের বস্তু মাপতে গ্রাম একক ব্যবহার করা হয়।", "speaker": "tuli"},
            {"text": "১ কেজি = ১০০০ গ্রাম।"},
        ], "ওজন পরিমাপ"),
        worked(sid(T2, "w2"), "বাটখারা দিয়ে ওজন তৈরি করি", [
            {"text": "২৫ গ্রাম বাটখারা তৈরি করতে লাগে ২০ গ্রাম ও ৫ গ্রাম, একত্রে ২৫ গ্রাম।"},
            {"text": "১০০ গ্রাম বাটখারা তৈরি করতে লাগে ৫০ গ্রাম ও ৫০ গ্রাম, একত্রে ১০০ গ্রাম, বা ১ কেজি = ১০০০ গ্রাম।"},
        ], "বিভিন্ন প্রকারের বস্তুর ওজন তুলনা"),
        {"id": sid(T2, "game1"), "type": "game", "kind": "money", "bookActivity": "ওজন তুলনা করি",
         "title": "বাটখারা মিলাও", "rounds": weight_rounds},
        quiz_step(T2, [
            question("q1", "১ কেজি সমান কত গ্রাম?", "১০০০ গ্রাম", ["১০০ গ্রাম", "১০ গ্রাম"],
                     explain="১ কেজি = ১০০০ গ্রাম।"),
            question("q2", "কম ওজনের বস্তু মাপতে কোন একক ব্যবহার করা হয়?", "গ্রাম", ["কিলোমিটার"],
                     explain="কম ওজনের বস্তু গ্রামে মাপা হয়।"),
            question("q3", "ওজন পরিমাপ করতে কী ব্যবহার করা হয়?", "দাঁড়িপাল্লা বা ডিজিটাল মাপনী",
                     ["স্কেল বা ফিতা"], explain="ওজন পরিমাপে দাঁড়িপাল্লা বা ডিজিটাল মাপনী ব্যবহার হয়।"),
            question("q4", "২০ গ্রাম ও ৫ গ্রাম বাটখারা একত্রে কত গ্রাম হয়?", "২৫ গ্রাম", ["১৫ গ্রাম", "৩০ গ্রাম"],
                     explain="২০+৫=২৫ গ্রাম।"),
            question("q5", "৫০ গ্রাম ও ৫০ গ্রাম বাটখারা একত্রে কত হয়?", "১০০ গ্রাম", ["৫০ গ্রাম", "১৫০ গ্রাম"],
                     explain="৫০+৫০=১০০ গ্রাম।"),
        ]),
        done_step(T2, "দারুণ হয়েছে!", "তুমি এখন কিলোগ্রাম ও গ্রামে ওজন পরিমাপ বুঝতে পারো!"),
    ],
})

# =========================================================================
# Topic 3 - তরলের আয়তন পরিমাপ (book pages 114-116)
# =========================================================================
T3 = "c5t3"

topics.append({
    "id": "c5t3", "chapterId": "c5", "number": 3, "title": "তরলের আয়তন পরিমাপ", "shape": "measurement",
    "bookPages": [114, 115, 116],
    "objective": "লিটার এককে তরলের আয়তন পরিমাপ করা।",
    "minutes": 9, "numbers": [],
    "steps": [
        intro_step(T3, "কোন বোতলে বেশি পানি ধরে?",
                   "কোন বোতলে বেশি পানি ধরে? কীভাবে আমরা এই বোতলগুলোর পানির পরিমাণ তুলনা করতে পারি?"),
        worked(sid(T3, "w1"), "তুলনা করার তিনটি উপায়", [
            {"text": "রেজার পদ্ধতি: প্রথম বোতল থেকে দ্বিতীয় বোতলে পানি ঢেলে দেখা যায় কোনটিতে বেশি পানি আছে।"},
            {"text": "তুলির পদ্ধতি: একই আকৃতির পাত্রে পানি ঢেলে দাগ দিয়ে তুলনা করা যায়।"},
            {"text": "রাফির পদ্ধতি: একই আকৃতির দুটি পাত্র ব্যবহার করে তুলনা করা যায়।"},
        ], "কোন বোতলে বেশি পানি ধরে?"),
        worked(sid(T3, "w2"), "তরলের আয়তনের একক", [
            {"text": "তরলের আয়তন পরিমাপে আমরা আন্তর্জাতিক একক লিটার ব্যবহার করি এবং এটি নির্দেশ করার জন্য ইংরেজি অক্ষর \"L\" বা \"l\" লিখি।"},
        ], "বালতিতে কতটুকু পানি ধরে তা নির্ণয় করি"),
        {"id": sid(T3, "game1"), "type": "game", "kind": "measure", "bookActivity": "কতটুকু পানি ধরে?",
         "title": "কত লিটার পানি ধরে?", "rounds": [
            rnd("l4", "৪টি ১ লিটার বোতলের পানি দিয়ে একটি বালতি পূর্ণ করা হয়েছে। বালতিতে কত লিটার পানি ধরে?",
                "৪ লিটার", ["৩ লিটার", "৫ লিটার"], hint="যতটি বোতল লেগেছে, ততই লিটার।"),
            rnd("l6", "৬টি ১ লিটার বোতলের পানি দিয়ে একটি পাত্র পূর্ণ করা হয়েছে। পাত্রে কত লিটার পানি ধরে?",
                "৬ লিটার", ["৪ লিটার", "৮ লিটার"], hint="যতটি বোতল লেগেছে, ততই লিটার।"),
            rnd("l2", "একটি ছোটো গ্লাস পূর্ণ করতে আধা লিটারের কম পানি লাগে। ২টি গ্লাস একত্রে কত লিটারের কাছাকাছি?",
                "১ লিটারের কাছাকাছি", ["৫ লিটারের কাছাকাছি"], hint="২টি ছোটো গ্লাস মিলে প্রায় ১ লিটার।"),
        ]},
        quiz_step(T3, [
            question("q1", "তরলের আয়তন পরিমাপের আন্তর্জাতিক একক কী?", "লিটার", ["মিটার", "কিলোগ্রাম"],
                     explain="তরলের আয়তন পরিমাপে লিটার একক ব্যবহার হয়।"),
            question("q2", "লিটার বোঝাতে কোন ইংরেজি অক্ষর লেখা হয়?", "L বা l", ["M বা m"],
                     explain="লিটার বোঝাতে L বা l লেখা হয়।"),
            question("q3", "৪টি ১ লিটার বোতলের পানি দিয়ে একটি বালতি পূর্ণ হলে, বালতিতে কত লিটার পানি ধরে?",
                     "৪ লিটার", ["২ লিটার", "৬ লিটার"], explain="৪টি ১ লিটার বোতল = ৪ লিটার।"),
            question("q4", "রেজার পদ্ধতিতে কীভাবে তুলনা করা হয়?", "এক বোতল থেকে আরেক বোতলে পানি ঢেলে",
                     ["ওজন করে"], explain="রেজা এক বোতলের পানি অন্য বোতলে ঢেলে তুলনা করেছিল।"),
            question("q5", "একই আকৃতির দুটি পাত্র ব্যবহার করে তুলনা করেছিল কে?", "রাফি", ["তুলি"],
                     explain="রাফি একই আকৃতির দুটি পাত্র ব্যবহার করে তুলনা করেছিল।"),
        ]),
        done_step(T3, "দারুণ হয়েছে!", "তুমি এখন লিটার এককে তরলের আয়তন পরিমাপ বুঝতে পারো!"),
    ],
})

# =========================================================================
# Topic 4 - সময় পরিমাপ (book pages 117-120)
# =========================================================================
T4 = "c5t4"

DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"]
BN_MONTHS = ["বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক",
             "অগ্রহায়ণ", "পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র"]
EN_MONTHS = ["জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
             "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"]


def day_before(d):
    return DAYS[(DAYS.index(d) - 1) % 7]


def day_after(d):
    return DAYS[(DAYS.index(d) + 1) % 7]


def month_offset(months, m, k):
    return months[(months.index(m) + k) % 12]


clock_rounds = [
    rnd("c%d" % h, "ঘড়িতে কয়টা বাজে?", "%s টা" % bn_digits(h), ["%s টা" % bn_digits(w) for w in
        random.sample([x for x in range(1, 13) if x != h], 2)], illustration="clock-%d-0" % h,
        hint="ঘণ্টার কাঁটা যে সংখ্যার কাছে আছে, সেটাই বাজে।")
    for h in [8, 2, 10, 3, 6]
]

digital_rounds = [
    rnd("d%d-%d" % (h, m), "ডিজিটাল ঘড়িতে %02d:%02d লেখা আছে। বাংলায় কয়টা বাজে?" % (h, m),
        "%s টা %s মিনিট" % (bn_digits(h), bn_digits(m)),
        ["%s টা %s মিনিট" % (bn_digits(h), bn_digits(w)) for w in
         random.sample([x for x in range(0, 60, 5) if x != m], 2)],
        hint="বাম পাশের অঙ্ক দুটি ঘণ্টা, ডান পাশের অঙ্ক দুটি মিনিট।")
    for h, m in [(11, 35), (8, 20), (6, 25), (7, 45)]
]

day_rounds = [
    rnd("day1", "সোমবারের আগের দিন কোনটি?", day_before("সোমবার"), [x for x in DAYS if x not in (day_before("সোমবার"), "সোমবার")][:2]),
    rnd("day2", "বুধবারের পরের দিন কোনটি?", day_after("বুধবার"), [x for x in DAYS if x not in (day_after("বুধবার"), "বুধবার")][:2]),
    rnd("month1", "জ্যৈষ্ঠ মাসের পরের মাস কোনটি (বাংলা মাস)?", month_offset(BN_MONTHS, "জ্যৈষ্ঠ", 1),
        [x for x in BN_MONTHS if x not in (month_offset(BN_MONTHS, "জ্যৈষ্ঠ", 1), "জ্যৈষ্ঠ")][:2]),
    rnd("month2", "মাঘ মাসের আগের মাস কোনটি (বাংলা মাস)?", month_offset(BN_MONTHS, "মাঘ", -1),
        [x for x in BN_MONTHS if x not in (month_offset(BN_MONTHS, "মাঘ", -1), "মাঘ")][:2]),
    rnd("month3", "নভেম্বর মাসের পূর্বের মাস কোনটি?", month_offset(EN_MONTHS, "নভেম্বর", -1),
        [x for x in EN_MONTHS if x not in (month_offset(EN_MONTHS, "নভেম্বর", -1), "নভেম্বর")][:2]),
    rnd("month4", "জুন মাসের দুই মাস পরের মাসের নাম কী?", month_offset(EN_MONTHS, "জুন", 2),
        [x for x in EN_MONTHS if x not in (month_offset(EN_MONTHS, "জুন", 2), "জুন")][:2]),
    rnd("month5", "অক্টোবর মাসের ৫ মাস পরের মাসের নাম কী?", month_offset(EN_MONTHS, "অক্টোবর", 5),
        [x for x in EN_MONTHS if x not in (month_offset(EN_MONTHS, "অক্টোবর", 5), "অক্টোবর")][:2]),
]

topics.append({
    "id": T4, "chapterId": "c5", "number": 4, "title": "সময় পরিমাপ", "shape": "measurement",
    "bookPages": [117, 118, 119, 120],
    "objective": "ঘড়িতে সময় পড়া এবং দিন, সপ্তাহ ও মাসের ক্রম বলা।",
    "minutes": 12, "numbers": [],
    "steps": [
        intro_step(T4, "ছবির ঘড়িতে কয়টা বাজে?", "ছবির ঘড়িতে কয়টা বাজে?", "clock-3-0"),
        worked(sid(T4, "w1"), "ঘড়ি পড়া শিখি", [
            {"text": "ঘড়িতে তিনটি কাঁটা থাকে: ঘণ্টার কাঁটা, মিনিটের কাঁটা ও সেকেন্ডের কাঁটা। সময়ের একক সেকেন্ড, মিনিট, ঘণ্টা।"},
            {"text": "ঘণ্টার কাঁটা ৩ এর ঘরে আছে, মিনিটের কাঁটা ১২ এর ঘরে আছে। তাই ৩টা বাজে।", "illustration": "clock-3-0"},
        ], "সময় পরিমাপ"),
        worked(sid(T4, "w2"), "ডিজিটাল ঘড়ি পড়ি", [
            {"text": "ডিজিটাল ঘড়ি বা মোবাইল ফোনের ঘড়িতে বামপাশের অংক দুটি ঘণ্টা ও ডান পাশের অংক দুটি হলো মিনিট।"},
            {"text": "ঘড়িতে ১১টা ১৫ মিনিট মানে লেখা থাকে 11:15।"},
        ], "সময় পরিমাপ"),
        {"id": sid(T4, "game1"), "type": "game", "kind": "measure", "bookActivity": "কয়টা বাজে?",
         "title": "ঘড়িতে কয়টা বাজে?", "rounds": clock_rounds},
        {"id": sid(T4, "game2"), "type": "game", "kind": "measure", "bookActivity": "ডিজিটাল ঘড়ি",
         "title": "ডিজিটাল ঘড়ি পড়ি", "rounds": digital_rounds},
        worked(sid(T4, "w3"), "দিন, সপ্তাহ ও মাস", [
            {"text": "১ সপ্তাহ = ৭ দিন: রবিবার, সোমবার, মঙ্গলবার, বুধবার, বৃহস্পতিবার, শুক্রবার, শনিবার।"},
            {"text": "১ মাস = ৩০ দিন। ১ বছর = ১২ মাস।"},
            {"text": "বাংলা মাসের নাম: বৈশাখ, জ্যৈষ্ঠ, আষাঢ়, শ্রাবণ, ভাদ্র, আশ্বিন, কার্তিক, অগ্রহায়ণ, পৌষ, মাঘ, ফাল্গুন, চৈত্র।"},
            {"text": "ইংরেজি মাসের নাম: জানুয়ারি, ফেব্রুয়ারি, মার্চ, এপ্রিল, মে, জুন, জুলাই, আগস্ট, সেপ্টেম্বর, অক্টোবর, নভেম্বর, ডিসেম্বর।"},
        ], "দিন, সপ্তাহ ও মাস"),
        {"id": sid(T4, "game3"), "type": "game", "kind": "measure", "bookActivity": "প্রশ্নের উত্তর দিই",
         "title": "দিন ও মাসের ক্রম", "rounds": day_rounds},
        quiz_step(T4, [
            question("q1", "১ সপ্তাহে কত দিন?", "৭ দিন", ["৫ দিন", "৩০ দিন"], explain="১ সপ্তাহ = ৭ দিন।"),
            question("q2", "ঘড়িতে কয়টা বাজে?", "৮ টা", ["২ টা", "৬ টা"], illustration="clock-8-0",
                     explain="ঘণ্টার কাঁটা ৮ এর ঘরে, মিনিটের কাঁটা ১২ এর ঘরে।"),
            question("q3", "সোমবারের আগের দিন কোনটি?", day_before("সোমবার"),
                     [x for x in DAYS if x not in (day_before("সোমবার"), "সোমবার")][:2],
                     explain="সোমবারের আগের দিন রবিবার।"),
            question("q4", "১ বছরে কত মাস?", "১২ মাস", ["১০ মাস", "৭ মাস"], explain="১ বছর = ১২ মাস।"),
            question("q5", "জুন মাসের দুই মাস পরের মাসের নাম কী?", month_offset(EN_MONTHS, "জুন", 2),
                     [x for x in EN_MONTHS if x not in (month_offset(EN_MONTHS, "জুন", 2), "জুন")][:2],
                     explain="জুনের দুই মাস পরে আগস্ট।"),
        ]),
        done_step(T4, "দারুণ হয়েছে!", "তুমি এখন ঘড়ি পড়তে এবং দিন-সপ্তাহ-মাসের ক্রম বলতে পারো!"),
    ],
})

chapter = {
    "id": "c5", "number": 5,
    "title": "পরিমাপ",
    "colour": "teal", "icon": "ruler",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ৫, বই পৃষ্ঠা ১০৭-১২০।",
    "_note": ("একক, সংজ্ঞা, তুলি-রাফির কথোপকথন, বাটখারার হিসাব, দিন-সপ্তাহ-মাসের "
              "ক্রম ও নমুনা প্রশ্নগুলো বইয়ের পাতা থেকে হুবহু নেওয়া। দিন ও মাসের "
              "আগের/পরের হিসাব কোডে সপ্তাহ/বছরের চক্র থেকে গণনা করা, অনুমান করা "
              "নয়। তরলের আয়তন অংশে বালতি/পাত্রে ঠিক কয়টি বোতল পানি ধরেছে তা "
              "স্ক্যানের ছোট আইকন থেকে নিশ্চিতভাবে গোনা যায়নি, তাই ৪-লিটার "
              "উদাহরণটি (যেটি স্পষ্ট ছিল) ছাড়া বাকি অনুশীলনী সংখ্যা নিজস্ব "
              "সংযোজন। স্কেলে দৈর্ঘ্য পড়ার (৮ সে.মি.) ছাড়া অন্য মানগুলোও (৫,১২,১৫) "
              "একই দক্ষতার অনুশীলনের জন্য নিজস্ব সংযোজন।"),
    "topics": topics,
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter05.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("chapter05.json: %d topic(s)" % len(topics))
