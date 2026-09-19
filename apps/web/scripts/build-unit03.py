# -*- coding: utf-8 -*-
"""Generate unit03.json — Commands, Instructions and Requests (book pages 31-35).

Same reason as build-unit02.py: every quiz and game answer index here is
*computed* from the correct option rather than typed, so the bug a child feels
as "the app says I'm wrong when I'm right" cannot happen.

The book text (commands, dialogues, rules, requests) is typed once, below, word
for word. Bangla glosses and pronunciations are Pickixo's addition and are
marked as such, because the textbook carries none.

Run:  python scripts/build-unit03.py
"""
import json
import pathlib
import random

random.seed(3)   # stable output: regenerating must not reshuffle every quiz


def vocab(vid, word, bangla, pron, page, category, image, example=None):
    return {
        "id": vid, "word": word, "bangla": bangla, "banglaPronunciation": pron,
        "banglaSource": "enrichment", "bookPage": page, "category": category,
        "image": image, "audio": None,
        "example": example, "exampleSource": "textbook" if example else None,
    }


def labelled(correct, wrongs, images=None):
    """Shuffle the correct label in among the wrong ones; return (options, answer).

    `images` maps a label to an illustration key, for picture options.
    """
    labels = [correct] + list(wrongs)
    random.shuffle(labels)
    opts = []
    for label in labels:
        o = {"label": label}
        if images and label in images:
            o["image"] = images[label]
        opts.append(o)
    return opts, labels.index(correct)


def step_id(lid, name):
    return lid + "-" + name


def choice_round(rid, ask, ask_bn, correct, wrongs, tests=None, image=None,
                 speak=None, hint=None, images=None):
    opts, answer = labelled(correct, wrongs, images)
    r = {"id": rid, "ask": ask, "askBn": ask_bn, "image": image, "speak": speak,
         "options": opts, "answer": answer, "hint": hint, "tests": tests}
    return r


def question(qid, qtype, ask, ask_bn, correct, wrongs, tests=None, image=None,
             speak=None, explain=None, images=None):
    opts, answer = labelled(correct, wrongs, images)
    return {"id": qid, "type": qtype, "ask": ask, "askBn": ask_bn,
            "image": image, "speak": speak, "options": opts, "answer": answer,
            "explain": explain, "tests": tests}


def true_false(qid, ask, ask_bn, is_true, explain, tests, image=None):
    return {"id": qid, "type": "true-false", "ask": ask, "askBn": ask_bn,
            "image": image,
            "options": [{"label": "True"}, {"label": "False"}],
            "answer": 0 if is_true else 1, "explain": explain, "tests": tests}


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, minutes, vocabulary, steps):
    return {
        "id": lid, "unitId": "u3", "number": number, "title": title,
        "titleBn": title_bn, "shape": shape, "bookPages": pages,
        "objective": objective, "objectiveBn": objective_bn,
        "minutes": minutes, "vocabulary": vocabulary, "steps": steps,
    }


QUIZ_TITLE = {"title": "Quick quiz", "titleBn": "ছোট্ট কুইজ"}
WORDS_TITLE = {"title": "New words", "titleBn": "নতুন শব্দ"}

lessons = []

# =========================================================================
# Lesson 1 - Classroom commands (book pages 31-32)
# =========================================================================
# id, the command exactly as printed, Bangla, Bangla sound, example from the book
COMMANDS = [
    ("raise-hand",  "Raise your hand",  "হাত তোলো",          "রেইজ ইয়োর হ্যান্ড",  None),
    ("sit-down",    "Sit down",         "বসো",               "সিট ডাউন",           None),
    ("stand-up",    "Stand up",         "দাঁড়াও",            "স্ট্যান্ড আপ",        None),
    ("clean-board", "Clean the board",  "বোর্ড মোছো",        "ক্লিন দ্য বোর্ড",     "Clean the board and go back to your seat."),
    ("be-quiet",    "Be quiet",         "চুপ করো",           "বি কোয়াইট",         None),
    ("close-book",  "Close your book",  "তোমার বই বন্ধ করো", "ক্লোজ ইয়োর বুক",    None),
    ("come-here",   "Come here",        "এখানে এসো",         "কাম হিয়ার",          None),
    ("write-name",  "Write your name",  "তোমার নাম লেখো",    "রাইট ইয়োর নেইম",     "Write your name on the board."),
    ("clap-hands",  "Clap your hands",  "হাততালি দাও",       "ক্ল্যাপ ইয়োর হ্যান্ডস", None),
    ("open-book",   "Open your book",   "তোমার বই খোলো",     "ওপেন ইয়োর বুক",      None),
]
# The example sentences above sit on page 32; the bare commands on page 31.
cmd_vocab = [vocab(i, w, bn, pr, 32 if ex else 31, "action", i, ex)
             for (i, w, bn, pr, ex) in COMMANDS]
C = {v["id"]: v for v in cmd_vocab}
cmd_labels = {v["word"]: v["image"] for v in cmd_vocab}
all_cmd_words = [v["word"] for v in cmd_vocab]


def others(word, pool, n=2):
    return random.sample([w for w in pool if w != word], n)


L1 = "u3l1"
game_pics = ["stand-up", "sit-down", "raise-hand", "clean-board", "be-quiet"]
picture_game = [
    choice_round("r-" + i, "What is the command?", "আদেশটি কী?",
                 C[i]["word"], others(C[i]["word"], all_cmd_words),
                 tests=i, image=i, hint="Look at what the child is doing.")
    for i in game_pics
]
listen_pics = ["clap-hands", "come-here", "write-name", "open-book", "close-book"]
listen_game = []
for i in listen_pics:
    opts_words = [C[i]["word"]] + others(C[i]["word"], all_cmd_words)
    random.shuffle(opts_words)
    listen_game.append({
        "id": "l-" + i, "ask": "Listen. Which picture?", "askBn": "শোনো। কোন ছবি?",
        "speak": C[i]["word"],
        "options": [{"label": w, "image": cmd_labels[w]} for w in opts_words],
        "answer": opts_words.index(C[i]["word"]),
        "hint": "Listen once more. Then look at each picture.", "tests": i,
    })

l1_quiz = [
    question("q1", "tap-picture", "What is the command?", "আদেশটি কী?",
             "Stand up", ["Sit down", "Be quiet"], tests="stand-up",
             image="stand-up", explain="Stand up = দাঁড়াও"),
    question("q2", "listen-choose", "Listen. Which command did you hear?",
             "শোনো। কোন আদেশটি শুনলে?", "Clap your hands",
             ["Close your book", "Come here"], tests="clap-hands",
             speak="Clap your hands"),
    question("q3", "fill-blank", "Clap your ___ .", "Clap your ___ .",
             "hands", ["name", "book"], tests="clap-hands",
             explain="We clap our hands."),
    true_false("q4", "Your teacher says: Come here. You go to your teacher.",
               "শিক্ষক বললেন: Come here. তুমি শিক্ষকের কাছে যাও।", True,
               "Come here means come to me.", "come-here"),
    question("q5", "tap-word", "Your teacher says: Be quiet. What do you do?",
             "শিক্ষক বললেন: Be quiet. তুমি কী করবে?", "Stop talking",
             ["Clap your hands", "Stand up"], tests="be-quiet",
             explain="Be quiet means do not talk."),
]

lessons.append(lesson_frame(
    L1, 1, "Classroom Commands", "শ্রেণিকক্ষের আদেশ", "command", [31, 32],
    "Understand ten classroom commands and act on them.",
    "শ্রেণিকক্ষের দশটি আদেশ বুঝে সেই অনুযায়ী কাজ করা।", 7, cmd_vocab, [
        {"id": step_id(L1, "intro"), "type": "intro",
         "title": "Listen and do!", "titleBn": "শোনো আর করো!",
         "say": "Listen to your teacher's commands. Then do them.",
         "sayBn": "শিক্ষক আদেশ দেন। শোনো আর সেটা করো।", "illustration": "classroom"},
        {"id": step_id(L1, "words1"), "type": "vocab", "bookActivity": "B",
         "title": "Commands 1", "titleBn": "আদেশ ১",
         "items": ["raise-hand", "sit-down", "stand-up", "clean-board", "be-quiet"]},
        {"id": step_id(L1, "words2"), "type": "vocab", "bookActivity": "B",
         "title": "Commands 2", "titleBn": "আদেশ ২",
         "items": ["close-book", "come-here", "write-name", "clap-hands", "open-book"]},
        {"id": step_id(L1, "do"), "type": "command", "bookActivity": "B",
         "title": "Listen and do", "titleBn": "শোনো আর করো", "source": "textbook",
         "commands": [{"text": v["word"], "textBn": v["bangla"],
                       "illustration": v["image"]} for v in cmd_vocab]},
        {"id": step_id(L1, "talk1"), "type": "dialogue", "bookActivity": "D",
         "title": "Listen carefully!", "titleBn": "মন দিয়ে শোনো!",
         "source": "textbook", "lines": [
             {"speaker": "Teacher", "text": "Hello, students! Listen carefully."},
             {"speaker": "Students", "text": "Sure, teacher."},
             {"speaker": "Teacher", "text": "Hello Noboni, show me your book."},
             {"speaker": "Noboni", "text": "Here it is, teacher."},
         ]},
        {"id": step_id(L1, "talk2"), "type": "dialogue", "bookActivity": "D",
         "title": "Write on the board", "titleBn": "বোর্ডে লেখো",
         "source": "textbook", "lines": [
             {"speaker": "Teacher", "text": "Hello, Abeer, come here. Write your name on the board."},
             {"speaker": "Abeer", "text": "Sure, I will."},
             {"speaker": "Teacher", "text": "Well done, Abeer. Clean the board and go back to your seat."},
             {"speaker": "Abeer", "text": "Thank you, teacher."},
             {"speaker": "Teacher", "text": "Monali, come to the front. Now, draw a circle on the board."},
             {"speaker": "Monali", "text": "Here we go, teacher."},
             {"speaker": "Teacher", "text": "Good job, Monali. Thank you."},
             {"speaker": "Monali", "text": "You're welcome, teacher."},
         ]},
        {"id": step_id(L1, "speak1"), "type": "speak", "bookActivity": "E",
         "title": "Be the teacher!", "titleBn": "তুমি শিক্ষক হও!",
         "prompt": "Tell a friend to sit down.", "promptBn": "বন্ধুকে বসতে বলো।",
         "modelAnswer": "Sit down."},
        {"id": step_id(L1, "speak2"), "type": "speak", "bookActivity": "E",
         "title": "Answer your teacher", "titleBn": "শিক্ষককে উত্তর দাও",
         "prompt": "Teacher says: Show me your book.",
         "promptBn": "শিক্ষক বললেন: তোমার বইটা দেখাও।",
         "modelAnswer": "Here it is, teacher."},
        {"id": step_id(L1, "game1"), "type": "game", "kind": "picture-to-word",
         "bookActivity": "C", "title": "Name the command", "titleBn": "আদেশটির নাম বলো",
         "rounds": picture_game},
        {"id": step_id(L1, "game2"), "type": "game", "kind": "listen-and-choose",
         "bookActivity": "C", "title": "Listen and choose", "titleBn": "শোনো আর বেছে নাও",
         "rounds": listen_game},
        dict({"id": step_id(L1, "quiz"), "type": "quiz", "questions": l1_quiz}, **QUIZ_TITLE),
        {"id": step_id(L1, "done"), "type": "done", "title": "Well done!",
         "titleBn": "খুব ভালো!",
         "say": "You know ten classroom commands now!",
         "sayBn": "তুমি এখন শ্রেণিকক্ষের দশটি আদেশ জানো!"},
    ]))

# =========================================================================
# Lesson 2 - Instructions (book pages 33-34)
# =========================================================================
DRAW = [
    vocab("draw-line", "straight line", "সরল রেখা", "স্ট্রেইট লাইন", 33,
          "object", "draw-line", "Draw a straight line."),
    vocab("draw-arrow", "arrow", "তীর", "অ্যারো", 33, "object", "draw-arrow",
          "Draw an arrow below the line."),
    vocab("draw-circle", "circle", "বৃত্ত", "সার্কল", 33, "shape", "draw-circle",
          "Draw a circle."),
    vocab("draw-flower", "flower", "ফুল", "ফ্লাওয়ার", 33, "plant", "draw-flower",
          "Draw a flower."),
]
# The eight classroom rules, word for word from the coloured list on page 34.
RULES = [
    ("rule-on-time", "Come on time", "সময়মতো এসো", "কাম অন টাইম", "come-on-time"),
    ("rule-prepare", "Prepare for class", "ক্লাসের জন্য তৈরি হও", "প্রিপেয়ার ফর ক্লাস", "prepare"),
    ("rule-listen", "Listen to others", "অন্যদের কথা শোনো", "লিসেন টু আদারস", "listen"),
    ("rule-raise-hand", "Raise hand to speak", "কথা বলতে হাত তোলো", "রেইজ হ্যান্ড টু স্পিক", "raise-hand"),
    ("rule-kind", "Be kind", "দয়ালু হও", "বি কাইন্ড", "kind"),
    ("rule-please", "Say 'please'", "'প্লিজ' বলো", "সে প্লিজ", "say-please"),
    ("rule-thanks", "Say, 'Thank you'", "'ধন্যবাদ' বলো", "সে থ্যাংক ইউ", "say-thanks"),
    ("rule-clean-up", "Clean up and help out", "পরিষ্কার করো আর সাহায্য করো", "ক্লিন আপ অ্যান্ড হেল্প আউট", "clean-up"),
]
rule_vocab = [vocab(i, w, bn, pr, 34, "action", img) for (i, w, bn, pr, img) in RULES]
R = {v["id"]: v for v in rule_vocab}
rule_words = [v["word"] for v in rule_vocab]
D = {v["id"]: v for v in DRAW}

# Five golden rules from the poster project, page 34 (printed in lower case).
GOLDEN = [
    ("Try hard", "চেষ্টা করো", "try-hard"),
    ("Listen", "মন দিয়ে শোনো", "listen"),
    ("Share", "ভাগ করে নাও", "share"),
    ("Care", "যত্ন নাও", "care"),
    ("Be safe", "নিরাপদ থাকো", "be-safe"),
]

L2 = "u3l2"
rule_picture_game = [
    choice_round("r-" + i, "Which rule is this?", "এটি কোন নিয়ম?",
                 R[i]["word"], others(R[i]["word"], rule_words),
                 tests=i, image=R[i]["image"], hint="Look at the little picture.")
    for i in ["rule-on-time", "rule-prepare", "rule-please", "rule-clean-up",
              "rule-kind", "rule-raise-hand"]
]
# Small situations: what does a good classmate do? Each answer is one of the
# book's own rules, so nothing here is invented advice.
SITUATIONS = [
    ("rule-raise-hand", "You want to ask a question in class.",
     "ক্লাসে তুমি একটা প্রশ্ন করতে চাও।"),
    ("rule-thanks", "Your friend helps you.", "তোমার বন্ধু তোমাকে সাহায্য করল।"),
    ("rule-on-time", "School starts at nine. When do you come?",
     "স্কুল শুরু হয় নয়টায়। তুমি কখন আসবে?"),
    ("rule-please", "You want to ask for a pencil.", "তুমি একটা পেনসিল চাইতে চাও।"),
]
situation_game = [
    choice_round("s-" + i, ask, ask_bn, R[i]["word"], others(R[i]["word"], rule_words),
                 tests=i, hint="Think about the rules on the list.")
    for (i, ask, ask_bn) in SITUATIONS
]

l2_quiz = [
    question("q1", "tap-picture", "Which rule is this?", "এটি কোন নিয়ম?",
             R["rule-on-time"]["word"], others(R["rule-on-time"]["word"], rule_words),
             tests="rule-on-time", image="come-on-time", explain="Come on time = সময়মতো এসো"),
    question("q2", "listen-choose", "Listen. Which rule did you hear?",
             "শোনো। কোন নিয়মটি শুনলে?", R["rule-listen"]["word"],
             others(R["rule-listen"]["word"], rule_words), tests="rule-listen",
             speak=R["rule-listen"]["word"]),
    question("q3", "fill-blank", "Raise ___ to speak.", "Raise ___ to speak.",
             "hand", ["book", "name"], tests="rule-raise-hand",
             explain="Raise hand to speak."),
    true_false("q4", "You can shout in class.", "তুমি ক্লাসে চিৎকার করতে পারো।",
               False, "The rule says: Raise hand to speak.", "rule-raise-hand"),
    question("q5", "tap-picture", "What did you draw?", "তুমি কী এঁকেছ?",
             "circle", ["arrow", "flower"], tests="draw-circle", image="draw-circle",
             explain="circle = বৃত্ত"),
]

lessons.append(lesson_frame(
    L2, 2, "Instructions", "নির্দেশ", "command", [33, 34],
    "Follow simple drawing instructions and read the classroom rules.",
    "সহজ আঁকার নির্দেশ মেনে চলা আর শ্রেণিকক্ষের নিয়ম পড়া।", 8,
    DRAW + rule_vocab, [
        {"id": step_id(L2, "intro"), "type": "intro", "title": "Follow the instructions",
         "titleBn": "নির্দেশ মেনে চলো",
         "say": "Listen to each instruction. Then do it.",
         "sayBn": "প্রতিটি নির্দেশ শোনো। তারপর সেটা করো।", "illustration": "listen"},
        {"id": step_id(L2, "words0"), "type": "vocab", "bookActivity": "A",
         "title": "Drawing words", "titleBn": "আঁকার শব্দ",
         "items": [v["id"] for v in DRAW]},
        {"id": step_id(L2, "draw"), "type": "command", "bookActivity": "A",
         "title": "Listen and draw", "titleBn": "শোনো আর আঁকো (খাতায়)",
         "source": "textbook", "commands": [
             {"text": "Draw a straight line. Draw an arrow below the line.",
              "textBn": "একটা সরল রেখা আঁকো। রেখার নিচে একটা তীর আঁকো।",
              "illustration": "draw-arrow"},
             {"text": "Draw a circle.", "textBn": "একটা বৃত্ত আঁকো।",
              "illustration": "draw-circle"},
             {"text": "Draw a flower. Colour it green and red.",
              "textBn": "একটা ফুল আঁকো। সবুজ আর লাল রং করো।",
              "illustration": "draw-flower"},
         ]},
        {"id": step_id(L2, "words1"), "type": "vocab", "bookActivity": "B",
         "title": "Classroom rules 1", "titleBn": "শ্রেণিকক্ষের নিয়ম ১",
         "items": [v["id"] for v in rule_vocab[:4]]},
        {"id": step_id(L2, "words2"), "type": "vocab", "bookActivity": "B",
         "title": "Classroom rules 2", "titleBn": "শ্রেণিকক্ষের নিয়ম ২",
         "items": [v["id"] for v in rule_vocab[4:]]},
        {"id": step_id(L2, "speak"), "type": "speak", "bookActivity": "B",
         "title": "Read a rule aloud", "titleBn": "একটি নিয়ম জোরে পড়ো",
         "prompt": "Read a rule aloud.", "promptBn": "একটি নিয়ম জোরে পড়ো।",
         "modelAnswer": "Come on time."},
        {"id": step_id(L2, "golden"), "type": "command", "bookActivity": "C",
         "title": "Five golden rules", "titleBn": "পাঁচটি সোনালি নিয়ম",
         "source": "textbook",
         "commands": [{"text": w, "textBn": bn, "illustration": img}
                      for (w, bn, img) in GOLDEN]},
        {"id": step_id(L2, "project"), "type": "intro", "bookActivity": "C",
         "title": "Make a poster!", "titleBn": "একটি পোস্টার বানাও!",
         "say": "Draw the five golden rules and put your poster on the class wall.",
         "sayBn": "পাঁচটি সোনালি নিয়ম এঁকে পোস্টারটি ক্লাসের দেয়ালে লাগাও।",
         "illustration": "poster"},
        {"id": step_id(L2, "game1"), "type": "game", "kind": "picture-to-word",
         "title": "Which rule?", "titleBn": "কোন নিয়ম?", "rounds": rule_picture_game},
        {"id": step_id(L2, "game2"), "type": "game", "kind": "choose-the-reply",
         "title": "What should you do?", "titleBn": "তুমি কী করবে?",
         "rounds": situation_game},
        dict({"id": step_id(L2, "quiz"), "type": "quiz", "questions": l2_quiz}, **QUIZ_TITLE),
        {"id": step_id(L2, "done"), "type": "done", "title": "Great job!",
         "titleBn": "দারুণ হয়েছে!",
         "say": "You can follow instructions and keep the class rules!",
         "sayBn": "তুমি নির্দেশ মানতে আর ক্লাসের নিয়ম মেনে চলতে পারো!"},
    ]))

# =========================================================================
# Lesson 3 - Making requests (book page 35)
# =========================================================================
POLITE = [
    vocab("excuse-me", "Excuse me", "মাফ করবেন", "এক্সকিউজ মি", 35, "expression",
          "excuse-me", "Excuse me Rita."),
    vocab("borrow", "borrow", "ধার নেওয়া", "বরো", 35, "action", "borrow",
          "Can I borrow your eraser, please?"),
    vocab("eraser", "eraser", "রাবার", "ইরেজার", 35, "object", "eraser",
          "Can I borrow your eraser, please?"),
    vocab("please-ask", "please", "দয়া করে", "প্লিজ", 35, "expression",
          "say-please", "Can I borrow your eraser, please?"),
    vocab("thank-you-so-much", "Thank you so much", "অনেক ধন্যবাদ",
          "থ্যাংক ইউ সো মাচ", 35, "expression", "thanks", "Thank you so much."),
    vocab("my-pleasure", "My pleasure", "এটা আমার আনন্দ", "মাই প্লেজার", 35,
          "expression", "happy-face", "My pleasure."),
]
REQUESTS = [
    vocab("req-ticket", "Please show your ticket.", "দয়া করে আপনার টিকিট দেখান",
          "প্লিজ শো ইয়োর টিকিট", 35, "sign", "sign-show-ticket"),
    vocab("req-no-litter", "No littering, please.", "দয়া করে ময়লা ফেলবেন না",
          "নো লিটারিং, প্লিজ", 35, "sign", "sign-no-litter"),
    vocab("req-phone", "Please turn off your phone here.",
          "দয়া করে এখানে ফোন বন্ধ রাখুন", "প্লিজ টার্ন অফ ইয়োর ফোন হিয়ার", 35,
          "sign", "sign-phone-off"),
    vocab("req-wash-hands", "Please wash your hands clean.",
          "দয়া করে হাত পরিষ্কার করে ধুয়ে নিন", "প্লিজ ওয়াশ ইয়োর হ্যান্ডস ক্লিন", 35,
          "sign", "sign-wash-hands"),
]
Q = {v["id"]: v for v in REQUESTS}
request_words = [v["word"] for v in REQUESTS]

L3 = "u3l3"
sign_game = [
    choice_round("m-" + i, "Which request matches this sign?",
                 "কোন অনুরোধটি এই চিহ্নের সঙ্গে মেলে?", Q[i]["word"],
                 others(Q[i]["word"], request_words), tests=i, image=Q[i]["image"],
                 hint="Read the words on the sign.")
    for i in ["req-ticket", "req-no-litter", "req-phone", "req-wash-hands"]
]
reply_game = [
    choice_round("p1", "Someone says: Thank you so much.", "কেউ বলল: Thank you so much.",
                 "My pleasure.", ["Excuse me.", "No littering, please."],
                 tests="my-pleasure", speak="Thank you so much.",
                 hint="When someone thanks you, be polite back."),
    choice_round("p2", "Hillol asks: Can I borrow your eraser, please?",
                 "হিল্লোল জিজ্ঞাসা করল: Can I borrow your eraser, please?",
                 "Oh, yes. Why not? Here it is.",
                 ["Please show your ticket.", "Sit down."],
                 tests="borrow", speak="Can I borrow your eraser, please?",
                 hint="Rita said yes and gave the eraser."),
    choice_round("p3", "You want to borrow a book. What do you say?",
                 "তুমি একটা বই ধার নিতে চাও। কী বলবে?",
                 "Excuse me. Can I borrow your book, please?",
                 ["Be quiet.", "Clap your hands."], tests="excuse-me",
                 hint="Start with Excuse me. End with please."),
]

l3_quiz = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "eraser",
             ["phone", "ticket"], tests="eraser", image="eraser",
             explain="eraser = রাবার"),
    question("q2", "listen-choose", "Listen. Which one did you hear?",
             "শোনো। কোনটি শুনলে?", "My pleasure",
             ["Excuse me", "Thank you so much"], tests="my-pleasure",
             speak="My pleasure"),
    question("q3", "fill-blank", "Can I ___ your eraser, please?",
             "Can I ___ your eraser, please?", "borrow", ["write", "clean"],
             tests="borrow", explain="borrow = ধার নেওয়া"),
    question("q4", "tap-picture", "What does this sign say?",
             "এই চিহ্নে কী লেখা আছে?", Q["req-no-litter"]["word"],
             others(Q["req-no-litter"]["word"], request_words),
             tests="req-no-litter", image="sign-no-litter"),
    true_false("q5", "This sign says: Please wash your hands clean.",
               "এই চিহ্নে লেখা: Please wash your hands clean.", False,
               "It says: Please turn off your phone here.", "req-phone",
               image="sign-phone-off"),
]

lessons.append(lesson_frame(
    L3, 3, "Making Requests", "অনুরোধ করা", "dialogue", [35],
    "Ask politely for something, thank someone, and read simple request signs.",
    "ভদ্রভাবে কিছু চাওয়া, ধন্যবাদ জানানো আর সহজ অনুরোধের চিহ্ন পড়া।", 7,
    POLITE + REQUESTS, [
        {"id": step_id(L3, "intro"), "type": "intro", "title": "In the library",
         "titleBn": "পাঠাগারে",
         "say": "Hillol wants to borrow an eraser. Listen to how he asks.",
         "sayBn": "হিল্লোল একটা রাবার ধার নিতে চায়। সে কীভাবে চায় শোনো।",
         "illustration": "library"},
        {"id": step_id(L3, "words1"), "type": "vocab", "bookActivity": "A",
         "title": "Polite words", "titleBn": "ভদ্র কথা",
         "items": [v["id"] for v in POLITE]},
        {"id": step_id(L3, "talk"), "type": "dialogue", "bookActivity": "A",
         "title": "Dialogue 1: In the library", "titleBn": "কথোপকথন ১: পাঠাগারে",
         "source": "textbook", "lines": [
             {"speaker": "Hillol", "text": "Excuse me Rita. Can I borrow your eraser, please?"},
             {"speaker": "Rita", "text": "Oh, yes. Why not? Here it is."},
             {"speaker": "Hillol", "text": "Thank you so much."},
             {"speaker": "Rita", "text": "My pleasure."},
         ]},
        {"id": step_id(L3, "speak1"), "type": "speak", "bookActivity": "A",
         "title": "Ask nicely!", "titleBn": "ভদ্রভাবে চাও!",
         "prompt": "Ask a friend for a pencil.", "promptBn": "বন্ধুর কাছে একটা পেনসিল চাও।",
         "modelAnswer": "Excuse me. Can I borrow your pencil, please?"},
        {"id": step_id(L3, "speak2"), "type": "speak", "bookActivity": "A",
         "title": "Say thank you", "titleBn": "ধন্যবাদ বলো",
         "prompt": "Your friend gives you the pencil. What do you say?",
         "promptBn": "বন্ধু তোমাকে পেনসিলটা দিল। তুমি কী বলবে?",
         "modelAnswer": "Thank you so much."},
        {"id": step_id(L3, "words2"), "type": "vocab", "bookActivity": "B",
         "title": "Requests and signs", "titleBn": "অনুরোধ ও চিহ্ন",
         "items": [v["id"] for v in REQUESTS]},
        {"id": step_id(L3, "game1"), "type": "game", "kind": "match-pairs",
         "bookActivity": "B", "title": "Match the sign", "titleBn": "চিহ্নটি মেলাও",
         "rounds": sign_game},
        {"id": step_id(L3, "game2"), "type": "game", "kind": "choose-the-reply",
         "title": "Choose the reply", "titleBn": "সঠিক উত্তর বেছে নাও",
         "rounds": reply_game},
        dict({"id": step_id(L3, "quiz"), "type": "quiz", "questions": l3_quiz}, **QUIZ_TITLE),
        {"id": step_id(L3, "done"), "type": "done", "title": "Well done!",
         "titleBn": "খুব ভালো!",
         "say": "You can ask politely and say thank you!",
         "sayBn": "তুমি ভদ্রভাবে চাইতে আর ধন্যবাদ বলতে পারো!"},
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u3", "number": 3,
    "title": "Commands, Instructions and Requests",
    "titleBn": "আদেশ, নির্দেশ ও অনুরোধ",
    "colour": "violet", "icon": "hand",
    "_source": "English for Today, Class Two (NCTB). Unit 3, book pages 31-35.",
    "_note": ("Commands, dialogues, rules and requests are transcribed word for "
              "word from the textbook. Bangla meanings are Pickixo's addition - "
              "the book carries no glosses. Drawing activities are done on "
              "paper, as in the book."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit03.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n",
               encoding="utf-8")

words = sum(len(l["vocabulary"]) for l in lessons)
print("unit03.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
