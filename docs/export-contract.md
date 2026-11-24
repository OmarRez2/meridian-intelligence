# Verified dataset contract

This document describes the version 2 JSON dataset used by the current website and the source builder that produced the checked-in export. The authoritative field and validation rules are implemented in `src/data/types.ts`, `src/data/validate.ts`, `src/data/measures.ts` and `scripts/build-real-dataset.py`.

## Trust and publication status

The website reads one JSON file from `src/data/verified/`, validates it, and never falls back to demo values. The checked-in `dataset.json` has provenance status `reconciled`; it is not marked `approved`. All metric definitions remain `proposed`, and website-derived findings and product-family assignments are pending team approval. Do not treat successful validation as publication approval.

The dataset contains aggregates and sample business labels, not raw source tables. It contains pseudonymous customer labels and no customer names, contacts or addresses. Keep source extracts, database files and Power BI files outside this website repository. The repository is intended to remain private until the project owners approve publication.

## Source builder

The current builder is `scripts/build-real-dataset.py`. It does not connect to SQL Server. It reads these twelve CSV inputs from a supplied folder:

| File stem | Use |
|---|---|
| `Sales_InvoiceLines` | Invoiced quantity, unit price and recorded line profit |
| `Sales_Invoices` | Invoice date, customer/order relationships and confirmed delivery date |
| `Sales_OrderLines` | Ordered and picked quantities |
| `Sales_Orders` | Order date, customer, expected delivery date and backorder reference |
| `Sales_Customers` | Customer identifiers and source segment references |
| `Sales_CustomerCategories` | Source customer segment labels |
| `Warehouse_StockItems` | Item, family input, reorder level, supplier and prices |
| `Warehouse_StockItemHoldings` | End-of-period quantity on hand |
| `Purchasing_PurchaseOrders` | Supplier, order date and expected delivery date |
| `Purchasing_PurchaseOrderLines` | Ordered/received outer packs, price and receipt dates |
| `Purchasing_Suppliers` | Supplier labels and source category references |
| `Purchasing_SupplierCategories` | Supplier group labels |

Existing project records describe an original bundle of sixteen read-only source exports. The current website builder reads the twelve inputs listed above because these are the tables used to derive its published sales, fulfilment, purchasing, inventory and customer aggregates. The remaining four exports are not consumed by the builder and are not needed to reproduce this website dataset; their names are not part of its input contract and are intentionally not guessed here. This reconciles the sixteen-file source handoff with the twelve-file website build without changing or regenerating the checked-in dataset.

`scripts/build-verified-dataset.mjs` is a legacy version 1 helper and is not the supported generator for the current export. Use the Python builder described here; do not use the legacy converter to replace the checked-in version 2 dataset.

With Python and pandas available, run from the project root:

```sh
python -B scripts/build-real-dataset.py approved-csv-folder
```

By default, the script writes `src/data/verified/dataset.json` and `docs/data/reconciliation.json`. It can instead take `--out` and `--report` output paths. It checks its selected totals against the benchmark values embedded in the script and exits rather than writing if those do not reconcile. The exact Python/pandas environment is not pinned in this repository; regeneration is therefore a controlled owner workflow, not a reproducible install command.

Do not run the builder with unapproved source files. Do not place raw source CSVs, database backups, Power BI files or extracts in this repository.

## Dataset shape and grain

The following describes the current `SupplyChainDataset` contract. References use zero-based positions except customer facts, which refer to the numeric customer `id`.

| Field | Grain / meaning |
|---|---|
| `provenance` | Dataset identifier, label, status, source, inclusive coverage, production time, USD currency and notes |
| `months`, `years` | Consecutive month records (`i`, `y`, zero-based `m`, display `label`) and covered years |
| `territories` | Customer-segment labels from the source categories |
| `categories` | Website-defined product-family labels |
| `facts` | One row per month × customer segment × product family; invoice sales and order-line demand measures |
| `orderFacts` | One row per month × customer segment; orders, backorders, confirmed deliveries and on-time deliveries |
| `purchaseOrders` | One row per purchase order; spend, line count, expected days, nullable completion/lead time and outer-pack counts |
| `suppliers` | Positional supplier id, label, source group and reference lead-time promise |
| `items` | One row per stock item; family, stock snapshot, prices, supplier reference and lifetime sales/demand aggregates |
| `customers` | Numeric customer id, pseudonymous label and source segment |
| `customerFacts` | One row per month × customer with invoiced revenue and distinct order count |
| `benchmarks` | Optional metric id, unit, value, source, tolerance and applicable year/segment/family scope |
| `missing` | Known source gaps with a count and visitor-facing note |

The current sales fact row contains `mi`, `t`, `c`, `revenue`, `profit`, `units`, `lossLines`, `loss`, `ordered` and `unmet`. These measures have different source event dates: invoiced measures use invoice month; ordered/unmet measures use order month. The separate `orderFacts` table prevents order counts from being duplicated across product families.

Purchase orders include `outers` and `received`, measured in outer packs. `leadDays` and `onTime` are null if any purchase-order line remains unreceived. Items include `unitPrice`, supplier reference `s`, and a nested `sales` summary in addition to stock-value fields. The builder emits those fields; the validator enforces the current type contract.

## Derivation rules

- **Revenue:** sum of invoice-line quantity × unit price, excluding tax.
- **Recorded profit:** sum of source line profit, including negative-profit lines.
- **Ordered and unpicked units:** sum of order-line quantity and quantity minus picked quantity.
- **Order fulfilment:** monthly order counts and backorders by source segment; confirmed-delivery punctuality compares the confirmed delivery date with the order's expected date.
- **Purchase spend:** ordered outer packs × expected price per outer. Lead time is measured to final receipt and is available only for fully received purchase orders.
- **Inventory:** a single holdings snapshot. Stock value is on-hand quantity × last cost price; average monthly use is computed from recent sales. There is no inventory history.
- **Customers:** customer-month revenue and distinct order counts derived from invoice lines. Names are replaced with `Customer <id>` labels.
- **Product families:** website-defined keyword groups applied to item names in first-match order. They are not source-provided product categories.

Metric formulas and filter scope are maintained once in `src/data/measures.ts` and described in `src/data/metrics.ts`. The validator uses those same measure functions to recompute the included benchmarks. Ratios are fractions from zero to one, not percentage values.

## Provenance and validation

Verified files must have a valid provenance object and a status allowed by `src/data/validate.ts` (`reconciled` or `approved`). The validator checks required fields and arrays, coverage and consecutive months, numeric and boolean types, ranges, uniqueness, positional references, non-empty sales facts and benchmark reconciliation. It rejects the whole file on errors; warnings are retained and displayed rather than silently repaired.

The current dataset includes thirteen benchmark rows. Their values and source descriptions are data provenance, not approval of the website's proposed metric semantics. A dataset can pass structural validation without making the website's own analysis a team-approved finding.

The verified loader imports files matching `src/data/verified/*.json`. Keep exactly one export in that directory. Zero exports produce an explicit unavailable state; multiple files are treated as ambiguous and rejected. The dev-only fixture seam in `src/data/verified.ts` is for browser tests and must not be used to replace or modify the shipped dataset.

## Validation commands

| Check | Command |
|---|---|
| Contract, measures, registry and architecture tests | `node scripts/test-data.mjs` |
| Browser checks of verified/demo, missing and invalid states | `node scripts/check-data-modes.mjs` (requires the local dev server) |
| Validate and render the current site | `npm run build` |
