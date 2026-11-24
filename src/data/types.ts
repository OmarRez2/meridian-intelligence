/**
 * Data contracts for the website.
 *
 * Every dataset carries its provenance and validation status, so the UI can always say where a
 * number came from. Synthetic (demo) and verified data share the same shape but never mix:
 * the adapter returns one or the other, or reports the verified one as missing.
 */

/** How far a dataset or a piece of content has been checked. Ordered from weakest to strongest. */
export type ValidationStatus =
  | 'synthetic'     // generated for the prototype; not derived from project data
  | 'illustrative'  // hand-written example content (diagrams, sample code); not project output
  | 'unverified'    // derived from project material but not yet reconciled
  | 'reconciled'    // matches the team's KPI benchmark across SQL, model and documentation
  | 'approved';     // signed off by the team for publication

/** English labels; the site shows them through `statusLabel()` in `i18n/strings.ts`, which also has Arabic. */
export const STATUS_LABEL: Record<ValidationStatus, string> = {
  synthetic: 'Synthetic demo data',
  illustrative: 'Illustrative example',
  unverified: 'Unverified',
  reconciled: 'Source-reconciled',
  approved: 'Team approved',
};

export type Provenance = {
  datasetId: string;
  label: string;
  status: ValidationStatus;
  /** Plain-language description of where the data comes from. */
  source: string;
  /** Inclusive coverage, ISO dates. */
  coverage: { from: string; to: string };
  /** When the export was produced (verified data) or generated (synthetic). */
  producedAt: string | null;
  /** Currency of every monetary field. The site formats US dollars only. */
  currency?: 'USD';
  /** Free-text caveats shown next to the data. */
  notes: string[];
};

export type MissingValueNote = { field: string; count: number; note: string };

/**
 * Field contracts (version 2). The full export contract, with units and relationships, is in
 * `docs/export-contract.md`; `validate.ts` enforces it. References between tables are zero-based
 * positions (`mi`, `t`, `c`, `s`) except customers, which are referenced by `id`.
 *
 * The two analysis axes are fixed for every dataset:
 *   - `territories` (`t`): customer segments, the source customer categories (Novelty Shop, Supermarket, ...)
 *   - `categories`  (`c`): product families, a documented grouping of stock items
 * The field names are kept from version 1 so the scene, validator and tests read both versions the same way.
 */
export type Month = { i: number; y: number; m: number; label: string };

/**
 * One row per month x segment x family. Revenue, profit, units and the loss fields come from invoice lines
 * (invoice month); `ordered` and `unmet` come from order lines (order month). All fields are additive.
 */
export type SalesFact = {
  mi: number; t: number; c: number;
  revenue: number; profit: number; units: number;
  /** invoice lines with negative recorded profit, and the absolute value of that profit */
  lossLines: number; loss: number;
  /** units ordered, and units ordered but not picked */
  ordered: number; unmet: number;
};
/** One row per month x segment (an order belongs to one customer, but often to several families). */
export type OrderFact = {
  mi: number; t: number;
  orders: number;
  /** orders that spawned a backorder for what could not be picked */
  backorders: number;
  /** invoices with a confirmed delivery, and those delivered on or before the order's expected date */
  deliveries: number; onTime: number;
};
/**
 * One row per purchase order. `leadDays` is order date to final receipt, null while any line is still open;
 * `onTime` is null for the same orders. `outers` and `received` are outer packs, not units.
 */
export type PurchaseOrder = { id?: number; mi: number; s: number; spend: number; lines: number; leadDays: number | null; expectedDays: number; onTime: boolean | null; outers?: number; received?: number };
/** `group` is the supplier's own category. `promise` is its typical expected lead time in days. */
export type Supplier = { id: number; label: string; group: string; promise: number };
/** Lifetime sales of one item over the whole coverage (same definitions as SalesFact). */
export type ItemSales = { revenue: number; profit: number; units: number; lossLines: number; loss: number; ordered: number; unmet: number };
export type StockItem = { id: number; label: string; c: number; reorder: number; onHand: number; monthlyUse: number; unitCost: number; unitPrice?: number; s?: number | null; sales?: ItemSales };
export type Customer = { id: number; label: string; t: number };
/** One row per month x customer with at least one invoice. */
export type CustomerFact = { mi: number; cu: number; revenue: number; orders: number };

/**
 * A benchmark is a KPI value the team has already reconciled (SQL, model and documentation agree).
 * The site recomputes each one from the export and rejects the export if they disagree.
 */
export type Benchmark = {
  metric: string;
  /** Must equal the unit in the metric registry. Ratios are fractions (0.25), not percentages. */
  unit: Unit;
  /** Whole calendar year and/or names from `territories` / `categories`. Omit for the full coverage. */
  scope?: { year?: number; territory?: string; category?: string };
  value: number;
  /** Relative tolerance; default 0.001 (0.1%). */
  tolerance?: number;
  /** Where the team's value comes from, e.g. "KPI benchmark sheet, row 4". */
  source: string;
};

export type SupplyChainDataset = {
  provenance: Provenance;
  months: Month[];
  years: number[];
  /** customer segments */
  territories: string[];
  /** product families */
  categories: string[];
  facts: SalesFact[];
  orderFacts: OrderFact[];
  purchaseOrders: PurchaseOrder[];
  suppliers: Supplier[];
  items: StockItem[];
  customers: Customer[];
  customerFacts: CustomerFact[];
  /** Reconciled KPI values the export is checked against. Optional for synthetic data. */
  benchmarks?: Benchmark[];
  missing: MissingValueNote[];
};

export type Filters = { year: number | null; territory: number | null; category: number | null };
export const noFilters = (): Filters => ({ year: null, territory: null, category: null });

/* ------------------------------------------------------------------ metrics */

export type Unit = 'currency' | 'count' | 'units' | 'ratio' | 'days' | 'hours' | 'months' | 'decimal';

/** Text in both site languages. */
export type Bi = { en: string; ar: string };

export type MetricDefinition = {
  id: string;
  label: Bi;
  unit: Unit;
  /** What the metric means, in plain language. */
  definition: Bi;
  /** How it is calculated, written for an analyst (kept in English: it names fields and functions). */
  formula: string;
  /** Which direction is favourable; 'neutral' when it depends on context. */
  better: 'up' | 'down' | 'neutral';
  /** 'proposed' until the team approves the definition. */
  status: 'proposed' | 'approved';
  /** Where the definition comes from: the team's Power BI measure, or the website's own analysis. */
  origin: 'team' | 'website';
};
