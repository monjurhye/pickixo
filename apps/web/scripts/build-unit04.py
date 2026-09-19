# -*- coding: utf-8 -*-
"""Generate unit04.json — Asking and Answering Questions (book pages 36-41).

Same approach as build-unit02.py / build-unit03.py: every quiz and game answer
index is *computed* from the correct option, never typed.

Textbook text (activity labels, dialogues, questions and answers) is typed once
below, word for word. Bangla glosses and pronunciations are Pickixo's addition
and are marked as such.

Notes on reading the book:
  * Several pages say "(Continue ....)" — the book expects pairs to keep going.
    Only the lines actually printed are recorded.
  * Where the book shows a choice ("Yes, I do. / No, I don't.") one printed
    option is used per dialogue; the game rounds teach both.
  * Lesson 1, Activity C prints the Tasin lines with the speaker labels
    swapped relative to the speech bubbles; the bubbles (teacher asks, Tasin
    answers) are followed because they match the picture.

Run:  python scripts/build-unit04.py
"""
import json
import pathlib
import random

random.seed(4)   # stable output: regenerating must not reshuffle every quiz


def vocab(vid, word, bangla, pron, page, category, image, example=None):
    return {
        "id": vid, "word": word, "bangla": bangla, "banglaPronunciation": pron,
        "banglaSource": "enrichment", "bookPage": page, "category": category,
        "image": image, "audio": None,
        "example": example, "exampleSource": "textbook" if example else None,
    }


def labelled(correct, wrongs):
    labels = [correct] + list(wrongs)
    random.shuffle(labels)
    return [{"label": l} for l in labels], labels.index(correct)


def others(word, pool, n=2):
    return random.sample([w for w in pool if w != word], n)


def rnd(rid, ask, ask_bn, correct, wrongs, tests=None, image=None, speak=None,
        hint=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": rid, "ask": ask, "askBn": ask_bn, "image": image,
            "speak": speak, "options": opts, "answer": answer, "hint": hint,
            "tests": tests}


def question(qid, qtype, ask, ask_bn, correct, wrongs, tests=None, image=None,
             speak=None, explain=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": qid, "type": qtype, "ask": ask, "askBn": ask_bn,
            "image": image, "speak": speak, "options": opts, "answer": answer,
            "explain": explain, "tests": tests}


def true_false(qid, ask, ask_bn, is_true, explain, tests):
    return {"id": qid, "type": "true-false", "ask": ask, "askBn": ask_bn,
            "options": [{"label": "True"}, {"label": "False"}],
            "answer": 0 if is_true else 1, "explain": explain, "tests": tests}


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, vocabulary, steps, minutes=7):
    return {
        "id": lid, "unitId": "u4", "number": number, "title": title,
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


def speak_step(lid, name, title, title_bn, prompt, prompt_bn, model,
               activity=None):
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


def picture_rounds(items_by_id, ids, ask, ask_bn, pool_words, hint):
    out = []
    for i in ids:
        w = items_by_id[i]["word"]
        out.append(rnd("r-" + i, ask, ask_bn, w, others(w, pool_words),
                       tests=i, image=items_by_id[i]["image"], hint=hint))
    return out


lessons = []

# =========================================================================
# Lesson 1 - Good and bad habits 1 (book pages 36-37)
# =========================================================================
L1 = "u4l1"
V1 = [
    vocab("go-to-school", "go to school", "স্কুলে যাওয়া", "গো টু স্কুল", 36, "action", "go-to-school"),
    vocab("go-to-bed", "go to bed", "ঘুমাতে যাওয়া", "গো টু বেড", 36, "action", "go-to-bed"),
    vocab("play-football", "play football", "ফুটবল খেলা", "প্লে ফুটবল", 36, "action", "play-football"),
    vocab("brush-teeth", "brush teeth", "দাঁত ব্রাশ করা", "ব্রাশ টিথ", 36, "action", "brush-teeth",
          "I brush my teeth after breakfast and dinner."),
    vocab("read-book", "read book", "বই পড়া", "রিড বুক", 36, "action", "read-book"),
    vocab("get-up", "get up", "ঘুম থেকে ওঠা", "গেট আপ", 36, "action", "get-up",
          "I get up early in the morning."),
    vocab("have-breakfast", "have breakfast", "সকালের নাস্তা খাওয়া", "হ্যাভ ব্রেকফাস্ট", 36, "action", "have-breakfast"),
    vocab("morning", "morning", "সকাল", "মর্নিং", 37, "day", "sunrise", "I get up early in the morning."),
    vocab("afternoon", "afternoon", "বিকাল", "আফটারনুন", 37, "day", "afternoon", "I play in the afternoon."),
]
I1 = {v["id"]: v for v in V1}
acts = ["go-to-school", "go-to-bed", "play-football", "brush-teeth",
        "read-book", "get-up", "have-breakfast"]
act_words = [I1[i]["word"] for i in acts]

order_rounds = [
    rnd("o1", "What do you do first in the morning?", "সকালে তুমি প্রথমে কী করো?",
        "get up", others("get up", act_words), tests="get-up", hint="Wake up first. ☀️"),
    rnd("o2", "After you get up, what do you do?", "ঘুম থেকে উঠে তুমি কী করো?",
        "have breakfast", others("have breakfast", act_words), tests="have-breakfast",
        hint="It is time to eat. 🍳"),
    rnd("o3", "After breakfast you ... your teeth.", "নাস্তার পরে তুমি দাঁত ...।",
        "brush", ["cut", "read"], tests="brush-teeth", hint="You use a toothbrush. 🪥"),
    rnd("o4", "Then it is time to ...", "তারপর ...।",
        "go to school", others("go to school", act_words), tests="go-to-school",
        hint="Take your bag. 🎒"),
    rnd("o5", "At night you ...", "রাতে তুমি ...।",
        "go to bed", others("go to bed", act_words), tests="go-to-bed",
        hint="It is dark and you are sleepy. 🌙"),
]
reply1 = [
    rnd("q-get-up", "When do you get up?", "তুমি কখন ঘুম থেকে ওঠো?",
        "I get up early in the morning.",
        ["I play in the afternoon.", "I brush my teeth after breakfast and dinner."],
        tests="get-up", speak="When do you get up?", hint="It is about getting up. ☀️"),
    rnd("q-brush", "When do you brush your teeth?", "তুমি কখন দাঁত ব্রাশ করো?",
        "I brush my teeth after breakfast and dinner.",
        ["I get up early in the morning.", "I play in the afternoon."],
        tests="brush-teeth", speak="When do you brush your teeth?", hint="It is about teeth. 🪥"),
    rnd("q-play", "When do you play?", "তুমি কখন খেলো?", "I play in the afternoon.",
        ["I get up early in the morning.", "I brush my teeth after breakfast and dinner."],
        tests="afternoon", speak="When do you play?", hint="It is about playing. ⚽"),
]
quiz1 = [
    question("q1", "tap-picture", "What is the boy doing?", "ছেলেটি কী করছে?",
             "brush teeth", others("brush teeth", act_words), tests="brush-teeth",
             image="brush-teeth", explain="brush teeth = দাঁত ব্রাশ করা"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "go to bed", others("go to bed", act_words), tests="go-to-bed", speak="go to bed"),
    question("q3", "fill-blank", "I brush my teeth ___ breakfast and dinner.",
             "I brush my teeth ___ breakfast and dinner.", "after", ["under", "blue"],
             tests="brush-teeth", explain="The book says: after breakfast and dinner."),
    true_false("q4", "Tasin gets up early in the morning.", "তাসিন খুব সকালে ঘুম থেকে ওঠে।",
               True, "Tasin said: I get up early in the morning.", "get-up"),
    question("q5", "tap-word", "When does U Mong play?", "উ মং কখন খেলে?", "In the afternoon",
             ["In the morning", "At night"], tests="afternoon",
             explain="U Mong said: I play in the afternoon."),
]
lessons.append(lesson_frame(
    L1, 1, "Good and Bad Habits 1", "ভালো ও খারাপ অভ্যাস ১", "dialogue", [36, 37],
    "Name daily activities and say when you do them.",
    "দৈনন্দিন কাজের নাম বলা আর কখন করো তা বলা।", V1, [
        intro_step(L1, "A day at home", "বাড়িতে একটি দিন",
                   "Look at what the boy does. Then say when you do it.",
                   "ছেলেটি কী করে দেখো। তারপর তুমি কখন করো বলো।", "get-up"),
        vocab_step(L1, "words1", acts[:4], "What is the boy doing? 1", "ছেলেটি কী করছে? ১", "A"),
        vocab_step(L1, "words2", ["read-book", "get-up", "have-breakfast", "morning", "afternoon"],
                   "What is the boy doing? 2", "ছেলেটি কী করছে? ২", "A"),
        game_step(L1, "order", "order-the-lines", "Put the day in order",
                  "দিনের কাজগুলো সাজাও", order_rounds, "B"),
        dialogue_step(L1, "talk", "Look, listen and say", "দেখো, শোনো আর বলো", [
            ("Teacher", "Hello, Tasin. When do you get up?"),
            ("Tasin", "Hello, teacher. I get up early in the morning."),
            ("Student 1", "Hello, Mahin. When do you brush your teeth?"),
            ("Student 2", "I brush my teeth after breakfast and dinner."),
            ("Jerin", "Hello, U Mong. When do you play?"),
            ("U Mong", "Hello, Jerin. I play in the afternoon."),
        ], "C"),
        speak_step(L1, "speak1", "Your turn!", "এবার তোমার পালা!", "When do you get up?",
                   "তুমি কখন ঘুম থেকে ওঠো?", "I get up early in the morning.", "D"),
        speak_step(L1, "speak2", "Ask and answer", "প্রশ্ন করো আর উত্তর দাও", "When do you play?",
                   "তুমি কখন খেলো?", "I play in the afternoon.", "D"),
        game_step(L1, "game1", "picture-to-word", "Name the activity", "কাজটির নাম বলো",
                  picture_rounds(I1, ["go-to-school", "go-to-bed", "play-football", "read-book",
                                      "have-breakfast"],
                                 "What is the boy doing?", "ছেলেটি কী করছে?", act_words,
                                 "Look at the picture."), "A"),
        game_step(L1, "game2", "choose-the-reply", "Choose the answer", "উত্তরটি বেছে নাও", reply1, "D"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You can say what you do in a day!",
                  "তুমি দিনে কী করো তা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 2 - What do you like? 1 (book page 38)
# =========================================================================
L2 = "u4l2"
V2 = [
    vocab("a-guava", "a guava", "একটি পেয়ারা", "আ গুয়াভা", 38, "food", "guava", "Do you like guavas?"),
    vocab("a-banana", "a banana", "একটি কলা", "আ বানানা", 38, "food", "banana", "Do you like bananas?"),
    vocab("an-orange", "an orange", "একটি কমলা", "অ্যান অরেঞ্জ", 38, "food", "orange"),
    vocab("a-papaya", "a papaya", "একটি পেঁপে", "আ পাপাইয়া", 38, "food", "papaya"),
    vocab("mangoes", "mangoes", "আম", "ম্যাংগোজ", 38, "food", "mango", "I like mangoes."),
    vocab("do-you-like", "Do you like ...?", "তুমি কি ... পছন্দ করো?", "ডু ইউ লাইক", 38, "expression",
          "asking", "Do you like bananas?"),
    vocab("yes-i-do", "Yes, I do.", "হ্যাঁ, করি", "ইয়েস আই ডু", 38, "expression", "thumbs-up"),
    vocab("no-i-dont", "No, I don't.", "না, করি না", "নো আই ডোন্ট", 38, "expression", "thumbs-down"),
]
I2 = {v["id"]: v for v in V2}
fruit_ids = ["a-guava", "a-banana", "an-orange", "a-papaya", "mangoes"]
fruit_words = [I2[i]["word"] for i in fruit_ids]
reply2 = [
    rnd("y1", "You like bananas. Someone asks: Do you like bananas?",
        "তুমি কলা পছন্দ করো। কেউ জিজ্ঞাসা করল: Do you like bananas?", "Yes, I do.",
        ["No, I don't.", "I like mangoes."], tests="yes-i-do", speak="Do you like bananas?",
        hint="You like them, so say yes. 🍌"),
    rnd("y2", "You do not like oranges. Someone asks: Do you like oranges?",
        "তুমি কমলা পছন্দ করো না। কেউ জিজ্ঞাসা করল: Do you like oranges?", "No, I don't.",
        ["Yes, I do.", "I like bananas."], tests="no-i-dont", speak="Do you like oranges?",
        hint="You do not like them, so say no. 🍊"),
    rnd("y3", "You do not like bananas, but you like mangoes.",
        "তুমি কলা পছন্দ করো না, কিন্তু আম পছন্দ করো।", "No, I don't. I like mangoes.",
        ["Yes, I do. I like mangoes.", "Yes, I do."], tests="mangoes",
        speak="Do you like bananas?", hint="Say no, then say what you like. 🥭"),
]
quiz2 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "a banana",
             others("a banana", fruit_words), tests="a-banana", image="banana",
             explain="a banana = একটি কলা"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "a papaya", others("a papaya", fruit_words), tests="a-papaya", speak="a papaya"),
    question("q3", "fill-blank", "Do you ___ bananas?", "Do you ___ bananas?", "like",
             ["write", "run"], tests="do-you-like", explain="We ask: Do you like bananas?"),
    true_false("q4", "Yes, I do. means you like it.", "Yes, I do. মানে তুমি সেটা পছন্দ করো।", True,
               "Yes, I do. = হ্যাঁ, আমি পছন্দ করি।", "yes-i-do"),
    question("q5", "tap-word", "You do not like guavas. What do you say?",
             "তুমি পেয়ারা পছন্দ করো না। তুমি কী বলবে?", "No, I don't.",
             ["Yes, I do.", "Yes, I like."], tests="no-i-dont",
             explain="No, I don't. = না, আমি পছন্দ করি না।"),
]
lessons.append(lesson_frame(
    L2, 2, "What Do You Like? 1", "তুমি কী পছন্দ করো? ১", "dialogue", [38],
    "Ask and answer about fruits you like.", "পছন্দের ফল নিয়ে প্রশ্ন করা আর উত্তর দেওয়া।", V2, [
        intro_step(L2, "Fruits we like", "আমাদের পছন্দের ফল", "Which fruit do you like best?",
                   "কোন ফলটি তোমার সবচেয়ে পছন্দ?", "orange"),
        vocab_step(L2, "words1", fruit_ids, "Look, listen and say", "দেখো, শোনো আর বলো", "B"),
        vocab_step(L2, "words2", ["do-you-like", "yes-i-do", "no-i-dont"], "Asking and answering",
                   "প্রশ্ন ও উত্তর", "B"),
        dialogue_step(L2, "talk1", "Do you like guavas?", "তুমি কি পেয়ারা পছন্দ করো?", [
            ("Teacher", "Do you like guavas?"),
            ("Girl", "Yes, I do."),
            ("Student 1", "Do you like bananas?"),
            ("Student 2", "No, I don't. I like mangoes."),
        ], "B"),
        dialogue_step(L2, "talk2", "Ask and answer in pairs", "জোড়ায় প্রশ্ন ও উত্তর", [
            ("Student 1", "Do you like mangoes?"),
            ("Student 2", "Yes, I like."),
            ("Student 2", "Do you like oranges?"),
            ("Student 1", "No, I don't."),
        ], "C"),
        speak_step(L2, "speak1", "What is your favourite fruit?", "তোমার প্রিয় ফল কোনটি?",
                   "What fruit do you like?", "তুমি কোন ফল পছন্দ করো?", "I like ...", "A"),
        speak_step(L2, "speak2", "Ask a friend", "বন্ধুকে জিজ্ঞাসা করো", "Ask: Do you like bananas?",
                   "জিজ্ঞাসা করো: Do you like bananas?", "Do you like bananas?", "C"),
        game_step(L2, "game1", "picture-to-word", "Name the fruit", "ফলটির নাম বলো",
                  picture_rounds(I2, fruit_ids, "What is this?", "এটি কী?", fruit_words,
                                 "Look at the picture."), "B"),
        game_step(L2, "game2", "choose-the-reply", "Yes or no?", "হ্যাঁ না কি না?", reply2, "C"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You can ask what someone likes!",
                  "তুমি কে কী পছন্দ করে জিজ্ঞাসা করতে পারো!"),
    ]))

# =========================================================================
# Lesson 3 - What do you like? 2 (book page 39)
# =========================================================================
L3 = "u4l3"
V3 = [
    vocab("football", "football", "ফুটবল", "ফুটবল", 39, "object", "football", "I like football."),
    vocab("cricket", "cricket", "ক্রিকেট", "ক্রিকেট", 39, "object", "cricket", "Do you like cricket?"),
    vocab("kabadi", "kabadi", "কাবাডি", "কাবাডি", 39, "object", "kabadi", "Do you like kabadi?"),
    vocab("singing", "singing", "গান গাওয়া", "সিংগিং", 39, "action", "singing", "I like singing."),
    vocab("dancing", "dancing", "নাচ", "ড্যান্সিং", 39, "action", "dancing", "Do you like dancing?"),
    vocab("go-picnic", "go on a picnic", "পিকনিকে যাওয়া", "গো অন আ পিকনিক", 39, "action", "picnic",
          "Do you like to go on a picnic?"),
    vocab("go-study-tour", "go on a study tour", "শিক্ষা সফরে যাওয়া", "গো অন আ স্টাডি ট্যুর", 39,
          "action", "study-tour", "I like to go on a study tour."),
]
I3 = {v["id"]: v for v in V3}
like_ids = ["football", "cricket", "kabadi", "singing", "dancing"]
like_words = [I3[i]["word"] for i in like_ids]
reply3 = [
    rnd("k1", "You do not like cricket. You like football. Someone asks: Do you like cricket?",
        "তুমি ক্রিকেট পছন্দ করো না, ফুটবল পছন্দ করো। কেউ জিজ্ঞাসা করল: Do you like cricket?",
        "No, I don't. I like football.", ["Yes, I do.", "I live in a village."],
        tests="cricket", speak="Do you like cricket?", hint="Say no, then say what you like. ⚽"),
    rnd("k2", "You like kabadi. Someone asks: Do you like kabadi?",
        "তুমি কাবাডি পছন্দ করো। কেউ জিজ্ঞাসা করল: Do you like kabadi?", "Yes, I do.",
        ["No, I don't.", "I like cricket."], tests="kabadi", speak="Do you like kabadi?",
        hint="You like it, so say yes."),
]
quiz3 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "cricket",
             others("cricket", like_words), tests="cricket", image="cricket", explain="cricket = ক্রিকেট"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "kabadi", others("kabadi", like_words), tests="kabadi", speak="kabadi"),
    question("q3", "fill-blank", "Do you ___ singing?", "Do you ___ singing?", "like", ["write", "sit"],
             tests="singing", explain="We ask: Do you like singing?"),
    true_false("q4", "S2 likes cricket.", "দ্বিতীয় শিক্ষার্থী ক্রিকেট পছন্দ করে।", False,
               "S2 said: No, I don't. I like football.", "cricket"),
    question("q5", "tap-word", "S1 said: No, I don't. I like singing. What does S1 like?",
             "প্রথম শিক্ষার্থী বলল: No, I don't. I like singing. সে কী পছন্দ করে?", "singing",
             ["dancing", "cricket"], tests="singing", explain="S1 likes singing."),
]
lessons.append(lesson_frame(
    L3, 3, "What Do You Like? 2", "তুমি কী পছন্দ করো? ২", "dialogue", [39],
    "Say which games and activities you like and do not like.",
    "কোন খেলা ও কাজ পছন্দ বা অপছন্দ তা বলা।", V3, [
        intro_step(L3, "Games and fun", "খেলা আর আনন্দ", "What do you like to do? Let's find out!",
                   "তুমি কী করতে ভালোবাসো? চলো জানি!", "football"),
        vocab_step(L3, "words1", ["football", "cricket", "kabadi", "singing"], "Look, listen and say 1",
                   "দেখো, শোনো আর বলো ১", "A"),
        vocab_step(L3, "words2", ["dancing", "go-picnic", "go-study-tour"], "Look, listen and say 2",
                   "দেখো, শোনো আর বলো ২", "A"),
        dialogue_step(L3, "talk1", "Do you like kabadi?", "তুমি কি কাবাডি পছন্দ করো?", [
            ("Teacher", "Do you like kabadi?"),
            ("Girl", "Yes, I do."),
            ("Student 1", "Do you like cricket?"),
            ("Student 2", "No, I don't. I like football."),
        ], "B"),
        dialogue_step(L3, "talk2", "Pairwork", "জোড়ায় কাজ", [
            ("Student 1", "Do you like to go on a picnic?"),
            ("Student 2", "No, I don't. I like to go on a study tour."),
            ("Student 2", "Do you like dancing?"),
            ("Student 1", "No, I don't. I like singing."),
        ], "C"),
        speak_step(L3, "speak1", "Your turn!", "এবার তোমার পালা!", "Do you like football?",
                   "তুমি কি ফুটবল পছন্দ করো?", "Yes, I do.", "B"),
        speak_step(L3, "speak2", "Say what you like", "তুমি কী পছন্দ করো বলো", "What do you like?",
                   "তুমি কী পছন্দ করো?", "I like ...", "C"),
        game_step(L3, "game1", "picture-to-word", "Name the picture", "ছবিটির নাম বলো",
                  picture_rounds(I3, like_ids, "What is this?", "এটি কী?", like_words,
                                 "Look at the picture."), "A"),
        game_step(L3, "game2", "choose-the-reply", "Choose the answer", "উত্তরটি বেছে নাও", reply3, "B"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You can say what you like and what you don't!",
                  "তুমি কী পছন্দ করো আর কী করো না তা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 4 - Good and bad habits 2 (book page 40)
# =========================================================================
L4 = "u4l4"
V4 = [
    vocab("evening", "evening", "সন্ধ্যা", "ইভনিং", 40, "day", "evening", "I study in the evening."),
    vocab("study", "study", "পড়াশোনা করা", "স্টাডি", 40, "action", "read-book", "I study in the evening."),
    vocab("cross-road", "cross a road", "রাস্তা পার হওয়া", "ক্রস আ রোড", 40, "action", "cross-road",
          "How do you cross a road?"),
    vocab("foot-overbridge", "foot over-bridge", "ফুট ওভারব্রিজ", "ফুট ওভার-ব্রিজ", 40, "place",
          "foot-overbridge", "I cross a road using the foot over-bridge."),
    vocab("cut-nails", "cut your nails", "নখ কাটা", "কাট ইয়োর নেইলস", 40, "action", "cut-nails",
          "How do you cut your nails?"),
    vocab("nail-cutter", "nail cutter", "নেইল কাটার", "নেইল কাটার", 40, "object", "nail-cutter",
          "I cut my nails by a nail cutter."),
]
I4 = {v["id"]: v for v in V4}
# Good and bad habits. The good ones are printed in the book (page 40, plus
# the getting-up and teeth answers on page 37). The two bad ones are the
# opposites shown in the page's pictures: biting nails, sitting too close to
# the TV. They are Pickixo's teaching addition, so they are only used in the
# game, never presented as textbook sentences.
HABITS = [
    ("Cut your nails with a nail cutter.", "নেইল কাটার দিয়ে নখ কাটা।", True, "cut-nails"),
    ("Cross a road using the foot over-bridge.", "ফুট ওভারব্রিজ দিয়ে রাস্তা পার হওয়া।", True, "foot-overbridge"),
    ("Bite your nails.", "নখ কামড়ানো।", False, "cut-nails"),
    ("Brush your teeth after breakfast and dinner.", "নাস্তা আর রাতের খাবারের পরে দাঁত ব্রাশ করা।", True, "study"),
    ("Sit very close to the TV.", "টিভির খুব কাছে বসা।", False, "study"),
]
habit_rounds = []
for i, (text, bn, good, tests) in enumerate(HABITS):
    tests = {"study": None}.get(tests, tests)
    habit_rounds.append({
        "id": "h%d" % (i + 1), "ask": text, "askBn": bn,
        "options": [{"label": "Good habit 👍"}, {"label": "Bad habit 👎"}],
        "answer": 0 if good else 1,
        "hint": "Think: is it good for you?", "tests": tests,
    })
reply4 = [
    rnd("a1", "How do you cross a road?", "তুমি কীভাবে রাস্তা পার হও?",
        "I cross a road using the foot over-bridge.",
        ["I cut my nails by a nail cutter.", "I study in the evening."],
        tests="cross-road", speak="How do you cross a road?", hint="It is about roads. 🚗"),
    rnd("a2", "How do you cut your nails?", "তুমি কীভাবে নখ কাটো?",
        "I cut my nails by a nail cutter.",
        ["I cross a road using the foot over-bridge.", "I have breakfast in the morning."],
        tests="cut-nails", speak="How do you cut your nails?", hint="It is about nails. ✂️"),
    rnd("a3", "What do you do in the evening?", "সন্ধ্যায় তুমি কী করো?", "I study in the evening.",
        ["I have breakfast in the morning.", "I cross a road using the foot over-bridge."],
        tests="evening", speak="What do you do in the evening?", hint="It is about the evening. 🌆"),
]
quiz4 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "foot over-bridge",
             ["nail cutter", "evening"], tests="foot-overbridge", image="foot-overbridge",
             explain="foot over-bridge = ফুট ওভারব্রিজ"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "nail cutter", ["foot over-bridge", "cross a road"], tests="nail-cutter", speak="nail cutter"),
    question("q3", "fill-blank", "I cut my nails by a nail ___ .", "I cut my nails by a nail ___ .",
             "cutter", ["bridge", "school"], tests="nail-cutter", explain="We cut nails with a nail cutter."),
    true_false("q4", "We cross a road using the foot over-bridge.",
               "আমরা ফুট ওভারব্রিজ দিয়ে রাস্তা পার হই।", True,
               "The book says: I cross a road using the foot over-bridge.", "foot-overbridge"),
    question("q5", "tap-word", "What do you do in the evening?", "সন্ধ্যায় তুমি কী করো?",
             "I study in the evening.", ["I have breakfast in the morning.", "I cross a road."],
             tests="evening", explain="The boy said: I study in the evening."),
]
lessons.append(lesson_frame(
    L4, 4, "Good and Bad Habits 2", "ভালো ও খারাপ অভ্যাস ২", "dialogue", [40],
    "Tell good habits from bad ones and answer 'How do you ...?' questions.",
    "ভালো ও খারাপ অভ্যাস চেনা আর 'তুমি কীভাবে ...?' প্রশ্নের উত্তর দেওয়া।", V4, [
        intro_step(L4, "Good habits", "ভালো অভ্যাস", "Which habits are good for you? Let's see!",
                   "কোন অভ্যাসগুলো তোমার জন্য ভালো? চলো দেখি!", "foot-overbridge"),
        vocab_step(L4, "words", [v["id"] for v in V4], "New words", "নতুন শব্দ", "A"),
        game_step(L4, "habits", "true-false", "Good habit or bad habit?", "ভালো না খারাপ অভ্যাস?",
                  habit_rounds, "A"),
        dialogue_step(L4, "talk1", "Look, listen and say", "দেখো, শোনো আর বলো", [
            ("Teacher", "What do you do in the evening?"),
            ("Boy", "I study in the evening."),
            ("Student 1", "What do you do in the morning?"),
            ("Student 2", "I have breakfast in the morning."),
            ("Student 2", "How do you cross a road?"),
            ("Student 1", "I cross a road using the foot over-bridge."),
        ], "B"),
        dialogue_step(L4, "talk2", "Pairwork", "জোড়ায় কাজ", [
            ("Student 1", "How do you cross a road?"),
            ("Student 2", "I cross a road using the foot over-bridge."),
            ("Student 2", "How do you cut your nails?"),
            ("Student 1", "I cut my nails by a nail cutter."),
        ], "C"),
        speak_step(L4, "speak1", "Your turn!", "এবার তোমার পালা!", "How do you cross a road?",
                   "তুমি কীভাবে রাস্তা পার হও?", "I cross a road using the foot over-bridge.", "C"),
        speak_step(L4, "speak2", "Ask a friend", "বন্ধুকে জিজ্ঞাসা করো", "Ask: How do you cut your nails?",
                   "জিজ্ঞাসা করো: How do you cut your nails?", "How do you cut your nails?", "C"),
        game_step(L4, "game2", "choose-the-reply", "Choose the answer", "উত্তরটি বেছে নাও", reply4, "B"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You know good habits and how to answer questions!",
                  "তুমি ভালো অভ্যাস চেনো আর প্রশ্নের উত্তর দিতে পারো!"),
    ]))

# =========================================================================
# Lesson 5 - Living place (book page 41)
# =========================================================================
L5 = "u4l5"
V5 = [
    vocab("village", "a village", "একটি গ্রাম", "আ ভিলেজ", 41, "place", "village", "I live in a village."),
    vocab("city", "a city", "একটি শহর", "আ সিটি", 41, "place", "city", "I live in a city."),
    vocab("small-town", "a small town", "একটি ছোট শহর", "আ স্মল টাউন", 41, "place", "small-town",
          "I live in a small town."),
    vocab("where-live", "Where do you live?", "তুমি কোথায় থাকো?", "হোয়ার ডু ইউ লিভ", 41, "expression",
          "house", "Where do you live?"),
]
I5 = {v["id"]: v for v in V5}
place_ids = ["village", "city", "small-town"]
place_words = [I5[i]["word"] for i in place_ids]
reply5 = [
    rnd("w1", "You live in a village. Someone asks: Where do you live?",
        "তুমি গ্রামে থাকো। কেউ জিজ্ঞাসা করল: Where do you live?", "I live in a village.",
        ["I live in a city.", "I live in a small town."], tests="village",
        speak="Where do you live?", hint="Say the place where you live. 🏡"),
    rnd("w2", "You live in a city. Someone asks: Where do you live?",
        "তুমি শহরে থাকো। কেউ জিজ্ঞাসা করল: Where do you live?", "I live in a city.",
        ["I live in a village.", "I live in a small town."], tests="city",
        speak="Where do you live?", hint="A city has tall buildings. 🏙️"),
    rnd("w3", "You live in a small town. Someone asks: Where do you live?",
        "তুমি ছোট শহরে থাকো। কেউ জিজ্ঞাসা করল: Where do you live?", "I live in a small town.",
        ["I live in a village.", "I live in a city."], tests="small-town",
        speak="Where do you live?", hint="A small town is not very big. 🏘️"),
]
quiz5 = [
    question("q1", "tap-picture", "Which place is this?", "এটি কোন জায়গা?", "a village",
             others("a village", place_words), tests="village", image="village",
             explain="a village = একটি গ্রাম"),
    question("q2", "listen-choose", "Listen. Which one did you hear?", "শোনো। কোনটি শুনলে?",
             "a small town", others("a small town", place_words), tests="small-town",
             speak="a small town"),
    question("q3", "fill-blank", "Where do you ___ ?", "Where do you ___ ?", "live", ["run", "sit"],
             tests="where-live", explain="We ask: Where do you live?"),
    true_false("q4", "In the book, one child says: I live in Kushtia town.",
               "বইয়ে একজন বলে: I live in Kushtia town.", True, "S2 said: I live in Kushtia town.",
               "small-town"),
    question("q5", "tap-word", "You live in a place with tall buildings. What do you say?",
             "তুমি উঁচু উঁচু বাড়ির জায়গায় থাকো। তুমি কী বলবে?", "I live in a city.",
             ["I live in a village.", "I live in a small town."], tests="city",
             explain="A city has many tall buildings."),
]
lessons.append(lesson_frame(
    L5, 5, "Living Place", "বাসস্থান", "dialogue", [41],
    "Say where you live: a village, a city or a small town.",
    "তুমি কোথায় থাকো তা বলা: গ্রাম, শহর বা ছোট শহর।", V5, [
        intro_step(L5, "Where do you live?", "তুমি কোথায় থাকো?", "Some people live in a village. Some live in a city.",
                   "কেউ গ্রামে থাকে। কেউ শহরে থাকে।", "house"),
        vocab_step(L5, "words", [v["id"] for v in V5], "Look and say", "দেখো আর বলো", "A"),
        dialogue_step(L5, "talk1", "Look, listen and say", "দেখো, শোনো আর বলো", [
            ("Teacher", "Where do you live?"),
            ("Girl", "I live in a village."),
            ("Student 1", "Where do you live?"),
            ("Student 2", "I live in a village."),
            ("Student 2", "Where do you live?"),
            ("Student 1", "I live in a small town."),
        ], "B"),
        dialogue_step(L5, "talk2", "Ask and answer in pairs", "জোড়ায় প্রশ্ন ও উত্তর", [
            ("Student 1", "Where do you live?"),
            ("Student 2", "I live in Kushtia town."),
            ("Student 2", "Where do you live?"),
            ("Student 1", "I live in a city."),
        ], "C"),
        speak_step(L5, "speak", "Your turn!", "এবার তোমার পালা!", "Where do you live?",
                   "তুমি কোথায় থাকো?", "I live in ...", "C"),
        game_step(L5, "game1", "picture-to-word", "Name the place", "জায়গাটির নাম বলো",
                  picture_rounds(I5, place_ids, "Which place is this?", "এটি কোন জায়গা?", place_words,
                                 "Look at the picture."), "A"),
        game_step(L5, "game2", "choose-the-reply", "Choose the answer", "উত্তরটি বেছে নাও", reply5, "B"),
        quiz_step(L5, quiz5),
        done_step(L5, "Great job!", "দারুণ হয়েছে!", "You can say where you live!",
                  "তুমি কোথায় থাকো তা বলতে পারো!"),
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u4", "number": 4,
    "title": "Asking and Answering Questions",
    "titleBn": "প্রশ্ন করা ও উত্তর দেওয়া",
    "colour": "green", "icon": "question",
    "_source": "English for Today, Class Two (NCTB). Unit 4, book pages 36-41.",
    "_note": ("Activity labels, dialogues, questions and answers are transcribed "
              "from the textbook. Bangla meanings are Pickixo's addition - the "
              "book carries no glosses. The 'bad habit' examples in Lesson 4's "
              "game are Pickixo's addition, based on the pictures on page 40."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit04.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n",
               encoding="utf-8")

words = sum(len(l["vocabulary"]) for l in lessons)
print("unit04.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
