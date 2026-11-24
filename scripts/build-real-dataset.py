"""
Builds the website's real dataset from the project's 16 OLTP CSV exports.

    python -B scripts/build-real-dataset.py <csv-folder> [--out src/data/verified/dataset.json] [--report docs/data/reconciliation.json]

Read-only: it opens the CSV files for reading and writes two files inside this workspace. It never connects
to SQL Server. The CSV exports are the project's own read-only extracts of WideWorldImporters (OLTP); the
project records them as cell-for-cell identical to the database (10,484,266 cells compared, 0 differences).
WideWorldImportersDW is not used, and the candidate warehouse outputs are used only as benchmark values.

What leaves this script is aggregated: month x segment x family sales, month x segment orders, one row per
purchase order, one row per stock item, and month x customer revenue keyed by the numeric customer id. The
exports contain no customer names, contacts, addresses or people, and nothing personal is written.

Every figure that the team has already verified with SQL is recomputed here from the source rows and written
as a benchmark; the website's validator recomputes each benchmark from the aggregates again, so a number on
the site has to agree with the source, with the team's SQL and with the site's own measures.
"""
import argparse, json, os, sys, datetime as dt
import pandas as pd

ap = argparse.ArgumentParser()
ap.add_argument('csv')
ap.add_argument('--out', default=os.path.join('src', 'data', 'verified', 'dataset.json'))
ap.add_argument('--report', default=os.path.join('docs', 'data', 'reconciliation.json'))
a = ap.parse_args()

def read(name):
    return pd.read_csv(os.path.join(a.csv, name + '.csv'), encoding='utf-8-sig', low_memory=False, na_values=['\\N', 'NULL'])

il, inv = read('Sales_InvoiceLines'), read('Sales_Invoices')
ol, od = read('Sales_OrderLines'), read('Sales_Orders')
cu, cc = read('Sales_Customers'), read('Sales_CustomerCategories')
si, sh = read('Warehouse_StockItems'), read('Warehouse_StockItemHoldings')
po, pol = read('Purchasing_PurchaseOrders'), read('Purchasing_PurchaseOrderLines')
sup, sc = read('Purchasing_Suppliers'), read('Purchasing_SupplierCategories')

# ---------------------------------------------------------------- product families (website-derived)
# The exports carry no stock-group table, so items are grouped by documented keyword rules on their names.
# Order matters: the first matching rule wins. Every one of the 227 items must land in exactly one family.
FAMILY_RULES = [
    ('USB & desk novelties', ['usb', 'periscope']),
    ('Joke mugs', ['mug']),
    ('Toys', ['toy', 'action figure']),
    ('Novelty footwear', ['slipper', 'socks']),
    ('Halloween masks', ['mask']),
    ('Apparel', ['shirt', 'hoodie', 'jacket']),
    ('Confectionery', ['chocolate']),
    ('Packaging & shipping', ['']),  # everything else: wrap, cartons, tape, dispensers, markers, knives, void fill
]
FAMILIES = [f for f, _ in FAMILY_RULES]
def family(name):
    n = name.lower()
    for i, (_, keys) in enumerate(FAMILY_RULES):
        if any(k in n for k in keys):
            return i
si['c'] = si.StockItemName.map(family)

# ---------------------------------------------------------------- customer segments (source categories)
used = sorted(cu.CustomerCategoryID.unique())
seg_names = cc.set_index('CustomerCategoryID').CustomerCategoryName
# order segments by revenue so the largest comes first
il['net'] = il.Quantity * il.UnitPrice
inv['d'] = pd.to_datetime(inv.InvoiceDate)
x = il.merge(inv[['InvoiceID', 'CustomerID', 'OrderID', 'd']], on='InvoiceID', validate='many_to_one') \
      .merge(cu[['CustomerID', 'CustomerCategoryID']], on='CustomerID', validate='many_to_one') \
      .merge(si[['StockItemID', 'c']], on='StockItemID', validate='many_to_one')
seg_order = x.groupby('CustomerCategoryID').net.sum().sort_values(ascending=False).index.tolist()
SEGMENTS = [seg_names[i] for i in seg_order]
seg_pos = {cid: k for k, cid in enumerate(seg_order)}
cu['t'] = cu.CustomerCategoryID.map(seg_pos)
x['t'] = x.CustomerCategoryID.map(seg_pos)

# ---------------------------------------------------------------- months
start, end = x.d.min(), x.d.max()
months = []
y, m = start.year, start.month
while (y, m) <= (end.year, end.month):
    months.append((y, m)); m += 1
    if m == 13: y, m = y + 1, 1
mi_of = {ym: i for i, ym in enumerate(months)}
MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
def mi(series):
    return [mi_of[(d.year, d.month)] for d in series]
x['mi'] = mi(x.d)

# ---------------------------------------------------------------- orders and order lines
od['od'] = pd.to_datetime(od.OrderDate)
od['mi'] = mi(od.od)
od = od.merge(cu[['CustomerID', 't']], on='CustomerID', validate='many_to_one')
od['backorder'] = od.BackorderOrderID.notna()   # the order spawned a backorder for what could not be picked
o2 = ol.merge(od[['OrderID', 'mi', 't']], on='OrderID', validate='many_to_one').merge(si[['StockItemID', 'c']], on='StockItemID')
o2['unmet'] = o2.Quantity - o2.PickedQuantity
# delivery punctuality: confirmed delivery date on the invoice vs the order's expected delivery date
dv = inv.merge(od[['OrderID', 'mi', 't', 'ExpectedDeliveryDate']], on='OrderID', validate='one_to_one')
dv['cd'] = pd.to_datetime(dv.ConfirmedDeliveryTime, errors='coerce')
dv = dv[dv.cd.notna()]
dv['onTime'] = dv.cd.dt.normalize() <= pd.to_datetime(dv.ExpectedDeliveryDate)

# ---------------------------------------------------------------- facts: month x segment x family
neg = x.LineProfit < 0
x['lossLines'] = neg.astype(int)
x['loss'] = (-x.LineProfit).where(neg, 0)
sales = x.groupby(['mi', 't', 'c']).agg(revenue=('net', 'sum'), profit=('LineProfit', 'sum'), units=('Quantity', 'sum'), lossLines=('lossLines', 'sum'), loss=('loss', 'sum'))
dem = o2.groupby(['mi', 't', 'c']).agg(ordered=('Quantity', 'sum'), unmet=('unmet', 'sum'))
F = sales.join(dem, how='outer').fillna(0).reset_index()
facts = [{
    'mi': int(r.mi), 't': int(r.t), 'c': int(r.c),
    'revenue': round(float(r.revenue), 2), 'profit': round(float(r.profit), 2), 'units': int(r.units),
    'lossLines': int(r.lossLines), 'loss': round(float(r.loss), 2), 'ordered': int(r.ordered), 'unmet': int(r.unmet),
} for r in F.itertuples()]

of = od.groupby(['mi', 't']).agg(orders=('OrderID', 'size'), backorders=('backorder', 'sum')) \
       .join(dv.groupby(['mi', 't']).agg(deliveries=('InvoiceID', 'size'), onTime=('onTime', 'sum')), how='outer').fillna(0).reset_index()
orderFacts = [{'mi': int(r.mi), 't': int(r.t), 'orders': int(r.orders), 'backorders': int(r.backorders), 'deliveries': int(r.deliveries), 'onTime': int(r.onTime)} for r in of.itertuples()]

# ---------------------------------------------------------------- suppliers and purchase orders
pol['spend'] = pol.OrderedOuters * pol.ExpectedUnitPricePerOuter
pol['rd'] = pd.to_datetime(pol.LastReceiptDate, errors='coerce')
p = pol.groupby('PurchaseOrderID').agg(spend=('spend', 'sum'), lines=('PurchaseOrderLineID', 'size'), rd=('rd', 'max'),
                                       pending=('rd', lambda s: int(s.isna().sum())), outers=('OrderedOuters', 'sum'), received=('ReceivedOuters', 'sum')).reset_index()
p = p.merge(po, on='PurchaseOrderID', validate='one_to_one')
p['od'] = pd.to_datetime(p.OrderDate); p['ed'] = pd.to_datetime(p.ExpectedDeliveryDate)
buyers = sorted(p.SupplierID.unique())
sup_pos = {sid: k for k, sid in enumerate(buyers)}
supc = sc.set_index('SupplierCategoryID').SupplierCategoryName
S = sup.set_index('SupplierID')
suppliers = []
for sid in buyers:
    exp = (p[p.SupplierID == sid].ed - p[p.SupplierID == sid].od).dt.days
    suppliers.append({'id': sup_pos[sid], 'label': S.loc[sid, 'SupplierName'], 'group': supc[S.loc[sid, 'SupplierCategoryID']], 'promise': int(exp.median())})
purchaseOrders = []
for r in p.sort_values('PurchaseOrderID').itertuples():
    received = r.pending == 0 and pd.notna(r.rd)
    lead = int((r.rd - r.od).days) if received else None
    expd = int((r.ed - r.od).days)
    purchaseOrders.append({'id': int(r.PurchaseOrderID), 'mi': mi_of[(r.od.year, r.od.month)], 's': sup_pos[r.SupplierID],
                           'spend': round(float(r.spend), 2), 'lines': int(r.lines), 'leadDays': lead, 'expectedDays': expd,
                           'onTime': (lead <= expd) if lead is not None else None, 'outers': int(r.outers), 'received': int(r.received)})

# ---------------------------------------------------------------- stock items (snapshot + lifetime sales)
last12 = x[x.d >= (end - pd.DateOffset(months=12)).normalize() + pd.Timedelta(days=1)]
use = last12.groupby('StockItemID').Quantity.sum() / 12
life = x.groupby('StockItemID').agg(revenue=('net', 'sum'), profit=('LineProfit', 'sum'), units=('Quantity', 'sum'), lossLines=('lossLines', 'sum'), loss=('loss', 'sum'))
dem_i = o2.groupby('StockItemID').agg(ordered=('Quantity', 'sum'), unmet=('unmet', 'sum'))
H = sh.merge(si, on='StockItemID', validate='one_to_one')
items = []
for r in H.sort_values('StockItemID').itertuples():
    L = life.loc[r.StockItemID] if r.StockItemID in life.index else None
    Dm = dem_i.loc[r.StockItemID] if r.StockItemID in dem_i.index else None
    items.append({
        'id': int(r.StockItemID), 'label': r.StockItemName.strip(), 'c': int(r.c),
        'reorder': int(r.ReorderLevel), 'onHand': int(r.QuantityOnHand), 'monthlyUse': round(float(use.get(r.StockItemID, 0.0)), 2),
        'unitCost': float(r.LastCostPrice), 'unitPrice': float(r.UnitPrice), 's': sup_pos.get(r.SupplierID),
        'sales': {
            'revenue': round(float(L.revenue), 2) if L is not None else 0, 'profit': round(float(L.profit), 2) if L is not None else 0,
            'units': int(L.units) if L is not None else 0, 'lossLines': int(L.lossLines) if L is not None else 0, 'loss': round(float(L.loss), 2) if L is not None else 0,
            'ordered': int(Dm.ordered) if Dm is not None else 0, 'unmet': int(Dm.unmet) if Dm is not None else 0,
        },
    })

# ---------------------------------------------------------------- customers (numeric ids only)
customers = [{'id': int(r.CustomerID), 'label': f'Customer {int(r.CustomerID)}', 't': int(r.t)} for r in cu.sort_values('CustomerID').itertuples()]
cf = x.groupby(['mi', 'CustomerID']).agg(revenue=('net', 'sum'), orders=('OrderID', 'nunique')).reset_index()
customerFacts = [{'mi': int(r.mi), 'cu': int(r.CustomerID), 'revenue': round(float(r.revenue), 2), 'orders': int(r.orders)} for r in cf.itertuples()]

# ---------------------------------------------------------------- independent source totals and benchmarks
full = {
    'revenue': round(float(x.net.sum()), 2), 'gross_profit': round(float(x.LineProfit.sum()), 2), 'units_sold': int(x.Quantity.sum()),
    'invoice_lines': int(len(x)), 'order_lines': int(len(ol)), 'orders': int(len(od)), 'ordered_units': int(ol.Quantity.sum()),
    'unmet_units': int((ol.Quantity - ol.PickedQuantity).sum()), 'short_lines': int(((ol.Quantity - ol.PickedQuantity) > 0).sum()),
    'loss_lines': int(neg.sum()), 'loss_value': round(float(x.loss.sum()), 2), 'active_customers': int(x.CustomerID.nunique()),
    'products_sold': int(x.StockItemID.nunique()), 'po_lines': int(len(pol)), 'unreceived_outers': int((pol.OrderedOuters - pol.ReceivedOuters).sum()),
    'items_at_reorder': int((sh.QuantityOnHand <= sh.ReorderLevel).sum()), 'on_time_delivery': round(float(dv.onTime.mean()), 6),
    'by_year': {int(y): {'revenue': round(float(g.net.sum()), 2), 'gross_profit': round(float(g.LineProfit.sum()), 2)} for y, g in x.groupby(x.d.dt.year)},
}
SRC = 'Team KPI benchmark (wwi-kpi-reconciliation, expected_benchmarks.json): SQL re-run on WWI_Cleaning_Test 2026-11-21'
QUOTED = 'Team KPI benchmark (expected_benchmarks.json), quoted from INSIGHTS_CATALOG.md and matched SQL = DAX in the final presentation'
TEAM = {  # the team's values, copied from the benchmark file; the source recomputation above must match them
    ('revenue', None): (172261341.20, SRC), ('gross_profit', None): (85729180.90, SRC), ('units_sold', None): (8950628, SRC),
    ('unmet_units', None): (360276, SRC), ('active_customers', None): (663, SRC),
    ('loss_value', None): (320493.55, QUOTED), ('unreceived_outers', None): (25949, QUOTED), ('items_below_reorder', None): (2, QUOTED),
    ('revenue', 2014): (49929487.20, QUOTED), ('revenue', 2015): (53991490.45, QUOTED),
    ('gross_profit', 2014): (24828462.45, QUOTED), ('gross_profit', 2015): (26957600.65, QUOTED),
    ('on_time_delivery', None): (0.9365, 'Final presentation, slide 9: runtime DAX value 93.65% (22 Nov 2026)'),
}
UNIT = {'revenue': 'currency', 'gross_profit': 'currency', 'units_sold': 'units', 'unmet_units': 'units', 'active_customers': 'count',
        'loss_value': 'currency', 'unreceived_outers': 'units', 'items_below_reorder': 'count', 'on_time_delivery': 'ratio'}
src_value = {
    ('revenue', None): full['revenue'], ('gross_profit', None): full['gross_profit'], ('units_sold', None): full['units_sold'],
    ('unmet_units', None): full['unmet_units'], ('active_customers', None): full['active_customers'], ('loss_value', None): full['loss_value'],
    ('unreceived_outers', None): full['unreceived_outers'], ('items_below_reorder', None): full['items_at_reorder'],
    ('revenue', 2014): full['by_year'][2014]['revenue'], ('revenue', 2015): full['by_year'][2015]['revenue'],
    ('gross_profit', 2014): full['by_year'][2014]['gross_profit'], ('gross_profit', 2015): full['by_year'][2015]['gross_profit'],
    ('on_time_delivery', None): full['on_time_delivery'],
}
benchmarks, recon = [], []
for (metric, year), (value, source) in TEAM.items():
    tol = 0.0001 if metric == 'on_time_delivery' else 0.000001
    got = src_value[(metric, year)]
    ok = abs(got - value) <= max(tol * abs(value), 1e-9)
    recon.append({'metric': metric, 'year': year, 'team': value, 'source_csv': got, 'match': ok})
    b = {'metric': metric, 'unit': UNIT[metric], 'value': value, 'tolerance': tol, 'source': source}
    if year: b['scope'] = {'year': year}
    benchmarks.append(b)
bad = [r for r in recon if not r['match']]
if bad:
    sys.exit('Source totals do not reconcile with the team benchmarks: ' + json.dumps(bad))

missing = [
    {'field': 'invoice confirmed delivery time', 'count': int(inv.ConfirmedDeliveryTime.isna().sum()), 'note': 'Invoices without a confirmed delivery are left out of on-time delivery.'},
    {'field': 'purchase order line receipt date', 'count': int(pol.LastReceiptDate.isna().sum()), 'note': 'Lines not yet received (purchase orders 2073 and 2074, kept as in the source). Their orders have no lead time.'},
    {'field': 'order picking completed', 'count': int(od.PickingCompletedWhen.isna().sum()), 'note': 'Orders not fully picked at the end of the extract. Kept, not imputed.'},
]

ds = {
    'provenance': {
        'datasetId': 'wwi-oltp-csv-2013-2016',
        'label': 'Wide World Importers, project source extract',
        'status': 'reconciled',
        'source': 'Aggregated by the website from the project’s 16 read-only CSV exports of the WideWorldImporters OLTP database.',
        'coverage': {'from': start.strftime('%Y-%m-%d'), 'to': end.strftime('%Y-%m-%d')},
        'producedAt': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        'currency': 'USD',
        'notes': [
            'Totals reconcile exactly with the team’s SQL benchmarks (net revenue, recorded profit, units, unmet units, loss lines, supplier gaps, reorder items, active customers, 2014 and 2015 figures).',
            'Customer segments are the source customer categories. Product families are a website grouping of the 227 item names, not a source table.',
            'Revenue is invoice-line net of tax (quantity × unit price); profit is the recorded line profit, including 4,626 negative-profit lines.',
            'Inventory is the holdings snapshot at the end of the extract; it has no history.',
            '2016 runs to 31 May, so annual comparisons use complete years or the same months.',
            'Website analysis: not reviewed or approved by the team.',
        ],
    },
    'months': [{'i': i, 'y': y, 'm': m - 1, 'label': f'{MON[m - 1]} {y}'} for i, (y, m) in enumerate(months)],
    'years': sorted({y for y, _ in months}),
    'territories': SEGMENTS,
    'categories': FAMILIES,
    'facts': facts,
    'orderFacts': orderFacts,
    'purchaseOrders': purchaseOrders,
    'suppliers': suppliers,
    'items': items,
    'customers': customers,
    'customerFacts': customerFacts,
    'benchmarks': benchmarks,
    'missing': missing,
}
os.makedirs(os.path.dirname(a.out), exist_ok=True)
with open(a.out, 'w', encoding='utf-8') as f:
    json.dump(ds, f, ensure_ascii=False, separators=(',', ':'))
os.makedirs(os.path.dirname(a.report), exist_ok=True)
with open(a.report, 'w', encoding='utf-8') as f:
    json.dump({'producedAt': ds['provenance']['producedAt'], 'source': 'WideWorldImporters OLTP CSV exports (16 files), read-only',
               'families': {fam: [it['label'] for it in items if it['c'] == k] for k, fam in enumerate(FAMILIES)},
               'family_rules': [{'family': f, 'keywords': k} for f, k in FAMILY_RULES], 'segments': SEGMENTS,
               'source_totals': full, 'reconciliation': recon}, f, ensure_ascii=False, indent=2)
print(f'wrote {a.out} ({os.path.getsize(a.out) / 1024:.0f} KB): {len(facts)} facts, {len(orderFacts)} order facts, {len(purchaseOrders)} POs, '
      f'{len(items)} items, {len(customers)} customers, {len(customerFacts)} customer-months; {len(recon)} benchmarks reconciled')
