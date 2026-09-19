# Gazette Rule Audit — জাতীয় বেতনস্কেল ২০২৬

Source: **চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬** — এস. আর. ও. নং ৩৪৭-আইন/২০২৬,
বাংলাদেশ গেজেট (অতিরিক্ত), ১৭ সেপ্টেম্বর ২০২৬, printed pages 25193–25211
(`gazet.pdf`, 19 PDF pages). Effective 1 July 2026. Issued by অর্থ বিভাগ,
অর্থ মন্ত্রণালয় under সরকারি চাকরি আইন, ২০১৮ §15.

An item is ticked only where the Gazette itself establishes it. Where it does
not, the item is listed under **Not established** and the calculator produces
no number for it.

---

## How the text was recovered

The PDF's Bengali body is set in a subsetted **NikoshBAN** TrueType font whose
`ToUnicode` CMap covers only punctuation and Latin digits, so copying text out
of it — or running `pdftotext` — yields mojibake. The figures in this project
were therefore recovered glyph by glyph:

1. Per-character glyph IDs were read from the PDF content streams
   (`page.get_texttrace()`).
2. The font's glyph order was found to follow the Unicode Bengali block over
   its *assigned* codepoints: `gid = 404 + index`, with U+09CE (ৎ) absent.
   Verified at ten independent anchors — 406=ং, 408=অ, 420=ক, 442=ব, 446=র,
   454=া, 461=ে, 469=য়, 474=০, 483=৯.
3. All 266 distinct glyphs were cropped from the rendered pages, assembled into
   labelled contact sheets and identified visually; the remaining conjuncts
   were confirmed from context in the decoded corpus.
4. The full document was decoded and is committed at
   `docs/payscale/gazette-2026-transcript.txt`. The decoder is at
   `apps/web/scripts/payscale/` (`glyphmap.py`, `decode_gazette.py`).

Bengali digit ৪ is drawn like a Latin "8" in this typeface, which makes
eyeballing the tables unreliable; the glyph-ID route avoids that class of error
entirely.

### Independent corroboration of the decoded numbers

| Check | Result |
| --- | --- |
| গেজেটের উদাহরণ ১ (গ্রেড ১৬: ৯৩০০ → ২১৯০০) reproduced by the engine | ✅ |
| গেজেটের উদাহরণ ২ (গ্রেড ১১: ১৩৭৯০ → ২৬২৯০ → ২৬৩০০) reproduced | ✅ |
| অনুচ্ছেদ ১১ table restates grade 1–7 ranges — matches অনুচ্ছেদ ৩(১) | ✅ |
| অনুচ্ছেদ ১০(১) quotes "৪৪০০০-১০৫৯০০ (৯ম গ্রেড)" — matches the table | ✅ |
| Grades 1–11 start at exactly 2× the 2015 minimum (arithmetic) | ✅ |
| Every step in every scale strictly increasing, 1–6% apart | ✅ |
| Grade 5 & 6 scale cells re-read visually at high resolution | ✅ |
| House-rent table (অনুচ্ছেদ ১৫) re-read visually at high resolution | ✅ |

All of the above are enforced as tests: `npm run test:payscale` (73 checks).

---

## Checklist

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 1 | 2015 Pay Scale, grades 1–20, every step | ✅ verified | অনুচ্ছেদ ৩(১) সারণি, pp. 25196–25199 |
| 2 | 2026 Pay Scale, grades 1–20, every step | ✅ verified | অনুচ্ছেদ ৩(১) সারণি, pp. 25196–25199 |
| 3 | Grade 1–20 present in both scales | ✅ verified | as above |
| 4 | Pay fixation rule | ✅ verified | অনুচ্ছেদ ৫(ক), ৫(খ), ৫(খ)(অ), ৫(খ)(আ) |
| 5 | Corresponding scale (1:1 by grade) | ✅ verified | অনুচ্ছেদ ৩(১), ৪ |
| 6 | Increment rules (date, one on fixation, 6-month proviso) | ✅ verified | অনুচ্ছেদ ৯(১), ৯(২) |
| 7 | "10% rule" | ✅ verified — **not a fixation rule** | only অনুচ্ছেদ ২৭ (deputation allowance) |
| 8 | "15% rule" | ✅ verified — **not a fixation rule** | only অনুচ্ছেদ ১৪ (Bangla New Year allowance) |
| 9 | Extra benefit (বিশেষ সুবিধা) rule | ✅ verified — abolished, adjusted against arrears | অনুচ্ছেদ ১(৩)(ট), ১(৩)(ঠ), ৮(১)(গ) |
| 10 | Adjustment rule | ✅ verified | অনুচ্ছেদ ১(৩)(ট) — against arrears under (ঘ) and (জ) |
| 11 | Special cases (promotion, deputation, leave, suspension, PRL, retiring) | ✅ verified | অনুচ্ছেদ ৫(ঘ)–(ঝ) |
| 12 | Fixed-pay posts outside the grade table | ✅ verified | অনুচ্ছেদ ৩(২), ৫(গ) |
| 13 | Higher grade (উচ্চতর গ্রেড) | ✅ verified | অনুচ্ছেদ ৬(১)–(৬) |
| 14 | Allowances with a rate in this order | ✅ verified | অনুচ্ছেদ ১৩–১৫, ১৮–২৮ |
| 15 | Allowances without a rate in this order | ✅ verified as *not stated* | অনুচ্ছেদ ১৬, ১৭, ২৯ |
| 16 | Effective dates (pay, phases, allowances) | ✅ verified | অনুচ্ছেদ ১(২), ১(৩)(ক)–(গ), ১(৩)(ঞ), ১২ |
| 17 | Exceptions / who the order does not cover | ✅ verified | অনুচ্ছেদ ১(৪) |
| 18 | Transition percentages 40/50 and 70/75 | ✅ verified | অনুচ্ছেদ ১(৩)(ক), (খ) |
| 19 | Pension: net pension table and slabs | ✅ verified (displayed, not calculated) | অনুচ্ছেদ ৮(১)(খ) |
| 20 | Pension transition percentages | ✅ verified (displayed, not calculated) | অনুচ্ছেদ ১(৩)(ঙ)–(ঝ) |
| 21 | Full-pay qualifying service, grades 1–7 | ✅ verified | অনুচ্ছেদ ১১ সারণি |
| 22 | First-appointment advance increments | ✅ verified | অনুচ্ছেদ ১০(১)–(৪) |
| 23 | Repeal of the 2015 order | ✅ verified | অনুচ্ছেদ ৩৩ |
| 24 | Source pages for every figure | ✅ verified | `sourceReferences.json` |
| 25 | Calculation formulas | ✅ verified against the Gazette's two worked examples | অনুচ্ছেদ ৫ |
| 26 | Arrears netting for 1 July 2026 onwards | ✅ verified | অনুচ্ছেদ ১(৩)(ঘ), ১৫(১), ১(৩)(ঞ), ১(৩)(ট), ৩২(১০) |
| 27 | Test cases pass | ✅ 73/73 | `npm run test:payscale` |

---

## The 1 July 2026 date mismatch, and what it does to arrears

The 2015 order's annual increment date was also 1 July. So an eligible employee
moved one step up the **2015** scale on 1 July 2026 and drew July, August and
September pay on that higher figure — while this order fixes pay from the
**30 June 2026** figure (অনুচ্ছেদ ২(খ), ৫) and grants its own single increment in
the new scale (অনুচ্ছেদ ৯(২)).

No clause cancels the old increment. It is superseded, and what was drawn on
account of it is money already paid, which nets off:

| Provision | Effect |
| --- | --- |
| অনুচ্ছেদ ১(৩)(ঘ) | July-onwards pay is payable as **বকেয়া** — i.e. due minus drawn |
| অনুচ্ছেদ ১৫(১) | house rent stays at the **30 June 2026** amount to 31 Dec 2027 |
| অনুচ্ছেদ ১(৩)(ঞ) | every other allowance likewise |
| অনুচ্ছেদ ১(৩)(ট) | the **whole** special benefit drawn 1 Jul → 17 Sep 2026 is adjusted against arrears — not merely the increment-driven part |
| অনুচ্ছেদ ৩২(১০) | "কম বা বেশি বেতন পরিশোধ হইয়া থাকিলে তাহা সমন্বয়যোগ্য হইবে" |

Worked through for the Gazette's own example-2 employee (grade 11, ৳13,790 on
30 June 2026):

| | |
| --- | --- |
| 1 July 2026, 2015 scale | ৳13,790 → ৳14,480 (increment ৳690) — drawn Jul–Sep |
| Due under this order, Jul–Dec 2026 | ৳13,790 + 50% of ৳13,810 = **৳20,695** |
| Naive arrears | (20,695 − 13,790) × 3 = ৳20,715 |
| Actual arrears | (20,695 − 14,480) × 3 = **৳18,645** |
| Difference | ৳690 × 3 = ৳2,070 — exactly the old increment |

The 2015 **basic** is derivable, because this Gazette reprints the 2015 scale.
The 2015 **allowance rates** are not, because the order repeals the 2015 order
without restating them — so house rent and special-benefit figures are user
inputs, labelled as such in the result.

---

## Not established by this Gazette

The calculator refuses to produce a figure for each of these, and says so on
screen.

1. **Fixation base above the top of the new scale.** অনুচ্ছেদ ৫(খ) does not say
   what happens if `new minimum + difference` exceeds the highest step. It
   cannot arise from a basic that is inside the 2015 scale (checked for all 20
   grades), so in practice it only signals a wrong grade or a wrong basic — the
   engine returns no figure and a blocker warning.
2. **Rounding of the transition percentage.** অনুচ্ছেদ ১(৩) gives 40/50/70/75%
   of the increase but not how a fraction of a taka is treated. The engine
   rounds to the nearest taka and *declares that as an assumption* in every
   result; iBAS++ may differ by a taka.
3. **Increment at the top of a scale.** অনুচ্ছেদ ৯ defines an increment as the
   next step; it is silent once there is no next step.
4. **Festival bonus and recreation allowance rates.** অনুচ্ছেদ ১৭ points at
   earlier memoranda and the Recreation Allowance Rules 1979 instead of stating
   a rate.
5. **Travel allowance rates.** অনুচ্ছেদ ১৬ keeps the existing rules and says the
   Finance Division will re-fix rates by separate order.
6. **Risk / special / guard / compensation allowance amounts.** অনুচ্ছেদ ২৯ and
   ৩০ refer to Finance Division memoranda of 2 September 2026 and state
   explicitly that these are *not* a percentage of basic pay. The +20% uplift in
   অনুচ্ছেদ ৩০(১) applies to the amount drawn on 30 June 2026, which the Gazette
   does not print.
7. **The rate of the 2015 special benefit.** The order abolishes বিশেষ সুবিধা
   without ever stating what it was. No 5%, 10% or 15% figure appears anywhere
   in this Gazette in connection with it.
8. **Deduction rates.** অনুচ্ছেদ ৩১ requires employees to assess and pay their
   own income tax under the Income Tax Act 2023; no tax, GPF or other deduction
   rate is fixed here.
9. **Which posts draw the washing allowance.** অনুচ্ছেদ ২৩ says "যাঁহাদের ক্ষেত্রে
   প্রযোজ্য" without listing them.
10. **Final fixation of a post filled by promotion on 1 July 2026.**
    অনুচ্ছেদ ৫(ঘ) defers to "প্রচলিত বিধিবিধান", which is outside this order.
11. **Whether a given employee received the 1 July 2026 increment under the 2015
    order.** It depends on qualifying service and on not already being at the top
    of the old scale. The calculator derives the amount from the reprinted 2015
    scale and states it as an assumption the user can override.
12. **How long the arrears period actually runs.** অনুচ্ছেদ ১(৩)(ঘ) says
    1 July 2026 to the date of issue (17 September 2026), but fixation happens
    later in practice and old-scale pay keeps being drawn until it does. Anything
    beyond that window is an over-payment under অনুচ্ছেদ ৩২(১০), so the month
    count is an input rather than a fixed three.

---

## Scope notes

- **Pension is data, not a calculator.** The net-pension table (অনুচ্ছেদ ৮) and
  the pension transition percentages are extracted, cited and displayed on
  `/pay-scale-2026`, but there is no pension calculator: the fixation of a
  pension also depends on gratuity election and commutation history, which this
  order does not restate.
- **Higher grade is documented, not automated.** অনুচ্ছেদ ৬ is reproduced in full
  on `/pay-fixation-2026`, but the calculator does not advance a grade by
  itself, because eligibility turns on "সন্তোষজনক চাকরি" and on a service history
  it is never given.
- **The 2015 allowance rates are not in this order.** The 2015 order is repealed
  and its rates are not restated, so a 2015-vs-2026 *gross* comparison can only
  be made with figures the user supplies; those are labelled
  "ব্যবহারকারীর দেওয়া পরিমাণ".
