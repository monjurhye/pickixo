import type { Vertical } from './api';

/**
 * The seven top-level sections, in navigation order.
 *
 * This list has to agree with the `vertical` CHECK constraint on the registry
 * table — it is the only thing duplicated between the database and the
 * frontend, and it is duplicated because routing has to know the segments
 * before it can ask the API anything.
 */
export const VERTICALS = [
  {
    slug: 'ai',
    name: 'AI',
    nameBn: 'এআই',
    tagline: 'Ask, write, create',
    description:
      'Chat, writing, documents and images, backed by several AI providers so a busy one does not become your problem.',
  },
  {
    slug: 'apps',
    name: 'Apps',
    nameBn: 'অ্যাপস',
    tagline: 'Everyday software',
    description: 'Productivity and utility apps that run in the browser.',
  },
  {
    slug: 'tools',
    name: 'Tools',
    nameBn: 'টুলস',
    tagline: 'One job, done well',
    description:
      'PDF, image, text and developer tools. No sign-up, no watermark, no upload limit games.',
  },
  {
    slug: 'games',
    name: 'Games',
    nameBn: 'গেমস',
    tagline: 'Play in the browser',
    description: 'Quick games with daily challenges and leaderboards.',
  },
  {
    slug: 'jobs',
    name: 'Jobs',
    nameBn: 'চাকরি',
    tagline: 'Find work, and get ready for it',
    description:
      'Government, private and remote listings, with the CV tools to actually apply.',
  },
  {
    slug: 'education',
    name: 'Education',
    nameBn: 'শিক্ষা',
    tagline: 'Learn, then use it',
    description:
      'Courses, scholarships and study tools that connect to where they lead: a career.',
  },
  {
    slug: 'banking',
    name: 'Banking Services',
    nameBn: 'ব্যাংকিং সেবা',
    tagline: 'Money matters, made simple',
    description:
      'Calculators, guides and tools for everyday banking: loans, savings, deposits and more.',
  },
  {
    slug: 'bangladesh',
    name: 'Bangladesh',
    nameBn: 'বাংলাদেশ',
    tagline: 'Services and information',
    description:
      'Government services, jobs, education and local information for Bangladesh.',
  },
] as const;

export const VERTICAL_SLUGS = VERTICALS.map((v) => v.slug) as readonly string[];

export function isVertical(value: string): value is Vertical {
  return VERTICAL_SLUGS.includes(value);
}

export function getVertical(slug: string) {
  return VERTICALS.find((v) => v.slug === slug);
}

export interface SubMenuItem {
  slug: string;
  name: string;
  nameBn: string;
  description: string;
  /** For an entry that points at an existing page outside `/<vertical>/<slug>`
   *  (e.g. the pay-scale calculators). Such entries have no registry category
   *  and no route of their own, so they are also left out of the sitemap. */
  href?: string;
}

export function submenuHref(vertical: string, item: SubMenuItem): string {
  return item.href ?? `/${vertical}/${item.slug}`;
}

/**
 * Second-level menu entries for a section, shown as a dropdown in the header.
 *
 * Each `slug` is also the `app_categories.slug` for that vertical (seeded in
 * 015_banking_vertical.sql) and the route `/<vertical>/<slug>`. Only Banking
 * Services has any today; a section without an entry here is a plain link.
 */
export const SUBMENUS: Partial<Record<Vertical, readonly SubMenuItem[]>> = {
  jobs: [
    {
      slug: 'salary-calculator',
      name: 'Salary Calculator',
      nameBn: 'বেতন ক্যালকুলেটর',
      description: 'National Pay Scale 2026: fixed pay for serving staff and new appointees.',
      href: '/salary-calculator',
    },
    {
      slug: 'pay-scale-2026',
      name: 'Pay Scale 2026',
      nameBn: 'জাতীয় বেতনস্কেল ২০২৬',
      description: 'Every grade and step of the 2026 scale, from the Gazette.',
      href: '/pay-scale-2026',
    },
    {
      slug: 'increment-calculator',
      name: 'Increment Calculator',
      nameBn: 'বেতনবৃদ্ধি ক্যালকুলেটর',
      description: 'Your next annual increments in the 2026 scale.',
      href: '/increment-calculator',
    },
    {
      slug: 'pay-scale-comparison',
      name: '2015 vs 2026',
      nameBn: '২০১৫ বনাম ২০২৬',
      description: 'How basic pay changes between the two scales.',
      href: '/2015-vs-2026-pay-scale',
    },
  ],
  banking: [
    {
      slug: 'loans',
      name: 'Loans',
      nameBn: 'ঋণ',
      description: 'Home, personal, car and SME loans: rates, EMI and eligibility.',
    },
    {
      slug: 'savings',
      name: 'Savings & Deposits',
      nameBn: 'সঞ্চয় ও আমানত',
      description: 'FDR, DPS and savings accounts: what they pay and how to compare them.',
    },
    {
      slug: 'cards',
      name: 'Cards',
      nameBn: 'কার্ড',
      description: 'Debit, credit and prepaid cards: fees, limits and how to choose.',
    },
    {
      slug: 'mobile-banking',
      name: 'Mobile Banking',
      nameBn: 'মোবাইল ব্যাংকিং',
      description: 'bKash, Nagad, Rocket and bank apps: charges and how to use them.',
    },
    {
      slug: 'bank-directory',
      name: 'Bank Directory',
      nameBn: 'ব্যাংক ডিরেক্টরি',
      description: 'Banks, branches, routing numbers and SWIFT codes in Bangladesh.',
    },
    {
      slug: 'calculators',
      name: 'Calculators',
      nameBn: 'ক্যালকুলেটর',
      description: 'EMI, interest, FDR maturity and currency conversion.',
    },
  ],
};

export function getSubMenu(vertical: string, slug: string) {
  return SUBMENUS[vertical as Vertical]?.find((s) => s.slug === slug);
}

/** Sections shown in the main navigation. Bangladesh and Apps live in the
 *  footer until they have enough behind them to earn a top-level slot. */
export const PRIMARY_NAV = VERTICALS.filter((v) =>
  ['ai', 'tools', 'games', 'jobs', 'education', 'banking'].includes(v.slug),
);
