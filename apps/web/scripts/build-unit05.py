# -*- coding: utf-8 -*-
"""Generate unit05.json — Days of the Week (book pages 42-54).

Same approach as build-unit02/03/04.py: every quiz and game answer index is
*computed* from the correct option, never typed.

Textbook text (day names, the rhyme, Rima's story, the birds' rhyme, the
questions) is typed once below, word for word. Bangla glosses and
pronunciations are Pickixo's addition and are marked as such.

Notes on reading the book:
  * Page 54 prints "Thrusday" in question 3. That is a typo in the book; it is
    corrected to "Thursday" here.
  * Lesson 3 Activity D (a word-search grid) and the trace/copy activities are
    pen-and-paper exercises and are not reproduced as screens. The copy
    activity is offered as a "listen and do" step (do it in your exercise book).
  * The blanks the book leaves for the child ("It's ......") are answered by
    the child aloud; no answer is invented for them.

Run:  python scripts/build-unit05.py
"""
import json
import pathlib
import random

random.seed(5)   # stable output: regenerating must not reshuffle every quiz


def vocab(vid, word, bangla, pron, page, category, image, example=None):
    return {
        "id": vid, "word": word, "bangla": bangla, "banglaPronunciation": pron,
        "banglaSource": "enrichment", "bookPage": page, "category": category,
        "image": image, "audio": None,
        "example": example, "exampleSource": "textbook" if example else None,
    }


def labelled(correct, wrongs, images=None):
    labels = [correct] + list(wrongs)
    random.shuffle(labels)
    opts = []
    for l in labels:
        o = {"label": l}
        if images and l in images:
            o["image"] = images[l]
        opts.append(o)
    return opts, labels.index(correct)


def others(word, pool, n=2):
    return random.sample([w for w in pool if w != word], n)


def rnd(rid, ask, ask_bn, correct, wrongs, tests=None, image=None, speak=None,
        hint=None, images=None):
    opts, answer = labelled(correct, wrongs, images)
    return {"id": rid, "ask": ask, "askBn": ask_bn, "image": image,
            "speak": speak, "options": opts, "answer": answer, "hint": hint,
            "tests": tests}


def question(qid, qtype, ask, ask_bn, correct, wrongs, tests=None, image=None,
             speak=None, explain=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": qid, "type": qtype, "ask": ask, "askBn": ask_bn,
            "image": image, "speak": speak, "options": opts, "answer": answer,
            "explain": explain, "tests": tests}


def true_false(qid, ask, ask_bn, is_true, explain, tests=None):
    return {"id": qid, "type": "true-false", "ask": ask, "askBn": ask_bn,
            "options": [{"label": "True"}, {"label": "False"}],
            "answer": 0 if is_true else 1, "explain": explain, "tests": tests}


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, vocabulary, steps, minutes=7):
    return {
        "id": lid, "unitId": "u5", "number": number, "title": title,
        "titleBn": title_bn, "shape": shape, "bookPages": pages,
        "objective": objective, "objectiveBn": objective_bn,
        "minutes": minutes, "vocabulary": vocabulary, "steps": steps,
    }


def sid(lid, name):
    return lid + "-" + name


def vocab_step(lid, name, ids, title, title_bn, activity=None):
    return {"id": sid(lid, name), "type": "vocab", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "items": ids}


def dialogue_step(lid, name, title, title_bn, lines, activity=None):
    return {"id": sid(lid, name), "type": "dialogue", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "source": "textbook",
            "lines": [{"speaker": s, "text": t} for (s, t) in lines]}


def speak_step(lid, name, title, title_bn, prompt, prompt_bn, model, activity=None):
    return {"id": sid(lid, name), "type": "speak", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "prompt": prompt,
            "promptBn": prompt_bn, "modelAnswer": model}


def game_step(lid, name, kind, title, title_bn, rounds, activity=None):
    return {"id": sid(lid, name), "type": "game", "kind": kind,
            "bookActivity": activity, "title": title, "titleBn": title_bn,
            "rounds": rounds}


def intro_step(lid, title, title_bn, say, say_bn, illustration):
    return {"id": sid(lid, "intro"), "type": "intro", "title": title,
            "titleBn": title_bn, "say": say, "sayBn": say_bn,
            "illustration": illustration}


def quiz_step(lid, questions):
    return {"id": sid(lid, "quiz"), "type": "quiz", "title": "Quick quiz",
            "titleBn": "ছোট্ট কুইজ", "questions": questions}


def done_step(lid, title, title_bn, say, say_bn):
    return {"id": sid(lid, "done"), "type": "done", "title": title,
            "titleBn": title_bn, "say": say, "sayBn": say_bn}


def story_step(lid, name, title, title_bn, scenes, activity=None):
    return {"id": sid(lid, name), "type": "story", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "source": "textbook",
            "scenes": [{"id": "s%d" % (i + 1), "text": t, "illustration": img,
                        "audio": None} for i, (t, img) in enumerate(scenes)]}


def picture_rounds(items_by_id, ids, ask, ask_bn, pool_words, hint):
    out = []
    for i in ids:
        w = items_by_id[i]["word"]
        out.append(rnd("r-" + i, ask, ask_bn, w, others(w, pool_words),
                       tests=i, image=items_by_id[i]["image"], hint=hint))
    return out


lessons = []

# =========================================================================
# Lesson 1 - Days (book pages 42-43)
# =========================================================================
DAYS = [
    ("sunday", "Sunday", "রবিবার", "সানডে"),
    ("monday", "Monday", "সোমবার", "মানডে"),
    ("tuesday", "Tuesday", "মঙ্গলবার", "টিউজডে"),
    ("wednesday", "Wednesday", "বুধবার", "ওয়েডনেসডে"),
    ("thursday", "Thursday", "বৃহস্পতিবার", "থার্সডে"),
    ("friday", "Friday", "শুক্রবার", "ফ্রাইডে"),
    ("saturday", "Saturday", "শনিবার", "স্যাটারডে"),
]
L1 = "u5l1"
V1 = [vocab(i, w, bn, pr, 42, "day", "day-" + i) for (i, w, bn, pr) in DAYS]
I1 = {v["id"]: v for v in V1}
day_words = [d[1] for d in DAYS]

quiz1 = [
    question("q1", "tap-picture", "Which day is this?", "এটি কোন দিন?", "Thursday",
             others("Thursday", day_words), tests="thursday", image="day-thursday",
             explain="Thursday = বৃহস্পতিবার"),
    question("q2", "listen-choose", "Listen. Which day did you hear?", "শোনো। কোন দিনটি শুনলে?",
             "Wednesday", others("Wednesday", day_words), tests="wednesday", speak="Wednesday"),
    question("q3", "fill-blank", "Sunday, Monday, ___", "Sunday, Monday, ___", "Tuesday",
             ["Friday", "Saturday"], tests="tuesday", explain="After Monday comes Tuesday."),
    true_false("q4", "Friday comes after Thursday.", "শুক্রবার বৃহস্পতিবারের পরে আসে।", True,
               "The days go: Thursday, Friday.", "friday"),
    question("q5", "tap-word", "Which day is the last on the list?", "তালিকার শেষ দিন কোনটি?",
             "Saturday", ["Sunday", "Monday"], tests="saturday",
             explain="The list ends with Saturday. Then Sunday comes again."),
]
lessons.append(lesson_frame(
    L1, 1, "Days", "দিন", "vocabulary", [42, 43],
    "Say the seven days of the week in order.", "সপ্তাহের সাতটি দিন ক্রমানুসারে বলা।", V1, [
        intro_step(L1, "Seven days", "সাতটি দিন", "There are seven days in a week. Let's say them!",
                   "সপ্তাহে সাতটি দিন। চলো বলি!", "week"),
        vocab_step(L1, "words1", ["sunday", "monday", "tuesday", "wednesday"], "Days of the week 1",
                   "সপ্তাহের দিন ১", "A"),
        vocab_step(L1, "words2", ["thursday", "friday", "saturday"], "Days of the week 2",
                   "সপ্তাহের দিন ২", "A"),
        speak_step(L1, "speak", "Say the weekdays", "সপ্তাহের দিনগুলো বলো",
                   "Say the days of the week.", "সপ্তাহের দিনগুলোর নাম বলো।",
                   "Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday.", "B"),
        game_step(L1, "game1", "picture-to-word", "Which day?", "কোন দিন?",
                  picture_rounds(I1, ["sunday", "tuesday", "wednesday", "friday", "saturday"],
                                 "Which day is this?", "এটি কোন দিন?", day_words,
                                 "Look at the box that is coloured."), "A"),
        game_step(L1, "game2", "order-the-lines", "First and last", "প্রথম আর শেষ", [
            rnd("o1", "Which day comes first on the list?", "তালিকায় কোন দিনটি প্রথমে?",
                "Sunday", others("Sunday", day_words), tests="sunday", hint="The list starts with Sunday."),
            rnd("o2", "Which day comes last on the list?", "তালিকায় কোন দিনটি শেষে?",
                "Saturday", others("Saturday", day_words), tests="saturday", hint="Then Sunday comes again."),
            rnd("o3", "Which day comes after Monday?", "সোমবারের পরে কোন দিন?",
                "Tuesday", others("Tuesday", day_words), tests="tuesday", hint="Monday, ... ?"),
        ], "B"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You can say all seven days!",
                  "তুমি সাতটি দিনই বলতে পারো!"),
    ], minutes=6))

# =========================================================================
# Lesson 2 - Seven days in a week (book pages 44-45)
# =========================================================================
L2 = "u5l2"
V2 = [
    vocab("calendar", "calendar", "ক্যালেন্ডার", "ক্যালেন্ডার", 44, "object", "calendar",
          "I look at my calendar and what do I see?"),
    vocab("week", "week", "সপ্তাহ", "উইক", 44, "day", "week", "There are seven days in a row for me."),
    vocab("today", "today", "আজ", "টুডে", 45, "day", "today"),
]
RHYME = [
    "I look at my calendar and what do I see?",
    "There are seven days in a row for me.",
    "Sunday, Monday, Tuesday too",
    "Wednesday, Thursday is next true.",
    "Friday, Saturday come and then",
    "Sunday comes around again.",
]
quiz2 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "calendar", ["clock", "book"],
             tests="calendar", image="calendar", explain="calendar = ক্যালেন্ডার"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "calendar", ["clock", "week"], tests="calendar", speak="calendar"),
    question("q3", "fill-blank", "There are ___ days in a week.", "There are ___ days in a week.",
             "seven", ["five", "ten"], tests="week", explain="A week has seven days."),
    true_false("q4", "After Saturday, Sunday comes around again.",
               "শনিবারের পরে আবার রবিবার আসে।", True, "The rhyme says: Sunday comes around again.", "week"),
    question("q5", "tap-picture", "How many days are in the week?", "সপ্তাহে কয়টি দিন?", "7",
             ["5", "10"], tests="week", image="week", explain="One box for each day: 7."),
]
lessons.append(lesson_frame(
    L2, 2, "Seven Days in a Week", "সপ্তাহে সাত দিন", "rhyme", [44, 45],
    "Recite the rhyme about the seven days.", "সাত দিনের ছড়াটি আবৃত্তি করা।", V2, [
        intro_step(L2, "Look at the calendar", "ক্যালেন্ডার দেখো",
                   "Look at the calendar. How many days are in a week?",
                   "ক্যালেন্ডার দেখো। সপ্তাহে কয়টি দিন?", "calendar"),
        vocab_step(L2, "words", ["calendar", "week", "today"], "New words", "নতুন শব্দ", "A"),
        {"id": sid(L2, "rhyme"), "type": "rhyme", "bookActivity": "A", "source": "textbook",
         "title": "Seven Days in a Week", "titleBn": "সপ্তাহে সাত দিন", "verses": [RHYME]},
        {"id": sid(L2, "write"), "type": "command", "bookActivity": "B", "source": "textbook",
         "title": "Write the days", "titleBn": "দিনগুলো লেখো (খাতায়)",
         "commands": [{"text": w, "textBn": "খাতায় লেখো: " + bn, "illustration": "day-" + i}
                      for (i, w, bn, _) in DAYS]},
        game_step(L2, "game", "order-the-lines", "Finish the rhyme", "ছড়াটি শেষ করো", [
            rnd("m1", "There are ___ days in a row for me.", "There are ___ days in a row for me.",
                "seven", ["five", "ten"], tests="week", hint="How many days are in a week?"),
            rnd("m2", "Sunday, Monday, ___ too", "Sunday, Monday, ___ too", "Tuesday",
                ["Friday", "Saturday"], hint="After Monday comes ... ?"),
            rnd("m3", "Friday, Saturday come and then ___ comes around again.",
                "Friday, Saturday come and then ___ comes around again.", "Sunday",
                ["Monday", "Wednesday"], tests="week", hint="A new week begins."),
        ], "A"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You can say the rhyme about the week!",
                  "তুমি সপ্তাহের ছড়াটি বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 3 - What day is today? (book pages 46-47)
# =========================================================================
L3 = "u5l3"
V3 = [
    vocab("how-many-days", "How many days are there in a week?", "সপ্তাহে কয়টি দিন?",
          "হাউ ম্যানি ডেইজ আর দেয়ার ইন আ উইক", 46, "expression", "week",
          "How many days are there in a week?"),
    vocab("what-day-today", "What day is today?", "আজ কী বার?", "হোয়াট ডে ইজ টুডে", 46,
          "expression", "today", "What day is today?"),
    vocab("comes-after", "What day comes after Monday?", "সোমবারের পরে কোন দিন?",
          "হোয়াট ডে কামস আফটার মানডে", 47, "expression", "day-tuesday",
          "What day comes after Monday?"),
]
after = lambda a: day_words[(day_words.index(a) + 1) % 7]
after_rounds = []
for a in ["Monday", "Tuesday", "Thursday", "Saturday"]:
    after_rounds.append(rnd("a-" + a.lower(), "What day comes after %s?" % a,
                            dict((d[1], d[2]) for d in DAYS)[a] + "ের পরে কোন দিন?",
                            after(a), others(after(a), day_words), speak="What day comes after %s?" % a,
                            hint="Say the days in order."))
quiz3 = [
    question("q1", "tap-word", "How many days are there in a week?", "সপ্তাহে কয়টি দিন?", "7 days",
             ["5 days", "10 days"], tests="how-many-days", explain="There are 7 days in a week."),
    question("q2", "listen-choose", "Listen. Which day did you hear?", "শোনো। কোন দিনটি শুনলে?",
             "Thursday", others("Thursday", day_words), speak="Thursday"),
    question("q3", "fill-blank", "What day comes ___ Monday?", "What day comes ___ Monday?",
             "after", ["blue", "under"], tests="comes-after", explain="We ask: What day comes after Monday?"),
    true_false("q4", "Tuesday comes after Monday.", "মঙ্গলবার সোমবারের পরে আসে।", True,
               "In the book: What day comes after Monday? Tuesday.", "comes-after"),
    question("q5", "tap-picture", "Which day is coloured?", "কোন দিনটি রং করা?", "Friday",
             others("Friday", day_words), image="day-friday", explain="The coloured box is Friday."),
]
lessons.append(lesson_frame(
    L3, 3, "What Day Is Today?", "আজ কী বার?", "dialogue", [46, 47],
    "Ask and say what day it is, and which day comes next.",
    "আজ কী বার আর তার পরের দিন কোনটি তা জিজ্ঞাসা করা ও বলা।", V3, [
        intro_step(L3, "What day is it?", "আজ কী বার?", "Do you know what day it is today?",
                   "আজ কী বার তুমি জানো?", "today"),
        vocab_step(L3, "words", ["how-many-days", "what-day-today", "comes-after"], "Asking about days",
                   "দিন নিয়ে প্রশ্ন", "A"),
        dialogue_step(L3, "talk1", "Listen and say", "শোনো আর বলো", [
            ("Teacher", "How many days are there in a week?"),
            ("Boy", "7 days"),
        ], "A"),
        speak_step(L3, "speak1", "Your turn!", "এবার তোমার পালা!", "How many days are there in a week?",
                   "সপ্তাহে কয়টি দিন?", "Seven days.", "B"),
        speak_step(L3, "speak2", "What day is it?", "আজ কী বার?", "What day is today?",
                   "আজ কী বার?", "It's ...", "B"),
        dialogue_step(L3, "talk2", "Ask and answer", "প্রশ্ন করো আর উত্তর দাও", [
            ("Student 1", "What day is today?"),
            ("Student 2", "It is Monday."),
            ("Student 2", "What day comes after Monday?"),
            ("Student 3", "Tuesday."),
        ], "C"),
        game_step(L3, "game1", "choose-the-reply", "What comes after?", "এর পরে কোনটি?", after_rounds, "C"),
        game_step(L3, "game2", "picture-to-word", "Which day is coloured?", "কোন দিনটি রং করা?", [
            rnd("d-" + i, "Which day is coloured?", "কোন দিনটি রং করা?", w, others(w, day_words),
                image="day-" + i, hint="Count the boxes from Sunday.")
            for (i, w, _, _) in [DAYS[1], DAYS[3], DAYS[5]]
        ], "D"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You can say what day it is!",
                  "আজ কী বার তুমি বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 4 - Rima and the seed (book page 48)
# =========================================================================
L4 = "u5l4"
V4 = [
    vocab("a-seed", "a seed", "একটি বীজ", "আ সিড", 48, "plant", "seed"),
    vocab("a-flower-pot", "a flower pot", "একটি ফুলের টব", "আ ফ্লাওয়ার পট", 48, "object", "flower-pot"),
    vocab("the-sun", "the sun", "সূর্য", "দ্য সান", 48, "nature", "the-sun"),
    vocab("a-water-can", "a water can", "একটি জলের ঝারি", "আ ওয়াটার ক্যান", 48, "object", "water-can"),
    vocab("a-plant", "a plant", "একটি চারাগাছ", "আ প্ল্যান্ট", 48, "plant", "plant"),
]
I4 = {v["id"]: v for v in V4}
ids4 = [v["id"] for v in V4]
words4 = [v["word"] for v in V4]
STEPS_ORDER = [("pot-empty", "an empty pot"), ("pot-soil", "a pot with soil"),
               ("watering", "watering the pot"), ("pot-sprout", "a small plant")]
order_pics = {label: img for (img, label) in STEPS_ORDER}
order4 = []
for n, (img, label) in enumerate(STEPS_ORDER, start=1):
    order4.append(rnd("n%d" % n, "Which picture is number %d?" % n, "%d নম্বর ছবিটি কোনটি?" % n,
                      label, others(label, [l for _, l in STEPS_ORDER]),
                      hint="Think: what comes first, then next?", images=order_pics))
quiz4 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "a water can", others("a water can", words4),
             tests="a-water-can", image="water-can", explain="a water can = একটি জলের ঝারি"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "a flower pot", others("a flower pot", words4), tests="a-flower-pot", speak="a flower pot"),
    question("q3", "fill-blank", "a flower ___", "a flower ___", "pot", ["can", "sun"],
             tests="a-flower-pot", explain="We say: a flower pot."),
    true_false("q4", "A seed can grow into a plant.", "একটি বীজ থেকে চারাগাছ হতে পারে।", True,
               "Rima's seed grows into a plant.", "a-seed"),
    question("q5", "tap-word", "What do we use to water a plant?", "গাছে জল দিতে আমরা কী ব্যবহার করি?",
             "a water can", ["the sun", "a seed"], tests="a-water-can",
             explain="We water a plant with a water can."),
]
lessons.append(lesson_frame(
    L4, 4, "Rima and the Seed", "রিমা আর বীজ", "category", [48],
    "Name the things a seed needs, and put the pictures in order.",
    "বীজের যা যা দরকার তার নাম বলা আর ছবিগুলো ক্রমানুসারে সাজানো।", V4, [
        intro_step(L4, "Rima and the seed", "রিমা আর বীজ",
                   "Rima wants to grow a plant. What does she need?",
                   "রিমা একটি গাছ লাগাতে চায়। তার কী কী দরকার?", "seed"),
        vocab_step(L4, "words", ids4, "Look, listen and say", "দেখো, শোনো আর বলো", "A"),
        game_step(L4, "game1", "picture-to-word", "Name the picture", "ছবিটির নাম বলো",
                  picture_rounds(I4, ids4, "What is this?", "এটি কী?", words4, "Look at the picture."), "A"),
        game_step(L4, "game2", "order-the-scenes", "Number the pictures", "ছবিগুলোর নম্বর দাও", order4, "B"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You know what a seed needs to grow!",
                  "বীজ বড় হতে কী লাগে তুমি জানো!"),
    ]))

# =========================================================================
# Lesson 5 - How does a plant grow? (book pages 49-51)
# =========================================================================
L5 = "u5l5"
V5 = [
    vocab("soil", "soil", "মাটি", "সয়েল", 49, "nature", "soil", "On Monday, Rima puts soil in a pot."),
    vocab("pot", "pot", "টব", "পট", 49, "object", "flower-pot", "On Monday, Rima puts soil in a pot."),
    vocab("water-seed", "water", "জল দেওয়া", "ওয়াটার", 49, "action", "water-can",
          "Rima waters the seed on Tuesday."),
    vocab("wait", "wait", "অপেক্ষা করা", "ওয়েট", 50, "action", "later", "On Friday, Rima waits."),
    vocab("leaves", "leaves", "পাতা", "লিভস", 50, "plant", "leaves",
          "It's a small plant with two leaves!"),
]
I5 = {v["id"]: v for v in V5}
STORY = [
    ("On Sunday, Rima's father gives her a seed.", "rima-seed"),
    ("On Monday, Rima puts soil in a pot.", "rima-soil"),
    ("She then puts the seed into the soil.", "rima-put-seed"),
    ("Rima waters the seed on Tuesday.", "rima-water"),
    ("On Wednesday, Rima puts the pot in the sun.", "rima-sun"),
    ("Rima waters the seed again on Thursday.", "rima-water"),
    ("On Friday, Rima waits.", "rima-wait"),
    ("On Saturday, Rima sees something in the pot. It's a small plant with two leaves!", "rima-sprout"),
]
# Activity C: the four sentences, in the order the story tells them.
ORDER_SENTENCES = [
    "Rima's father gives her a seed.",
    "Rima puts the seed in the pot.",
    "Rima puts the pot in the sun.",
    "There's a small plant!",
]
order5 = []
for n, s in enumerate(ORDER_SENTENCES, start=1):
    order5.append(rnd("c%d" % n, "Which sentence is number %d?" % n, "%d নম্বর বাক্যটি কোনটি?" % n,
                      s, others(s, ORDER_SENTENCES), hint="Follow Rima's story from Sunday."))
missing_days = []
for n, (idx, text) in enumerate([(1, "Sunday, ___, Tuesday"), (3, "Tuesday, ___, Thursday"),
                                 (5, "Thursday, ___, Saturday"), (6, "Friday, ___")], start=1):
    missing_days.append(rnd("d%d" % n, text, text, day_words[idx], others(day_words[idx], day_words),
                            hint="Say the days in order."))
quiz5 = [
    question("q1", "tap-picture", "What does Rima see on Saturday?", "শনিবার রিমা কী দেখে?",
             "a small plant", ["a big tree", "a bird"], image="rima-sprout",
             explain="It's a small plant with two leaves!"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "soil", ["seed", "sun"], tests="soil", speak="soil"),
    question("q3", "fill-blank", "Rima puts soil in a ___ .", "Rima puts soil in a ___ .", "pot",
             ["book", "bird"], tests="pot", explain="On Monday, Rima puts soil in a pot."),
    true_false("q4", "Rima waters the seed on Tuesday.", "রিমা মঙ্গলবার বীজে জল দেয়।", True,
               "The book says: Rima waters the seed on Tuesday.", "water-seed"),
    question("q5", "tap-word", "What does Rima do on Friday?", "শুক্রবার রিমা কী করে?", "Rima waits.",
             ["Rima waters the seed.", "Rima puts the pot in the sun."], tests="wait",
             explain="On Friday, Rima waits."),
]
lessons.append(lesson_frame(
    L5, 5, "How Does a Plant Grow?", "গাছ কীভাবে বড় হয়?", "story", [49, 50, 51],
    "Follow Rima's story through the week and say what happens on each day.",
    "সপ্তাহের প্রতিদিন রিমার গল্পে কী ঘটে তা অনুসরণ করা ও বলা।", V5, [
        intro_step(L5, "Rima's plant", "রিমার গাছ", "Rima gets a seed on Sunday. What happens next?",
                   "রবিবার রিমা একটি বীজ পায়। তারপর কী হয়?", "rima-seed"),
        vocab_step(L5, "words", [v["id"] for v in V5], "New words", "নতুন শব্দ", "A"),
        story_step(L5, "story", "Rima and her seed", "রিমা আর তার বীজ", STORY, "A"),
        speak_step(L5, "speak", "Retell it", "আবার বলো", "What does Rima see on Saturday?",
                   "শনিবার রিমা কী দেখে?", "A small plant with two leaves!", "B"),
        game_step(L5, "game1", "order-the-scenes", "Put the story in order", "গল্পটি সাজাও", order5, "C"),
        game_step(L5, "game2", "order-the-lines", "Say the missing days", "বাদ পড়া দিনগুলো বলো",
                  missing_days, "D"),
        quiz_step(L5, quiz5),
        done_step(L5, "Great job!", "দারুণ হয়েছে!", "You can tell how Rima's plant grew!",
                  "রিমার গাছ কীভাবে বড় হলো তুমি বলতে পারো!"),
    ], minutes=8))

# =========================================================================
# Lesson 6 - Two little birds (book pages 52-54)
# =========================================================================
L6 = "u5l6"
V6 = [
    vocab("egg", "egg", "ডিম", "এগ", 52, "nature", "egg", "On Sunday, I saw two eggs in the nest."),
    vocab("bird-nest", "nest", "পাখির বাসা", "নেস্ট", 52, "nature", "bird-nest",
          "On Sunday, I saw two eggs in the nest."),
    vocab("little-bird", "little bird", "ছোট পাখি", "লিটল বার্ড", 52, "bird", "bird",
          "On Monday, there were two little birds instead."),
    vocab("branch", "branch", "ডাল", "ব্রাঞ্চ", 53, "nature", "branch",
          "On Thursday, the little birds sat on a branch."),
    vocab("fly-away", "fly away", "উড়ে যাওয়া", "ফ্লাই অ্যাওয়ে", 53, "action", "birds-flyaway",
          "On Saturday, the little birds happily flew away."),
]
I6 = {v["id"]: v for v in V6}
BIRDS = [
    ("On Sunday, I saw two eggs in the nest.", "birds-eggs"),
    ("On Monday, there were two little birds instead.", "birds-hatch"),
    ("On Tuesday, as the day began the little birds twittered and sang.", "birds-sing"),
    ("On Wednesday, the little birds hopped and danced.", "birds-hop"),
    ("On Thursday, the little birds sat on a branch.", "birds-branch"),
    ("On Friday, the little birds began to play.", "birds-play"),
    ("On Saturday, the little birds happily flew away.", "birds-flyaway"),
]
# Activity C's four questions, answered from the rhyme itself.
qa = [
    rnd("k1", "What was in the nest on Sunday?", "রবিবার বাসায় কী ছিল?", "Two eggs",
        ["Two little birds", "A branch"], tests="egg", speak="What was in the nest on Sunday?",
        hint="Read the first line of the rhyme."),
    rnd("k2", "When did the two birds come out of the eggs?", "দুটি পাখি কখন ডিম থেকে বের হলো?",
        "On Monday", ["On Sunday", "On Saturday"], tests="little-bird",
        speak="When did the two birds come out of the eggs?", hint="There were two little birds instead."),
    rnd("k3", "What did the birds do on Thursday?", "বৃহস্পতিবার পাখিরা কী করল?",
        "They sat on a branch.", ["They flew away.", "They began to play."], tests="branch",
        speak="What did the birds do on Thursday?", hint="Find Thursday in the rhyme."),
    rnd("k4", "When did the birds fly away?", "পাখিরা কখন উড়ে গেল?", "On Saturday",
        ["On Sunday", "On Friday"], tests="fly-away", speak="When did the birds fly away?",
        hint="It is the last day of the rhyme."),
]
pic_labels = {"eggs in the nest": "birds-eggs", "birds on a branch": "birds-branch",
              "birds flying away": "birds-flyaway", "birds singing": "birds-sing"}
pic_words = list(pic_labels)
order6 = []
for (day, label) in [("Sunday", "eggs in the nest"), ("Thursday", "birds on a branch"),
                     ("Saturday", "birds flying away")]:
    order6.append(rnd("p-" + day.lower(), "Which picture is %s?" % day, "%s কোন ছবিটি?" % day,
                      label, others(label, pic_words), hint="Follow the rhyme day by day.",
                      images=pic_labels))
quiz6 = [
    question("q1", "tap-picture", "What happened on Saturday?", "শনিবার কী হলো?",
             "The birds flew away.", ["The birds sang.", "The birds played."], tests="fly-away",
             image="birds-flyaway", explain="On Saturday, the little birds happily flew away."),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "branch", ["nest", "egg"], tests="branch", speak="branch"),
    question("q3", "fill-blank", "On Sunday, I saw two ___ in the nest.",
             "On Sunday, I saw two ___ in the nest.", "eggs", ["books", "frogs"], tests="egg",
             explain="On Sunday, I saw two eggs in the nest."),
    true_false("q4", "The birds flew away on Monday.", "পাখিরা সোমবার উড়ে গেল।", False,
               "They flew away on Saturday.", "fly-away"),
    question("q5", "tap-word", "What did the little birds do on Friday?", "শুক্রবার ছোট পাখিরা কী করল?",
             "They began to play.", ["They sat on a branch.", "They flew away."], tests="little-bird",
             explain="On Friday, the little birds began to play."),
]
lessons.append(lesson_frame(
    L6, 6, "Two Little Birds", "দুটি ছোট পাখি", "rhyme", [52, 53, 54],
    "Recite the rhyme about two little birds and answer questions about it.",
    "দুটি ছোট পাখির ছড়া আবৃত্তি করা আর তার প্রশ্নের উত্তর দেওয়া।", V6, [
        intro_step(L6, "Two little birds", "দুটি ছোট পাখি", "Two little birds live in a nest. Let's meet them!",
                   "দুটি ছোট পাখি বাসায় থাকে। চলো তাদের সঙ্গে দেখা করি!", "birds-hatch"),
        vocab_step(L6, "words", [v["id"] for v in V6], "New words", "নতুন শব্দ", "A"),
        story_step(L6, "rhyme", "Two little birds", "দুটি ছোট পাখি", BIRDS, "A"),
        game_step(L6, "game1", "choose-the-reply", "Ask and answer", "প্রশ্ন আর উত্তর", qa, "C"),
        game_step(L6, "game2", "order-the-scenes", "Find the picture", "ছবিটি খুঁজে বের করো", order6, "A"),
        quiz_step(L6, quiz6),
        done_step(L6, "Well done!", "খুব ভালো!", "You know the rhyme about the two little birds!",
                  "তুমি দুটি ছোট পাখির ছড়াটি জানো!"),
    ], minutes=8))

# -------------------------------------------------------------------------
unit = {
    "id": "u5", "number": 5,
    "title": "Days of The Week",
    "titleBn": "সপ্তাহের দিন",
    "colour": "orange", "icon": "calendar",
    "_source": "English for Today, Class Two (NCTB). Unit 5, book pages 42-54.",
    "_note": ("Day names, the rhyme, Rima's story, the birds' rhyme and the "
              "questions are transcribed from the textbook. Bangla meanings are "
              "Pickixo's addition - the book carries no glosses. Pen-and-paper "
              "activities (tracing, copying, the word search) are not reproduced "
              "as screens."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit05.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n",
               encoding="utf-8")

words = sum(len(l["vocabulary"]) for l in lessons)
print("unit05.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
