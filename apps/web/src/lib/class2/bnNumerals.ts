/**
 * Bangla digits for a number shown in Bangla text.
 *
 * The Maths course's entire UI is in Bangla — unlike the English course,
 * where an Arabic numeral sits naturally in an English sentence ("3/8").
 * Showing "1টি পাঠ" or "অধ্যায় 3" mixes scripts in a way the book itself
 * never does: every count is spelled ১, ২, ৩ throughout "প্রাথমিক গণিত".
 * Every visible count in the Maths app should be passed through this.
 */
const DIGITS: Record<string, string> = {
  0: '০', 1: '১', 2: '২', 3: '৩', 4: '৪', 5: '৫', 6: '৬', 7: '৭', 8: '৮', 9: '৯',
};

export function bn(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => DIGITS[d]!);
}
