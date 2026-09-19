# Pickixo Kids — curriculum map and platform design

**পিকজিকো কিডস — শিশুদের খেলতে খেলতে নিজে নিজে শেখার প্ল্যাটফর্ম**

One platform. One child. One progress record. Difficulty adapts; the child
never picks an age.

---

## 0. Sources

Two primary sources, both read directly. Nothing below is filled in from
general knowledge — where the sources are silent, this document says so.

| # | Source | What it is | How it was read |
|---|---|---|---|
| **S1** | **আমার বই** — প্রাক-প্রাথমিক শিক্ষা, NCTB, 2018 printing (2014 academic year onward) | The pre-primary pupil's book. 165 PDF pages, **entirely scanned images** — 11 characters of extractable text in the whole file. | Rendered to PNG at 100 dpi and read page by page. |
| **S2** | **প্রাক-প্রাথমিক শিক্ষাক্রম ২০২২ (পরিমার্জিত ২০২৫)** — NCTB, "৪+ ও ৫+ বয়সি শিশুদের জন্য" | The official curriculum: learning areas, competencies, learning outcomes, teaching activities and assessment guidance. 78 pages, real text layer. | Text extracted and read. Downloaded from a Bangladesh government portal (DPE Rajbari). |

**S1 page offset: PDF page = book page + 7.** (Book page ১ is PDF 7; PDF 7 and
8 are a duplicated page, so everything from book page ২ onward is +7. Verified
at book 2→PDF 9, book 3→PDF 10, book 29→PDF 36.)

S1 is the content. S2 is the pedagogy and — critically — the **age split**.

### The single most important thing the sources say

S2 is not one curriculum with an age label on the cover. It is a table whose
columns are literally:

> | শিখনক্ষেত্র | ৪+ বয়সি শিশুর অর্জন উপযোগী যোগ্যতা | ৫+ বয়সি শিশুর অর্জন উপযোগী যোগ্যতা |

**The same learning areas, with a 4+ competency and a 5+ competency for each.**
NCTB has already designed exactly the "one platform, two levels" model this
brief asks for. Pickixo Kids does not have to invent a difficulty ladder — it
implements the one the curriculum already defines.

---

## A. Complete curriculum map

### A1. Learning areas (শিখনক্ষেত্র) — S2

Nine areas. Both age bands share all nine; only the competency differs.

| # | শিখনক্ষেত্র | In Pickixo |
|---|---|---|
| ১ | শারীরিক ও পেশির কার্যক্ষমতা | Fine-motor only (tracing, drag) — gross motor is off-screen, see §27 |
| ২ | সামাজিক ও আবেগিক | Story and picture contexts |
| ৩ | মূল্যবোধ ও নৈতিকতা | Story and picture contexts |
| ৪ | **ভাষা ও যোগাযোগ** | **বাংলা — subject 1** |
| ৫ | **গণিত ও যুক্তি** | **সংখ্যা ও আকৃতি — subject 2** |
| ৬ | সৃজনশীলতা ও নান্দনিকতা | রং করি / আঁকি activities |
| ৭ | পরিবেশ ও জলবায়ু | পরিবেশ — subject 3 |
| ৮ | বিজ্ঞান ও প্রযুক্তি | পরিবেশ — subject 3 |
| ৯ | শারীরিক-মানসিক স্বাস্থ্য ও সুরক্ষা | স্বাস্থ্য ও নিরাপত্তা |

Areas 1, 2, 3 and 9 are substantially about behaviour in a room with other
children. A screen can carry their *content* (a story about sharing; a road
sign) but cannot assess them, and Pickixo does not pretend to. They are
marked `assessable: false` and never gate progress.

### A2. Chapter map of আমার বই (S1)

From the সূচিপত্র on PDF 6 — authoritative. **11 chapters, book pages 1–158.**

| # | অধ্যায় | Book pages | PDF pages | Learning area |
|---|---|---|---|---|
| ১ | জাতীয় সংগীত | 1 | 7–8 | ২, ৩ |
| ২ | আমার ছবি | 2 | 9 | ২, ৬ |
| ৩ | চারু ও কারু | 3–14 | 10–21 | ৬, ১ |
| ৪ | ছবি পড়া | 15–24 | 22–31 | ৪ |
| ৫ | মিল-অমিলের খেলা | 25–28 | 32–35 | ৫ |
| ৬ | **বর্ণমালা পরিচিতি : স্বরবর্ণ** | 29–39 | 36–46 | ৪ |
| ৭ | **বর্ণমালা পরিচিতি : ব্যঞ্জনবর্ণ** | 40–81 | 47–88 | ৪ |
| ৮ | পরিবেশ | 82–90 | 89–97 | ৭ |
| ৯ | প্রযুক্তি স্বাস্থ্য নিরাপত্তা | 91–95 | 98–102 | ৮, ৯ |
| ১০ | প্রাক-গাণিতিক ধারণা | 96–104 | 103–111 | ৫ |
| ১১ | **সংখ্যার ধারণা** | 105–158 | 112–165 | ৫ |

### A3. স্বরবর্ণ — 11 vowels, with the book's own picture-words

Book pages 30–39. Each letter is printed with **two** picture-words, except
where noted. The letter is shown in red inside the word.

| বর্ণ | শব্দ ১ | শব্দ ২ | Book page |
|---|---|---|---|
| অ | অজগর | অলঙ্কার | 30 |
| আ | আম | আনারস | 30 |
| ই | ইট | ইলিশ | 31 |
| ঈ | ঈগল | ঈদ | 31 |
| উ | উট | উড়োজাহাজ | 33 |
| ঊ | ঊর্মিমালা | — | 33 |
| ঋ | ঋতু | ঋতু | 34 |
| এ | একতারা | — | 35 |
| ঐ | ঐরাবত | — | 35 |
| ও | ওল | ওড়না | 36 |
| ঔ | ঔষধ | — | 36 |

Chart on book page 38, laid out 4 / 3 / 4. **Rhyme** on book page 39 —
স্বরবর্ণের ছড়া by **ইকবাল হোসেন**, six couplets covering all eleven vowels.

### A4. ব্যঞ্জনবর্ণ — 39 consonants, in eight বর্গ groups

Book pages 41–77. The book teaches them **five at a time**, then a chart page
("বর্ণ পড়ি"), then an exercise. That grouping is the natural lesson unit and
Pickixo keeps it.

| বর্গ | Letters | Words (as printed) | Book pages |
|---|---|---|---|
| ক-বর্গ | ক খ গ ঘ ঙ | কলম·কলা, খরগোশ·খাতা, গাছ·গাড়ি, ঘর·ঘড়ি, ব্যাঙ·ঝিঙা | 41–43 |
| চ-বর্গ | চ ছ জ ঝ ঞ | চড়ুই পাখি·চশমা, ছাগল·ছাতা, জাহাজ·জবা, ঝড়·ঝর্ণা, মিঞসাহেব·মিঞ | 45–47 |
| ট-বর্গ | ট ঠ ড ঢ ণ | টিয়া·টমেটো, ঠোঁট·ঠেলাগাড়ি, ডাব·ডিম, ঢোল·ঢাকনা, হরিণ·বীণা | 49–51 |
| ত-বর্গ | ত থ দ ধ ন | তবলা·তিমি, থালা·থলে, দোয়েল·দরজা, ধান·ধনুক, নদী·নৌকা | 53–54 |
| প-বর্গ | প ফ ব ভ ম | পাখি·পাতা, ফুল·ফড়িং, বানর·বক, ভালুক·ভেড়া, ময়ূর·মাছি | 56–58 |
| অন্তঃস্থ | য র ল শ | যব·যাঁতা, রাজহাঁস·রংধনু, লাটিম·লিচু, শাপলা·শসা | 60–61 |
| ঊষ্ম | ষ স হ ড় ঢ় | ষাঁড়·মহিষ, সিংহ·সাবান, হাঁস·হাতি, বিড়াল·ঘড়ি, আষাঢ় | 63–65 |
| বিশেষ | য় ৎ ং ঃ ঁ | ময়না·আয়না, মৎস্য·চিৎপটাং, শিং·আংটি, দুঃখী, চাঁদ·কাঁঠাল | 67–69 |

Chart on book page 71, eight rows. **Rhyme** on book pages 72–74 —
ব্যঞ্জনবর্ণের ছড়া by **খান আতাউর রহমান**.

**Pedagogically important, and taken straight from the book:** ঙ, ঞ, ণ, ড়, ঢ়,
য়, ৎ, ং, ঃ and ঁ are taught *inside* words (ব্যা**ঙ**, হরি**ণ**, চাঁ**দ**),
never word-initial, because Bangla does not start words with them. Pickixo's
"which letter does this start with?" game must therefore **exclude** these ten
letters, and use "find the letter in the word" instead. This is a real
correctness constraint, not a nicety.

### A5. শব্দ গঠন — word formation, from the book

Book pages 76–77. **The word-building activity this brief asks for is already
in the NCTB book**, with these exact words:

| Word | Built from | Book page |
|---|---|---|
| বল | ব + ল | 76 |
| বই | ব + ই | 76 |
| মই | ম + ই | 76 |
| ঘর | ঘ + র | 76 |
| বক | ব + ক | 76 |
| ফল | ফ + ল | 76 |
| জগ | জ + গ | 77 |
| খই | খ + ই | 77 |
| কলম | ক + ল + ম | 77 |
| কলস | ক + ল + স | 77 |

Eight two-letter words and two three-letter words. **These ten are the entire
textbook-sourced word-building set.** Anything else Pickixo offers is marked
`source: "pickixo"` and labelled সম্পূরক.

### A6. সংখ্যার ধারণা — numbers

- **০–২০.** Each number gets a "গণনা করি" page: objects to count, the numeral,
  a bead number-line, and a **সংখ্যা লেখার অনুশীলন** grid with dotted tracing
  guides. Tracing is in the book; Pickixo is not inventing it.
- ১–১০ on book pages 109–123, ১১–২০ on 132–141, ০ introduced at book 128.
- Number rhyme, book page 106 — এক এর পরে দুই…
- Then: ছোট বড় সংখ্যার ধারণা (ordering, book 148), **যোগ করি**, **বিয়োগ করি**
  (book 153–158, ending "সমাপ্ত").

### A7. Everything else, by chapter

- **চারু ও কারু** (3–14): রং করি — ছাতা, কচু পাতা, জাতীয় পতাকা, শহিদ মিনার.
- **ছবি পড়া** (15–24): picture sets to talk about, and **ছবিতে গল্প : হাঁস ও
  মুরগি** (book 20) — a numbered-panel picture story. This is the Story Mode source.
- **মিল-অমিলের খেলা** (25–28): কোনটি আলাদা (odd one out, book 26) and
  ছবি দুটির মধ্যে অমিল (spot the difference, book 27).
- **পরিবেশ** (82–90): গ্রাম ও শহর; পাহাড় নদী বন ফসলের মাঠ সাগর; সকাল দুপুর
  বিকাল সন্ধ্যা; ছয় ঋতু; ভূমিকম্প, ঝড়, বন্যা.
- **প্রযুক্তি স্বাস্থ্য নিরাপত্তা** (91–95): প্রচলিত প্রযুক্তি; তথ্য ও যোগাযোগ
  প্রযুক্তি; দাঁত মাজা; রাস্তায় সংকেত (7 road signs).
- **প্রাক-গাণিতিক ধারণা** (96–104): ছোট-বড়, মোটা-চিকন, লম্বা-খাটো, আকৃতি.

---

## B. Chapter → lesson structure

The book's own rhythm, kept intact:

```
পড়ি (2 letters/page, 2 picture-words each)   ×  2–3 pages
   ↓
বর্ণ পড়ি  (the group's chart)
   ↓
অনুশীলন  (1–2 exercise pages)
```

So **one বর্গ = one Pickixo lesson**. That gives:

| Subject | Units | Lessons |
|---|---|---|
| বাংলা | স্বরবর্ণ (3 lessons), ব্যঞ্জনবর্ণ (8 lessons), শব্দ গঠন (2 lessons) | 13 |
| সংখ্যা | ০–৫, ৬–১০, ১১–১৫, ১৬–২০, তুলনা, যোগ, বিয়োগ | 7 |
| প্রাক-গণিত | ছোট-বড়, মোটা-চিকন, লম্বা-খাটো, আকৃতি, মিল-অমিল | 5 |
| পরিবেশ | গ্রাম ও শহর, সময়, ঋতু, দুর্যোগ, প্রযুক্তি, স্বাস্থ্য ও নিরাপত্তা | 6 |
| ছবি ও গল্প | ছবি পড়া, হাঁস ও মুরগি, ছড়া (3) | 5 |

**36 lessons**, all traceable to book pages.

---

## C. Learning objectives

Taken verbatim from S2's শিখনফল, which is what makes them curriculum
objectives rather than Pickixo's opinion. The 4+ / 5+ split is S2's own.

### ভাষা ও যোগাযোগ (৪.১)

| 4+ child | 5+ child |
|---|---|
| ৪.১.১ অঙ্গভঙ্গি/বলার মাধ্যমে ভাব প্রকাশ | ৪.১.১ same |
| ৪.১.২ পরিচিত চিহ্ন, সংকেত, ছবি দেখে **শনাক্ত** | ৪.১.২ চিহ্ন ও সংকেত দেখে **অনুসরণ** |
| ৪.১.৩ ছবি দেখে নিজের মতো করে বলা | ৪.১.৩ নির্দেশনা শুনে অনুসরণ |
| ৪.১.৪ সহজ নির্দেশনা অনুসরণ | **৪.১.৪ ধ্বনির লিখিত রূপ/প্রতীক (বর্ণ) শনাক্ত** |
| ৪.১.৫ ছোট ও সহজ বাক্য শুনে বলা | **৪.১.৫ দুই বা তিন বর্ণের ছোট শব্দ শুনে বলা** |
| ৪.১.৬ **আঁকিবুকি** করা | **৪.১.৬ শব্দ থেকে বর্ণ শনাক্ত** |
| ৪.১.৭ ছবি ও প্যাটার্ন আঁকা | ৪.১.৭ ছবি দেখে সহজ বাক্যে বর্ণনা |
| | ৪.১.৮ সহজ বাক্য শুনে বলা |
| | ৪.১.৯ ছবি আঁকা ও রং করা |
| | ৪.১.১০ প্যাটার্ন/আকৃতি আঁকা |
| | **৪.১.১১ বর্ণাংশ ও বর্ণ লিখতে পারা** |
| | ৪.১.১২ নিজের নাম অনুলিপি করা |

> ### ⚠️ This changes the brief, and it is the one place I am pushing back
>
> **In the official curriculum a 4+ child does not learn letters.** There is no
> বর্ণ outcome anywhere in the 4+ column. A 4+ child does pictures, signs,
> listening, speaking, scribbling and patterns. Letters begin at 5+ (৪.১.৪).
>
> The brief's §5 example asks a 4+ child "কোনটি ক?". Followed literally, that
> teaches a four-year-old something NCTB deliberately withholds for a year, and
> the source-first rule in §2 forbids it.
>
> **What I built instead, which I think gives you what you actually wanted:**
> the beginner path is picture-, sound- and pattern-first exactly as §5
> describes — it simply isn't *about letters yet*. A child who is ready moves up
> and meets ক naturally, in the same session, with no age gate. That is §36's
> diagram, and it is also NCTB's. Nothing is lost; the beginner path just now
> has curriculum backing for what it does.

### গণিত ও যুক্তি (৫)

| 4+ child | 5+ child |
|---|---|
| ৫.১.১ আকার ও আয়তনে তুলনা | ৫.১.১ আকার, আয়তন **ও ওজনে** তুলনা |
| ৫.১.২ অবস্থানগত স্থিতি তুলনা | ৫.১.২ অবস্থান চিহ্নিত |
| ৫.১.৩ উপকরণ **গণনা** | ৫.১.৩ আকৃতি শনাক্ত |
| ৫.১.৪ আকৃতির বস্তু শনাক্ত | ৫.১.৪ আকৃতি অনুযায়ী শ্রেণিকরণ |
| ৫.১.৫ রং/আকৃতি অনুযায়ী সাজানো | ৫.১.৫ পরিমাপ অনুমান |
| ৫.১.৬ অনুমানপূর্বক পরিমাপ | ৫.১.৬ নকশা/প্যাটার্ন তৈরি |
| ৫.১.৭ সহজ প্যাটার্ন তৈরি | **৫.২.১–১০ — the whole number strand** |

5+ only, and this is the entire number chapter of আমার বই:
৫.২.১ গণনা ১–২০ · ৫.২.২ সংখ্যা প্রতীক শনাক্ত · ৫.২.৩ উপকরণের সঙ্গে প্রতীক
মিলানো · ৫.২.৪–৫ শূন্য · ৫.২.৬ ১–২০ মিলানো · **৫.২.৭ ১–২০ লিখতে পারা** ·
৫.২.৮ কম-বেশি · ৫.২.৯ যোগ · ৫.২.১০ বিয়োগ.

**A 4+ child counts. A 5+ child counts, writes numerals, and adds.**

---

## D. The 4+ → 5+ adaptive strategy

### D1. The difficulty axis is NCTB's, not mine

One phrase recurs through S2's outcomes:

> বাস্তব ও **অর্ধবাস্তব** উপকরণ … ও **সংখ্যা প্রতীক** ব্যবহার করে

**বাস্তব → অর্ধবাস্তব → প্রতীক** (concrete → pictorial → symbolic). The book
teaches subtraction on book page 153 in exactly these three steps on one page:
breaking glasses, then apples with dots under them, then bare numerals.

That is the difficulty ladder. The four Pickixo levels are that ladder:

| Level | Child sees | Representation | Curriculum band |
|---|---|---|---|
| **A — Explore** | চলো দেখি | ছবি only. Tap, listen, no reading. | 4+ |
| **B — Learn** | চলো শিখি | ছবি + প্রতীক together | 4+ → 5+ |
| **C — Practice** | চলো খেলি | প্রতীক, picture as a hint on request | 5+ |
| **D — Master** | আমি পারি | প্রতীক only, mixed, from memory | 5+ |

Level names are never shown. The child sees the four Bangla phrases above.

### D2. What the engine watches

Per item (a letter, a word, a number), per attempt:

| Signal | Used for |
|---|---|
| correct / incorrect | mastery step |
| response time vs. the item's expected time | confidence, not scoring |
| hint used, audio replayed | confidence down, never marked wrong |
| repeated confusion with a *specific* other item | targeted ক-vs-খ revision |
| tracing path coverage | a separate, much looser threshold (§9) |
| attempts since last correct | whether to drop a level |

### D3. The rules

```
promote   after 4 correct in a row at the current level,
          median response time under the expected time,
          and no hint on the last 2

demote    after 2 wrong in a row, or 3 wrong of the last 5
          — silently, mid-session, with no message about it

hold      otherwise
```

Demotion is **per item**, not per child. A child can be at Master on ক and
Explore on ঞ at the same moment, which is how real children actually are. The
"child's level" shown to a parent is just the median across active items.

**Never punish.** A wrong answer produces `আবার চেষ্টা করি ❤️`, the same
friendly voice, and the next attempt is made easier — that is the entire
consequence. There is no score, no red, no X, no sound of failure.

### D4. First session, no age asked (§30, §31)

The first lesson is fixed and deliberately easy: three picture-tap rounds at
Level A drawn from ছবি পড়া (book 16). It is a warm start, not a test — but the
engine watches it, and by round four it has a starting level. Cold start is
Level A for everyone; a ready child is at Level C within two minutes and
nobody was asked how old they are.

---

## E. Activity types

Every one of these is a page in আমার বই. The `source` column is the §2 rule
made mechanical.

| Activity | NCTB instruction | Book page | source |
|---|---|---|---|
| শুনি ও দেখি | পড়ি | 30–77 | textbook |
| বর্ণ চিনি | বর্ণ পড়ি | 38, 43, 71 | textbook |
| শব্দে বর্ণ খুঁজি | নিচের শব্দগুলো থেকে ঙ খুঁজে বের করি | 44 | textbook |
| বর্ণ ও শব্দ মিলাই | শব্দের সাথে বর্ণ দাগ টেনে মিলাই | 32 | textbook |
| একই বর্ণে শুরু | একই বর্ণ দিয়ে শুরু হয়েছে এমন শব্দ মিলাই | 44 | textbook |
| গোল দাগ দিই | পাশের বর্ণ দিয়ে যে যে শব্দ শুরু হয়েছে | 55 | textbook |
| হারানো বর্ণ | হারিয়ে যাওয়া বর্ণগুলো লিখি | 34, 59, 66, 75 | textbook |
| পরের বর্ণ | খালি ঘরে পরের বর্ণটি লিখি | 52 | textbook |
| সাজিয়ে লিখি | বর্ণগুলো সাজিয়ে লিখি | 48 | textbook |
| শব্দ বানাই | শব্দ গঠন | 76–77 | textbook |
| ছবি ও শব্দ মিলাই | দাগ টেনে ছবির সাথে শব্দ মিলাই | 78 | textbook |
| ট্রেস করি | সংখ্যা লেখার অনুশীলন | 109–141 | textbook |
| গণনা করি | গণনা করি | 109–141 | textbook |
| সমান সংখ্যা | সমান সংখ্যক ছবি মিল করি | 107–108 | textbook |
| গোল ভরাট | বাম পাশের সংখ্যা অনুযায়ী গোল ভরাট করি | 128 | textbook |
| ছোট থেকে বড় | ছোট বড় সংখ্যার ধারণা | 148 | textbook |
| যোগ ও বিয়োগ | যোগ করি / বিয়োগ করি | 153–158 | textbook |
| কোনটি আলাদা | কোনটি আলাদা খুঁজে বের করি | 26 | textbook |
| অমিল খুঁজি | ছবি দুটির মধ্যে অমিল | 27 | textbook |
| রং করি | রং করি | 7–8, 98–102 | textbook |
| ছড়া | স্বরবর্ণের/ব্যঞ্জনবর্ণের/সংখ্যার ছড়া | 39, 72–74, 106 | textbook |
| গল্প | ছবিতে গল্প : হাঁস ও মুরগি | 20 | textbook |
| **বলি** | — | — | **pickixo** |
| **স্মৃতির খেলা** | — | — | **pickixo** |
| **ধ্বনি মেলাই** | — | — | **pickixo** |

Only three of 25 are Pickixo's own, and each is labelled **সম্পূরক** in the UI
and in the data. Speaking is an addition because a book cannot listen; memory
and sound-matching are additions because they rehearse book content in a form
paper cannot hold.

---

## F. Game types

The 18 in the brief, mapped onto the activities above. Each is one reusable
component driven by JSON — no game is hard-coded to a letter. **All 18 are
implemented**, and `content.test.mjs` fails the build if a lesson lists a game
that cannot actually be built from that lesson's own items.

Four of them run for several taps rather than one, so they live in
`components/kids/games.tsx` with their own small piece of state: memory,
matching, sorting and spot-the-difference. Every step inside them is recorded
as a real answer about a real item, which is what lets a memory game move a
letter's mastery and what makes the "≥2 activity kinds" rule in §J mean
something.

Two notes on how they are built, both deliberate:

- **Nothing drags.** Game 5 is "Drag and Drop" in the brief, and it is
  implemented as tap-then-tap. Dragging is hard for four-year-old fingers on a
  phone and impossible with a screen reader, while tapping is the gesture the
  rest of the app already uses — and the book's own instruction is
  *দাগ টেনে মিলাই*, joining two things, which is exactly what tapping a pair does.
- **Sorting and odd-one-out only appear where they have an answer.** Sorting
  words by their first letter, and "which one does not start with ক", are both
  meaningless for ঙ ঞ ণ ড় ঢ় য় ৎ ং ঃ ঁ. The ladder for those groups omits
  them and the generators refuse them, so the question never reaches a child.

| # | Game | Engine kind | Level | Source |
|---|---|---|---|---|
| 1 | Find the Letter | `find-letter` | B–D | book 44 |
| 2 | Match Picture + Letter | `match-picture-letter` | A–B | book 32 |
| 3 | Match Picture + Word | `match-picture-word` | C | book 78 |
| 4 | Listen and Choose | `listen-choose` | A–D | pickixo |
| 5 | Drag and Drop | `drag-drop` | B–D | book 32 |
| 6 | Memory Cards | `memory` | B–C | pickixo |
| 7 | Missing Letter | `missing-letter` | C–D | book 34 |
| 8 | Build the Word | `build-word` | C–D | book 76 |
| 9 | Trace the Letter | `trace` | B–D | book 109 |
| 10 | Sort the Objects | `sort` | A–B | book 104 |
| 11 | Odd One Out | `odd-one-out` | A–C | book 26 |
| 12 | Tap the Correct Answer | `tap-answer` | A–D | book 55 |
| 13 | Sequence Game | `sequence` | C–D | book 48, 52 |
| 14 | Listen and Repeat | `listen-repeat` | A–D | pickixo |
| 15 | Picture Quiz | `picture-quiz` | A–C | book 16 |
| 16 | Sound Matching | `sound-match` | B–D | pickixo |
| 17 | Counting Game | `count` | A–D | book 109 |
| 18 | Simple Puzzle | `spot-difference` | A–B | book 27 |

Rules for all 18: playable without reading; no time limit; no lives; no
failure state; every instruction has audio; a wrong tap animates gently and
stays on the same round.

---

## G. Data schema

Content is data, never markup (§22). Three layers.

### G1. Curriculum (static JSON, ships with the app)

```jsonc
{
  "id": "bn-consonants-ka",
  "subject": "bangla",
  "unit": "banjonborno",
  "number": 2,
  "title": "ক খ গ ঘ ঙ",
  "source": {                      // §23 — every lesson is provable
    "book": "আমার বই — প্রাক-প্রাথমিক শিক্ষা (NCTB)",
    "edition": "2018",
    "bookPages": [41, 42, 43, 44],
    "pdfPages": [48, 49, 50, 51]
  },
  "objectives": [
    { "code": "৪.১.৪", "band": "5+", "text": "ধ্বনির লিখিত রূপ/প্রতীক (বর্ণ) শনাক্ত করতে পারবে।" }
  ],
  "items": [
    { "id": "ka", "glyph": "ক", "type": "consonant",
      "words": [
        { "text": "কলম", "image": "kolom", "initial": true,  "bookPage": 41 },
        { "text": "কলা", "image": "kola",  "initial": true,  "bookPage": 41 }
      ],
      "audio": null,               // null ⇒ speech synthesis, bn-BD
      "wordInitial": true,         // false for ঙ ঞ ণ ড় ঢ় য় ৎ ং ঃ ঁ
      "strokes": [ /* SVG path data for tracing */ ] }
  ],
  "activities": {                  // §22 — one lesson, four difficulties
    "explore":  ["listen-look", "picture-quiz"],
    "learn":    ["match-picture-letter", "find-letter", "trace"],
    "practice": ["missing-letter", "tap-answer", "build-word"],
    "master":   ["sequence", "sound-match", "build-word"]
  }
}
```

`source.bookPages` is **required and validated**. A lesson without it cannot
ship — that is what makes the claim "this is the NCTB curriculum" checkable.

### G2. Progress (localStorage first, syncs to account later)

```ts
type Level   = 'explore' | 'learn' | 'practice' | 'master';
type Mastery = 'not_started' | 'introduced' | 'learning'
             | 'practicing'  | 'confident'  | 'mastered';   // §19, six states

interface ItemProgress {
  id: string;
  mastery: Mastery;
  level: Level;                 // where this item sits right now
  correct: number; wrong: number;
  streak: number;               // consecutive correct at current level
  medianMs: number;
  confusedWith: Record<string, number>;   // ক → { খ: 3 }  drives §18
  lastSeen: string;             // ISO
  dueAt: string | null;         // spaced revision
}
```

Six mastery states, not four, exactly as §19 asks. Movement is one step at a
time in either direction, and `mastered` needs two confident sessions **on
different days** — a child who happens to have a good five minutes has not
mastered anything yet.

### G3. Database (for the parent account)

Progress works fully signed-out. Signing in adds sync only.

```sql
kids_child      (id, account_id, display_name, avatar, created_at)
kids_progress   (child_id, item_id, mastery, level, correct, wrong,
                 median_ms, last_seen, due_at)
kids_session    (id, child_id, started_at, ended_at, minutes, lessons)
kids_event      (id, child_id, at, lesson_id, item_id, kind, correct, ms)
```

`kids_event` is append-only and is what the parent dashboard and the revision
engine both read. No child row carries a name that is visible to anyone but
the owning account (§27).

---

## H. UI/UX sitemap

```
/kids                         child home — 5 big cards, voice-guided
│
├── /kids/বাংলা               subject → unit → lesson picker (pictures, no text)
├── /kids/সংখ্যা
├── /kids/খেলা                games, straight in
├── /kids/গল্প                stories and rhymes
├── /kids/আমার                stars, badges, "আমি যা শিখেছি"
│
├── /kids/lesson/[id]         the player — one screen at a time
└── /kids/parents             parent area, behind a simple gate
    ├── progress              per subject, per item
    ├── practice              what needs work, and why
    └── settings              sound, motion, session length
```

Child screens: no navigation bar, no text menus, one back arrow (a large
🏠), everything else is a picture. Minimum touch target 64 px. Bangla first,
always. Nothing on a child screen requires reading.

---

## I. Parent dashboard

```
আজকের শেখা
  বাংলা    ✓ ৩টি কাজ   ৮ মিনিট
  সংখ্যা   ✓ ১টি কাজ   ৪ মিনিট

যেগুলো আবার অনুশীলন করা দরকার
  ক   খুব কাছাকাছি — খ-এর সাথে গুলিয়ে ফেলছে
  ঞ   নতুন
  ৭   লিখতে গিয়ে আটকে যাচ্ছে

এই সপ্তাহে
  ১২টি বর্ণ চেনা হয়েছে · ৪টি শব্দ বানানো হয়েছে · ধারাবাহিক ৫ দিন
```

Written for a parent, not a teacher: no percentages, no rank, no comparison to
other children. "যেগুলো আবার অনুশীলন করা দরকার" names the *confusion*
(ক vs খ), because that is actionable and a raw score is not. The parent is
explicitly told they do not need to sit with the child.

---

## J. Progress and mastery

```
NOT_STARTED → INTRODUCED → LEARNING → PRACTICING → CONFIDENT → MASTERED
```

Promotion needs **multiple signals**, never one perfect run (§19):

| To reach | Needs |
|---|---|
| INTRODUCED | seen once in any activity |
| LEARNING | 1 correct recognition |
| PRACTICING | 3 correct across ≥2 activity types |
| CONFIDENT | 5 correct, ≤1 wrong in last 6, at Level C+ |
| MASTERED | CONFIDENT **on two different days**, plus one correct at Level D |

Occasional mistakes never block progress — a single wrong answer at CONFIDENT
does not demote the mastery state, only the activity level. That separation is
deliberate: the *task* gets easier immediately, the *record* stays honest.

**Spaced revision (§18):** an item due again at 1, 3, 7 then 21 days. Any item
with `confusedWith[x] ≥ 2` generates a dedicated ক-vs-খ discrimination set:
picture → sound → choose → game, six rounds, then back to normal.

---

## K. Technical architecture

Fits what Pickixo already runs — no new infrastructure.

```
apps/web/src/data/kids/**.json          curriculum, data-driven      (§22)
apps/web/src/lib/kids/
    content.ts     types + validateLesson()   — refuses unsourced content
    adaptive.ts    the level engine           (§4)
    mastery.ts     six-state model            (§19)
    revision.ts    spacing + confusion sets   (§18)
    progress.ts    localStorage, sync-ready
    speech.ts      bn-BD audio + optional ASR (§10, §11)
apps/web/src/components/kids/             player, 18 games, tracing canvas
apps/web/src/app/kids/**                  routes
apps/api/app/routers/kids.py              sync + parent dashboard
database/schema/014_kids.sql              tables + registry row
```

**Performance (§26).** Target is a 2018 Android phone on 3G:

- No new runtime dependency. Animation is CSS and inline SVG; no Lottie
  player, no animation library. Illustrations are **inline SVG components**,
  following the existing `alphabetDrawings.tsx` pattern — they cost bytes once,
  scale to any screen, and need no network request.
- Audio is speech synthesis (`bn-BD`) with `audio: null` everywhere, so the
  first release ships **zero audio files**. Recorded audio drops in later by
  filling that field — a JSON change, no code change.
- One lesson's JSON is ~8 KB. Lessons are route-split and prefetched one ahead.
- Everything works offline after first load except sync.

**Accessibility (§21).** Reduced-motion honoured; no activity depends on colour
alone (every coloured target also differs in shape or carries its glyph);
tracing has a "দেখাও" button that completes it for a child who cannot draw;
all audio has a visible text equivalent; full keyboard path through every game.

**Safety (§27).** No profiles, no messaging, no comments, no external links, no
ads, no notifications. The parent area is separated by a gate a 4-year-old will
not pass (a 3-digit arithmetic question, not a password). Nothing about a child
leaves the device unless the parent signs in.

---

## L. Implementation plan

| Phase | What | Done when |
|---|---|---|
| **1** | Content schema + `validateLesson` + স্বরবর্ণ and ক-বর্গ data | Validator passes; every lesson has book pages |
| **2** | Adaptive, mastery, revision engines + unit tests | Engine tests pass |
| **3** | Lesson player + 8 core games + tracing canvas | ক-বর্গ playable end to end |
| **4** | Child home, subject and lesson pickers, rewards | A non-reader can navigate |
| **5** | Remaining 10 games; all 39 consonants + numbers ০–২০ | 36 lessons, all validated |
| **6** | Parent area + API sync + `014_kids.sql` + registry row | Findable from search and sitemap |
| **7** | Stories, rhymes, পরিবেশ | Full book covered |

Phases 1–4 are the vertical slice that proves the design. Each phase ends
running, not half-built.

---

## What is deliberately not claimed

- **No recorded audio yet.** Browser `bn-BD` speech synthesis is decent on
  Android and poor-to-absent on some desktops. Where there is no voice the UI
  stays usable and silent; it never freezes waiting for sound.
- **Speech recognition is optional and never gates anything** (§11). Bangla ASR
  in the browser is unreliable; the child always gets
  `আমি শুনেছি! আবার চেষ্টা করো 😊` and moves on.
- **Illustrations are original** (§24). No scanned textbook artwork is used
  anywhere — the same commitment already recorded for Class 2 English. All 99
  picture-words in the curriculum are drawn as inline SVG in
  `components/kids/drawings.tsx`, and `content.test.mjs` fails the build if a
  lesson gains a word without a drawing, or keeps a drawing no lesson uses.
  Where the book's own illustration settles an ambiguous word it was checked
  and followed — শিং is a bull's head rather than the catfish, মিঞ is a
  black-and-white cat, ঋতু is the flame tree in flower — because a picture
  that contradicts the source teaches the wrong word.
- **Learning areas 1, 2, 3 and 9 are carried, not assessed.** A screen cannot
  judge whether a child shares nicely.
