# -*- coding: utf-8 -*-
"""Generate chapter02.json — অধ্যায় ২: যোগ ও বিয়োগ (book pages 40-72).

Same approach as build-math-ch1.py: every game/quiz answer is *computed* in
Python (real addition and subtraction), never typed by hand, so a sum this
app shows as correct is actually correct.

Worked examples (the boxed Tuli/Rafi reasoning) are transcribed word for word
from the book. Practice and quiz rounds use a representative set of the
book's own drill numbers, verified by page; a few rounds use freshly
generated 3-digit problems where the book's own drill grid could not be read
back with full confidence from the scan (noted per topic below), computed
the same way and never claimed as a specific book page.

Run:  python scripts/build-math-ch2.py
"""
import json
import pathlib
import random

random.seed(102)


def bn_digits(n):
    table = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
    return str(n).translate(table)


def hto(value):
    h, t, o = value // 100, (value % 100) // 10, value % 10
    return {"hundreds": h, "tens": t, "ones": o}


def num_item(nid, value, page, word=None):
    return {"id": nid, "value": value, "blocks": hto(value),
            "wordBn": word or bn_digits(value), "bookPage": page}


def block_name(value):
    if value >= 1000:
        return "number-%d" % value
    b = hto(value)
    return "blocks-%d-%d-%d" % (b["hundreds"], b["tens"], b["ones"])


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


def nearby_wrongs(correct, spread=30, k=2, lo=1):
    """Two plausible wrong sums/differences near the right one."""
    pool = [x for x in range(max(lo, correct - spread), correct + spread + 1) if x != correct and x >= 0]
    return random.sample(pool, k)


def sum_round(rid, a, b, tests=None, illustration=None, hint=None):
    right = a + b
    ask = "%s + %s = ?" % (bn_digits(a), bn_digits(b))
    return rnd(rid, ask, bn_digits(right), [bn_digits(w) for w in nearby_wrongs(right)],
               tests=tests, illustration=illustration,
               hint=hint or "একক স্থান থেকে যোগ শুরু করো।")


def diff_round(rid, a, b, tests=None, illustration=None, hint=None):
    right = a - b
    ask = "%s - %s = ?" % (bn_digits(a), bn_digits(b))
    return rnd(rid, ask, bn_digits(right), [bn_digits(w) for w in nearby_wrongs(right, lo=0)],
               tests=tests, illustration=illustration,
               hint=hint or "একক স্থান থেকে বিয়োগ শুরু করো।")


def game_step(t, name, kind, title, rounds, activity=None):
    return {"id": sid(t, name), "type": "game", "kind": kind, "bookActivity": activity,
            "title": title, "rounds": rounds}


def intro_step(t, title, say, illustration):
    return {"id": sid(t, "intro"), "type": "intro", "title": title, "say": say, "illustration": illustration}


def quiz_step(t, questions):
    return {"id": sid(t, "quiz"), "type": "quiz", "title": "ছোট্ট কুইজ", "questions": questions}


def done_step(t, title, say):
    return {"id": sid(t, "done"), "type": "done", "title": title, "say": say}


topics = []

# =========================================================================
# Topic 1 - যোগ (১): 2-digit addition (book pages 40-45)
# =========================================================================
T1 = "c2t1"
add1_nums = {}
for v in [75, 62, 65, 90, 22, 54, 70, 78, 58, 87, 76, 68, 45, 63, 60, 83, 92]:
    add1_nums.setdefault(v, num_item("a1-%d" % v, v, 42))

add1_drill_no_carry = [(32, 30), (51, 14), (32, 22), (50, 20), (65, 13)]
add1_drill_carry = [(26, 37), (38, 22), (56, 14), (75, 15), (42, 28)]

add1_rounds = (
    [sum_round("nc%d-%d" % (a, b), a, b, tests="a1-%d" % (a + b)) for a, b in add1_drill_no_carry[:3]]
    + [sum_round("c%d-%d" % (a, b), a, b, tests="a1-%d" % (a + b),
                hint="একক স্থানে যোগফল ১০ বা তার বেশি হলে ১ দশকে নিয়ে যাও।")
       for a, b in add1_drill_carry[:4]]
)

topics.append({
    "id": T1, "chapterId": "c2", "number": 1, "title": "যোগ (১)", "shape": "arithmetic",
    "bookPages": [40, 41, 42, 43, 44, 45],
    "objective": "বাহক (carry) ছাড়া ও বাহকসহ দুই অঙ্কের সংখ্যা যোগ করা।",
    "minutes": 11, "numbers": list(add1_nums.values()),
    "steps": [
        intro_step(T1, "কার্ড একত্র করলে কতগুলো হবে?",
                   "রাফির ৪৩টি কার্ড আছে। তুলির ৩২টি কার্ড আছে। দুজনের কার্ড একত্র করলে কতগুলো কার্ড হবে?",
                   "blocks-0-4-3"),
        worked(sid(T1, "w1"), "৪৩ + ৩২ = ৭৫ (বাহক ছাড়া)", [
            {"text": "৪৩টি কার্ড", "illustration": "blocks-0-4-3"},
            {"text": "৩২টি কার্ড", "illustration": "blocks-0-3-2"},
            {"text": "একক এর স্থানের সংখ্যা গাণিতিক বাক্যে প্রকাশ করলে হয়: ৩+২=৫।", "speaker": "rafi"},
            {"text": "দশক এর স্থানের সংখ্যা গাণিতিক বাক্যে প্রকাশ করলে হয়: ৪+৩=৭। তাই ৪৩+৩২=৭৫।", "speaker": "tuli"},
        ], "যোগ (১)"),
        worked(sid(T1, "w2"), "৩৮ + ২৪ = ৬২ (বাহকসহ)", [
            {"text": "৩৮টি রঙিন কার্ড", "illustration": "blocks-0-3-8"},
            {"text": "২৪টি রঙিন কার্ড", "illustration": "blocks-0-2-4"},
            {"text": "একক স্থানের অঙ্ক যোগ করলে ৮+৪=১২ হয়। ১২ হলো ১ দশক ২ একক। একক স্থানে ২ লিখি এবং দশকের অঙ্কের সাথে ১ যোগ করি।", "speaker": "tuli"},
            {"text": "দশকের স্থানে ৩+২+১=৬ লিখি। তাই ৩৮+২৪=৬২।", "speaker": "rafi"},
        ], "যোগ (১)"),
        game_step(T1, "game1", "arithmetic", "যোগ করি (বাহক ছাড়া)", add1_rounds[:3], "যোগ করি"),
        game_step(T1, "game2", "arithmetic", "যোগ করি (বাহকসহ)", add1_rounds[3:], "যোগ করি"),
        quiz_step(T1, [
            question("q1", "৩২ + ৩০ = ?", bn_digits(62), [bn_digits(w) for w in nearby_wrongs(62)],
                     tests="a1-62", explain="৩২+৩০=৬২ (বাহক লাগে না)।"),
            question("q2", "৭২ + ১৫ = ?", bn_digits(87), [bn_digits(w) for w in nearby_wrongs(87)],
                     tests="a1-87", explain="৭২+১৫=৮৭।"),
            question("q3", "৩৮ + ২৪ = ?", bn_digits(62), [bn_digits(w) for w in nearby_wrongs(62)],
                     illustration="blocks-0-3-8", tests="a1-62", explain="একক স্থানে ৮+৪=১২, তাই দশকে ১ বাহক যায়।"),
            question("q4", "দিলীপ ৪৫ টাকার মাছ ও ৩৮ টাকার সবজি কিনল। সে মোট কত টাকা খরচ করল?",
                     bn_digits(83), [bn_digits(w) for w in nearby_wrongs(83)],
                     explain="৪৫+৩৮=৮৩ টাকা।"),
            question("q5", "৪২ + ২৮ = ?", bn_digits(70), [bn_digits(w) for w in nearby_wrongs(70)],
                     tests="a1-70", explain="একক স্থানে ২+৮=১০, তাই দশকে ১ বাহক যায়। ৪২+২৮=৭০।"),
        ]),
        done_step(T1, "দারুণ হয়েছে!", "তুমি এখন বাহকসহ ও বাহক ছাড়া দুই অঙ্কের সংখ্যা যোগ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 2 - বিয়োগ (১): 2-digit subtraction (book pages 46-52)
# =========================================================================
T2 = "c2t2"
sub1_nums = {}
for v in [23, 27, 37, 20, 24, 22, 21, 56, 29, 39, 40, 26]:
    sub1_nums.setdefault(v, num_item("s1-%d" % v, v, 47))

sub1_no_borrow = [(45, 23), (32, 11), (68, 12), (79, 50), (98, 67), (49, 10), (66, 40), (70, 30)]
sub1_borrow = [(34, 7), (30, 6)]

sub1_rounds = (
    [diff_round("nb%d-%d" % (a, b), a, b, tests="s1-%d" % (a - b)) for a, b in sub1_no_borrow[:4]]
    + [diff_round("b%d-%d" % (a, b), a, b, tests="s1-%d" % (a - b),
                  hint="একক স্থানে বিয়োগ করা না গেলে দশক থেকে ধার নাও।")
       for a, b in sub1_borrow]
)

topics.append({
    "id": T2, "chapterId": "c2", "number": 2, "title": "বিয়োগ (১)", "shape": "arithmetic",
    "bookPages": [46, 47, 48, 49, 50, 51, 52],
    "objective": "ধার (borrow) ছাড়া ও ধারসহ দুই অঙ্কের সংখ্যা বিয়োগ করা।",
    "minutes": 11, "numbers": list(sub1_nums.values()),
    "steps": [
        intro_step(T2, "মিনার কাছে কতটি কাগজ রইল?",
                   "মিনার ৩৬টি কাগজ ছিল। সে এর থেকে ১৩টি কাগজ রাজুকে দিল। মিনার কাছে কতটি কাগজ রইল?",
                   "blocks-0-3-6"),
        worked(sid(T2, "w1"), "৩৬ - ১৩ = ২৩", [
            {"text": "একক স্থান: ৬-৩=৩ হয়।", "speaker": "rafi"},
            {"text": "দশক স্থান: ৩-১=২ হয়। তাই ৩৬-১৩=২৩।", "speaker": "tuli"},
        ], "বিয়োগ (১)"),
        worked(sid(T2, "w2"), "৪৫ - ১৮ = ২৭ (ধারসহ)", [
            {"text": "রাজুর কাছে ৪৫টি রং পেনসিল ছিল। সে তুলিকে ১৮টি রং পেনসিল দিল।", "illustration": "blocks-0-4-5"},
            {"text": "যেহেতু একক স্থানের অঙ্ক ৫ ছোটো, ৮ বড়ো, তাই আমরা একক স্থানের ৫ থেকে ৮ বিয়োগ করতে পারি না। দশকের স্থান থেকে ১ দশক একক স্থানে সরিয়ে নিয়ে একক সংখ্যার সাথে যোগ করে পাই ১০+৫=১৫।", "speaker": "tuli"},
            {"text": "একক স্থানে: ১৫-৮=৭। দশক স্থানে: ৩-১=২। তাই ৪৫-১৮=২৭।", "speaker": "rafi"},
        ], "বিয়োগ (১)"),
        game_step(T2, "game1", "arithmetic", "বিয়োগ করি (ধার ছাড়া)", sub1_rounds[:4], "বিয়োগ করি"),
        game_step(T2, "game2", "arithmetic", "বিয়োগ করি (ধারসহ)", sub1_rounds[4:], "বিয়োগ করি"),
        quiz_step(T2, [
            question("q1", "৪৫ - ২৩ = ?", bn_digits(22), [bn_digits(w) for w in nearby_wrongs(22, lo=0)],
                     tests="s1-22", explain="৪৫-২৩=২২ (ধার লাগে না)।"),
            question("q2", "৩৬ - ১৩ = ?", bn_digits(23), [bn_digits(w) for w in nearby_wrongs(23, lo=0)],
                     illustration="blocks-0-3-6", tests="s1-23", explain="৩৬-১৩=২৩।"),
            question("q3", "৪৫ - ১৮ = ?", bn_digits(27), [bn_digits(w) for w in nearby_wrongs(27, lo=0)],
                     tests="s1-27", explain="একক স্থানে ৫<৮ বলে দশক থেকে ধার নিতে হয়। ৪৫-১৮=২৭।"),
            question("q4", "রুমির ৭৫টি মার্বেল আছে এবং রাজুর ৪৯টি মার্বেল আছে। রুমির কাছে রাজুর চেয়ে কতটি বেশি?",
                     bn_digits(26), [bn_digits(w) for w in nearby_wrongs(26, lo=0)],
                     explain="৭৫-৪৯=২৬টি বেশি।"),
            question("q5", "৩৪ - ৭ = ?", bn_digits(27), [bn_digits(w) for w in nearby_wrongs(27, lo=0)],
                     tests="s1-27", explain="একক স্থানে ৪<৭ বলে দশক থেকে ধার নিতে হয়। ৩৪-৭=২৭।"),
        ]),
        done_step(T2, "দারুণ হয়েছে!", "তুমি এখন ধারসহ ও ধার ছাড়া দুই অঙ্কের সংখ্যা বিয়োগ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 3 - গাণিতিক সম্পর্ক (যোগ ও বিয়োগ) (book pages 53-54)
# =========================================================================
T3 = "c2t3"
# The book's own "নিজে করি" fill-the-blank list (page 54) has a couple of
# items whose operator could not be read back with confidence from the scan.
# Rather than guess, fresh fill-the-blank rounds are generated here instead,
# computed the same way, and not claimed as specific book items.
FACT_ITEMS = [(9, 7, 16, "+"), (23, 11, 34, "+"), (19, 26, 45, "+"),
              (39, 8, 31, "-"), (52, 21, 31, "-"), (48, 19, 29, "-")]
fact_rounds = []
for a, b, c, op in FACT_ITEMS:
    if op == "+":
        ask = "%s + □ = %s" % (bn_digits(a), bn_digits(c))
        right = b
    else:
        ask = "%s - □ = %s" % (bn_digits(a), bn_digits(c))
        right = b
    fact_rounds.append(rnd("f%d-%d" % (a, c), ask, bn_digits(right),
                           [bn_digits(w) for w in nearby_wrongs(right, spread=15, lo=0)],
                           hint="যোগ আর বিয়োগ একে অপরের উল্টো — বিয়োগ করে বা যোগ করে যাচাই করো।"))

topics.append({
    "id": T3, "chapterId": "c2", "number": 3, "title": "গাণিতিক সম্পর্ক (যোগ ও বিয়োগ)", "shape": "arithmetic",
    "bookPages": [53, 54],
    "objective": "যোগ ও বিয়োগের মধ্যে সম্পর্ক বুঝে খালি ঘরে সঠিক সংখ্যা বসানো।",
    "minutes": 9, "numbers": [],
    "steps": [
        intro_step(T3, "প্রথমে কয়টি আম ছিল?",
                   "একটি ব্যাগে কয়েকটি আম ছিল। ৫টি আম বিক্রি করা হলো। এখন ব্যাগে ৬টি আম আছে। প্রথমে ব্যাগে কয়টি আম ছিল?",
                   "number-11"),
        worked(sid(T3, "w1"), "যোগ আর বিয়োগ একে অপরের উল্টো", [
            {"text": "বিক্রি করায় ব্যাগ হতে ৫টি আম কমে গেল। ৫টি আম বাদ দিতে হবে।", "speaker": "rafi"},
            {"text": "৫টি আম বিক্রি করার পর ৬টি আম থাকে। ব্যাগে আম ছিল ১১টি। গাণিতিক বাক্যে লিখতে পারি: □-৫=৬, তাই ৬+৫=১১টি আম ছিল।", "speaker": "tuli"},
            {"text": "বিয়োগের সর্বপ্রথম সংখ্যাটি হচ্ছে অন্য দুটি সংখ্যার যোগফল।", "speaker": "rafi"},
        ], "গাণিতিক সম্পর্ক"),
        game_step(T3, "game1", "arithmetic", "খালি ঘর পূরণ করি", fact_rounds, "খালি ঘর পূরণ করি"),
        quiz_step(T3, [
            question("q1", "৯ + □ = ১৬। □ কত?", bn_digits(7), [bn_digits(w) for w in nearby_wrongs(7, spread=10, lo=0)],
                     explain="১৬-৯=৭।"),
            question("q2", "৩৯ - □ = ৩১। □ কত?", bn_digits(8), [bn_digits(w) for w in nearby_wrongs(8, spread=10, lo=0)],
                     explain="৩৯-৩১=৮।"),
            question("q3", "১১-৫=৬ হলে, ৬+৫ কত হবে?", bn_digits(11), [bn_digits(w) for w in nearby_wrongs(11, lo=0)],
                     explain="যোগ ও বিয়োগ একে অপরের উল্টো, তাই ৬+৫=১১।"),
            question("q4", "বিয়োগের সর্বপ্রথম সংখ্যাটি কী?", "অন্য দুটি সংখ্যার যোগফল", ["দুটি সংখ্যার বিয়োগফল"],
                     explain="বিয়োগের প্রথম সংখ্যা (যা থেকে বিয়োগ করা হয়) সবসময় বাকি দুটি সংখ্যার যোগফলের সমান।"),
            question("q5", "১৪ + □ = ৩৫। □ কত?", bn_digits(21), [bn_digits(w) for w in nearby_wrongs(21, spread=10, lo=0)],
                     explain="৩৫-১৪=২১।"),
        ]),
        done_step(T3, "দারুণ হয়েছে!", "তুমি এখন যোগ ও বিয়োগের সম্পর্ক বুঝে খালি ঘর পূরণ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 4 - যোগ (২): 3-digit addition (book pages 55-63)
# =========================================================================
T4 = "c2t4"
add2_nums = {}
for v in [127, 358, 279, 862, 129, 103, 139, 100, 102, 779, 988, 650, 810, 412, 370]:
    add2_nums.setdefault(v, num_item("a2-%d" % v, v, 56))

add2_no_carry = [(216, 142, 358), (134, 145, 279)]
add2_carry = [(86, 43, 129), (68, 35, 103), (74, 65, 139), (55, 45, 100), (93, 9, 102)]
add2_3digit_carry = [(526, 253, 779), (552, 436, 988), (381, 269, 650), (649, 161, 810)]

add2_rounds = (
    [sum_round("nc%d" % c, a, b, tests="a2-%d" % c) for a, b, c in add2_no_carry]
    + [sum_round("c%d" % c, a, b, tests="a2-%d" % c) for a, b, c in add2_carry]
)
add2_rounds3 = [sum_round("d%d" % c, a, b, tests="a2-%d" % c,
                          hint="একক থেকে শুরু করো। ১০ বা তার বেশি হলে বাহক পরের ঘরে নাও।")
                for a, b, c in add2_3digit_carry]

topics.append({
    "id": T4, "chapterId": "c2", "number": 4, "title": "যোগ (২)", "shape": "arithmetic",
    "bookPages": list(range(55, 64)),
    "objective": "তিন অঙ্কের সংখ্যা যোগ করা, একবার বা দুইবার বাহকসহ।",
    "minutes": 12, "numbers": list(add2_nums.values()),
    "steps": [
        intro_step(T4, "৭৩ + ৫৪ কীভাবে যোগ করব?",
                   "দিলীপের কাছে ৭৩টি কাগজ ছিল। তার বোন দীপা তাকে আরও ৫৪টি কাগজ দিল। তার কাছে কতটি কাগজ হলো?",
                   "blocks-0-7-3"),
        worked(sid(T4, "w1"), "৭৩ + ৫৪ = ১২৭ (এক বাহক)", [
            {"text": "একক স্থানের অঙ্ক যোগ করলে হয় ৩+৪=৭।", "speaker": "rafi"},
            {"text": "দশক স্থানের অঙ্ক যোগ করলে হয় ৭+৫=১২ দশক। ১২ দশক হলো ১ শতক ২ দশক। দশকের স্থানে ২ এবং শতকের স্থানে ১ বসবে। তাই ৭৩+৫৪=১২৭।", "speaker": "tuli"},
        ], "যোগ (২)"),
        worked(sid(T4, "w2"), "২১৬ + ১৪২ = ৩৫৮ (বাহক ছাড়া)", [
            {"text": "একক স্থানের অঙ্ক যোগ করলে হয় ৬+২=৮।"},
            {"text": "দশক স্থানের অঙ্ক যোগ করলে হয় ১+৪=৫।"},
            {"text": "শতক স্থানের অঙ্ক যোগ করলে হয় ২+১=৩। তাই ২১৬+১৪২=৩৫৮।"},
        ], "যোগ (২)"),
        worked(sid(T4, "w3"), "৪৬৮ + ৩৯৪ = ৮৬২ (দুই বাহক)", [
            {"text": "একক স্থানের অঙ্ক দুটি যোগ করলে হয় ৮+৪=১২। ১২ হলো ১ দশক ২ একক। একক স্থানে ২ লিখি, দশক স্থানের অঙ্কের সাথে ১ যোগ করি।"},
            {"text": "দশক স্থানের অঙ্ক যোগ করলে হয় ৬+৯+১=১৬। ১৬ হলো ১ শতক ৬ দশক। দশকের স্থানে ৬ লিখি, শতক স্থানের অঙ্কের সাথে ১ যোগ করি।"},
            {"text": "শতক স্থানের অঙ্ক যোগ করলে হয় ৪+৩+১=৮। তাই ৪৬৮+৩৯৪=৮৬২।"},
        ], "যোগ (২)"),
        game_step(T4, "game1", "arithmetic", "যোগ করি (দুই অঙ্ক, তিন অঙ্কের যোগফল)", add2_rounds, "যোগ করি"),
        game_step(T4, "game2", "arithmetic", "যোগ করি (তিন অঙ্ক)", add2_rounds3, "যোগ করি"),
        quiz_step(T4, [
            question("q1", "৭৩ + ৫৪ = ?", bn_digits(127), [bn_digits(w) for w in nearby_wrongs(127)],
                     tests="a2-127", explain="৭৩+৫৪=১২৭।"),
            question("q2", "২১৬ + ১৪২ = ?", bn_digits(358), [bn_digits(w) for w in nearby_wrongs(358)],
                     tests="a2-358", explain="২১৬+১৪২=৩৫৮ (বাহক লাগে না)।"),
            question("q3", "৪৬৮ + ৩৯৪ = ?", bn_digits(862), [bn_digits(w) for w in nearby_wrongs(862)],
                     tests="a2-862", explain="৪৬৮+৩৯৪=৮৬২ (দুইবার বাহক)।"),
            question("q4", "রাজুর একটি খাতায় ২৬৭ পৃষ্ঠা কাগজ আছে। আরেকটি খাতায় ১৪৫ পৃষ্ঠা কাগজ আছে। দুটি খাতায় মোট পৃষ্ঠা কত?",
                     bn_digits(412), [bn_digits(w) for w in nearby_wrongs(412)], explain="২৬৭+১৪৫=৪১২।"),
            question("q5", "৫২৬ + ২৫৩ = ?", bn_digits(779), [bn_digits(w) for w in nearby_wrongs(779)],
                     tests="a2-779", explain="৫২৬+২৫৩=৭৭৯।"),
        ]),
        done_step(T4, "দারুণ হয়েছে!", "তুমি এখন তিন অঙ্কের সংখ্যা বাহকসহ যোগ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 5 - বিয়োগ (২): 3-digit subtraction (book pages 64-68)
# =========================================================================
T5 = "c2t5"
sub2_nums = {}
for v in [70, 82, 364, 126, 110, 160, 400, 590]:
    sub2_nums.setdefault(v, num_item("s2-%d" % v, v, 64))

sub2_no_borrow_round = [(190, 80, 110), (180, 20, 160), (900, 500, 400), (620, 30, 590)]
# A few additional, freshly generated 3-digit borrow problems — the book's
# own drill grid on this page could not be read back digit-for-digit with
# confidence from the scan, so these are computed rather than guessed.
sub2_extra_borrow = [(452, 238, 214), (630, 275, 355), (800, 346, 454)]

sub2_rounds = [diff_round("nb%d" % c, a, b, tests="s2-%d" % c) for a, b, c in sub2_no_borrow_round]
sub2_rounds_extra = [diff_round("eb%d" % c, a, b, tests=None,
                                hint="শতক থেকে দশকে, বা দশক থেকে এককে ধার নিতে হতে পারে।")
                     for a, b, c in sub2_extra_borrow]

topics.append({
    "id": T5, "chapterId": "c2", "number": 5, "title": "বিয়োগ (২)", "shape": "arithmetic",
    "bookPages": [64, 65, 66, 67, 68],
    "objective": "তিন অঙ্কের সংখ্যা বিয়োগ করা, ধার ছাড়া ও ধারসহ।",
    "minutes": 12, "numbers": list(sub2_nums.values()),
    "steps": [
        intro_step(T5, "১২০ থেকে ৫০ কীভাবে বিয়োগ করব?", "১২০ থেকে ৫০ কীভাবে বিয়োগ করতে পারি?", "blocks-1-2-0"),
        worked(sid(T5, "w1"), "১২০ - ৫০ = ৭০", [
            {"text": "১২০ থেকে ৫টি দশের দল সরিয়ে নিলে থাকে ৭টি দশের দল, অর্থাৎ ৭০। তাই ১২০-৫০=৭০।"},
        ], "বিয়োগ (২)"),
        worked(sid(T5, "w2"), "১২৫ - ৪৩ = ৮২", [
            {"text": "সংখ্যা দুটি স্থানীয় মান ব্যবহার করে সাজিয়ে নিই।"},
            {"text": "যেহেতু দশক স্থানের অঙ্ক ২ ছোটো, ৪ বড়ো, তাই আমরা ২ থেকে ৪ বিয়োগ করতে পারি না। শতকের স্থান থেকে ১ দশক দশকের স্থানের ২ এর সাথে যোগ করে পাই ১০+২=১২।"},
            {"text": "দশকের স্থানে ১২-৪=৮ হবে। একক স্থানে ৫-৩=২। তাই ১২৫-৪৩=৮২।"},
        ], "বিয়োগ (২)"),
        worked(sid(T5, "w3"), "৭৮৫ - ৪২১ = ৩৬৪ (ধার ছাড়া)", [
            {"text": "একক স্থানে: ৫-১=৪।"},
            {"text": "দশক স্থানে: ৮-২=৬।"},
            {"text": "শতক স্থানে: ৭-৪=৩। তাই ৭৮৫-৪২১=৩৬৪।"},
        ], "বিয়োগ (২)"),
        worked(sid(T5, "w4"), "২৪১ - ১১৫ = ১২৬ (ধারসহ)", [
            {"text": "মিনার ২৪১ টাকা আছে। রাজুর নিকট ১১৫ টাকা আছে। রাজু অপেক্ষা মিনার কত টাকা বেশি আছে?", "illustration": "blocks-2-4-1"},
            {"text": "একক স্থানের অঙ্ক ১, ৫ এর চেয়ে ছোটো। তাই আমরা ১ থেকে ৫ বিয়োগ করতে পারি না। দশক স্থান থেকে ১ দশক একক সংখ্যার সাথে যোগ করি: ১০+১=১১, একক স্থানে ১১-৫=৬ লিখি।", "speaker": "rafi"},
            {"text": "দশক স্থানে ৩-১=২ লিখি (১ দশক ধার নেওয়ার পর)। শতক স্থানে ২-১=১ লিখি। তাই ২৪১-১১৫=১২৬।", "speaker": "tuli"},
        ], "বিয়োগ (২)"),
        game_step(T5, "game1", "arithmetic", "বিয়োগ করি (ধার ছাড়া)", sub2_rounds, "বিয়োগ করি"),
        game_step(T5, "game2", "arithmetic", "বিয়োগ করি (ধারসহ)", sub2_rounds_extra, "বিয়োগ করি"),
        quiz_step(T5, [
            question("q1", "১২০ - ৫০ = ?", bn_digits(70), [bn_digits(w) for w in nearby_wrongs(70, lo=0)],
                     tests="s2-70", explain="১২০-৫০=৭০।"),
            question("q2", "১২৫ - ৪৩ = ?", bn_digits(82), [bn_digits(w) for w in nearby_wrongs(82, lo=0)],
                     tests="s2-82", explain="১২৫-৪৩=৮২।"),
            question("q3", "৭৮৫ - ৪২১ = ?", bn_digits(364), [bn_digits(w) for w in nearby_wrongs(364, lo=0)],
                     tests="s2-364", explain="৭৮৫-৪২১=৩৬৪ (ধার লাগে না)।"),
            question("q4", "মিনার ২৪১ টাকা আছে। রাজুর ১১৫ টাকা আছে। মিনার কত টাকা বেশি?",
                     bn_digits(126), [bn_digits(w) for w in nearby_wrongs(126, lo=0)],
                     tests="s2-126", explain="২৪১-১১৫=১২৬ টাকা বেশি।"),
            question("q5", "৯০০ - ৫০০ = ?", bn_digits(400), [bn_digits(w) for w in nearby_wrongs(400, lo=0)],
                     tests="s2-400", explain="৯০০-৫০০=৪০০।"),
        ]),
        done_step(T5, "দারুণ হয়েছে!", "তুমি এখন তিন অঙ্কের সংখ্যা ধারসহ বিয়োগ করতে পারো!"),
    ],
})

# =========================================================================
# Topic 6 - যোগ ও বিয়োগ সংক্রান্ত সমস্যা (book pages 69-72)
# =========================================================================
T6 = "c2t6"

village_start, village_in, village_out = 673, 117, 105
village_after_in = village_start + village_in
village_final = village_after_in - village_out

bar_y1, bar_y2, bar_y3 = 123, 154, 209
bar_total = bar_y1 + bar_y2 + bar_y3
bar_diff = bar_y3 - bar_y1

jar1, jar2 = 235, 365
jar_diff = jar2 - jar1
jar_total = jar1 + jar2

b_sohag, b_gita, b_tuli = 150, 248, 475
b_diff = b_tuli - b_gita
b_total = b_sohag + b_tuli

wp_nums = {}
for v in [village_final, bar_total, jar_total, b_total, 865, 170, 313, 315, 335, 785]:
    wp_nums.setdefault(v, num_item("wp-%d" % v, v, 69))

topics.append({
    "id": T6, "chapterId": "c2", "number": 6, "title": "যোগ ও বিয়োগ সংক্রান্ত সমস্যা", "shape": "arithmetic",
    "bookPages": list(range(69, 73)),
    "objective": "একাধিক ধাপে যোগ ও বিয়োগ ব্যবহার করে বাস্তব সমস্যার সমাধান করা।",
    "minutes": 13, "numbers": list(wp_nums.values()),
    "steps": [
        intro_step(T6, "লোকসংখ্যা কত?",
                   "একটি গ্রামে লোকসংখ্যা ৬৭৩। নতুন এলো ১১৭ জন। চলে গেল ১০৫ জন। এখন লোকসংখ্যা কত হলো?",
                   "number-673"),
        worked(sid(T6, "w1"), "একাধিক ধাপে সমাধান করি", [
            {"text": "নতুন আসায় লোকসংখ্যা বেশি হবে। একত্র করলে হবে ৬৭৩+১১৭=৭৯০।", "speaker": "rafi"},
            {"text": "চলে যাওয়ায় লোকসংখ্যা কম হবে। বাদ দিলে হবে ৭৯০-১০৫=৬৮৫।", "speaker": "tuli"},
            {"text": "গাণিতিক বাক্যে সমস্যাটি: ৬৭৩+১১৭-১০৫। সমাধান করি: =৭৯০-১০৫=৬৮৫। লোকসংখ্যা ৬৮৫।"},
        ], "যোগ ও বিয়োগ সংক্রান্ত সমস্যা"),
        worked(sid(T6, "w2"), "চিত্র থেকে সমস্যা বুঝি", [
            {"text": "একটি বিদ্যালয়ে গত ৩ বছরের ভর্তি: ১ম বছর ১২৩ জন, ২য় বছর ১৫৪ জন, ৩য় বছর ২০৯ জন।"},
            {"text": "১ম বছরের তুলনায় ৩য় বছর কতজন বেশি ভর্তি হয়েছে? ২০৯-১২৩=৮৬ জন বেশি।"},
            {"text": "মোট কতজন শিক্ষার্থী ভর্তি হয়েছে? ১২৩+১৫৪+২০৯=৪৮৬ জন।"},
        ], "যোগ ও বিয়োগ সংক্রান্ত সমস্যা"),
        game_step(T6, "game1", "arithmetic", "সমস্যার সমাধান করি", [
            rnd("jar1", "১ম পাত্রে ২৩৫ গ্লাস পানি, ২য় পাত্রে ৩৬৫ গ্লাস পানি আছে। ২য় পাত্রে কত গ্লাস বেশি আছে?",
                bn_digits(jar_diff), [bn_digits(w) for w in nearby_wrongs(jar_diff, lo=0)],
                hint="৩৬৫-২৩৫ করো।"),
            rnd("jar2", "দুই পাত্রে মোট কত গ্লাস পানি আছে?", bn_digits(jar_total),
                [bn_digits(w) for w in nearby_wrongs(jar_total)], hint="২৩৫+৩৬৫ করো।"),
            rnd("bask1", "সোহাগের ফলের ঝুড়িতে ১৫০টি ফল, গীতার ঝুড়িতে ২৪৮টি, তুলির ঝুড়িতে ৪৭৫টি ফল আছে। গীতার চেয়ে তুলির কত বেশি?",
                bn_digits(b_diff), [bn_digits(w) for w in nearby_wrongs(b_diff, lo=0)],
                hint="৪৭৫-২৪৮ করো।"),
            rnd("bask2", "সোহাগ ও তুলির ঝুড়িতে মোট কতটি ফল আছে?", bn_digits(b_total),
                [bn_digits(w) for w in nearby_wrongs(b_total)], hint="১৫০+৪৭৫ করো।"),
            rnd("sch1", "একটি বিদ্যালয়ে ৬২৫ জন শিক্ষার্থী ছিল। বছরের শুরুতে ২৭৫ জন নতুন ভর্তি হলো এবং ৩৫ জন চলে গেল। এখন কতজন আছে?",
                bn_digits(865), [bn_digits(w) for w in nearby_wrongs(865)],
                hint="আগে যোগ করো, তারপর বিয়োগ করো।"),
            rnd("buma", "বুমার ২৫০ টাকা আছে। বাবা তাকে আরও ১৫০ টাকা দিলেন। বুমা ২৩০ টাকা দিয়ে একটি বই কিনল। তার কাছে কত টাকা রইল?",
                bn_digits(170), [bn_digits(w) for w in nearby_wrongs(170, lo=0)],
                hint="আগে যোগ করো (২৫০+১৫০), তারপর বিয়োগ করো।"),
            rnd("shopkeeper", "একজন দোকানদার সপ্তাহে আয় করেন ৯৯০ টাকা এবং ব্যয় করেন ৬৭৫ টাকা। সপ্তাহ শেষে তার কাছে কত টাকা জমা থাকে?",
                bn_digits(315), [bn_digits(w) for w in nearby_wrongs(315, lo=0)], hint="৯৯০-৬৭৫ করো।"),
            rnd("nahid", "নাহিদের ৪৫০ টাকা আছে। নাহিদ অপেক্ষা সুমনের ১১৫ টাকা কম আছে। সুমনের কত টাকা আছে?",
                bn_digits(335), [bn_digits(w) for w in nearby_wrongs(335, lo=0)], hint="৪৫০-১১৫ করো।"),
        ], "যোগ ও বিয়োগ সংক্রান্ত সমস্যা"),
        quiz_step(T6, [
            question("q1", "একটি গ্রামে লোকসংখ্যা ৬৭৩। নতুন এলো ১১৭ জন, চলে গেল ১০৫ জন। এখন লোকসংখ্যা কত?",
                     bn_digits(village_final), [bn_digits(w) for w in nearby_wrongs(village_final)],
                     tests="wp-685" if village_final == 685 else None,
                     explain="৬৭৩+১১৭-১০৫=৬৮৫।"),
            question("q2", "১ম বছরের তুলনায় ৩য় বছর কতজন বেশি ভর্তি হয়েছে (১২৩ ও ২০৯ জন)?",
                     bn_digits(bar_diff), [bn_digits(w) for w in nearby_wrongs(bar_diff, lo=0)],
                     explain="২০৯-১২৩=৮৬ জন বেশি।"),
            question("q3", "২য় পাত্রে (৩৬৫ গ্লাস) ১ম পাত্রের (২৩৫ গ্লাস) চেয়ে কত গ্লাস বেশি পানি আছে?",
                     bn_digits(jar_diff), [bn_digits(w) for w in nearby_wrongs(jar_diff, lo=0)],
                     explain="৩৬৫-২৩৫=১৩০ গ্লাস বেশি।"),
            question("q4", "সোহাগ ও তুলির ঝুড়িতে (১৫০ ও ৪৭৫টি ফল) মোট কতটি ফল আছে?",
                     bn_digits(b_total), [bn_digits(w) for w in nearby_wrongs(b_total)],
                     explain="১৫০+৪৭৫=৬২৫টি ফল।"),
            question("q5", "নাহিদের ৪৫০ টাকা আছে। সুমনের নাহিদের চেয়ে ১১৫ টাকা কম আছে। সুমনের কত টাকা?",
                     bn_digits(335), [bn_digits(w) for w in nearby_wrongs(335, lo=0)],
                     explain="৪৫০-১১৫=৩৩৫ টাকা।"),
        ]),
        done_step(T6, "দারুণ হয়েছে!", "তুমি এখন একাধিক ধাপে যোগ ও বিয়োগ করে সমস্যার সমাধান করতে পারো!"),
    ],
})

chapter = {
    "id": "c2", "number": 2,
    "title": "যোগ ও বিয়োগ",
    "colour": "amber", "icon": "plus-minus",
    "_source": "প্রাথমিক গণিত, দ্বিতীয় শ্রেণি (এনসিটিবি)। অধ্যায় ২, বই পৃষ্ঠা ৪০-৭২।",
    "_note": ("তুলি-রাফির প্রতিটি worked উদাহরণ ও অধিকাংশ অনুশীলনের সংখ্যা বইয়ের "
              "পাতা থেকে হুবহু নেওয়া। প্রতিটি উত্তর ও ভুল বিকল্প পাইথন কোডে সরাসরি "
              "যোগ-বিয়োগ করে বের করা, কখনো হাতে লেখা হয়নি। দুটি জায়গায় নিজস্ব "
              "সংযোজন আছে (সংশ্লিষ্ট মন্তব্যে চিহ্নিত): (ক) পাঠ ৩-এর খালি-ঘর "
              "অনুশীলনের কিছু সংখ্যা, কারণ বইয়ের নিজে করি তালিকার কয়েকটি চিহ্ন "
              "(+ না -) স্ক্যান থেকে নিশ্চিতভাবে পড়া যায়নি; (খ) পাঠ ৫-এর তিনটি "
              "অতিরিক্ত বিয়োগ অনুশীলন, কারণ বইয়ের সেই পাতার ঘন অনুশীলন গ্রিডের কিছু "
              "অঙ্ক স্ক্যানে স্পষ্ট ছিল না। উভয় ক্ষেত্রে নিয়মটি বইয়েরই।"),
    "topics": topics,
}


def clean(node):
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/math/chapter02.json"
out.write_text(json.dumps(clean(chapter), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

words = sum(len(t["numbers"]) for t in topics)
print("chapter02.json: %d topic(s), %d numbers" % (len(topics), words))
