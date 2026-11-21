/**
 * Pickixo's Android apps, as listed on Google Play
 * (developer page id 6091266553355216276), checked 2026-11-21.
 *
 * Names are the ones on each Play listing. Every privacy link here is the
 * address Google Play has on file — changing or removing one of those pages
 * puts the app's listing at risk, so they are listed together to make that
 * dependency visible.
 */
export type PlayApp = {
  id: string;
  name: string;
  nameBn?: string;
  /** Short and factual, from the listing title. */
  blurb: string;
  privacy?: string;
};

export const PLAY_DEVELOPER_URL =
  'https://play.google.com/store/apps/dev?id=6091266553355216276';

export const playUrl = (id: string) =>
  `https://play.google.com/store/apps/details?id=${id}`;

export const PLAY_APPS: PlayApp[] = [
  {
    id: 'com.pickixo.ludotiger',
    name: 'Ludo Tiger',
    nameBn: 'লুডো টাইগার',
    blurb: 'Ludo, the board game, on your phone.',
    privacy: 'https://ludotiger.xyz/privacy-policy.html',
  },
  {
    id: 'com.khb.farmmate',
    name: 'Khamar Bondhu',
    nameBn: 'খামার বন্ধু',
    blurb: 'Cattle farming records and accounts — গরু পালন ও হিসাব.',
    privacy: '/khamar-bondhu/privacy-policy',
  },
  {
    id: 'com.pickixo.survivaltiger',
    name: 'Survival Tiger: Bagha Char',
    blurb: 'A battle royale game.',
    privacy: '/survival-tiger/privacy',
  },
  {
    id: 'com.hyelabs.bdraillive',
    name: 'pathik',
    nameBn: 'ট্রেনের সময়সূচি',
    blurb: 'Bangladesh train schedules, off days and estimated train positions.',
    privacy: '/pathik-api/privacy',
  },
  {
    id: 'com.pickixo.polyscan',
    name: 'Polyscan',
    blurb: 'An offline document scanner with OCR.',
    privacy: '/polyscan/privacy',
  },
  {
    id: 'com.pickixo.wifidetective',
    name: 'WiFi Detective',
    nameBn: 'নেট স্লো কেন?',
    blurb: 'Find out why your internet is slow.',
    privacy: '/wifi-detective/privacy',
  },
  {
    id: 'com.genspark.wifitvremote',
    name: 'Smart TV Remote',
    nameBn: 'টিভি রিমোট',
    blurb: 'Control a smart TV over Wi-Fi.',
    privacy: '/wifi-tv-remote/privacy-policy',
  },
  {
    id: 'com.maaz.banglakeyboard',
    name: 'Maaz Bangla Keyboard',
    nameBn: 'বাংলা কিবোর্ড',
    blurb: 'A keyboard for typing Bangla.',
    privacy: '/maaz-privacy-policy.html',
  },
  {
    id: 'com.pickixo.vpn',
    name: 'Pickixo VPN',
    blurb: 'VPN with Japan and Korea servers.',
    privacy: '/pickixo-vpn/privacy',
  },
  {
    id: 'com.sonali_info.app',
    name: 'Sonali Info',
    blurb: 'FDR, EMI and routing numbers — FDR, EMI ও রাউটিং.',
  },
  {
    id: 'com.pickixo.protaruna_checker',
    name: 'Protaruna Checker',
    blurb: 'Check a suspicious SMS or message for scams, in Bangla.',
    privacy: 'https://monjurhye.github.io/protaruna-checker-privacy/',
  },
];
