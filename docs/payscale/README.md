# সরকারি বেতন / National Pay Scale 2026

A Gazette-driven pay-fixation calculator for Bangladesh government employees,
built from **চাকরি (বেতন ও ভাতাদি) আদেশ, ২০২৬** (এস. আর. ও. নং ৩৪৭-আইন/২০২৬,
17 September 2026).

## The one rule this code is built around

Nothing here invents a government rule. Where the Gazette states something, the
calculator applies it and cites the article. Where it does not, the calculator
returns `null` and a warning rather than a plausible number. That is why
`FixationResult` uses nullable numbers and carries `warnings` everywhere, and
why `Certainty` distinguishes `GAZETTE` from `DERIVED`, `ASSUMPTION` and
`UNDETERMINED`.

The second most consequential: **arrears are net, not gross.** The 2015 order's
increment date was also 1 July, so July–September 2026 pay was drawn on a 2015
step one above the figure this order fixes from. `arrears.ts` nets that off; see
GAZETTE-AUDIT.md for the worked example.

The most consequential instance: **there is no percentage uplift of basic pay
anywhere in this order.** Pay is fixed by walking the printed steps of two
scales (অনুচ্ছেদ ৫). The percentages people remember — 40/50/70/75 — apply to the
*increase*, during a transition, and are computed separately.

## Layout

```
apps/web/src/data/payscale/
  payScale2015.json      generated from the PDF — every step of every grade
  payScale2026.json      generated from the PDF — plus the two fixed-pay posts
  payRules2026.json      fixation, increment, higher grade, first appointment,
                         transition, exclusions, repeal, and what is *not* settled
  benefitRules.json      every percentage in the order, one structured rule each
  allowanceRules.json    অনুচ্ছেদ ১২–৩১
  pensionRules.json      অনুচ্ছেদ ৭, ৮ and the pension transition
  sourceReferences.json  gazette metadata, article→page index, extraction method

apps/web/src/lib/payscale/
  types.ts               including Certainty and Warning
  payScale.ts            scale lookup and step arithmetic
  salaryFixation.ts      the engine — অনুচ্ছেদ ৫ and ৯
  incrementCalculator.ts অনুচ্ছেদ ৯
  allowanceCalculator.ts অনুচ্ছেদ ১২–২৮
  salaryCalculator.ts    gross / net composition
  arrears.ts             বকেয়া — অনুচ্ছেদ ১(৩)(ঘ), ১৫(১), ১(৩)(ট), ৩২(১০)
  checker.ts             "আমার বেতন ঠিক আছে কি?"
  validation.ts          the warning vocabulary; blockers stop a calculation
  auditTrail.ts          a checkable record of every calculation
  sourceReference.ts     citations
  format.ts              Bengali digits, lakh grouping, dates
  share.ts               result links that carry no personal data
  faq.ts
  aiExplain.ts           facts for the AI layer, and the invented-figure guard
  engine.test.mjs        73 checks, each naming the rule it tests

apps/web/scripts/payscale/
  glyphmap.py            the recovered NikoshBAN glyph→Unicode map
  decode_gazette.py      re-decodes gazet.pdf to a layout-preserving transcript

docs/payscale/
  GAZETTE-AUDIT.md            what is verified, and what the Gazette leaves open
  gazette-2026-transcript.txt the decoded Gazette, for checking any figure by eye
```

## Routes

| URL | What it is |
| --- | --- |
| `/salary-calculator` | the main pay-fixation calculator |
| `/pay-scale-2026` | grades 1–20, every step, plus allowance and pension tables |
| `/pay-fixation-2026` | অনুচ্ছেদ ৫ in full, with the Gazette's own worked examples |
| `/2015-vs-2026-pay-scale` | grade-by-grade comparison, basic vs gross kept apart |
| `/increment-calculator` | অনুচ্ছেদ ৯ |
| `/gross-salary-calculator` | basic + allowances |
| `/salary-checker` | compare an official figure against the Gazette |
| `/govt-salary-calculator-bangladesh` | English entry point, same engine |
| `/grade-1-salary` … `/grade-20-salary` | one page per grade |

## Running the checks

```bash
cd apps/web
npm run test:payscale
```

The two tests that matter most reproduce the Gazette's own worked examples
(অনুচ্ছেদ ৫, উদাহরণ ১ and ২). If those fail, nothing else in the calculator is
trustworthy.

## Regenerating the scales from the PDF

The Gazette's embedded font has no usable character map, so the scale tables
cannot be copy-pasted out of it. To rebuild them from a copy of `gazet.pdf`:

```bash
cd apps/web
python scripts/payscale/decode_gazette.py 0 19 > gazette_decoded.txt
```

`glyphmap.py` holds the recovered glyph→Unicode table; `docs/payscale/GAZETTE-AUDIT.md`
explains how it was derived and how the result was corroborated.
