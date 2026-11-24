import type { SupplyChainDataset, ValidationStatus } from './types';
import type { DataResult } from './adapter';
import { sum } from './measures';

/** The homepage dial has 48 positions (four years). */
export const DIAL_CAPACITY = 48;

/**
 * Views derived from one dataset. Every page and the 3D scene read numbers through these
 * functions, so they always describe the dataset the adapter returned and nothing else.
 */

/** The five customer segments. Used only to place an empty instrument (no data loaded). */
const SAMPLE_TERRITORIES = ['Novelty Shop', 'Supermarket', 'Gift Store', 'Computer Store', 'Corporate'];

/** Total revenue per month, from the sales facts. */
export function monthlyRevenue(ds: SupplyChainDataset): number[] {
  const out = new Array(ds.months.length).fill(0);
  for (const x of ds.facts) out[x.mi] += x.revenue;
  return out;
}

/** Each territory's share of revenue over the whole coverage. Negative totals count as zero size. */
export function territoryShare(ds: SupplyChainDataset): number[] {
  const out = new Array(ds.territories.length).fill(0);
  for (const x of ds.facts) out[x.t] += x.revenue;
  const pos = out.map((v) => Math.max(0, v));
  const tot = pos.reduce((a, b) => a + b, 0);
  return pos.map((v) => (tot ? v / tot : 1 / pos.length));
}

/* ------------------------------------------------------------------ the sky */
export type SkyData = {
  /** 'empty' draws the instrument with no data encoded in it: equal segments and a bare rim */
  kind: 'data' | 'empty';
  status: ValidationStatus | null;
  /** first calendar year on the rim; null hides the year labels */
  startYear: number | null;
  territories: { label: string; share: number }[];
  /** monthly totals for the dial, at most 48; empty when there is no data */
  dial: number[];
  /** `orders` is the supplier's number of purchase orders in the data (null when nothing is loaded) */
  suppliers: { label: string; orders: number | null }[];
  /** "demo" or "verified": used in node descriptions */
  qualifier: string;
  /** customers per segment, for the node captions (null when nothing is loaded) */
  customers: (number | null)[];
};

export function skyFromDataset(ds: SupplyChainDataset): SkyData {
  const q = ds.provenance.status === 'synthetic' ? 'demo' : 'verified';
  const share = territoryShare(ds);
  const poBySupplier = new Map<number, number>();
  ds.purchaseOrders.forEach((p) => poBySupplier.set(p.s, (poBySupplier.get(p.s) ?? 0) + 1));
  return {
    kind: 'data',
    status: ds.provenance.status,
    startYear: ds.months[0]?.y ?? null,
    territories: ds.territories.map((label, t) => ({ label, share: share[t] })),
    dial: monthlyRevenue(ds).slice(0, DIAL_CAPACITY),
    suppliers: ds.suppliers.map((s) => ({ label: s.label, orders: poBySupplier.get(s.id) ?? 0 })),
    qualifier: q,
    customers: ds.territories.map((_, t) => ds.customers.filter((c) => c.t === t).length),
  };
}

export const EMPTY_SKY: SkyData = {
  kind: 'empty',
  status: null,
  startYear: null,
  territories: SAMPLE_TERRITORIES.map((label) => ({ label, share: 1 / SAMPLE_TERRITORIES.length })),
  dial: [],
  suppliers: Array.from({ length: 7 }, () => ({ label: 'Supplier', orders: null })),
  qualifier: 'verified',
  customers: SAMPLE_TERRITORIES.map(() => null),
};

export const skyFor = (r: DataResult): SkyData => (r.state === 'ready' ? skyFromDataset(r.dataset) : EMPTY_SKY);

/* ------------------------------------------------------------------ homepage previews */
/** `id` names the Observatory domain; `v` is a monthly series for its sparkline (empty for the inventory snapshot). */
export type DomainPreview = { id: string; tone: string; v: number[] };

/** Monthly series that preview the six Observatory domains on the homepage. Labels are added by the page. */
export function domainPreviews(ds: SupplyChainDataset): DomainPreview[] {
  const n = ds.months.length;
  const byMonth = (f: (mi: number) => number) => Array.from({ length: n }, (_, mi) => f(mi));
  const fm = new Map<number, SupplyChainDataset['facts']>();
  ds.facts.forEach((x) => { const a = fm.get(x.mi); if (a) a.push(x); else fm.set(x.mi, [x]); });
  const om = new Map<number, number>();
  ds.orderFacts.forEach((x) => om.set(x.mi, (om.get(x.mi) ?? 0) + x.orders));
  const pm = new Map<number, number>(), pc = new Map<number, number>();
  ds.purchaseOrders.forEach((x) => { pm.set(x.mi, (pm.get(x.mi) ?? 0) + x.spend); pc.set(x.mi, (pc.get(x.mi) ?? 0) + 1); });
  const cm = new Map<number, Set<number>>();
  ds.customerFacts.forEach((x) => { const s = cm.get(x.mi) ?? new Set<number>(); s.add(x.cu); cm.set(x.mi, s); });
  return [
    { id: 'sales', tone: 'var(--glacier)', v: byMonth((m) => sum(fm.get(m) ?? [], (x) => x.revenue)) },
    { id: 'orders', tone: 'var(--chalk)', v: byMonth((m) => om.get(m) ?? 0) },
    { id: 'purchasing', tone: 'var(--brass)', v: byMonth((m) => pm.get(m) ?? 0) },
    { id: 'inventory', tone: 'var(--ember)', v: [] },
    { id: 'suppliers', tone: 'var(--brass)', v: byMonth((m) => pc.get(m) ?? 0) },
    { id: 'customers', tone: 'var(--glacier)', v: byMonth((m) => cm.get(m)?.size ?? 0) },
  ];
}
