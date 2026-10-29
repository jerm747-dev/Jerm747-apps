// Quote engine for jerm747.dev
// Everything is measured against one full working year of Jeremy's time.
// Edit these numbers to change every estimate on the site.

export const YEAR_VALUE = 120000; // one full year of my time
export const YEAR_HOURS = 2080; // 40 hrs x 52 weeks
export const RATE = 95; // hourly contract rate (covers taxes, tools, no benefits)
export const RANGE_SPREAD = 0.2; // estimates show +/- 20%

export const PROJECT_TYPES = [
  { id: 'site', label: 'Website', detail: 'Business site, portfolio or landing pages', hours: [40, 80] },
  { id: 'webapp', label: 'Web app', detail: 'Accounts, dashboards, client-side logic', hours: [120, 240] },
  { id: 'fullstack', label: 'Full-stack system', detail: 'Front end, server API and database', hours: [240, 480] },
  { id: 'game', label: 'Game or media', detail: 'Browser games, music and media players', hours: [100, 260] },
  { id: 'consult', label: 'Consulting', detail: 'Audits, architecture, getting your tech in order', hours: [10, 30] },
];

export const FEATURES = [
  { id: 'accounts', label: 'User accounts and login', hours: [30, 50] },
  { id: 'database', label: 'Database and stored records', hours: [40, 80] },
  { id: 'admin', label: 'Admin dashboard', hours: [30, 60] },
  { id: 'integrations', label: 'Connect outside services (APIs)', hours: [20, 50] },
  { id: 'content', label: 'Content you can edit yourself', hours: [15, 30] },
  { id: 'storefront', label: 'Storefront on Shopify, Stripe or similar', hours: [20, 40] },
  { id: 'languages', label: 'More than one language', hours: [15, 30] },
  { id: 'email', label: 'Email updates and reports', hours: [10, 25] },
  { id: 'migration', label: 'Move or rebuild an existing site', hours: [20, 60] },
];

// How fast the work runs. Steady is my normal pace; priority means extended
// hours, which are billed at a premium so long nights are a choice, not a default.
export const PACES = [
  { id: 'steady', label: 'Steady', detail: 'About 15 hours a week', hoursPerWeek: 15, multiplier: 1 },
  { id: 'focused', label: 'Focused', detail: 'About 25 hours a week', hoursPerWeek: 25, multiplier: 1.1 },
  { id: 'priority', label: 'Priority', detail: 'Up to 40 hours a week, extended hours', hoursPerWeek: 40, multiplier: 1.35 },
];

export const YEAR_FRACTIONS = [
  { value: 1 / 52, label: '1/52', words: 'about one week' },
  { value: 1 / 24, label: '1/24', words: 'about two weeks' },
  { value: 1 / 12, label: '1/12', words: 'about one month' },
  { value: 1 / 6, label: '1/6', words: 'about two months' },
  { value: 1 / 4, label: '1/4', words: 'about one quarter' },
  { value: 1 / 2, label: '1/2', words: 'about half a year' },
  { value: 1, label: '1', words: 'a full year' },
];

export function nearestFraction(share) {
  let best = YEAR_FRACTIONS[0];
  let bestDist = Infinity;
  for (const f of YEAR_FRACTIONS) {
    const dist = Math.abs(Math.log(share) - Math.log(f.value));
    if (dist < bestDist) {
      best = f;
      bestDist = dist;
    }
  }
  return best;
}

function roundTo(n, step) {
  return Math.round(n / step) * step;
}

export function estimate({ typeId, featureIds = [], paceId = 'steady' }) {
  const type = PROJECT_TYPES.find((t) => t.id === typeId);
  if (!type) return null;
  const pace = PACES.find((p) => p.id === paceId) || PACES[0];

  let low = type.hours[0];
  let high = type.hours[1];
  for (const id of featureIds) {
    const f = FEATURES.find((x) => x.id === id);
    if (f) {
      low += f.hours[0];
      high += f.hours[1];
    }
  }
  const midHours = (low + high) / 2;
  const midPrice = midHours * RATE * pace.multiplier;

  const priceLow = Math.max(500, roundTo(midPrice * (1 - RANGE_SPREAD), 500));
  const priceHigh = Math.max(priceLow + 500, roundTo(midPrice * (1 + RANGE_SPREAD), 500));

  const share = midPrice / YEAR_VALUE;
  const weeksLow = Math.max(1, Math.round(low / pace.hoursPerWeek));
  const weeksHigh = Math.max(weeksLow, Math.round(high / pace.hoursPerWeek));

  return {
    type,
    pace,
    hours: [low, high],
    price: [priceLow, priceHigh],
    share,
    fraction: nearestFraction(share),
    weeks: [weeksLow, weeksHigh],
  };
}

export function money(n) {
  return '$' + n.toLocaleString('en-US');
}

// Project keys: J747-XXXX-XXXX, no look-alike characters (0/O, 1/I/L).
const KEY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const KEY_PATTERN = /^J747-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

export function makeProjectKey(rand = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = rand(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += KEY_ALPHABET[bytes[i] % KEY_ALPHABET.length];
  return `J747-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeKey(input) {
  const raw = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const body = raw.startsWith('J747') ? raw.slice(4) : raw;
  if (body.length !== 8) return raw;
  return `J747-${body.slice(0, 4)}-${body.slice(4)}`;
}
