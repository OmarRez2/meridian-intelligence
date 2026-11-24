import type { Bi, ValidationStatus } from '../data/types';

/**
 * Language state for the whole site (English and Arabic).
 *
 * Content is written next to the code that renders it, as `L('English', 'العربية')` or as `{ en, ar }`
 * objects read with `tr()`. Pages are remounted when the language changes (see `main.ts`), so a string is
 * always produced in the current language. The choice is remembered per browser; `?lang=ar` in the URL
 * (search part) overrides it, which keeps screenshots and links reproducible.
 *
 * Numbers use Western digits in both languages: the figures are financial and technical, they sit next to
 * English product and supplier names, and Western digits are the norm in Egyptian business reporting.
 * Months are the Egyptian names (يناير … ديسمبر). Code, formulas and identifiers stay left-to-right.
 */
export type Lang = 'en' | 'ar';
type Listener = (l: Lang) => void;
const KEY = 'meridian:lang';
const listeners = new Set<Listener>();

function initial(): Lang {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'ar' || q === 'en') return q;
  try { const s = localStorage.getItem(KEY); if (s === 'ar' || s === 'en') return s; } catch { /* storage blocked */ }
  return 'en';
}

export const i18n = {
  lang: initial() as Lang,
  get rtl() { return this.lang === 'ar'; },
  set(l: Lang) {
    if (l === this.lang) return;
    this.lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* keep in memory only */ }
    apply();
    listeners.forEach((f) => f(l));
  },
  subscribe(f: Listener) { listeners.add(f); return () => { listeners.delete(f); }; },
};

export function apply() {
  const h = document.documentElement;
  h.lang = i18n.lang;
  h.dir = i18n.rtl ? 'rtl' : 'ltr';
}

/** Inline bilingual text. */
export const L = (en: string, ar: string) => (i18n.lang === 'ar' ? ar : en);
/** Reads a `{ en, ar }` object. */
export const tr = (b: Bi) => b[i18n.lang];
/** Isolates a left-to-right run (code, a formula, an English name) inside Arabic text. */
export const ltr = (s: string) => `<bdi dir="ltr">${s}</bdi>`;

/* ------------------------------------------------------------------ names that come from the data */
const SEGMENTS: Record<string, string> = {
  'Novelty Shop': 'متاجر الهدايا الطريفة', Supermarket: 'السوبر ماركت', 'Gift Store': 'متاجر الهدايا', 'Computer Store': 'متاجر الكمبيوتر', Corporate: 'الشركات',
  Agent: 'الوكلاء', Wholesaler: 'تجار الجملة', 'General Retailer': 'تجار التجزئة العامة',
};
const SEGMENTS_EN: Record<string, string> = { 'Novelty Shop': 'Novelty shops', Supermarket: 'Supermarkets', 'Gift Store': 'Gift stores', 'Computer Store': 'Computer stores', Corporate: 'Corporate buyers' };
const FAMILIES: Record<string, string> = {
  'USB & desk novelties': 'طرائف USB والمكتب', 'Joke mugs': 'أكواب الدعابة', Toys: 'الألعاب', 'Novelty footwear': 'أحذية وجوارب طريفة',
  'Halloween masks': 'أقنعة الهالوين', Apparel: 'الملابس', Confectionery: 'الحلويات', 'Packaging & shipping': 'التغليف والشحن',
};
const SUPPLIER_GROUPS: Record<string, string> = {
  'Novelty Goods Supplier': 'مورّد سلع طريفة', 'Clothing Supplier': 'مورّد ملابس', 'Packaging Supplier': 'مورّد تغليف', 'Toy Supplier': 'مورّد ألعاب', 'Demo supplier': 'مورّد تجريبي',
};
/** A customer segment (source customer category) in the current language. */
export const segName = (s: string) => (i18n.lang === 'ar' ? SEGMENTS[s] ?? s : SEGMENTS_EN[s] ?? s);
/** A product family (website grouping) in the current language. */
export const famName = (s: string) => (i18n.lang === 'ar' ? FAMILIES[s] ?? s : s);
export const supplierGroup = (s: string) => (i18n.lang === 'ar' ? SUPPLIER_GROUPS[s] ?? s : s);
/** Customers have no names in the exports; they are shown by their numeric id. */
export const customerName = (id: number) => (i18n.lang === 'ar' ? `العميل ${id}` : `Customer ${id}`);

const STATUS: Record<ValidationStatus, Bi> = {
  synthetic: { en: 'Synthetic demo data', ar: 'بيانات تجريبية مُولَّدة' },
  illustrative: { en: 'Illustrative example', ar: 'مثال توضيحي' },
  unverified: { en: 'Unverified', ar: 'غير مُتحقَّق منه' },
  reconciled: { en: 'Source-reconciled', ar: 'مطابق للمصدر' },
  approved: { en: 'Team approved', ar: 'معتمد من الفريق' },
};
export const statusLabel = (s: ValidationStatus) => tr(STATUS[s]);

/* ------------------------------------------------------------------ dates */
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_EN_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthShort = (m: number) => (i18n.lang === 'ar' ? MONTHS_AR[m] : MONTHS_EN[m]);
export const monthLong = (m: number) => (i18n.lang === 'ar' ? MONTHS_AR[m] : MONTHS_EN_LONG[m]);
/** "Jan 2013" / "يناير 2013" */
export const monthLabel = (y: number, m: number) => `${monthShort(m)} ${y}`;
/** ISO date → "31 May 2016" / "31 مايو 2016" */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${monthLong(m - 1)} ${y}`;
}

/* ------------------------------------------------------------------ numbers */
const group = (v: number, digits = 0) => v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
/** The Arabic percent sign follows the number, as in Arabic typesetting. */
export const pct = (v: number, digits = 1) => (i18n.lang === 'ar' ? `${(v * 100).toFixed(digits)}٪` : `${(v * 100).toFixed(digits)}%`);
export function money(v: number) {
  const a = Math.abs(v), s = v < 0 ? '−' : '';
  if (i18n.lang === 'ar') {
    if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)} مليار $`;
    if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)} مليون $`;
    if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)} ألف $`;
    return `${s}${a.toFixed(0)} $`;
  }
  if (a >= 1e9) return `${s}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(1)}K`;
  return `${s}$${a.toFixed(0)}`;
}
/** Exact currency, for reconciliation tables: $172,261,341.20 */
export const moneyExact = (v: number) => (i18n.lang === 'ar' ? `${group(v, 2)} $` : `$${group(v, 2)}`);
export const int = (v: number) => group(Math.round(v));
export const days = (v: number) => (i18n.lang === 'ar' ? `${v.toFixed(1)} يوم` : `${v.toFixed(1)} days`);
export const months = (v: number) => (i18n.lang === 'ar' ? `${v.toFixed(1)} شهر` : `${v.toFixed(1)} mo`);
export const hours = (v: number) => (i18n.lang === 'ar' ? `${v.toFixed(1)} ساعة` : `${v.toFixed(1)} h`);
/** "+8.1%" with a true minus sign */
export const signedPct = (v: number, digits = 1) => `${v >= 0 ? '+' : '−'}${pct(Math.abs(v), digits)}`;
