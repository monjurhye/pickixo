# -*- coding: utf-8 -*-
"""Generate unit06.json — Let's Play with Sounds (book pages 55-62).

Same approach as build-unit02..05.py: answers are *computed*, never typed.

This unit matters more than the others for that rule. Every "same / different"
pair is decided by comparing the SOUND of each word, looked up in the two
tables below, so a pair like "goat / road" (both spelled with a t or a d, but
ending /t/ and /d/) cannot be mislabelled by a slip of the finger. The tables
hold sounds, not spellings: apple, ant and ash all begin with the same sound
even though nothing in the spelling says so to a child, and cake and cot begin
alike although one starts with "ca" and one with "co".

Textbook text (words, sound letters, the pairs) is transcribed as printed.
Bangla glosses and pronunciations are Pickixo's addition, marked as such.

Notes on reading the book:
  * "Say the sound" activities ("T: a  Ss: a") are classroom call-and-response.
    Browser speech cannot reliably say an isolated sound (it says the letter's
    NAME), so the app teaches sounds through words: it names the sound-letter
    the book prints (a—ant, red—d) and speaks whole words only.
  * Page 57 (Lesson 2, Activity C) is cut off after item 5 in the scan; only
    the five printed pairs are used.
  * Lesson 4 Activity D's word list (road, frog, net, shop, jeep, goat, pass,
    make) has no pictures, so it is practised aloud rather than as picture cards.
  * The book spells ball's missing letters as "ba—": the answer is "ll".

Run:  python scripts/build-unit06.py
"""
import json
import pathlib
import random

random.seed(6)   # stable output: regenerating must not reshuffle every quiz

# --- sounds, not spellings ------------------------------------------------
# The beginning sound of each word used in an initial-sound pair.
INITIAL = {
    "ant": "ae", "apple": "ae", "ash": "ae",
    "man": "m", "mat": "m", "men": "m", "milk": "m",
    "fan": "f",
    "cot": "k", "cat": "k", "cake": "k", "cap": "k",
    "bag": "b", "bed": "b", "book": "b",
    "top": "t", "take": "t", "tap": "t",
}
# The ending sound of each word used in a final-sound pair.
FINAL = {
    "bat": "t", "cat": "t", "vat": "t", "rat": "t", "fat": "t", "mat": "t",
    "hat": "t", "pet": "t", "cot": "t", "goat": "t",
    "van": "n", "fan": "n", "pan": "n",
    "jug": "g", "flag": "g", "mug": "g", "dog": "g",
    "map": "p",
    "lotus": "s", "bus": "s",
    "rod": "d", "road": "d", "red": "d",
    "tall": "l", "bell": "l", "ball": "l",
}
# The sound-letter the book prints for a word (b—bag, red—d).
FIRST_LETTER = {"ant": "a", "apple": "a", "ash": "a", "mat": "m", "man": "m", "milk": "m",
                "bag": "b", "fan": "f", "top": "t", "cake": "c", "tap": "t", "book": "b",
                "cap": "c"}
LAST_LETTER = {"cat": "t", "bat": "t", "fan": "n", "van": "n", "red": "d", "ball": "l",
               "dog": "g", "bus": "s"}


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


def rnd(rid, ask, ask_bn, correct, wrongs, tests=None, image=None, speak=None, hint=None):
    opts, answer = labelled(correct, wrongs)
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


def lesson_frame(lid, number, title, title_bn, pages, objective, objective_bn,
                 vocabulary, steps, minutes=7):
    return {"id": lid, "unitId": "u6", "number": number, "title": title,
            "titleBn": title_bn, "shape": "phonics", "bookPages": pages,
            "objective": objective, "objectiveBn": objective_bn, "minutes": minutes,
            "vocabulary": vocabulary, "steps": steps}


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


def letter_rounds(items, sound_of, letters, ask, ask_bn, hint):
    """A picture, and which sound-letter it starts / ends with."""
    out = []
    for vid, word, image in items:
        right = sound_of[word]
        out.append(rnd("r-" + vid, ask, ask_bn, right, others(right, letters),
                       tests=vid, image=image, hint=hint))
    return out


def pair_rounds(pairs, table, position, id_of, hint_same, hint_diff):
    """The book's own same/different pairs, decided from the sound tables.

    `position` is "begin" or "end". The answer comes from comparing the two
    sounds, so a pair such as goat / road (final /t/ and /d/) cannot be
    mislabelled by a slip of the finger.
    """
    bn = {"begin": "শুরুর", "end": "শেষের"}[position]
    out = []
    for n, (a, b) in enumerate(pairs, start=1):
        same = table[a] == table[b]
        tests = next((id_of[w] for w in (a, b) if w in id_of), None)
        out.append({
            "id": "p%d" % n,
            "ask": "Do %s and %s %s with the same sound?" % (a, b, position),
            "askBn": "%s আর %s — %s ধ্বনি কি একই?" % (a, b, bn),
            "speak": "%s. %s." % (a, b),
            "options": [{"label": "S (same)"}, {"label": "D (different)"}],
            "answer": 0 if same else 1,
            "hint": hint_same if same else hint_diff,
            "tests": tests,
        })
    return out


lessons = []

# =========================================================================
# Lesson 1 - Initial sounds 1 (book pages 55-56)
# =========================================================================
L1 = "u6l1"
V1 = [
    vocab("s-ant", "ant", "পিঁপড়া", "অ্যান্ট", 55, "animal", "ant", "a (/æ/)—ant"),
    vocab("s-apple", "apple", "আপেল", "অ্যাপল", 55, "food", "apple", "a—apple"),
    vocab("s-mat", "mat", "মাদুর", "ম্যাট", 55, "object", "mat", "m (/m/)—mat"),
    vocab("s-man", "man", "পুরুষ মানুষ", "ম্যান", 55, "person", "man", "m—man"),
    vocab("s-ash", "ash", "ছাই", "অ্যাশ", 55, "nature", "ash"),
    vocab("s-milk", "milk", "দুধ", "মিল্ক", 55, "food", "milk"),
]
I1 = {v["word"]: v for v in V1}
ID1 = {v["word"]: v["id"] for v in V1}
LETTERS_INIT = ["a", "m", "b", "f", "t", "c"]
L1_PAIRS = [("apple", "mat"), ("man", "mat"), ("apple", "fan"), ("ant", "ash"), ("man", "fan")]
quiz1 = [
    question("q1", "tap-picture", "What is the first sound?", "শুরুর ধ্বনি কোনটি?", "m",
             ["a", "f"], tests="s-mat", image="mat", explain="m—mat"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "apple", ["ant", "man"], tests="s-apple", speak="apple"),
    question("q3", "fill-blank", "___ pple", "___ pple", "a", ["m", "f"], tests="s-apple",
             explain="a—apple"),
    true_false("q4", "Ant and apple begin with the same sound.",
               "ant আর apple একই ধ্বনি দিয়ে শুরু হয়।", True, "Both begin with a.", "s-ant"),
    question("q5", "tap-word", "Which word begins with the same sound as man?",
             "কোন শব্দটি man-এর মতো একই ধ্বনি দিয়ে শুরু?", "mat", ["apple", "ash"],
             tests="s-man", explain="man and mat both begin with m."),
]
lessons.append(lesson_frame(
    L1, 1, "Initial Sounds 1", "শুরুর ধ্বনি ১", [55, 56],
    "Hear the beginning sound of a word and tell whether two words begin alike.",
    "শব্দের শুরুর ধ্বনি শোনা আর দুটি শব্দ একই ধ্বনি দিয়ে শুরু কি না বলা।", V1, [
        intro_step(L1, "Beginning sounds", "শুরুর ধ্বনি", "Every word begins with a sound. Listen for it!",
                   "প্রতিটি শব্দ একটি ধ্বনি দিয়ে শুরু হয়। মন দিয়ে শোনো!", "apple"),
        vocab_step(L1, "words", [v["id"] for v in V1], "Look, listen and say", "দেখো, শোনো আর বলো", "A"),
        speak_step(L1, "speak1", "Say the sound and the word", "ধ্বনি আর শব্দ বলো",
                   "Say: a, ant.", "বলো: a, ant.", "a. ant.", "B"),
        speak_step(L1, "speak2", "Now with m", "এবার m দিয়ে", "Say: m, mat.", "বলো: m, mat.", "m. mat.", "B"),
        game_step(L1, "game1", "picture-to-word", "What is the first sound?", "শুরুর ধ্বনি কোনটি?",
                  letter_rounds([(ID1[w], w, I1[w]["image"]) for w in ["ant", "apple", "mat", "man", "ash", "milk"]],
                                FIRST_LETTER, LETTERS_INIT, "What is the first sound?",
                                "শুরুর ধ্বনি কোনটি?", "Say the word slowly. Listen to the start."), "C"),
        game_step(L1, "game2", "same-sound", "Same or different?", "একই না আলাদা?",
                  pair_rounds(L1_PAIRS, INITIAL, "begin", ID1,
                              "They start with the same sound.", "They start with different sounds."), "E"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You can hear the beginning of a word!",
                  "তুমি শব্দের শুরুর ধ্বনি শুনতে পারো!"),
    ]))

# =========================================================================
# Lesson 2 - Initial sounds 2 (book pages 57-58)
# =========================================================================
L2 = "u6l2"
V2 = [
    vocab("s-bag", "bag", "ব্যাগ", "ব্যাগ", 57, "object", "bag", "b—bag"),
    vocab("s-fan", "fan", "পাখা", "ফ্যান", 57, "object", "fan", "f—fan"),
    vocab("s-top", "top", "লাটিম", "টপ", 57, "object", "top", "t—top"),
    vocab("s-cake", "cake", "কেক", "কেক", 57, "food", "cake", "c—cake"),
    vocab("s-tap", "tap", "কল", "ট্যাপ", 58, "object", "tap"),
    vocab("s-book", "book", "বই", "বুক", 58, "object", "book"),
    vocab("s-cap", "cap", "টুপি", "ক্যাপ", 58, "object", "cap"),
]
I2 = {v["word"]: v for v in V2}
ID2 = {v["word"]: v["id"] for v in V2}
L2_PAIRS = [("cot", "cat"), ("fan", "apple"), ("bag", "bed"), ("cake", "take"), ("man", "men")]
quiz2 = [
    question("q1", "tap-picture", "What is the first sound?", "শুরুর ধ্বনি কোনটি?", "b", ["f", "t"],
             tests="s-bag", image="bag", explain="b—bag"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "cake", ["cap", "tap"], tests="s-cake", speak="cake"),
    question("q3", "fill-blank", "___ op", "___ op", "t", ["b", "f"], tests="s-top", explain="t—top"),
    true_false("q4", "Bag and bed begin with the same sound.", "bag আর bed একই ধ্বনি দিয়ে শুরু হয়।",
               True, "Both begin with b.", "s-bag"),
    question("q5", "tap-word", "Which word begins with the same sound as tap?",
             "কোন শব্দটি tap-এর মতো একই ধ্বনি দিয়ে শুরু?", "top", ["book", "fan"],
             tests="s-tap", explain="tap and top both begin with t."),
]
lessons.append(lesson_frame(
    L2, 2, "Initial Sounds 2", "শুরুর ধ্বনি ২", [57, 58],
    "Say more words by their beginning sound: b, f, t and c.",
    "শুরুর ধ্বনি অনুযায়ী আরও শব্দ বলা: b, f, t আর c।", V2, [
        intro_step(L2, "More beginning sounds", "আরও শুরুর ধ্বনি", "Listen to the first sound of each word.",
                   "প্রতিটি শব্দের প্রথম ধ্বনি শোনো।", "bag"),
        vocab_step(L2, "words1", ["s-bag", "s-fan", "s-top", "s-cake"], "Look, listen and say 1",
                   "দেখো, শোনো আর বলো ১", "A"),
        vocab_step(L2, "words2", ["s-tap", "s-book", "s-cap"], "Look, listen and say 2",
                   "দেখো, শোনো আর বলো ২", "D"),
        speak_step(L2, "speak", "Say the sounds and the words", "ধ্বনি আর শব্দ বলো",
                   "Say: b, bag. f, fan. t, top. c, cake.", "বলো: b, bag. f, fan. t, top. c, cake.",
                   "b, bag. f, fan. t, top. c, cake.", "B"),
        game_step(L2, "game1", "picture-to-word", "What is the first sound?", "শুরুর ধ্বনি কোনটি?",
                  letter_rounds([(ID2[w], w, I2[w]["image"]) for w in ["bag", "fan", "top", "cake", "tap", "book", "cap"]],
                                FIRST_LETTER, LETTERS_INIT, "What is the first sound?",
                                "শুরুর ধ্বনি কোনটি?", "Say the word slowly. Listen to the start."), "B"),
        game_step(L2, "game2", "same-sound", "Same or different?", "একই না আলাদা?",
                  pair_rounds(L2_PAIRS, INITIAL, "begin", ID2,
                              "They start with the same sound.", "They start with different sounds."), "C"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You can match words by their first sound!",
                  "তুমি প্রথম ধ্বনি দেখে শব্দ মেলাতে পারো!"),
    ]))

# =========================================================================
# Lesson 3 - Final sounds 1 (book pages 59-60)
# =========================================================================
L3 = "u6l3"
V3 = [
    vocab("e-cat", "cat", "বিড়াল", "ক্যাট", 59, "animal", "cat", "cat—t"),
    vocab("e-bat", "bat", "ব্যাট", "ব্যাট", 59, "object", "bat", "bat—t"),
    vocab("e-fan", "fan", "পাখা", "ফ্যান", 59, "object", "fan", "fan—n"),
    vocab("e-van", "van", "ভ্যান", "ভ্যান", 59, "vehicle", "van", "van—n"),
]
I3 = {v["word"]: v for v in V3}
ID3 = {v["word"]: v["id"] for v in V3}
LETTERS_END = ["t", "n", "d", "l", "g", "s", "p"]
L3_PAIRS = [("bat", "van"), ("vat", "rat"), ("fan", "fat"), ("mat", "hat"), ("pan", "pet")]
# Activity C: complete the words. The picture is the clue; the ending is the answer.
complete3 = []
for w, start in [("fan", "fa"), ("cat", "ca"), ("van", "va"), ("bat", "ba")]:
    end = w[len(start):]
    complete3.append(rnd("c-" + w, "%s___" % start, "%s___" % start, end,
                         others(end, [x for x in LETTERS_END]), tests=ID3[w], image=I3[w]["image"],
                         hint="Look at the picture. Say the word."))
quiz3 = [
    question("q1", "tap-picture", "What is the last sound?", "শেষ ধ্বনি কোনটি?", "n", ["t", "d"],
             tests="e-van", image="van", explain="van—n"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "bat", ["cat", "van"], tests="e-bat", speak="bat"),
    question("q3", "fill-blank", "ca___", "ca___", "t", ["n", "d"], tests="e-cat", explain="cat—t"),
    true_false("q4", "Cat and bat end with the same sound.", "cat আর bat একই ধ্বনি দিয়ে শেষ হয়।",
               True, "Both end with t.", "e-cat"),
    question("q5", "tap-word", "Which word ends with the same sound as fan?",
             "কোন শব্দটি fan-এর মতো একই ধ্বনি দিয়ে শেষ?", "van", ["cat", "bat"], tests="e-fan",
             explain="fan and van both end with n."),
]
lessons.append(lesson_frame(
    L3, 3, "Final Sounds 1", "শেষের ধ্বনি ১", [59, 60],
    "Hear the ending sound of a word and complete words with their last letter.",
    "শব্দের শেষ ধ্বনি শোনা আর শেষ অক্ষর দিয়ে শব্দ সম্পূর্ণ করা।", V3, [
        intro_step(L3, "Ending sounds", "শেষের ধ্বনি", "Words end with a sound too. Listen for it!",
                   "শব্দের শেষেও একটি ধ্বনি থাকে। মন দিয়ে শোনো!", "cat"),
        vocab_step(L3, "words", [v["id"] for v in V3], "Look, listen and say", "দেখো, শোনো আর বলো", "A"),
        speak_step(L3, "speak", "Say the word and its end", "শব্দ আর তার শেষ ধ্বনি বলো",
                   "Say: cat, t. bat, t.", "বলো: cat, t. bat, t.", "cat, t. bat, t.", "B"),
        game_step(L3, "game1", "picture-to-word", "What is the last sound?", "শেষ ধ্বনি কোনটি?",
                  letter_rounds([(ID3[w], w, I3[w]["image"]) for w in ["cat", "bat", "fan", "van"]],
                                LAST_LETTER, LETTERS_END, "What is the last sound?",
                                "শেষ ধ্বনি কোনটি?", "Say the word slowly. Listen to the end."), "B"),
        game_step(L3, "game2", "missing-letter", "Finish the word", "শব্দটি শেষ করো", complete3, "C"),
        game_step(L3, "game3", "same-sound", "Same or different?", "একই না আলাদা?",
                  pair_rounds(L3_PAIRS, FINAL, "end", ID3,
                              "They end with the same sound.", "They end with different sounds."), "D"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You can hear the end of a word!",
                  "তুমি শব্দের শেষ ধ্বনি শুনতে পারো!"),
    ]))

# =========================================================================
# Lesson 4 - Final sounds 2 (book pages 61-62)
# =========================================================================
L4 = "u6l4"
V4 = [
    vocab("e-red", "red", "লাল", "রেড", 61, "colour", "red", "red—d"),
    vocab("e-ball", "ball", "বল", "বল", 61, "object", "football", "ball—l"),
    vocab("e-dog", "dog", "কুকুর", "ডগ", 61, "animal", "dog", "dog—g"),
    vocab("e-bus", "bus", "বাস", "বাস", 61, "vehicle", "bus", "bus—s"),
]
I4 = {v["word"]: v for v in V4}
ID4 = {v["word"]: v["id"] for v in V4}
L4_PAIRS = [("jug", "flag"), ("mug", "map"), ("lotus", "bus"), ("rod", "cot"), ("goat", "road"), ("tall", "bell")]
complete4 = []
for w, start in [("ball", "ba"), ("red", "re"), ("bus", "bu"), ("dog", "do")]:
    end = w[len(start):]
    pool = ["ll", "d", "s", "g", "t", "n"]
    complete4.append(rnd("c-" + w, "%s___" % start, "%s___" % start, end, others(end, pool),
                         tests=ID4[w], image=I4[w]["image"], hint="Look at the picture. Say the word."))
READ_ALOUD = "road, frog, net, shop, jeep, goat, pass, make"
quiz4 = [
    question("q1", "tap-picture", "What is the last sound?", "শেষ ধ্বনি কোনটি?", "g", ["s", "d"],
             tests="e-dog", image="dog", explain="dog—g"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "bus", ["red", "dog"], tests="e-bus", speak="bus"),
    question("q3", "fill-blank", "re___", "re___", "d", ["s", "g"], tests="e-red", explain="red—d"),
    true_false("q4", "Goat and road end with the same sound.", "goat আর road একই ধ্বনি দিয়ে শেষ হয়।",
               False, "goat ends with t. road ends with d.", None),
    question("q5", "tap-word", "Which word ends with the same sound as ball?",
             "কোন শব্দটি ball-এর মতো একই ধ্বনি দিয়ে শেষ?", "bell", ["bus", "dog"], tests="e-ball",
             explain="ball and bell both end with l."),
]
lessons.append(lesson_frame(
    L4, 4, "Final Sounds 2", "শেষের ধ্বনি ২", [61, 62],
    "Say the final sounds of more words: d, l, g and s.",
    "আরও শব্দের শেষ ধ্বনি বলা: d, l, g আর s।", V4, [
        intro_step(L4, "More ending sounds", "আরও শেষের ধ্বনি", "Listen to the last sound of each word.",
                   "প্রতিটি শব্দের শেষ ধ্বনি শোনো।", "dog"),
        vocab_step(L4, "words", [v["id"] for v in V4], "Look, listen and say", "দেখো, শোনো আর বলো", "A"),
        speak_step(L4, "speak1", "Say the word and its end", "শব্দ আর তার শেষ ধ্বনি বলো",
                   "Say: red, d. ball, l. dog, g. bus, s.", "বলো: red, d. ball, l. dog, g. bus, s.",
                   "red, d. ball, l. dog, g. bus, s.", "B"),
        speak_step(L4, "speak2", "Read the words aloud", "শব্দগুলো জোরে পড়ো",
                   "Read aloud: " + READ_ALOUD + ".", "জোরে পড়ো: " + READ_ALOUD + "।",
                   READ_ALOUD + ".", "D"),
        game_step(L4, "game1", "picture-to-word", "What is the last sound?", "শেষ ধ্বনি কোনটি?",
                  letter_rounds([(ID4[w], w, I4[w]["image"]) for w in ["red", "ball", "dog", "bus"]],
                                LAST_LETTER, LETTERS_END, "What is the last sound?",
                                "শেষ ধ্বনি কোনটি?", "Say the word slowly. Listen to the end."), "B"),
        game_step(L4, "game2", "missing-letter", "Finish the word", "শব্দটি শেষ করো", complete4, "C"),
        game_step(L4, "game3", "same-sound", "Same or different?", "একই না আলাদা?",
                  pair_rounds(L4_PAIRS, FINAL, "end", ID4,
                              "They end with the same sound.", "They end with different sounds."), "E"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You can hear how words end!",
                  "শব্দ কীভাবে শেষ হয় তুমি শুনতে পারো!"),
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u6", "number": 6,
    "title": "Let's Play with Sounds",
    "titleBn": "চলো ধ্বনি নিয়ে খেলি",
    "colour": "pink", "icon": "sound",
    "_source": "English for Today, Class Two (NCTB). Unit 6, book pages 55-62.",
    "_note": ("Words, sound-letters and the same/different pairs are transcribed "
              "from the textbook; every S/D answer is computed from a table of "
              "sounds, not typed. Bangla meanings are Pickixo's addition - the "
              "book carries no glosses. Sounds are taught through whole words "
              "because browser speech cannot say an isolated sound."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit06.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Print every pair with its computed verdict, so a human can eyeball the sounds.
for name, pairs, table in [("initial 1", L1_PAIRS, INITIAL), ("initial 2", L2_PAIRS, INITIAL),
                           ("final 1", L3_PAIRS, FINAL), ("final 2", L4_PAIRS, FINAL)]:
    print(name + ": " + ", ".join("%s/%s=%s" % (a, b, "S" if table[a] == table[b] else "D")
                                  for a, b in pairs))
words = sum(len(l["vocabulary"]) for l in lessons)
print("unit06.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
