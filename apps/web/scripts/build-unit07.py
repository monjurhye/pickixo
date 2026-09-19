# -*- coding: utf-8 -*-
"""Generate unit07.json — Colours, Shapes and Signs (book pages 63-74).

Same approach as build-unit02..06.py: every quiz and game answer index is
*computed* from the correct option, never typed.

Textbook text (colour sentences, the two rhymes, Mr. Shape, the size words, the
road-sign names) is transcribed word for word. Bangla glosses and
pronunciations are Pickixo's addition and are marked as such.

Notes on reading the book:
  * Shapes are coloured differently on p.67 (red circle, blue square, green
    triangle, orange rectangle) and p.68 (the triangle is orange, the
    rectangle green). Because the book contradicts itself, no question here
    asks what colour a shape is.
  * Mr. Shape's counts (Lesson 4, Activity B) are true of Pickixo's own
    drawing of him, which follows the book's layout: 5 circles (face, two
    round eyes, two hands), 1 square (body), 3 triangles (nose and two feet),
    4 rectangles (two arms, two legs).
  * The word-match on p.64, the butterfly colouring on p.65, the drawing and
    project tasks, and the drive-along game on p.74 are pen-and-paper or
    classroom activities. Drawing/project tasks are offered as "listen and do"
    steps; the p.74 pictures carry no labels, so the game is not reproduced.
  * "Turn right / Turn left" is one printed sign with two names; it is kept as
    a single item.

Run:  python scripts/build-unit07.py
"""
import json
import pathlib
import random

random.seed(7)   # stable output: regenerating must not reshuffle every quiz


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


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, vocabulary, steps, minutes=7):
    return {"id": lid, "unitId": "u7", "number": number, "title": title,
            "titleBn": title_bn, "shape": shape, "bookPages": pages,
            "objective": objective, "objectiveBn": objective_bn,
            "minutes": minutes, "vocabulary": vocabulary, "steps": steps}


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


def rhyme_step(lid, name, title, title_bn, verses, activity=None):
    return {"id": sid(lid, name), "type": "rhyme", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn, "verses": verses}


def command_step(lid, name, title, title_bn, cards, activity=None):
    return {"id": sid(lid, name), "type": "command", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn,
            "commands": [{"text": t, "textBn": bn, "illustration": img} for (t, bn, img) in cards]}


def picture_rounds(items_by_id, ids, ask, ask_bn, pool_words, hint):
    out = []
    for i in ids:
        w = items_by_id[i]["word"]
        out.append(rnd("r-" + i, ask, ask_bn, w, others(w, pool_words),
                       tests=i, image=items_by_id[i]["image"], hint=hint))
    return out


lessons = []

# =========================================================================
# Lesson 1 - Colours (book pages 63-64)
# =========================================================================
L1 = "u7l1"
# colour, object that has it, sentence printed under the picture, Bangla, sound
COLOUR_ROWS = [
    ("red", "rose", "The rose is red.", "লাল", "রেড"),
    ("green", "parrot", "The parrot is green.", "সবুজ", "গ্রিন"),
    ("blue", "sky", "The sky is blue.", "নীল", "ব্লু"),
    ("violet", "balloon", "The balloon is violet.", "বেগুনি", "ভায়োলেট"),
    ("orange", "carrot", "The carrot is orange.", "কমলা", "অরেঞ্জ"),
    ("yellow", "banana", "The banana is yellow.", "হলুদ", "ইয়েলো"),
    ("indigo", "kite", "The kite is indigo.", "ঘন নীল", "ইন্ডিগো"),
]
V1 = [vocab("c-" + c, c, bn, pr, 63, "colour", "colour-" + c, sentence)
      for (c, obj, sentence, bn, pr) in COLOUR_ROWS]
I1 = {v["id"]: v for v in V1}
colour_words = [r[0] for r in COLOUR_ROWS]
object_rounds = [
    rnd("o-" + obj, "What colour is this?", "এটি কী রঙের?", c, others(c, colour_words),
        tests="c-" + c, image=obj, hint="Look at the picture. Which colour do you see?")
    for (c, obj, _, _, _) in COLOUR_ROWS
]
swatch_pool = ["red", "green", "blue", "violet", "orange", "yellow", "indigo"]
quiz1 = [
    question("q1", "tap-picture", "What colour is the parrot?", "টিয়া পাখিটি কী রঙের?", "green",
             others("green", colour_words), tests="c-green", image="parrot",
             explain="The parrot is green."),
    question("q2", "listen-choose", "Listen. Which colour did you hear?", "শোনো। কোন রংটি শুনলে?",
             "indigo", others("indigo", colour_words), tests="c-indigo", speak="indigo"),
    question("q3", "fill-blank", "The sky is ___ .", "The sky is ___ .", "blue",
             others("blue", colour_words), tests="c-blue", explain="The sky is blue."),
    true_false("q4", "The banana is yellow.", "কলাটি হলুদ।", True, "The banana is yellow.", "c-yellow"),
    question("q5", "tap-picture", "Which colour is this?", "এটি কোন রং?", "orange",
             others("orange", colour_words), tests="c-orange", image="colour-orange",
             explain="orange = কমলা"),
]
lessons.append(lesson_frame(
    L1, 1, "Colours", "রং", "category", [63, 64],
    "Name the seven colours and say what colour things are.",
    "সাতটি রঙের নাম বলা আর জিনিসের রং বলা।", V1, [
        intro_step(L1, "Colours all around", "চারপাশের রং", "Look around you. What colours can you see?",
                   "চারদিকে তাকাও। তুমি কী কী রং দেখতে পাও?", "rainbow"),
        vocab_step(L1, "words1", ["c-red", "c-green", "c-blue", "c-violet"], "Colours 1", "রং ১", "A"),
        vocab_step(L1, "words2", ["c-orange", "c-yellow", "c-indigo"], "Colours 2", "রং ২", "A"),
        speak_step(L1, "speak", "Say it!", "বলো!", "Say: The rose is red.", "বলো: The rose is red.",
                   "The rose is red.", "A"),
        game_step(L1, "game1", "picture-to-word", "What colour is it?", "এটি কী রঙের?", object_rounds, "C"),
        game_step(L1, "game2", "picture-to-word", "Name the colour", "রঙের নাম বলো", [
            rnd("s-" + c, "Which colour is this?", "এটি কোন রং?", c, others(c, colour_words),
                tests="c-" + c, image="colour-" + c, hint="Say the colours you know.")
            for c in ["yellow", "violet", "red", "green", "indigo"]
        ], "D"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You can name the seven colours!",
                  "তুমি সাতটি রঙের নাম বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 2 - Rainbow (book pages 65-66)
# =========================================================================
L2 = "u7l2"
V2 = [
    vocab("rainbow", "rainbow", "রংধনু", "রেইনবো", 65, "nature", "rainbow", "Seven colours make a rainbow?"),
    vocab("raindrops", "raindrops", "বৃষ্টির ফোঁটা", "রেইনড্রপস", 65, "nature", "rain", "Raindrops and sunlight"),
    vocab("sunlight", "sunlight", "সূর্যের আলো", "সানলাইট", 65, "nature", "the-sun", "Raindrops and sunlight"),
]
RAINBOW = [
    "Do you know? Do you know?",
    "Seven colours make a rainbow?",
    "Red, orange and yellow,",
    "Green and blue,",
    "Violet, indigo too!",
    "Raindrops and sunlight",
    "Make the colours look so bright!",
]
quiz2 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "rainbow", ["kite", "balloon"],
             tests="rainbow", image="rainbow", explain="rainbow = রংধনু"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "sunlight", ["raindrops", "rainbow"], tests="sunlight", speak="sunlight"),
    question("q3", "fill-blank", "Seven colours make a ___ .", "Seven colours make a ___ .", "rainbow",
             ["parrot", "carrot"], tests="rainbow", explain="Seven colours make a rainbow."),
    true_false("q4", "A rainbow has seven colours.", "রংধনুতে সাতটি রং আছে।", True,
               "The rhyme says: Seven colours make a rainbow.", "rainbow"),
    question("q5", "tap-word", "Raindrops and ___ make the colours look so bright!",
             "Raindrops and ___ make the colours look so bright!", "sunlight", ["shadows", "rainbows"],
             tests="sunlight", explain="Raindrops and sunlight make the colours bright."),
]
lessons.append(lesson_frame(
    L2, 2, "Rainbow", "রংধনু", "rhyme", [65, 66],
    "Recite the rhyme about the seven colours of the rainbow.",
    "রংধনুর সাতটি রঙের ছড়া আবৃত্তি করা।", V2, [
        intro_step(L2, "Seven colours", "সাতটি রং", "Seven colours make a rainbow. Can you say them?",
                   "সাতটি রং মিলে রংধনু হয়। তুমি বলতে পারো?", "rainbow"),
        vocab_step(L2, "words", ["rainbow", "raindrops", "sunlight"], "New words", "নতুন শব্দ", "A"),
        rhyme_step(L2, "rhyme", "Seven Colours Make a Rainbow", "সাত রঙে রংধনু", [RAINBOW], "A"),
        command_step(L2, "draw", "Draw a rainbow", "একটি রংধনু আঁকো", [
            ("Draw a rainbow and colour it. Say the rhyme as you draw.",
             "একটি রংধনু এঁকে রং করো। আঁকতে আঁকতে ছড়াটি বলো।", "rainbow")], "C"),
        game_step(L2, "game1", "picture-to-word", "Write the colour", "রঙের নাম বলো", [
            rnd("k-" + c, "Which colour is this?", "এটি কোন রং?", c, others(c, colour_words),
                image="colour-" + c, hint="You know these colours!")
            for c in ["green", "yellow", "indigo", "orange", "red"]
        ], "D"),
        game_step(L2, "game2", "order-the-lines", "Finish the rhyme", "ছড়াটি শেষ করো", [
            rnd("m1", "Red, ___ and yellow,", "Red, ___ and yellow,", "orange",
                ["blue", "violet"], hint="Red, ... and yellow."),
            rnd("m2", "Green and ___ ,", "Green and ___ ,", "blue", ["red", "orange"],
                hint="Green and ... ."),
            rnd("m3", "Violet, ___ too!", "Violet, ___ too!", "indigo", ["green", "yellow"],
                hint="Violet, ... too!"),
            rnd("m4", "Seven colours make a ___ ?", "Seven colours make a ___ ?", "rainbow",
                ["raindrop", "sunlight"], tests="rainbow", hint="Look up after the rain."),
        ], "A"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You can say the rainbow rhyme!", "তুমি রংধনুর ছড়াটি বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 3 - Shapes and sizes (book pages 67-68)
# =========================================================================
L3 = "u7l3"
SHAPES = [
    ("circle", "বৃত্ত", "সার্কল"),
    ("square", "বর্গ", "স্কয়ার"),
    ("triangle", "ত্রিভুজ", "ট্রায়াঙ্গল"),
    ("rectangle", "আয়তক্ষেত্র", "রেক্টাঙ্গল"),
]
V3 = [vocab("sh-" + w, w, bn, pr, 67, "shape", "shape-" + w) for (w, bn, pr) in SHAPES]
I3 = {v["id"]: v for v in V3}
shape_words = [s[0] for s in SHAPES]
match_rounds = []
for w in shape_words:
    opts_words = [w] + others(w, shape_words)
    random.shuffle(opts_words)
    match_rounds.append({
        "id": "m-" + w, "ask": "Find the " + w + ".", "askBn": w + " খুঁজে বের করো।",
        "options": [{"image": "shape-" + x} for x in opts_words],
        "answer": opts_words.index(w), "hint": "Read the word. Look at each shape.", "tests": "sh-" + w,
    })
quiz3 = [
    question("q1", "tap-picture", "What shape is this?", "এটি কোন আকার?", "triangle",
             others("triangle", shape_words), tests="sh-triangle", image="shape-triangle",
             explain="triangle = ত্রিভুজ"),
    question("q2", "listen-choose", "Listen. Which shape did you hear?", "শোনো। কোন আকারটি শুনলে?",
             "rectangle", others("rectangle", shape_words), tests="sh-rectangle", speak="rectangle"),
    question("q3", "tap-word", "Which shape is round?", "কোন আকারটি গোল?", "circle",
             ["square", "triangle"], tests="sh-circle", explain="A circle is round."),
    true_false("q4", "A triangle has three sides.", "ত্রিভুজের তিনটি বাহু থাকে।", True,
               "A triangle has three sides.", "sh-triangle"),
    question("q5", "tap-picture", "What shape is this?", "এটি কোন আকার?", "square",
             others("square", shape_words), tests="sh-square", image="shape-square",
             explain="square = বর্গ"),
]
lessons.append(lesson_frame(
    L3, 3, "Shapes and Sizes", "আকার ও মাপ", "category", [67, 68],
    "Name a circle, a square, a triangle and a rectangle.",
    "বৃত্ত, বর্গ, ত্রিভুজ আর আয়তক্ষেত্রের নাম বলা।", V3, [
        intro_step(L3, "Shapes", "আকার", "Look around the room. What shapes can you see?",
                   "ঘরের চারদিকে তাকাও। কী কী আকার দেখতে পাও?", "grand-clock"),
        vocab_step(L3, "words", [v["id"] for v in V3], "Look, listen and say", "দেখো, শোনো আর বলো", "C"),
        command_step(L3, "trace", "Trace the shapes in the air", "বাতাসে আকারগুলো আঁকো", [
            ("Trace a %s in the air." % w, "বাতাসে একটি %s আঁকো।" % bn, "shape-" + w)
            for (w, bn, _) in SHAPES], "C"),
        command_step(L3, "clock", "The grand clock", "বিশাল ঘড়ি", [
            ("Draw the grand clock and colour it.", "বিশাল ঘড়িটি এঁকে রং করো।", "grand-clock")], "B"),
        speak_step(L3, "speak", "Shapes in my classroom", "আমার শ্রেণিকক্ষের আকার",
                   "Say a shape you can see in your classroom.", "শ্রেণিকক্ষে দেখা একটি আকারের নাম বলো।",
                   "I see a rectangle.", "F"),
        game_step(L3, "game1", "picture-to-word", "What shape is it?", "এটি কোন আকার?",
                  picture_rounds(I3, [v["id"] for v in V3], "What shape is this?", "এটি কোন আকার?",
                                 shape_words, "Count the sides. Is it round?"), "E"),
        game_step(L3, "game2", "match-pairs", "Read and match", "পড়ো আর মেলাও", match_rounds, "E"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You know four shapes now!", "তুমি এখন চারটি আকার চেনো!"),
    ]))

# =========================================================================
# Lesson 4 - More about shapes (book page 69)
# =========================================================================
L4 = "u7l4"
# part id, word, Bangla, sound, the shape the rhyme says it is, example from the rhyme
PARTS = [
    ("face", "face", "মুখ", "ফেইস", "a circle", "My eyes are round and so is my face,"),
    ("body", "body", "শরীর", "বডি", "a square", "My body is square if you haven't noticed, in case."),
    ("arms", "arms", "বাহু", "আর্মস", "rectangles", "My arms are rectangles and so are my legs."),
    ("legs", "legs", "পা", "লেগস", "rectangles", "My arms are rectangles and so are my legs."),
    ("hands", "hands", "হাতের পাতা", "হ্যান্ডস", "circles", "My hands are circles and my feet are triangles, you see."),
    ("feet", "feet", "পায়ের পাতা", "ফিট", "triangles", "My hands are circles and my feet are triangles, you see."),
]
V4 = [vocab("part-" + i, w, bn, pr, 69, "body", "part-" + i, ex) for (i, w, bn, pr, sh, ex) in PARTS]
I4 = {v["id"]: v for v in V4}
part_words = [p[1] for p in PARTS]
SINGULAR = ["a circle", "a square", "a triangle", "a rectangle"]
PLURAL = ["circles", "squares", "triangles", "rectangles"]
shape_of_part = []
for (i, w, bn, pr, sh, ex) in PARTS:
    pool = SINGULAR if sh.startswith("a ") else PLURAL
    verb = "is" if sh.startswith("a ") else "are"
    shape_of_part.append(rnd("sp-" + i, "What shape %s Mr. Shape's %s?" % (verb, w),
                             "মিস্টার শেপের %s কোন আকারের?" % bn, sh, others(sh, pool), tests="part-" + i,
                             image="part-" + i, hint="Look at the coloured part.",))
MR = "mr-shape"
# Counted from the drawing, see the notes at the top of this file.
COUNTS = [("circles", 5), ("squares", 1), ("triangles", 3), ("rectangles", 4)]
count_rounds = []
for (name, n) in COUNTS:
    pool = [x for x in range(1, 7) if x != n]
    wrong = random.sample(pool, 2)
    count_rounds.append(rnd("n-" + name, "How many %s does Mr. Shape have?" % name,
                            "মিস্টার শেপের কয়টি %s আছে?" % {"circles": "বৃত্ত", "squares": "বর্গ",
                                                                "triangles": "ত্রিভুজ", "rectangles": "আয়তক্ষেত্র"}[name],
                            str(n), [str(w) for w in wrong], image=MR,
                            hint="Count them one by one. Look at the eyes and the nose too!"))
MRSHAPE = [
    "I am Mr. Shape, look at me.",
    "I have circles, squares, triangles and rectangles",
    "As many as there could be.",
    "My eyes are round and so is my face,",
    "My body is square if you haven't noticed, in case.",
    "My arms are rectangles and so are my legs.",
    "My hands are circles and my feet are triangles, you see.",
]
quiz4 = [
    question("q1", "tap-picture", "Which part is coloured?", "কোন অংশটি রং করা?", "arms",
             others("arms", part_words), tests="part-arms", image="part-arms", explain="arms = বাহু"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "feet", others("feet", part_words), tests="part-feet", speak="feet"),
    question("q3", "fill-blank", "My body is ___ .", "My body is ___ .", "square", ["round", "short"],
             tests="part-body", explain="My body is square."),
    true_false("q4", "Mr. Shape's feet are triangles.", "মিস্টার শেপের পা-এর পাতা ত্রিভুজ।", True,
               "The rhyme says: my feet are triangles.", "part-feet"),
    question("q5", "tap-word", "What shape are Mr. Shape's hands?", "মিস্টার শেপের হাতের পাতা কোন আকারের?",
             "circles", ["squares", "triangles"], tests="part-hands", explain="My hands are circles."),
]
lessons.append(lesson_frame(
    L4, 4, "More About Shapes", "আকার নিয়ে আরও", "rhyme", [69],
    "Say what shapes Mr. Shape is made of and count them.",
    "মিস্টার শেপ কোন কোন আকার দিয়ে তৈরি তা বলা ও গোনা।", V4, [
        intro_step(L4, "Meet Mr. Shape", "মিস্টার শেপের সঙ্গে দেখা", "Mr. Shape is made of shapes. Can you see them?",
                   "মিস্টার শেপ কয়েকটি আকার দিয়ে তৈরি। তুমি দেখতে পাও?", "mr-shape"),
        vocab_step(L4, "words1", ["part-face", "part-body", "part-arms"], "Mr. Shape's parts 1",
                   "মিস্টার শেপের অংশ ১", "A"),
        vocab_step(L4, "words2", ["part-legs", "part-hands", "part-feet"], "Mr. Shape's parts 2",
                   "মিস্টার শেপের অংশ ২", "A"),
        rhyme_step(L4, "rhyme", "Mr. Shape", "মিস্টার শেপ", [MRSHAPE], "A"),
        game_step(L4, "game1", "picture-to-word", "Which part?", "কোন অংশ?",
                  picture_rounds(I4, [p[0] and "part-" + p[0] for p in PARTS], "Which part is coloured?",
                                 "কোন অংশটি রং করা?", part_words, "Look at Mr. Shape."), "A"),
        game_step(L4, "game2", "choose-the-reply", "What shape is it?", "কোন আকার?", shape_of_part, "A"),
        game_step(L4, "game3", "count-objects", "Count the shapes", "আকারগুলো গোনো", count_rounds, "B"),
        command_step(L4, "colour", "Colour and make", "রং করো আর বানাও", [
            ("Colour Mr. Shape.", "মিস্টার শেপকে রং করো।", "mr-shape"),
            ("Make the grand clock with paper. Colour it and put it on the classroom wall.",
             "কাগজ দিয়ে বিশাল ঘড়ি বানাও। রং করে শ্রেণিকক্ষের দেয়ালে লাগাও।", "grand-clock"),
        ], "C"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You know Mr. Shape's shapes!", "তুমি মিস্টার শেপের আকারগুলো জানো!"),
    ]))

# =========================================================================
# Lesson 5 - Sizes (book pages 70-71)
# =========================================================================
L5 = "u7l5"
SIZES = [
    ("tall", "লম্বা", "টল", "a tall man", "man-tall"),
    ("short", "খাটো", "শর্ট", "a short man", "man-short"),
    ("big", "বড়", "বিগ", "a big pot", "pot-big"),
    ("small", "ছোট", "স্মল", "a small pot", "pot-small"),
    ("fat", "মোটা", "ফ্যাট", "a fat cow", "cow-fat"),
    ("thin", "রোগা", "থিন", "a thin cow", "cow-thin"),
]
EXAMPLES = {"tall": "a tall man", "short": "a short man", "big": "It's a big tree.",
            "small": "It's small.", "fat": "It's a fat cow.", "thin": "It's a thin cow."}
V5 = [vocab("sz-" + w, w, bn, pr, 70, "expression", "size-" + w, EXAMPLES[w])
      for (w, bn, pr, _, _) in SIZES]
I5 = {v["id"]: v for v in V5}
size_words = [s[0] for s in SIZES]
OPPOSITE = {"tall": "short", "short": "tall", "big": "small", "small": "big", "fat": "thin", "thin": "fat"}
# Activity C: listen and circle the picture — each has two pictures to pick from.
listen5 = []
for (w, bn, pr, phrase, img) in SIZES:
    other = next(s for s in SIZES if s[0] == OPPOSITE[w])
    two = [(phrase, img), (other[3], other[4])]
    random.shuffle(two)
    listen5.append({
        "id": "l-" + w, "ask": "Listen. Circle the picture.", "askBn": "শোনো। ছবিটি বেছে নাও।",
        "speak": phrase,
        "options": [{"label": p, "image": im} for (p, im) in two],
        "answer": [p for (p, _) in two].index(phrase),
        "hint": "Listen again. Which one is it?", "tests": "sz-" + w,
    })
opposite5 = []
for (w, bn, pr, phrase, img) in SIZES:
    if w in ("tall", "big", "fat"):
        pic = "size-" + w
        opposite5.append(rnd("o-" + w, "What is it like?", "এটি কেমন?", w, [OPPOSITE[w]],
                             tests="sz-" + w, image=pic, hint="Look at the picture."))
for w in ("short", "small", "thin"):
    opposite5.append(rnd("o-" + w, "What is it like?", "এটি কেমন?", w, [OPPOSITE[w]],
                         tests="sz-" + w, image="size-" + w, hint="Look at the picture."))
quiz5 = [
    question("q1", "tap-picture", "What is it like?", "এটি কেমন?", "big", ["small", "thin"],
             tests="sz-big", image="size-big", explain="An elephant is big."),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "thin", ["fat", "tall"], tests="sz-thin", speak="thin"),
    question("q3", "fill-blank", "It's a ___ cow.", "It's a ___ cow.", "fat", ["tall", "big"],
             tests="sz-fat", explain="The book says: It's a fat cow."),
    true_false("q4", "A short tree is tall.", "একটি খাটো গাছ লম্বা।", False, "A short tree is not tall.", "sz-short"),
    question("q5", "tap-word", "Which word is the opposite of big?", "big-এর উল্টো শব্দ কোনটি?", "small",
             ["fat", "tall"], tests="sz-small", explain="big ↔ small"),
]
lessons.append(lesson_frame(
    L5, 5, "Sizes", "আকারে বড়-ছোট", "category", [70, 71],
    "Say whether things are tall or short, big or small, fat or thin.",
    "কোনটি লম্বা না খাটো, বড় না ছোট, মোটা না রোগা তা বলা।", V5, [
        intro_step(L5, "Big and small", "বড় আর ছোট", "Some things are big. Some are small. Let's look!",
                   "কিছু জিনিস বড়। কিছু ছোট। চলো দেখি!", "size-big"),
        vocab_step(L5, "words1", ["sz-tall", "sz-short", "sz-big"], "Look, listen and say 1", "দেখো, শোনো আর বলো ১", "A"),
        vocab_step(L5, "words2", ["sz-small", "sz-fat", "sz-thin"], "Look, listen and say 2", "দেখো, শোনো আর বলো ২", "A"),
        speak_step(L5, "speak1", "Point and say", "দেখাও আর বলো", "Point to the elephant. Say: It's big.",
                   "হাতিটিকে দেখাও। বলো: It's big.", "It's big.", "B"),
        game_step(L5, "game1", "listen-and-choose", "Listen and circle", "শোনো আর বেছে নাও", listen5, "C"),
        dialogue_step(L5, "talk", "Talk about the picture", "ছবি নিয়ে কথা বলো", [
            ("Boy", "What is it?"),
            ("Girl", "Is it a cow?"),
            ("Boy", "Yes, it is! It's fat."),
            ("Girl", "Now, it's my turn. It's small."),
        ], "D"),
        speak_step(L5, "speak2", "Say it about a cow", "গরুটি নিয়ে বলো", "Look at the thin cow. Say: It's a thin cow.",
                   "রোগা গরুটি দেখো। বলো: It's a thin cow.", "It's a thin cow.", "D"),
        game_step(L5, "game2", "picture-to-word", "What is it like?", "এটি কেমন?", opposite5, "A"),
        quiz_step(L5, quiz5),
        done_step(L5, "Great job!", "দারুণ হয়েছে!", "You can say big, small, tall and short!",
                  "তুমি big, small, tall আর short বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 6 - Road signs (book pages 72-74)
# =========================================================================
L6 = "u7l6"
LIGHTS = [
    ("l-stop", "stop", "থামো", "স্টপ", "light-red", "I say stop, and stop right away."),
    ("l-wait", "wait", "অপেক্ষা করো", "ওয়েট", "light-yellow", "I mean wait, till the light is green."),
    ("l-go", "go", "যাও", "গো", "light-green", "I say go, go right away."),
]
SIGNS = [
    ("rs-signal", "Signal Ahead", "সামনে সিগন্যাল", "সিগন্যাল অ্যাহেড", "road-signal-ahead"),
    ("rs-horn", "No horn", "হর্ন বাজানো নিষেধ", "নো হর্ন", "road-no-horn"),
    ("rs-enter", "Do not enter", "প্রবেশ নিষেধ", "ডু নট এন্টার", "road-do-not-enter"),
    ("rs-school", "School ahead", "সামনে স্কুল", "স্কুল অ্যাহেড", "road-school-ahead"),
    ("rs-uturn", "U-Turn", "ইউ-টার্ন", "ইউ-টার্ন", "road-u-turn"),
    ("rs-nouturn", "No U-Turn", "ইউ-টার্ন নিষেধ", "নো ইউ-টার্ন", "road-no-u-turn"),
    ("rs-parking", "No parking", "পার্কিং নিষেধ", "নো পার্কিং", "road-no-parking"),
    ("rs-turn", "Turn right / Turn left", "ডানে ঘোরো / বাঁয়ে ঘোরো", "টার্ন রাইট / টার্ন লেফট", "road-turn"),
    ("rs-zebra", "Zebra crossing", "জেব্রা ক্রসিং", "জেব্রা ক্রসিং", "road-zebra-crossing"),
]
V6 = ([vocab(i, w, bn, pr, 73, "sign", img, ex) for (i, w, bn, pr, img, ex) in LIGHTS]
      + [vocab(i, w, bn, pr, 73, "sign", img) for (i, w, bn, pr, img) in SIGNS])
I6 = {v["id"]: v for v in V6}
sign_ids = [s[0] for s in SIGNS]
sign_words = [s[1] for s in SIGNS]
LIGHT_LABEL = {"stop": "red light", "wait": "yellow light", "go": "green light"}
LIGHT_IMG = {"red light": "light-red", "yellow light": "light-yellow", "green light": "light-green"}
light_rounds = []
for n, (i, w, bn, pr, img, ex) in enumerate(LIGHTS, start=1):
    right = LIGHT_LABEL[w]
    light_rounds.append(rnd("c%d" % n, "Which light tells a car to %s?" % w,
                            "কোন বাতি গাড়িকে %s বলে?" % bn.replace("করো", "করতে").replace("যাও", "যেতে").replace("থামো", "থামতে"),
                            right, others(right, list(LIGHT_IMG)), tests=i, images=LIGHT_IMG,
                            hint="Red, yellow, green: stop, wait, go."))
quiz6 = [
    question("q1", "tap-picture", "What does this sign say?", "এই চিহ্নে কী লেখা আছে?", "Do not enter",
             others("Do not enter", sign_words), tests="rs-enter", image="road-do-not-enter"),
    question("q2", "listen-choose", "Listen. Which sign did you hear?", "শোনো। কোন চিহ্নটি শুনলে?",
             "Zebra crossing", others("Zebra crossing", sign_words), tests="rs-zebra", speak="Zebra crossing"),
    question("q3", "fill-blank", "Red light says ___ .", "Red light says ___ .", "stop", ["go", "wait"],
             tests="l-stop", explain="Red light says stop."),
    true_false("q4", "Yellow light says go.", "হলুদ বাতি বলে go।", False,
               "Yellow light says wait. Green light says go.", "l-wait"),
    question("q5", "tap-word", "Which light tells a car to go?", "কোন বাতি গাড়িকে যেতে বলে?", "green light",
             ["red light", "yellow light"], tests="l-go", explain="Green light says go."),
]
RHYME6 = [
    ["Red light, red light,", "What do you say?", "I say stop, and stop right away."],
    ["Yellow light, yellow light,", "What do you mean?", "I mean wait, till the light is green."],
    ["Green light, green light,", "What do you say?", "I say go, go right away."],
]
lessons.append(lesson_frame(
    L6, 6, "Road Signs", "রাস্তার চিহ্ন", "category", [72, 73, 74],
    "Know what the traffic lights say and recognise nine road signs.",
    "ট্রাফিক বাতি কী বলে তা জানা আর নয়টি রাস্তার চিহ্ন চেনা।", V6, [
        intro_step(L6, "Traffic lights", "ট্রাফিক বাতি", "Traffic lights tell cars when to stop and go.",
                   "ট্রাফিক বাতি গাড়িকে কখন থামতে আর যেতে হবে বলে।", "traffic-light"),
        vocab_step(L6, "lights", ["l-stop", "l-wait", "l-go"], "What the lights say", "বাতিগুলো কী বলে", "B"),
        rhyme_step(L6, "rhyme", "Red light, red light", "লাল বাতি, লাল বাতি", RHYME6, "A"),
        speak_step(L6, "speak1", "Say what the light says", "বাতি কী বলে তা বলো",
                   "Say: Red light says stop.", "বলো: Red light says stop.", "Red light says stop.", "B"),
        game_step(L6, "game1", "choose-the-reply", "Which light?", "কোন বাতি?", light_rounds, "C"),
        vocab_step(L6, "signs1", sign_ids[:5], "Road signs 1", "রাস্তার চিহ্ন ১", "E"),
        vocab_step(L6, "signs2", sign_ids[5:], "Road signs 2", "রাস্তার চিহ্ন ২", "E"),
        game_step(L6, "game2", "picture-to-word", "Name the sign", "চিহ্নটির নাম বলো",
                  picture_rounds(I6, ["rs-signal", "rs-horn", "rs-enter", "rs-school", "rs-uturn", "rs-parking"],
                                 "What does this sign say?", "এই চিহ্নে কী লেখা আছে?", sign_words,
                                 "Look at the picture on the sign."), "E"),
        quiz_step(L6, quiz6),
        done_step(L6, "Well done!", "খুব ভালো!", "You know the road signs and the lights!",
                  "তুমি রাস্তার চিহ্ন আর বাতিগুলো চেনো!"),
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u7", "number": 7,
    "title": "Colours, Shapes and Signs",
    "titleBn": "রং, আকার ও চিহ্ন",
    "colour": "teal", "icon": "palette",
    "_source": "English for Today, Class Two (NCTB). Unit 7, book pages 63-74.",
    "_note": ("Colour sentences, both rhymes, the size words and the road-sign "
              "names are transcribed from the textbook. Bangla meanings are "
              "Pickixo's addition - the book carries no glosses. Drawing, "
              "project and word-match activities are pen-and-paper and are "
              "offered as 'listen and do' steps where they make sense."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit07.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

words = sum(len(l["vocabulary"]) for l in lessons)
print("unit07.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
