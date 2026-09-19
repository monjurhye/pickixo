import type { Metadata } from 'next';
import Link from 'next/link';
import { PayScaleShell } from './PayScaleShell';
import { GradeScaleDetail } from './PayScaleTable';
import { SalaryCalculator } from './SalaryCalculator';
import { Card, SectionHeading, Stat } from './Ui';
import { getScale2015, getScale2026, isNinthGradeOrAbove } from '@/lib/payscale/payScale';
import { fixFromScaleMinimum } from '@/lib/payscale/salaryFixation';
import { houseRentPercent, mobileAllowance } from '@/lib/payscale/allowanceCalculator';
import { formatBn, gradeLabel, percentBn, taka, toBnDigits } from '@/lib/payscale/format';
import { absoluteUrl, breadcrumbSchema, buildMetadata, jsonLd } from '@/lib/seo';
import type { Grade } from '@/lib/payscale/types';

/**
 * One grade's landing page, shared by /grade-1-salary … /grade-20-salary.
 *
 * The worked example on each page starts from the scale minimum, because that
 * is the one figure that is the same for everyone in the grade and can be
 * stated without knowing anything about the reader. Everything that depends on
 * their own step is left to the calculator below it rather than being implied
 * by a headline number.
 */

export function gradeMetadata(grade: Grade): Metadata {
  const old = getScale2015(grade);
  const fresh = getScale2026(grade);
  const path = `/grade-${grade}-salary`;
  if (!old || !fresh) return buildMetadata({ title: gradeLabel(grade), description: '', path });

  const title = `${gradeLabel(grade)} এর বেতন কত ২০২৬ — ${formatBn(fresh.minimum)}${
    fresh.fixed ? ' (নির্ধারিত)' : ` থেকে ${formatBn(fresh.maximum)}`} টাকা`;
  const description =
    `জাতীয় বেতনস্কেল ২০২৬ অনুযায়ী ${gradeLabel(grade)} এর বেতন ${
      fresh.fixed ? `${formatBn(fresh.minimum)} টাকা (নির্ধারিত)` :
      `${formatBn(fresh.minimum)}–${formatBn(fresh.maximum)} টাকা`}। `
    + `২০১৫ স্কেলে ছিল ${formatBn(old.minimum)}${old.fixed ? '' : `–${formatBn(old.maximum)}`} টাকা। `
    + 'প্রতিটি ধাপ, বেতন নির্ধারণের হিসাব, বাড়ি ভাড়া ও অন্যান্য ভাতার হারসহ।';

  return buildMetadata({ title, description, path });
}

export function GradeSalaryPage({ grade }: { grade: Grade }) {
  const old = getScale2015(grade);
  const fresh = getScale2026(grade);
  if (!old || !fresh) return null;

  const path = `/grade-${grade}-salary`;
  const fixation = fixFromScaleMinimum(grade);
  const ninthOrAbove = isNinthGradeOrAbove(grade);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbSchema([
              { name: 'হোম', path: '/' },
              { name: 'জাতীয় বেতনস্কেল ২০২৬', path: '/pay-scale-2026' },
              { name: `${gradeLabel(grade)} এর বেতন`, path },
            ]),
            {
              '@type': 'FAQPage',
              '@id': `${absoluteUrl(path)}#faq`,
              mainEntity: [
                {
                  '@type': 'Question',
                  name: `${gradeLabel(grade)} এর বেতন কত?`,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: fresh.fixed
                      ? `জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী ${gradeLabel(grade)} এর বেতন ${formatBn(fresh.minimum)} টাকা (নির্ধারিত)।`
                      : `জাতীয় বেতনস্কেল, ২০২৬ অনুযায়ী ${gradeLabel(grade)} এর বেতনস্কেল ${formatBn(fresh.minimum)}–${formatBn(fresh.maximum)} টাকা, মোট ${toBnDigits(fresh.stepCount)}টি ধাপ। প্রারম্ভিক বেতন ${formatBn(fresh.minimum)} টাকা।`,
                  },
                },
                {
                  '@type': 'Question',
                  name: `${gradeLabel(grade)} এ ২০১৫ স্কেল থেকে কত বাড়ল?`,
                  acceptedAnswer: {
                    '@type': 'Answer',
                    text: `২০১৫ স্কেলে প্রারম্ভিক বেতন ছিল ${formatBn(old.minimum)} টাকা; ২০২৬ স্কেলে তাহা ${formatBn(fresh.minimum)} টাকা — অর্থাৎ প্রারম্ভিক ধাপে ${formatBn(fresh.minimum - old.minimum)} টাকা বৃদ্ধি। তবে আপনার নিজের বৃদ্ধি নির্ভর করিবে আপনি ২০১৫ স্কেলের কোন ধাপে ছিলেন তাহার উপর।`,
                  },
                },
              ],
            },
          ),
        }}
      />

      <PayScaleShell
        title={`${gradeLabel(grade)} এর বেতন — জাতীয় বেতনস্কেল ২০২৬`}
        crumb={`${gradeLabel(grade)} এর বেতন`}
        lead={
          fresh.fixed
            ? `অনুচ্ছেদ ৩(১) অনুযায়ী ${gradeLabel(grade)} এর বেতন ${taka(fresh.minimum)} (নির্ধারিত)।`
            : `অনুচ্ছেদ ৩(১) অনুযায়ী ${gradeLabel(grade)} এর বেতনস্কেল ${taka(fresh.minimum)} – ${taka(fresh.maximum)}, মোট ${toBnDigits(fresh.stepCount)}টি ধাপ।`
        }
      >
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Stat label="২০১৫ স্কেল (বর্তমান বেতনস্কেল)"
                value={old.fixed ? `${taka(old.minimum)} (নির্ধারিত)` : `${taka(old.minimum)} – ${taka(old.maximum)}`}
                hint={`${toBnDigits(old.stepCount)}টি ধাপ`} />
          <Stat label="২০২৬ স্কেল (অনুরূপ স্কেল)" tone="accent"
                value={fresh.fixed ? `${taka(fresh.minimum)} (নির্ধারিত)` : `${taka(fresh.minimum)} – ${taka(fresh.maximum)}`}
                hint={`${toBnDigits(fresh.stepCount)}টি ধাপ`} />
        </div>

        {fixation?.ok && fixation.newBasic !== null ? (
          <Card className="mt-5">
            <h2 className="text-subheading text-ink">প্রারম্ভিক ধাপের উদাহরণ</h2>
            <p className="mt-1 text-small text-ink-muted">
              ৩০ জুন ২০২৬ তারিখে ২০১৫ স্কেলের প্রারম্ভিক ধাপে ({taka(old.minimum)}) থাকা একজন
              কর্মচারীর ক্ষেত্রে —
            </p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <Stat label="অনুচ্ছেদ ৫(ক) অনুযায়ী নির্ধারিত" value={taka(fixation.fixedBasic)} />
              <Stat label="১ জুলাই ২০২৬ এ বেতনবৃদ্ধিসহ" value={taka(fixation.newBasic)} tone="accent" />
              <Stat label="মাসিক বৃদ্ধি" value={taka(fixation.monthlyIncrease)}
                    hint={percentBn(fixation.percentIncrease)} />
            </div>
            <p className="mt-3 text-small text-ink-muted">
              অনুচ্ছেদ ১(৩) অনুযায়ী এই বৃদ্ধির {ninthOrAbove ? '৪০%' : '৫০%'} ১ জুলাই ২০২৬ হইতে
              ৩১ ডিসেম্বর ২০২৬ পর্যন্ত, {ninthOrAbove ? '৭০%' : '৭৫%'} ১ জানুয়ারি ২০২৭ হইতে
              ৩০ জুন ২০২৭ পর্যন্ত, এবং শতভাগ ১ জুলাই ২০২৭ হইতে প্রদেয়।
            </p>
            <p className="mt-2 text-small text-ink-muted">
              আপনি যদি উচ্চতর ধাপে থাকেন, আপনার অঙ্ক ভিন্ন হইবে — নিচের ক্যালকুলেটরে নিজের
              মূল বেতন দিন।
            </p>
          </Card>
        ) : null}

        <section aria-labelledby="steps-heading" className="mt-10">
          <SectionHeading id="steps-heading" sub="অনুচ্ছেদ ৩(১) এর সারণি অনুযায়ী প্রতিটি ধাপ">
            ধাপ অনুযায়ী বেতন
          </SectionHeading>
          <GradeScaleDetail grade={grade} />
        </section>

        <section aria-labelledby="allow-heading" className="mt-10">
          <SectionHeading id="allow-heading"
            sub="অনুচ্ছেদ ১২ অনুযায়ী এই হার ১ জানুয়ারি ২০২৮ হইতে কার্যকর">
            {`${gradeLabel(grade)} এর ভাতার হার`}
          </SectionHeading>
          <Card>
            <dl className="space-y-2 text-small">
              <Row label="বাড়ি ভাড়া — ঢাকা সিটি কর্পোরেশন"
                   value={`মূল বেতনের ${toBnDigits(houseRentPercent(grade, 'dhaka') ?? 0)}%`} />
              <Row label="বাড়ি ভাড়া — অন্যান্য সিটি কর্পোরেশন ও সাভার/কক্সবাজার পৌর এলাকা"
                   value={`মূল বেতনের ${toBnDigits(houseRentPercent(grade, 'major-city') ?? 0)}%`} />
              <Row label="বাড়ি ভাড়া — অন্যান্য স্থান"
                   value={`মূল বেতনের ${toBnDigits(houseRentPercent(grade, 'other') ?? 0)}%`} />
              <Row label="মোবাইল ভাতা" value={`মাসিক ${taka(mobileAllowance(grade))}`} />
              <Row label="টিফিন ভাতা"
                   value={grade >= 11 ? 'মাসিক ৳৫০০ (লাঞ্চ ভাতা বা বিনামূল্যে দুপুরের খাবার না পাইলে)' : 'প্রযোজ্য নয় (১১–২০ গ্রেডের জন্য)'} />
              <Row label="যাতায়াত ভাতা"
                   value={grade >= 11 ? 'মাসিক ৳৬০০ (সিটি কর্পোরেশন এলাকায় কর্মস্থল হইলে)' : 'প্রযোজ্য নয় (১১–২০ গ্রেডের জন্য)'} />
              <Row label="প্রশিক্ষণ প্রতিষ্ঠানে প্রেষণ ভাতা"
                   value={grade <= 9 ? 'মূল বেতনের ১০% (শুধু প্রশিক্ষণ কাজে প্রেষণে)' : 'প্রযোজ্য নয় (৯ম গ্রেড ও তদূর্ধ্বের জন্য)'} />
              <Row label="বাংলা নববর্ষ ভাতা" value="আহরিত মূল বেতনের ১৫% — বৎসরে একবার" />
              <Row label="চিকিৎসা ভাতা" value="মাসিক ৳৩,০০০ (৫০ বৎসর পর্যন্ত), ৳৪,০০০ (তাহার পর)" />
            </dl>
          </Card>
        </section>

        <section aria-labelledby="calc-heading" className="mt-10">
          <SectionHeading id="calc-heading"
            sub="আপনার নিজের ধাপ দিয়া হিসাব করুন — প্রতিটি ধাপের ব্যাখ্যা ও গেজেট সূত্রসহ।">
            নিজের বেতন হিসাব করুন
          </SectionHeading>
          <SalaryCalculator />
        </section>

        <nav aria-label="অন্যান্য গ্রেড" className="mt-10">
          <h2 className="text-subheading text-ink">অন্যান্য গ্রেড</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: 20 }, (_, i) => i + 1)
              .filter((g) => g !== grade)
              .map((g) => (
                <li key={g}>
                  <Link href={`/grade-${g}-salary`}
                        className="inline-block rounded-control border border-border bg-surface px-3 py-1.5
                                   text-small text-ink-muted transition hover:border-border-strong hover:text-ink">
                    {gradeLabel(g)}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </PayScaleShell>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border pb-2 last:border-0 sm:flex-row sm:justify-between sm:gap-6">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-bengali tabular-nums text-ink sm:text-right">{value}</dd>
    </div>
  );
}
