# -*- coding: utf-8 -*-
"""Generate unit09.json — Animals and Birds (book pages 84-92).

Same approach as build-unit02..08.py: every quiz and game answer index is
*computed* from the correct option, never typed.

In this unit the wrong options matter as much as the right one. "Where does a
parrot live?" has two right answers in the book ("a nest or a tree hole"), and
"what does a cow eat" (grass) sits beside "what does a deer eat" (grass,
leaves, etc.). A distractor that is also correct would tell a child who
answered correctly that they were wrong, so distractors are chosen to share no
word with any correct answer for that animal.

Textbook text (living places, food, the cow-and-hen passage, Hey Diddle,
Diddle, the questions and the punctuation exercise) is transcribed word for
word. Bangla glosses and pronunciations are Pickixo's addition, marked as such.

Notes on reading the book:
  * p.86 Activity F item 4 ("The parrot lives in a tree") is left out: the
    book says a parrot lives in "a nest or a tree hole", and "in a tree" is
    neither clearly true nor false against that text.
  * p.87 Activity B's table lists the foods in a different order from
    Activity A on purpose (it is a "make meaningful sentences" puzzle); the
    pairings are taken from Activity A.
  * p.88 "A monkey eats apples." is marked true: the book says monkeys eat
    fruits, and an apple is a fruit.
  * p.89 Activity C's box makes blank 1 "animal" ("A hen is a domestic
    ___"), which contradicts the passage just above ("A hen is a domestic
    bird"), so blank 1 is not used; the other four blanks are.
  * The picture questions (p.84 "What do you see?", "How many animals?"),
    the writing tasks, the drawing task and the name game on p.92 are open
    or classroom activities and are not scored. Drawing and acting are offered
    as "listen and do" steps.
  * Activity D on p.88 ("A goat / A cat / A lion / A duck: ...") gives no
    answers, so only the worked example (the hen) is used.

Run:  python scripts/build-unit09.py
"""
import json
import pathlib
import random

random.seed(9)   # stable output: regenerating must not reshuffle every quiz


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
    return {"id": rid, "ask": ask, "askBn": ask_bn, "image": image, "speak": speak,
            "options": opts, "answer": answer, "hint": hint, "tests": tests}


def question(qid, qtype, ask, ask_bn, correct, wrongs, tests=None, image=None,
             speak=None, explain=None):
    opts, answer = labelled(correct, wrongs)
    return {"id": qid, "type": qtype, "ask": ask, "askBn": ask_bn, "image": image,
            "speak": speak, "options": opts, "answer": answer, "explain": explain,
            "tests": tests}


def true_false(qid, ask, ask_bn, is_true, explain, tests=None):
    return {"id": qid, "type": "true-false", "ask": ask, "askBn": ask_bn,
            "options": [{"label": "True"}, {"label": "False"}],
            "answer": 0 if is_true else 1, "explain": explain, "tests": tests}


def tf_round(rid, sentence, sentence_bn, is_true, hint, tests=None):
    """A true/false round. On a miss the hint gives the right answer, as the book asks."""
    return {"id": rid, "ask": sentence, "askBn": sentence_bn, "speak": sentence,
            "options": [{"label": "True"}, {"label": "False"}],
            "answer": 0 if is_true else 1, "hint": hint, "tests": tests}


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, vocabulary, steps, minutes=7):
    return {"id": lid, "unitId": "u9", "number": number, "title": title,
            "titleBn": title_bn, "shape": shape, "bookPages": pages,
            "objective": objective, "objectiveBn": objective_bn,
            "minutes": minutes, "vocabulary": vocabulary, "steps": steps}


def sid(lid, name):
    return lid + "-" + name


def vocab_step(lid, name, ids, title, title_bn, activity=None):
    return {"id": sid(lid, name), "type": "vocab", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "items": ids}


def speak_step(lid, name, title, title_bn, prompt, prompt_bn, model, activity=None):
    return {"id": sid(lid, name), "type": "speak", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "prompt": prompt,
            "promptBn": prompt_bn, "modelAnswer": model}


def game_step(lid, name, kind, title, title_bn, rounds, activity=None):
    return {"id": sid(lid, name), "type": "game", "kind": kind, "bookActivity": activity,
            "title": title, "titleBn": title_bn, "rounds": rounds}


def intro_step(lid, title, title_bn, say, say_bn, illustration):
    return {"id": sid(lid, "intro"), "type": "intro", "title": title, "titleBn": title_bn,
            "say": say, "sayBn": say_bn, "illustration": illustration}


def quiz_step(lid, questions):
    return {"id": sid(lid, "quiz"), "type": "quiz", "title": "Quick quiz",
            "titleBn": "ছোট্ট কুইজ", "questions": questions}


def done_step(lid, title, title_bn, say, say_bn):
    return {"id": sid(lid, "done"), "type": "done", "title": title, "titleBn": title_bn,
            "say": say, "sayBn": say_bn}


def text_step(lid, name, title, title_bn, sentences, activity=None):
    return {"id": sid(lid, name), "type": "rhyme", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn,
            "listenLabel": "Listen to the text", "verses": [sentences]}


def story_step(lid, name, title, title_bn, scenes, activity=None):
    return {"id": sid(lid, name), "type": "story", "bookActivity": activity,
            "title": title, "titleBn": title_bn, "source": "textbook",
            "scenes": [{"id": "s%d" % (i + 1), "text": t, "illustration": img, "audio": None}
                       for i, (t, img) in enumerate(scenes)]}


def command_step(lid, name, title, title_bn, cards, activity=None):
    return {"id": sid(lid, name), "type": "command", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn,
            "commands": [{"text": t, "textBn": bn, "illustration": img} for (t, bn, img) in cards]}


def tokens(phrase):
    return {w.strip(",.").lower() for w in phrase.split() if w.strip(",.").lower() != "etc"}


lessons = []

# =========================================================================
# Lesson 1 - Their living places (book pages 84-86)
# =========================================================================
L1 = "u9l1"
ANIMALS = [
    ("an-tiger", "tiger", "বাঘ", "টাইগার", "tiger"),
    ("an-dog", "dog", "কুকুর", "ডগ", "dog"),
    ("an-monkey", "monkey", "বানর", "মাংকি", "monkey"),
    ("an-cow", "cow", "গরু", "কাউ", "cow"),
    ("an-deer", "deer", "হরিণ", "ডিয়ার", "deer"),
    ("an-parrot", "parrot", "টিয়া", "প্যারট", "parrot"),
    ("an-crow", "crow", "কাক", "ক্রো", "crow"),
]
# animal -> (home word used as the answer, the book's sentence, [homes that are also right])
HOME_OF = {
    "tiger": ("lair", "A tiger lives in a lair.", ["lair"]),
    "dog": ("kennel", "A dog lives in a kennel or doghouse.", ["kennel"]),
    "monkey": ("tree", "A monkey lives in a tree.", ["tree"]),
    "cow": ("cowshed", "A cow lives in a shed or a cowshed.", ["cowshed"]),
    "deer": ("forest", "A deer lives in a forest.", ["forest"]),
    "parrot": ("nest", "A parrot lives in a nest or a tree hole.", ["nest", "tree hole"]),
    "crow": ("nest", "A crow lives in a nest.", ["nest"]),
}
HOMES = [
    ("ho-kennel", "kennel", "কুকুরের ঘর", "কেনেল", "kennel"),
    ("ho-cowshed", "cowshed", "গোয়ালঘর", "কাউশেড", "cowshed"),
    ("ho-tree", "tree", "গাছ", "ট্রি", "tree"),
    ("ho-nest", "nest", "পাখির বাসা", "নেস্ট", "bird-nest"),
    ("ho-lair", "lair", "বাঘের গুহা", "লেয়ার", "lair"),
    ("ho-forest", "forest", "বন", "ফরেস্ট", "forest"),
    ("ho-hole", "tree hole", "গাছের কোটর", "ট্রি হোল", "tree-hole"),
]
HOME_EX = {
    "kennel": "A dog lives in a kennel or doghouse.", "cowshed": "A cow lives in a shed or a cowshed.",
    "tree": "A monkey lives in a tree.", "nest": "A crow lives in a nest.",
    "lair": "A tiger lives in a lair.", "forest": "A deer lives in a forest.",
    "tree hole": "A parrot lives in a nest or a tree hole.",
}
V1 = ([vocab(i, w, bn, pr, 84, "bird" if w in ("parrot", "crow") else "animal", img)
       for (i, w, bn, pr, img) in ANIMALS]
      + [vocab(i, w, bn, pr, 85, "place", img, HOME_EX[w]) for (i, w, bn, pr, img) in HOMES])
IA = {v["word"]: v for v in V1}
animal_words = [a[1] for a in ANIMALS]
home_words = [h[1] for h in HOMES]
home_img = {h[1]: h[4] for h in HOMES}
home_id = {h[1]: h[0] for h in HOMES}

where_rounds = []
for (aid, a, bn, pr, img) in ANIMALS:
    right, sentence, also = HOME_OF[a]
    wrongs = random.sample([h for h in home_words if h not in also and h != "tree hole"], 2)
    where_rounds.append(rnd("w-" + a, "Where does a %s live?" % a, "%s কোথায় থাকে?" % bn, right, wrongs,
                            tests=home_id[right], image=img, hint=sentence, images=home_img))
tf1 = [
    tf_round("t1", "The monkey lives in a tree hole.", "বানর গাছের কোটরে থাকে।", False,
             "No! A monkey lives in a tree.", "ho-tree"),
    tf_round("t2", "The cow lives in a forest.", "গরু বনে থাকে।", False,
             "No! A cow lives in a shed or a cowshed.", "ho-cowshed"),
    tf_round("t3", "The crow lives in a nest.", "কাক বাসায় থাকে।", True,
             "Yes! A crow lives in a nest.", "ho-nest"),
]
quiz1 = [
    question("q1", "tap-picture", "Which animal is this?", "এটি কোন প্রাণী?", "tiger",
             others("tiger", animal_words), tests="an-tiger", image="tiger", explain="tiger = বাঘ"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "kennel", others("kennel", home_words), tests="ho-kennel", speak="kennel"),
    question("q3", "fill-blank", "A deer lives in a ___ .", "A deer lives in a ___ .", "forest",
             ["kennel", "lair"], tests="ho-forest", explain="A deer lives in a forest."),
    true_false("q4", "A tiger lives in a lair.", "বাঘ গুহায় থাকে।", True, "The book says: A tiger lives in a lair.", "ho-lair"),
    question("q5", "tap-picture", "Who lives here?", "এখানে কে থাকে?", "a dog", ["a cow", "a crow"],
             tests="ho-kennel", image="kennel", explain="A dog lives in a kennel."),
]
lessons.append(lesson_frame(
    L1, 1, "Their Living Places", "তাদের বাসস্থান", "category", [84, 85, 86],
    "Name seven animals and birds and say where each one lives.",
    "সাতটি প্রাণী ও পাখির নাম বলা আর তারা কোথায় থাকে তা বলা।", V1, [
        intro_step(L1, "Where do they live?", "তারা কোথায় থাকে?", "Every animal and bird has a home. Where do they live?",
                   "প্রতিটি প্রাণী ও পাখির একটি বাসস্থান আছে। তারা কোথায় থাকে?", "forest"),
        vocab_step(L1, "animals1", [a[0] for a in ANIMALS[:4]], "Animals 1", "প্রাণী ১", "B"),
        vocab_step(L1, "animals2", [a[0] for a in ANIMALS[4:]], "Animals and birds 2", "প্রাণী ও পাখি ২", "B"),
        vocab_step(L1, "homes1", [h[0] for h in HOMES[:4]], "Their homes 1", "তাদের বাসস্থান ১", "C"),
        vocab_step(L1, "homes2", [h[0] for h in HOMES[4:]], "Their homes 2", "তাদের বাসস্থান ২", "C"),
        speak_step(L1, "speak", "Say it!", "বলো!", "Say: A dog lives in a kennel.", "বলো: A dog lives in a kennel.",
                   "A dog lives in a kennel.", "D"),
        game_step(L1, "game1", "picture-to-word", "Name the animal", "প্রাণীটির নাম বলো", [
            rnd("r-" + a, "Which animal is this?", "এটি কোন প্রাণী?", a, others(a, animal_words),
                tests=aid, image=img, hint="Look at the picture.")
            for (aid, a, bn, pr, img) in ANIMALS[:6]
        ], "B"),
        game_step(L1, "game2", "match-pairs", "Where do they live?", "তারা কোথায় থাকে?", where_rounds, "E"),
        game_step(L1, "game3", "true-false", "True or false?", "সত্য না মিথ্যা?", tf1, "F"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You know where animals and birds live!",
                  "প্রাণী ও পাখি কোথায় থাকে তুমি জানো!"),
    ], minutes=8))

# =========================================================================
# Lesson 2 - Their food (book pages 87-88)
# =========================================================================
L2 = "u9l2"
FOODS = [
    ("fo-meat", "meat", "মাংস", "মিট", "meat", "A dog eats meat."),
    ("fo-grass", "grass", "ঘাস", "গ্রাস", "grass", "A cow eats grass."),
    ("fo-fruits", "fruits", "ফল", "ফ্রুটস", "fruits", "A parrot eats fruits."),
    ("fo-nuts", "nuts", "বাদাম জাতীয় ফল", "নাটস", "nuts", "A monkey eats fruits, nuts, etc."),
    ("fo-grains", "grains", "শস্যদানা", "গ্রেইনস", "grains", "A crow eats grains, insects, etc."),
    ("fo-insects", "insects", "পোকামাকড়", "ইনসেক্টস", "insects", "A crow eats grains, insects, etc."),
    ("fo-leaves", "leaves", "পাতা", "লিভস", "leaves", "A deer eats grass, leaves, etc."),
]
V2 = [vocab(i, w, bn, pr, 87, "food", img, ex) for (i, w, bn, pr, img, ex) in FOODS]
# animal -> (food phrase printed in Activity A, vocab id it teaches)
FOOD_OF = {
    "dog": ("meat", "fo-meat"),
    "cow": ("grass", "fo-grass"),
    "monkey": ("fruits, nuts, etc.", "fo-nuts"),
    "parrot": ("fruits", "fo-fruits"),
    "tiger": ("meat", "fo-meat"),
    "crow": ("grains, insects, etc.", "fo-insects"),
    "deer": ("grass, leaves, etc.", "fo-leaves"),
}
FOOD_PHRASES = sorted({v[0] for v in FOOD_OF.values()})
IMG_OF = {a[1]: a[4] for a in ANIMALS}
BN_OF = {a[1]: a[2] for a in ANIMALS}
eat_rounds = []
for animal in ["dog", "cow", "monkey", "parrot", "tiger", "crow", "deer"]:
    right, tid = FOOD_OF[animal]
    # A wrong option must not share a word with the right one: "grass" would also
    # be right for the deer, and "fruits" for the monkey.
    safe = [p for p in FOOD_PHRASES if not (tokens(p) & tokens(right))]
    eat_rounds.append(rnd("e-" + animal, "What does a %s eat?" % animal, "%s কী খায়?" % BN_OF[animal],
                          right, random.sample(safe, 2), tests=tid, image=IMG_OF[animal],
                          hint="A %s eats %s" % (animal, right)))
tf2 = [
    tf_round("c1", "A tiger eats grass.", "বাঘ ঘাস খায়।", False, "No! A tiger eats meat.", "fo-meat"),
    tf_round("c2", "A parrot eats ants.", "টিয়া পিঁপড়া খায়।", False, "No! A parrot eats fruits.", "fo-fruits"),
    tf_round("c3", "A monkey eats apples.", "বানর আপেল খায়।", True,
             "Yes! Apples are fruits. A monkey eats fruits, nuts, etc.", "fo-nuts"),
    tf_round("c4", "A deer eats leaves.", "হরিণ পাতা খায়।", True, "Yes! A deer eats grass, leaves, etc.", "fo-leaves"),
    tf_round("c5", "A cow eats meat.", "গরু মাংস খায়।", False, "No! A cow eats grass.", "fo-grass"),
]
food_words = [f[1] for f in FOODS]
quiz2 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "meat", others("meat", food_words),
             tests="fo-meat", image="meat", explain="meat = মাংস"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "insects", others("insects", food_words), tests="fo-insects", speak="insects"),
    question("q3", "fill-blank", "A cow eats ___ .", "A cow eats ___ .", "grass", ["meat", "insects"],
             tests="fo-grass", explain="A cow eats grass."),
    true_false("q4", "A dog eats meat.", "কুকুর মাংস খায়।", True, "The book says: A dog eats meat.", "fo-meat"),
    question("q5", "tap-picture", "Who eats this?", "এটি কে খায়?", "a cow", ["a tiger", "a dog"],
             tests="fo-grass", image="grass", explain="A cow eats grass."),
]
lessons.append(lesson_frame(
    L2, 2, "Their Food", "তাদের খাবার", "category", [87, 88],
    "Say what different animals and birds eat.",
    "কোন প্রাণী ও পাখি কী খায় তা বলা।", V2, [
        intro_step(L2, "What do they eat?", "তারা কী খায়?", "Animals and birds eat different food. Let's find out!",
                   "প্রাণী ও পাখি আলাদা আলাদা খাবার খায়। চলো জানি!", "grass"),
        vocab_step(L2, "food1", [f[0] for f in FOODS[:4]], "Their food 1", "তাদের খাবার ১", "A"),
        vocab_step(L2, "food2", [f[0] for f in FOODS[4:]], "Their food 2", "তাদের খাবার ২", "A"),
        speak_step(L2, "speak1", "Say it!", "বলো!", "Say: A dog eats meat.", "বলো: A dog eats meat.",
                   "A dog eats meat.", "B"),
        game_step(L2, "game1", "choose-the-reply", "What does it eat?", "এটি কী খায়?", eat_rounds, "B"),
        game_step(L2, "game2", "true-false", "True or false?", "সত্য না মিথ্যা?", tf2, "C"),
        speak_step(L2, "speak2", "A hen", "একটি মুরগি", "Say: A hen lives in a hen house. It eats rice, insects, etc.",
                   "বলো: A hen lives in a hen house. It eats rice, insects, etc.",
                   "A hen lives in a hen house. It eats rice, insects, etc.", "D"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You know what animals and birds eat!",
                  "প্রাণী ও পাখি কী খায় তুমি জানো!"),
    ]))

# =========================================================================
# Lesson 3 - Domestic animals and birds (book pages 89-90)
# =========================================================================
L3 = "u9l3"
V3 = [
    vocab("do-animal", "domestic animal", "গৃহপালিত প্রাণী", "ডমেস্টিক অ্যানিম্যাল", 89, "animal", "cow",
          "A cow is a domestic animal."),
    vocab("do-bird", "domestic bird", "গৃহপালিত পাখি", "ডমেস্টিক বার্ড", 89, "bird", "hen",
          "A hen is a domestic bird."),
    vocab("do-milk", "milk", "দুধ", "মিল্ক", 89, "food", "milk", "The cow gives us milk."),
    vocab("do-eggs", "eggs", "ডিম", "এগস", 89, "food", "egg", "We eat eggs."),
    vocab("do-lays", "lays", "ডিম পাড়ে", "লেইজ", 89, "action", "birds-eggs", "The hen lays eggs for us."),
    vocab("do-pet", "pet animal", "পোষা প্রাণী", "পেট অ্যানিম্যাল", 90, "animal", "cat", "Orpa has a pet animal."),
]
COWHEN = [
    "A cow is a domestic animal.", "A hen is a domestic bird.", "We keep them in our houses.",
    "The cow gives us milk.", "We drink milk.", "The hen lays eggs for us.", "We eat eggs.",
]
cowhen_qa = [
    rnd("b1", "What kind of animal is the cow?", "গরু কী ধরনের প্রাণী?", "A domestic animal",
        ["A wild animal", "A pet bird"], tests="do-animal", speak="What kind of animal is the cow?",
        hint="Read the first sentence."),
    rnd("b2", "What does the cow give us?", "গরু আমাদের কী দেয়?", "Milk", ["Eggs", "Grass"],
        tests="do-milk", speak="What does the cow give us?", hint="We drink it."),
    rnd("b3", "What kind of bird is the hen?", "মুরগি কী ধরনের পাখি?", "A domestic bird",
        ["A wild bird", "A pet animal"], tests="do-bird", speak="What kind of bird is the hen?",
        hint="Read the second sentence."),
    rnd("b4", "What does the hen give us?", "মুরগি আমাদের কী দেয়?", "Eggs", ["Milk", "Meat"],
        tests="do-eggs", speak="What does the hen give us?", hint="We eat them."),
]
BOX = ["animal", "house", "lives", "lays", "eggs"]
blanks = [
    ("It lives in our ___ .", "house", None),
    ("It ___ on grains and insects.", "lives", None),
    ("It ___ eggs.", "lays", "do-lays"),
    ("We eat ___ .", "eggs", "do-eggs"),
]
blank_rounds = [rnd("f%d" % n, s, s, w, others(w, BOX), tests=t, hint="Choose from the box.")
                for n, (s, w, t) in enumerate(blanks, start=1)]
MARKS = {".": ". (full stop)", "?": "? (question mark)"}
PUNCT = [
    ("Orpa has a pet animal ___", "."), ("It is a cat ___", "."), ("Its name is Nini ___", "."),
    ("Have you any pet animal ___", "?"), ("Do you love it ___", "?"), ("What is its name ___", "?"),
]
punct_rounds = [rnd("p%d" % n, s, s, MARKS[m], [MARKS[x] for x in MARKS if x != m],
                    hint="A question ends with ?. A telling sentence ends with a full stop.")
                for n, (s, m) in enumerate(PUNCT, start=1)]
quiz3 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "milk", ["eggs", "meat"],
             tests="do-milk", image="milk", explain="The cow gives us milk."),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "eggs", ["milk", "lays"], tests="do-eggs", speak="eggs"),
    question("q3", "fill-blank", "The hen ___ eggs for us.", "The hen ___ eggs for us.", "lays",
             ["lives", "drinks"], tests="do-lays", explain="The hen lays eggs for us."),
    true_false("q4", "A cow is a domestic animal.", "গরু একটি গৃহপালিত প্রাণী।", True,
               "The text says: A cow is a domestic animal.", "do-animal"),
    question("q5", "tap-picture", "What is this?", "এটি কী?", "a hen", ["a cow", "a cat"],
             tests="do-bird", image="hen", explain="A hen is a domestic bird."),
]
lessons.append(lesson_frame(
    L3, 3, "Domestic Animals and Birds", "গৃহপালিত প্রাণী ও পাখি", "story", [89, 90],
    "Read about the cow and the hen, and say what they give us.",
    "গরু ও মুরগির কথা পড়া আর তারা আমাদের কী দেয় তা বলা।", V3, [
        intro_step(L3, "At home", "বাড়িতে", "A cow and a hen live with us. What do they give us?",
                   "একটি গরু আর একটি মুরগি আমাদের সঙ্গে থাকে। তারা আমাদের কী দেয়?", "cow"),
        vocab_step(L3, "words", [v["id"] for v in V3], "New words", "নতুন শব্দ", "A"),
        text_step(L3, "text", "Domestic animals and birds", "গৃহপালিত প্রাণী ও পাখি", COWHEN, "A"),
        game_step(L3, "game1", "choose-the-reply", "Ask and answer", "প্রশ্ন আর উত্তর", cowhen_qa, "B"),
        game_step(L3, "game2", "order-the-lines", "Fill in the blanks", "ফাঁকা জায়গা পূরণ করো", blank_rounds, "C"),
        speak_step(L3, "speak1", "Domestic animals", "গৃহপালিত প্রাণী",
                   "Say a domestic animal and a domestic bird you know.",
                   "তোমার জানা একটি গৃহপালিত প্রাণী আর একটি গৃহপালিত পাখির নাম বলো।",
                   "A cow is a domestic animal. A hen is a domestic bird.", "D"),
        game_step(L3, "game3", "order-the-lines", "Which mark?", "কোন চিহ্ন?", punct_rounds, "E"),
        speak_step(L3, "speak2", "Your favourite", "তোমার প্রিয়", "Tell us about your favourite animal or bird.",
                   "তোমার প্রিয় প্রাণী বা পাখি সম্পর্কে বলো।", "My favourite animal is ...", "F"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You know what a cow and a hen give us!",
                  "গরু আর মুরগি আমাদের কী দেয় তুমি জানো!"),
    ], minutes=8))

# =========================================================================
# Lesson 4 - A rhyme: Hey Diddle, Diddle (book pages 91-92)
# =========================================================================
L4 = "u9l4"
V4 = [
    vocab("ry-fiddle", "fiddle", "বেহালা", "ফিডল", 91, "object", "fiddle", "The cat, and the fiddle,"),
    vocab("ry-moon", "moon", "চাঁদ", "মুন", 91, "nature", "moon", "The cow jumped over the moon."),
    vocab("ry-dish", "dish", "থালা", "ডিশ", 91, "object", "dish", "And the dish ran away with the spoon."),
    vocab("ry-spoon", "spoon", "চামচ", "স্পুন", 91, "object", "spoon", "And the dish ran away with the spoon."),
]
DIDDLE = [
    ("Hey diddle, diddle The cat, and the fiddle,", "rhyme-cat"),
    ("The cow jumped over the moon.", "rhyme-cow"),
    ("The little dog laughed to see such sport,", "rhyme-dog"),
    ("And the dish ran away with the spoon.", "rhyme-dish"),
]
diddle_qa = [
    rnd("a1", "What is the cat doing?", "বিড়ালটি কী করছে?", "Playing the fiddle",
        ["Sleeping", "Eating a fish"], tests="ry-fiddle", speak="What is the cat doing?",
        hint="Read the first two lines."),
    rnd("a2", "Where is the cow jumping?", "গরুটি কোথায় লাফাচ্ছে?", "Over the moon",
        ["Over the dish", "Over the fence"], tests="ry-moon", speak="Where is the cow jumping?",
        hint="Read the third line."),
    rnd("a3", "Who laughed?", "কে হাসল?", "The little dog", ["The cat", "The cow"],
        speak="Who laughed?", hint="Read the fourth line."),
    rnd("a4", "Who ran away with the spoon?", "চামচ নিয়ে কে পালিয়ে গেল?", "The dish", ["The cat", "The moon"],
        tests="ry-dish", speak="Who ran away with the spoon?", hint="Read the last line."),
]
SCENE_LABEL = {"the cat and the fiddle": "rhyme-cat", "the cow and the moon": "rhyme-cow",
               "the little dog": "rhyme-dog", "the dish and the spoon": "rhyme-dish"}
scene_words = list(SCENE_LABEL)
scene_rounds = []
for (line, label) in [("The cat, and the fiddle,", "the cat and the fiddle"),
                      ("The cow jumped over the moon.", "the cow and the moon"),
                      ("The little dog laughed to see such sport,", "the little dog"),
                      ("And the dish ran away with the spoon.", "the dish and the spoon")]:
    scene_rounds.append(rnd("p-" + label.split()[1], line, line, label, others(label, scene_words),
                            hint="Find the picture that matches the line.", images=SCENE_LABEL))
quiz4 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "a fiddle", ["a dish", "a spoon"],
             tests="ry-fiddle", image="fiddle", explain="fiddle = বেহালা"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "moon", ["dish", "spoon"], tests="ry-moon", speak="moon"),
    question("q3", "fill-blank", "The cow jumped over the ___ .", "The cow jumped over the ___ .", "moon",
             ["fiddle", "spoon"], tests="ry-moon", explain="The cow jumped over the moon."),
    true_false("q4", "The cat played the fiddle.", "বিড়ালটি বেহালা বাজাল।", True,
               "The rhyme says: The cat, and the fiddle.", "ry-fiddle"),
    question("q5", "tap-word", "The dish ran away with the ___ .", "The dish ran away with the ___ .",
             "spoon", ["moon", "fiddle"], tests="ry-spoon", explain="And the dish ran away with the spoon."),
]
lessons.append(lesson_frame(
    L4, 4, "A Rhyme", "একটি ছড়া", "rhyme", [91, 92],
    "Recite the rhyme Hey Diddle, Diddle and act it out.",
    "\"Hey Diddle, Diddle\" ছড়াটি আবৃত্তি করা আর অভিনয় করে দেখানো।", V4, [
        intro_step(L4, "A funny rhyme", "একটি মজার ছড়া", "A cat plays a fiddle. A cow jumps over the moon!",
                   "একটি বিড়াল বেহালা বাজায়। একটি গরু চাঁদের ওপর দিয়ে লাফায়!", "rhyme-cow"),
        vocab_step(L4, "words", [v["id"] for v in V4], "New words", "নতুন শব্দ", "B"),
        story_step(L4, "rhyme", "Hey Diddle, Diddle", "হে ডিডল, ডিডল", DIDDLE, "B"),
        game_step(L4, "game1", "choose-the-reply", "Questions about the rhyme", "ছড়াটি নিয়ে প্রশ্ন", diddle_qa, "A"),
        game_step(L4, "game2", "order-the-scenes", "Find the picture", "ছবিটি খুঁজে বের করো", scene_rounds, "A"),
        command_step(L4, "act", "Act it out", "অভিনয় করো", [
            ("Play the fiddle.", "বেহালা বাজাও।", "fiddle"),
            ("Jump.", "লাফাও।", "rhyme-cow"),
            ("Laugh.", "হাসো।", "rhyme-dog"),
            ("Run.", "দৌড়াও।", "rhyme-dish"),
        ], "D"),
        command_step(L4, "draw", "Draw your favourite", "তোমার প্রিয়টি আঁকো", [
            ("Draw a picture of your favourite animal or bird. Colour it and display it in the class.",
             "তোমার প্রিয় প্রাণী বা পাখির ছবি আঁকো। রং করে শ্রেণিকক্ষে টাঙিয়ে দাও।", "colouring")], "E"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You can say Hey Diddle, Diddle!", "তুমি Hey Diddle, Diddle বলতে পারো!"),
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u9", "number": 9,
    "title": "Animals and Birds",
    "titleBn": "প্রাণী ও পাখি",
    "colour": "lime", "icon": "paw",
    "_source": "English for Today, Class Two (NCTB). Unit 9, book pages 84-92.",
    "_note": ("Living places, food, the cow-and-hen passage, Hey Diddle, Diddle "
              "and the exercises are transcribed from the textbook. Bangla "
              "meanings are Pickixo's addition - the book carries no glosses. "
              "Distractor answers are chosen so that none is also correct."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit09.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Show every food/home round with its options, so a person can check no wrong
# option is also right.
for r in eat_rounds:
    print("%-22s -> %-26s | %s" % (r["ask"], r["options"][r["answer"]]["label"],
                                   ", ".join(o["label"] for i, o in enumerate(r["options"]) if i != r["answer"])))
for r in where_rounds:
    print("%-26s -> %-8s | %s" % (r["ask"], r["options"][r["answer"]]["label"],
                                  ", ".join(o["label"] for i, o in enumerate(r["options"]) if i != r["answer"])))
words = sum(len(l["vocabulary"]) for l in lessons)
print("unit09.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
