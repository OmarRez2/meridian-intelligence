import type { Unit } from '../data/types';
import { money, int, pct, days, hours, months, L } from '../i18n';

export type Fmt = (v: number) => string;

/** Formatters follow the current language (see `i18n/index.ts`); call them at render time. */
export const fmt = {
  money,
  int,
  pct: (v: number) => pct(v),
  days,
  hours,
  months,
  dec: (v: number) => v.toFixed(1),
};

export const formatFor = (u: Unit): Fmt =>
  ({ currency: fmt.money, count: fmt.int, units: fmt.int, ratio: fmt.pct, days: fmt.days, hours: fmt.hours, months: fmt.months, decimal: fmt.dec })[u];

export const unitLabel = (u: Unit): string => ({
  currency: L('US dollars', 'الدولار الأمريكي'), count: L('a count', 'عدد'), units: L('units', 'وحدات'), ratio: L('a percentage', 'نسبة مئوية'),
  days: L('days', 'أيام'), hours: L('hours', 'ساعات'), months: L('months', 'أشهر'), decimal: L('a ratio', 'نسبة'),
})[u];

/** Escape text before it goes into an HTML template string. */
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
