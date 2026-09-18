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

/** Sections shown in the main navigation. Bangladesh and Apps live in the
 *  footer until they have enough behind them to earn a top-level slot. */
export const PRIMARY_NAV = VERTICALS.filter((v) =>
  ['ai', 'tools', 'games', 'jobs', 'education'].includes(v.slug),
);
