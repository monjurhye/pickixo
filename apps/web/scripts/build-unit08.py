# -*- coding: utf-8 -*-
"""Generate unit08.json — My Family, Friends and I (book pages 75-83).

Same approach as build-unit02..07.py: every quiz and game answer index is
*computed* from the correct option, never typed. Where the answer depends on a
rule (a / an before a word) the rule is applied by code to the book's own
sentences.

Textbook text (Mita's passage, her mother, her father and her brother Kamal,
the Family rhyme, the questions, the a/an and punctuation exercises) is
transcribed word for word. Bangla glosses and pronunciations are Pickixo's
addition and are marked as such.

Notes on reading the book:
  * The reading passages are read aloud with the same "read along" step used for
    rhymes, labelled as a text rather than a rhyme.
  * p.78 Activity C asks "What does she rides on?" — a typo in the book;
    the question here reads "What does she ride on?".
  * p.79 prints "He is a farmer, He has no land" with a comma where a full stop
    belongs; a full stop is used.
  * The picture questions (p.77 "How many people are there?" etc.) are about the
    book's own artwork, which is not reproduced, so they are not asked.
  * The blanks the book leaves for the child's own name, class, mother and
    father are answered aloud by the child; no answer is invented for them.
  * The last of Lesson 4's blanks ("He loves to play ......") has no single
    answer in the text, so only the first three are used.
  * Lesson 5's "How many family members?" counts the family words the rhyme
    names: mother, father, sister, brother, me, grandpa, grandma, uncle, aunt,
    cousins = 10. The "your mother's mother is your ..." rounds are Pickixo's
    teaching addition (the book only lists the words).

Run:  python scripts/build-unit08.py
"""
import json
import pathlib
import random

random.seed(8)   # stable output: regenerating must not reshuffle every quiz


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


def lesson_frame(lid, number, title, title_bn, shape, pages, objective,
                 objective_bn, vocabulary, steps, minutes=7):
    return {"id": lid, "unitId": "u8", "number": number, "title": title,
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
    """A short reading passage, read aloud sentence by sentence."""
    return {"id": sid(lid, name), "type": "rhyme", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn,
            "listenLabel": "Listen to the text", "verses": [sentences]}


def rhyme_step(lid, name, title, title_bn, verses, activity=None):
    return {"id": sid(lid, name), "type": "rhyme", "bookActivity": activity,
            "source": "textbook", "title": title, "titleBn": title_bn, "verses": verses}


def qa_rounds(prefix, items, hint):
    """(question, question-in-Bangla, right answer, [wrong answers], vocab id or None)."""
    out = []
    for n, (q, q_bn, right, wrongs, tests) in enumerate(items, start=1):
        out.append(rnd("%s%d" % (prefix, n), q, q_bn, right, wrongs, tests=tests, speak=q, hint=hint))
    return out


lessons = []

# =========================================================================
# Lesson 1 - Myself (book pages 75-76)
# =========================================================================
L1 = "u8l1"
V1 = [
    vocab("m-student", "student", "শিক্ষার্থী", "স্টুডেন্ট", 75, "person", "mita", "I am a student."),
    vocab("m-class", "class", "শ্রেণি", "ক্লাস", 75, "place", "classroom", "I am in class 2."),
    vocab("m-homework", "homework", "বাড়ির কাজ", "হোমওয়ার্ক", 75, "object", "read-book",
          "I do my homework in the evening."),
    vocab("m-draw", "draw pictures", "ছবি আঁকা", "ড্র পিকচার্স", 75, "action", "colouring",
          "I like to draw pictures and colour them."),
]
MYSELF = [
    "My name is Mita.", "I am seven years old.", "I am a student.", "I am in class 2.",
    "I go to school everyday.", "I do my homework in the evening.",
    "I like to draw pictures and colour them.", "I have a brother.", "I love to play with him.",
]
mita_qa = qa_rounds("e", [
    ("Who is Mita?", "মিতা কে?", "A student", ["A farmer", "A health worker"], "m-student"),
    ("How old is she?", "তার বয়স কত?", "Seven", ["Six", "Ten"], None),
    ("Which class is she in?", "সে কোন শ্রেণিতে পড়ে?", "Class 2", ["Class 5", "Class 3"], "m-class"),
    ("When does she do her homework?", "সে কখন বাড়ির কাজ করে?", "In the evening",
     ["In the morning", "At night"], "m-homework"),
    ("What does she like to do?", "সে কী করতে ভালোবাসে?", "Draw pictures and colour them",
     ["Play football", "Cook food"], "m-draw"),
], "Read the text about Mita again.")
quiz1 = [
    question("q1", "tap-picture", "Who is this?", "ইনি কে?", "Mita", ["Kamal", "Rima"],
             image="mita", explain="This is Mita."),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "homework", ["student", "class"], tests="m-homework", speak="homework"),
    question("q3", "fill-blank", "I am in ___ 2 .", "I am in ___ 2 .", "class", ["draw", "evening"],
             tests="m-class", explain="I am in class 2."),
    true_false("q4", "Mita is seven years old.", "মিতার বয়স সাত বছর।", True,
               "Mita says: I am seven years old.", None),
    question("q5", "tap-word", "Who does Mita love to play with?", "মিতা কার সঙ্গে খেলতে ভালোবাসে?",
             "Her brother", ["Her mother", "Her teacher"], explain="I have a brother. I love to play with him."),
]
lessons.append(lesson_frame(
    L1, 1, "Myself", "আমার কথা", "dialogue", [75, 76],
    "Say your name, age and class, and read about Mita.",
    "নিজের নাম, বয়স ও শ্রেণি বলা এবং মিতার কথা পড়া।", V1, [
        intro_step(L1, "Meet Mita", "মিতার সঙ্গে দেখা", "Mita tells us about herself. Let's listen!",
                   "মিতা নিজের কথা বলছে। চলো শুনি!", "mita"),
        vocab_step(L1, "words", [v["id"] for v in V1], "New words", "নতুন শব্দ", "C"),
        text_step(L1, "text", "Myself", "আমার কথা", MYSELF, "C"),
        speak_step(L1, "speak1", "Tell us about you", "নিজের কথা বলো",
                   "Say: Hello, I am ... I am 7 years old. I am a student. Who are you?",
                   "বলো: Hello, I am ... I am 7 years old. I am a student. Who are you?",
                   "Hello, I am ... I am 7 years old. I am a student. Who are you?", "B"),
        speak_step(L1, "speak2", "Your class", "তোমার শ্রেণি", "Which class are you in?",
                   "তুমি কোন শ্রেণিতে পড়ো?", "I am in class ...", "F"),
        game_step(L1, "game", "choose-the-reply", "Questions about Mita", "মিতাকে নিয়ে প্রশ্ন", mita_qa, "E"),
        quiz_step(L1, quiz1),
        done_step(L1, "Great job!", "দারুণ হয়েছে!", "You can tell about yourself!", "তুমি নিজের কথা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 2 - My mother (book pages 77-78)
# =========================================================================
L2 = "u8l2"
V2 = [
    vocab("mo-health", "health worker", "স্বাস্থ্যকর্মী", "হেলথ ওয়ার্কার", 77, "person", "health-worker",
          "She is a health worker."),
    vocab("mo-bike", "motorbike", "মোটরবাইক", "মোটরবাইক", 77, "vehicle", "motorbike", "She rides a motorbike."),
    vocab("mo-village", "village", "গ্রাম", "ভিলেজ", 77, "place", "village",
          "…the health of the women in the village."),
    vocab("mo-care", "takes care of", "যত্ন নেয়", "টেকস কেয়ার অভ", 77, "action", "care",
          "She takes care of our family."),
]
MOTHER = [
    "My mother's name is Rahela Khatun.", "She is a health worker.", "She rides a motorbike.",
    "She goes from one house to another to monitor the health of the women in the village.",
    "She takes care of our family.", "She is a very good person.", "I love my mother.",
]
mother_qa = qa_rounds("c", [
    ("Who is Mita's mother?", "মিতার মা কে?", "Rahela Khatun", ["Akbar Ali", "Mita"], None),
    ("What does she do?", "তিনি কী করেন?", "She is a health worker.",
     ["She is a farmer.", "She is a student."], "mo-health"),
    ("What does she ride on?", "তিনি কীসে চড়েন?", "A motorbike", ["A bicycle", "A bus"], "mo-bike"),
    ("What does she take care of?", "তিনি কার যত্ন নেন?", "Our family", ["Our school", "Our village"], "mo-care"),
], "Read the text about Mita's mother again.")
# Activity E: fill in the blanks. Each answer is a word or phrase from the text.
mother_fill = [
    rnd("f1", "Rahela Khatun is a ___ .", "Rahela Khatun is a ___ .", "health worker",
        ["farmer", "student"], tests="mo-health", hint="Look at the text."),
    rnd("f2", "She ___ a motorbike.", "She ___ a motorbike.", "rides", ["eats", "draws"],
        tests="mo-bike", hint="What does she do with a motorbike?"),
    rnd("f3", "She monitors the health of the ___ in the village.",
        "She monitors the health of the ___ in the village.", "women", ["cows", "boys"],
        tests="mo-village", hint="Read the fourth sentence."),
    rnd("f4", "Rahela Khatun takes care of her ___ .", "Rahela Khatun takes care of her ___ .",
        "family", ["school", "bike"], tests="mo-care", hint="Read the fifth sentence."),
]
quiz2 = [
    question("q1", "tap-picture", "What is this?", "এটি কী?", "motorbike", ["umbrella", "village"],
             tests="mo-bike", image="motorbike", explain="motorbike = মোটরবাইক"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "village", ["motorbike", "family"], tests="mo-village", speak="village"),
    question("q3", "fill-blank", "She is a health ___ .", "She is a health ___ .", "worker", ["farmer", "student"],
             tests="mo-health", explain="She is a health worker."),
    true_false("q4", "Mita's mother rides a bus.", "মিতার মা বাসে চড়েন।", False,
               "She rides a motorbike.", "mo-bike"),
    question("q5", "tap-word", "Mita says: She is a very good ___ .", "মিতা বলে: She is a very good ___ .",
             "person", ["motorbike", "village"], explain="She is a very good person."),
]
lessons.append(lesson_frame(
    L2, 2, "My Mother", "আমার মা", "story", [77, 78],
    "Read about Mita's mother and answer questions about her.",
    "মিতার মায়ের কথা পড়া আর তাঁকে নিয়ে প্রশ্নের উত্তর দেওয়া।", V2, [
        intro_step(L2, "Mita's mother", "মিতার মা", "Mita tells us about her mother. Let's listen!",
                   "মিতা তার মায়ের কথা বলছে। চলো শুনি!", "health-worker"),
        vocab_step(L2, "words", [v["id"] for v in V2], "New words", "নতুন শব্দ", "B"),
        text_step(L2, "text", "My mother", "আমার মা", MOTHER, "B"),
        game_step(L2, "game1", "choose-the-reply", "Questions about the text", "লেখাটি নিয়ে প্রশ্ন", mother_qa, "C"),
        speak_step(L2, "speak", "Your mother", "তোমার মা",
                   "What's your mother's name? What does she do?", "তোমার মায়ের নাম কী? তিনি কী করেন?",
                   "My mother's name is ... She is a ...", "D"),
        game_step(L2, "game2", "order-the-lines", "Fill in the blanks", "ফাঁকা জায়গা পূরণ করো", mother_fill, "E"),
        quiz_step(L2, quiz2),
        done_step(L2, "Well done!", "খুব ভালো!", "You can tell about your mother!", "তুমি তোমার মায়ের কথা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 3 - My father (book pages 79-80)
# =========================================================================
L3 = "u8l3"
V3 = [
    vocab("fa-farmer", "farmer", "কৃষক", "ফার্মার", 79, "person", "farmer", "He is a farmer."),
    vocab("fa-land", "land", "জমি", "ল্যান্ড", 79, "place", "field", "He has no land to cultivate."),
    vocab("fa-chores", "household chores", "ঘরের কাজ", "হাউসহোল্ড চোর্স", 79, "action", "cooking",
          "He helps my mother at household chores."),
    vocab("fa-look", "looks after", "দেখাশোনা করে", "লুকস আফটার", 79, "action", "care",
          "He looks after our animals too."),
]
FATHER = [
    "My father's name is Akbar Ali.", "He is a farmer.", "He has no land to cultivate.",
    "He works on others' land.", "He helps my mother at household chores.",
    "He takes care of all the family members.", "He looks after our animals too.",
]
father_qa = qa_rounds("c", [
    ("What's the name of Mita's father?", "মিতার বাবার নাম কী?", "Akbar Ali",
     ["Kamal", "Rahela Khatun"], None),
    ("What does he do?", "তিনি কী করেন?", "He is a farmer.", ["He is a student.", "He is a health worker."],
     "fa-farmer"),
    ("Where does he work?", "তিনি কোথায় কাজ করেন?", "On others' land", ["In a school", "In a shop"], "fa-land"),
    ("How does he help her mother?", "তিনি মিতার মাকে কীভাবে সাহায্য করেন?", "At household chores",
     ["By riding a motorbike", "By teaching Mita"], "fa-chores"),
], "Read the text about Mita's father again.")
quiz3 = [
    question("q1", "tap-picture", "Who is this?", "ইনি কে?", "a farmer", ["a student", "a health worker"],
             tests="fa-farmer", image="farmer", explain="farmer = কৃষক"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "land", ["farmer", "animals"], tests="fa-land", speak="land"),
    question("q3", "fill-blank", "He helps my mother at household ___ .", "He helps my mother at household ___ .",
             "chores", ["village", "umbrella"], tests="fa-chores", explain="He helps my mother at household chores."),
    true_false("q4", "Mita's father has no land to cultivate.", "মিতার বাবার চাষ করার মতো জমি নেই।", True,
               "The text says: He has no land to cultivate.", "fa-land"),
    question("q5", "tap-word", "What is Mita's father's name?", "মিতার বাবার নাম কী?", "Akbar Ali",
             ["Kamal", "Rahela Khatun"], explain="My father's name is Akbar Ali."),
]
lessons.append(lesson_frame(
    L3, 3, "My Father", "আমার বাবা", "story", [79, 80],
    "Read about Mita's father and answer questions about him.",
    "মিতার বাবার কথা পড়া আর তাঁকে নিয়ে প্রশ্নের উত্তর দেওয়া।", V3, [
        intro_step(L3, "Mita's father", "মিতার বাবা", "Mita tells us about her father. Let's listen!",
                   "মিতা তার বাবার কথা বলছে। চলো শুনি!", "farmer"),
        vocab_step(L3, "words", [v["id"] for v in V3], "New words", "নতুন শব্দ", "B"),
        text_step(L3, "text", "My Father", "আমার বাবা", FATHER, "B"),
        game_step(L3, "game", "choose-the-reply", "Questions about the text", "লেখাটি নিয়ে প্রশ্ন", father_qa, "C"),
        speak_step(L3, "speak1", "Your father", "তোমার বাবা",
                   "What's your father's name? What does he do?", "তোমার বাবার নাম কী? তিনি কী করেন?",
                   "My father's name is ... He is a ...", "D"),
        speak_step(L3, "speak2", "Helping the family", "পরিবারে সাহায্য",
                   "How does he help in the family?", "তিনি পরিবারে কীভাবে সাহায্য করেন?",
                   "He helps ...", "D"),
        quiz_step(L3, quiz3),
        done_step(L3, "Great job!", "দারুণ হয়েছে!", "You can tell about your father!", "তুমি তোমার বাবার কথা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 4 - My brother (book pages 81-82)
# =========================================================================
L4 = "u8l4"
V4 = [
    vocab("br-brother", "brother", "ভাই", "ব্রাদার", 81, "family", "fam-brother", "This is my brother Kamal."),
    vocab("br-parents", "parents", "মা-বাবা", "প্যারেন্টস", 81, "family", "fam-parents",
          "Our parents love us very much."),
    vocab("br-together", "together", "একসঙ্গে", "টুগেদার", 81, "expression", "two-children-waving",
          "We play together."),
    vocab("br-happy", "happy family", "সুখী পরিবার", "হ্যাপি ফ্যামিলি", 81, "expression", "happy-face",
          "We are a happy family."),
    vocab("br-umbrella", "umbrella", "ছাতা", "আম্ব্রেলা", 82, "object", "umbrella",
          "He needs an umbrella to go to work."),
]
BROTHER = [
    "This is my brother Kamal.", "He is ten years old.", "He is in class five.",
    "He helps me with my homework.", "He loves to play.", "We play together.",
    "My brother helps our parents.", "Our parents love us very much.", "We are a happy family.",
]
kamal_fill = [
    rnd("k1", "Kamal is ___ old.", "Kamal is ___ old.", "ten years", ["five years", "seven years"],
        hint="Read the second sentence."),
    rnd("k2", "He is in class ___ .", "He is in class ___ .", "five", ["two", "ten"], hint="Read the third sentence."),
    rnd("k3", "He helps Mita with her ___ .", "He helps Mita with her ___ .", "homework",
        ["umbrella", "village"], hint="Read the fourth sentence."),
]
# Activity F: a or an. The rule is applied by code: "an" before a vowel sound.
def a_or_an(word):
    return "an" if word[0].lower() in "aeiou" else "a"

AAN = [
    ("Mita is ___ girl.", "girl"), ("She has ___ brother.", "brother"),
    ("Mita eats ___ egg every morning.", "egg"), ("Their mother is ___ health worker.", "health"),
    ("Their father is ___ farmer.", "farmer"), ("He needs ___ umbrella to go to work.", "umbrella"),
]
aan_rounds = []
for n, (sentence, word) in enumerate(AAN, start=1):
    right = a_or_an(word)
    aan_rounds.append(rnd("a%d" % n, sentence, sentence, right, ["an" if right == "a" else "a"],
                          hint="Use an before a, e, i, o, u sounds." if right == "an" else "Use a before other sounds."))
# Activity G: punctuation. The mark at the end of each speech bubble in the picture.
PUNCT = [
    ("How many animals do you have ___", "?"),
    ("We have twenty six animals ___", "."),
    ("What domestic animals do you have ___", "?"),
    ("We have cows ___ ducks, chickens and goats.", ","),
]
MARKS = {",": ", (comma)", ".": ". (full stop)", "?": "? (question mark)"}
punct_rounds = []
for n, (sentence, mark) in enumerate(PUNCT, start=1):
    punct_rounds.append(rnd("g%d" % n, sentence, sentence, MARKS[mark],
                            [MARKS[m] for m in MARKS if m != mark],
                            hint="A question ends with ?. A telling sentence ends with a full stop."))
quiz4 = [
    question("q1", "tap-picture", "Who is this?", "ইনি কে?", "Kamal", ["Mita", "Akbar Ali"],
             image="kamal", explain="This is Mita's brother Kamal."),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "parents", ["brother", "together"], tests="br-parents", speak="parents"),
    question("q3", "fill-blank", "Mita eats ___ egg every morning.", "Mita eats ___ egg every morning.",
             "an", ["a", "many"], explain="We say an egg."),
    true_false("q4", "Kamal is ten years old.", "কামালের বয়স দশ বছর।", True, "The text says: He is ten years old.", None),
    question("q5", "tap-word", "What does Kamal love to do?", "কামাল কী করতে ভালোবাসে?", "Play",
             ["Sleep", "Cook"], explain="He loves to play."),
]
lessons.append(lesson_frame(
    L4, 4, "My Brother", "আমার ভাই", "story", [81, 82],
    "Read about Kamal, and use a / an and punctuation correctly.",
    "কামালের কথা পড়া আর a / an ও যতিচিহ্ন ঠিকভাবে ব্যবহার করা।", V4, [
        intro_step(L4, "Mita's brother", "মিতার ভাই", "Mita tells us about her brother Kamal.",
                   "মিতা তার ভাই কামালের কথা বলছে।", "kamal"),
        vocab_step(L4, "words", [v["id"] for v in V4], "New words", "নতুন শব্দ", "B"),
        text_step(L4, "text", "My brother", "আমার ভাই", BROTHER, "B"),
        game_step(L4, "game1", "order-the-lines", "Fill in the blanks", "ফাঁকা জায়গা পূরণ করো", kamal_fill, "C"),
        speak_step(L4, "speak1", "Your brothers and sisters", "তোমার ভাইবোন",
                   "How many brothers and sisters do you have?", "তোমার কয়জন ভাইবোন?",
                   "I have ... brothers and ... sisters.", "D"),
        speak_step(L4, "speak2", "Who helps you?", "কে তোমাকে সাহায্য করে?",
                   "Who helps you with your homework?", "বাড়ির কাজে কে তোমাকে সাহায্য করে?",
                   "My ... helps me.", "D"),
        game_step(L4, "game2", "order-the-lines", "a or an?", "a না an?", aan_rounds, "F"),
        game_step(L4, "game3", "order-the-lines", "Which mark?", "কোন চিহ্ন?", punct_rounds, "G"),
        quiz_step(L4, quiz4),
        done_step(L4, "Well done!", "খুব ভালো!", "You can tell about your brother!", "তুমি তোমার ভাইয়ের কথা বলতে পারো!"),
    ]))

# =========================================================================
# Lesson 5 - A rhyme: Family (book page 83)
# =========================================================================
L5 = "u8l5"
FAMILY = [
    ("f-mother", "mother", "মা", "মাদার", "fam-mother"),
    ("f-father", "father", "বাবা", "ফাদার", "fam-father"),
    ("f-sister", "sister", "বোন", "সিস্টার", "fam-sister"),
    ("f-brother", "brother", "ভাই", "ব্রাদার", "fam-brother"),
    ("f-me", "me", "আমি", "মি", "fam-me"),
    ("f-grandpa", "grandpa", "দাদা / নানা", "গ্র্যান্ডপা", "fam-grandpa"),
    ("f-grandma", "grandma", "দাদি / নানি", "গ্র্যান্ডমা", "fam-grandma"),
    ("f-uncle", "uncle", "চাচা / মামা", "আঙ্কল", "fam-uncle"),
    ("f-aunt", "aunt", "চাচি / খালা / ফুফু", "আন্ট", "fam-aunt"),
    ("f-cousins", "cousins", "চাচাতো / মামাতো ভাইবোন", "কাজিনস", "fam-cousins"),
]
V5 = [vocab(i, w, bn, pr, 83, "family", img,
            "Mother, father, sister, brother and me." if k < 5
            else "Grandpa, grandma, uncle, aunt and cousins too")
      for k, (i, w, bn, pr, img) in enumerate(FAMILY)]
I5 = {v["id"]: v for v in V5}
fam_words = [f[1] for f in FAMILY]
RHYME5 = [
    ["Come with me, and meet my family", "Mother, father, sister, brother and me."],
    ["There are some more members I tell you", "Grandpa, grandma, uncle, aunt and cousins too"],
    ["We spend time together", "And help one another."],
    ["I love them, and they love me", "We are all a happy family."],
]
count5 = [
    rnd("n1", "Mother, father, sister, brother and me. How many?", "মা, বাবা, বোন, ভাই আর আমি। কয়জন?", "5",
        ["4", "6"], image="family-tree", hint="Count the words in the second line."),
    rnd("n2", "Grandpa, grandma, uncle, aunt and cousins. How many?", "দাদা, দাদি, চাচা, চাচি আর কাজিনরা। কয়টি নাম?",
        "5", ["4", "6"], image="family-tree", hint="Count the words in the fourth line."),
    rnd("n3", "How many family members does the rhyme name in all?", "ছড়ায় সব মিলিয়ে কয়জন সদস্যের নাম আছে?",
        "10", ["8", "12"], image="family-tree", hint="Add the two lines together: 5 and 5."),
]
KIN = [
    ("Your mother's mother is your ___ .", "grandma", "f-grandma"),
    ("Your father's brother is your ___ .", "uncle", "f-uncle"),
    ("Your father's sister is your ___ .", "aunt", "f-aunt"),
    ("Your uncle's children are your ___ .", "cousins", "f-cousins"),
]
kin_rounds = [rnd("k%d" % n, q, q, w, others(w, fam_words), tests=t, hint="Think of the family tree.")
              for n, (q, w, t) in enumerate(KIN, start=1)]
quiz5 = [
    question("q1", "tap-picture", "Who is this?", "ইনি কে?", "grandpa", others("grandpa", fam_words),
             tests="f-grandpa", image="fam-grandpa", explain="grandpa = দাদা / নানা"),
    question("q2", "listen-choose", "Listen. Which word did you hear?", "শোনো। কোন শব্দটি শুনলে?",
             "cousins", others("cousins", fam_words), tests="f-cousins", speak="cousins"),
    question("q3", "fill-blank", "We are all a happy ___ .", "We are all a happy ___ .", "family",
             ["mother", "cousins"], explain="We are all a happy family."),
    true_false("q4", "In the rhyme, they help one another.", "ছড়ায় তারা একে অপরকে সাহায্য করে।", True,
               "The rhyme says: And help one another.", None),
    question("q5", "tap-picture", "Who is this?", "ইনি কে?", "aunt", others("aunt", fam_words),
             tests="f-aunt", image="fam-aunt", explain="aunt = চাচি / খালা / ফুফু"),
]
lessons.append(lesson_frame(
    L5, 5, "A Rhyme: Family", "একটি ছড়া: পরিবার", "rhyme", [83],
    "Name the members of a family and recite the family rhyme.",
    "পরিবারের সদস্যদের নাম বলা আর পরিবারের ছড়া আবৃত্তি করা।", V5, [
        intro_step(L5, "My family", "আমার পরিবার", "Come with me, and meet my family!",
                   "এসো আমার সঙ্গে, আমার পরিবারের সঙ্গে দেখা করো!", "family-tree"),
        vocab_step(L5, "words1", [f[0] for f in FAMILY[:5]], "My family 1", "আমার পরিবার ১", "A"),
        vocab_step(L5, "words2", [f[0] for f in FAMILY[5:]], "My family 2", "আমার পরিবার ২", "A"),
        rhyme_step(L5, "rhyme", "Family", "পরিবার", RHYME5, "A"),
        speak_step(L5, "speak", "Say the family words", "পরিবারের শব্দগুলো বলো",
                   "Say: Mother, father, sister, brother and me.", "বলো: Mother, father, sister, brother and me.",
                   "Mother, father, sister, brother and me.", "C"),
        game_step(L5, "game1", "picture-to-word", "Who is it?", "ইনি কে?", [
            rnd("w-" + i, "Who is this?", "ইনি কে?", I5[i]["word"], others(I5[i]["word"], fam_words),
                tests=i, image=I5[i]["image"], hint="Look at the picture.")
            for i in ["f-mother", "f-father", "f-grandpa", "f-grandma", "f-uncle", "f-aunt"]
        ], "A"),
        game_step(L5, "game2", "count-objects", "How many members?", "কয়জন সদস্য?", count5, "B"),
        game_step(L5, "game3", "choose-the-reply", "Who is who?", "কে কে?", kin_rounds, "A"),
        quiz_step(L5, quiz5),
        done_step(L5, "Great job!", "দারুণ হয়েছে!", "You can name everyone in a family!",
                  "তুমি পরিবারের সবার নাম বলতে পারো!"),
    ]))

# -------------------------------------------------------------------------
unit = {
    "id": "u8", "number": 8,
    "title": "My Family, friends and I",
    "titleBn": "আমার পরিবার, বন্ধু ও আমি",
    "colour": "rose", "icon": "family",
    "_source": "English for Today, Class Two (NCTB). Unit 8, book pages 75-83.",
    "_note": ("Mita's passage, her mother, father and brother, the Family rhyme "
              "and the exercises are transcribed from the textbook. Bangla "
              "meanings are Pickixo's addition - the book carries no glosses. "
              "The 'who is who' kinship rounds in Lesson 5 are Pickixo's "
              "teaching addition."),
    "lessons": lessons,
}


def clean(node):
    """Drop nulls the schema treats as absent, so the file stays readable."""
    if isinstance(node, dict):
        return {k: clean(v) for k, v in node.items() if v is not None}
    if isinstance(node, list):
        return [clean(v) for v in node]
    return node


out = pathlib.Path(__file__).resolve().parents[1] / "src/data/class2/english/unit08.json"
out.write_text(json.dumps(clean(unit), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

for sentence, word in AAN:
    print("%-45s -> %s" % (sentence, a_or_an(word)))
words = sum(len(l["vocabulary"]) for l in lessons)
print("unit08.json: " + str(len(lessons)) + " lessons, " + str(words) + " words")
