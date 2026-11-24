import '../styles/manifest.css';
import type { Page } from '../lib/router';
import { fmt } from '../charts/kit';
import { getDataset } from '../data/adapter';
import { monthlyRevenue } from '../data/derive';
import { dataStatePanel } from '../components/datastate';

/** Alternative direction study: "Manifest". Lighter build — enough to judge its character. */
const page: Page & { stop?: () => void } = {
  async mount(root) {
    // a design study, but its numbers still come through the adapter and follow the data mode
    const result = await getDataset();
    const ds = result.state === 'ready' ? result.dataset : null;
    const series = ds ? monthlyRevenue(ds) : [];
    const MONTHS = ds?.months ?? [];
    const UNIT = (series.length ? Math.max(...series) : 1) / 9;
    const synthetic = ds?.provenance.status === 'synthetic';
    root.innerHTML = `
    <div class="mf">
      <header class="mf-hero">
        <p class="mf-crumb"><a href="#/directions">Design directions</a> / Manifest study</p>
        <h1 class="mf-title">Manifest</h1>
        <div class="mf-doc" role="group" aria-label="Document header">
          <div><span>Consignor</span><b>${ds ? `${ds.suppliers.length} suppliers` : 'Suppliers'}</b></div>
          <div><span>Port of call</span><b>One warehouse</b></div>
          <div><span>Consignee</span><b>${ds ? `Customers in ${ds.territories.length} territories` : 'Customers'}</b></div>
          <div><span>Period</span><b>${ds ? `${MONTHS[0].label} to ${MONTHS[MONTHS.length - 1].label}` : 'No data loaded'}</b></div>
          <div class="mf-docstamp"><span class="stamp">${synthetic ? 'Synthetic demo' : ds ? 'Verified view' : 'No data'}</span></div>
        </div>
        <p class="mf-lede">The supply chain read as its own paperwork. Every month is a container; every finding is stamped onto the record once someone has checked it.</p>
      </header>

      <section class="yard" aria-labelledby="yard-h">
        ${result.state === 'ready' ? `<div class="yard-head"><h2 id="yard-h">Container yard</h2><p>One stack per month. Each container is ${fmt.money(UNIT)} of ${synthetic ? 'synthetic' : 'verified'} revenue.</p></div>
        <div class="yard-stacks" role="img" aria-label="Stacked container chart of ${synthetic ? 'synthetic' : 'verified'} monthly revenue from ${MONTHS[0]?.label} to ${MONTHS[MONTHS.length - 1]?.label}">
          ${series.map((v, i) => {
            const n = Math.max(1, Math.round(v / UNIT));
            return `<div class="stack" style="--n:${n}" title="${MONTHS[i].label}: ${fmt.money(v)}">${Array.from({ length: n }, (_, k) => `<i style="--k:${k};--c:${i}" class="${(i + k) % 7 === 0 ? 'y' : ''}"></i>`).join('')}${MONTHS[i].m === 0 ? `<em>${MONTHS[i].y}</em>` : ''}</div>`;
          }).join('')}
        </div>` : `<div class="yard-head"><h2 id="yard-h">Container yard</h2></div>${dataStatePanel(result, '/directions/manifest', { compact: true, headingId: 'yard-state' })}<div class="yard-stacks"></div>`}
      </section>

      <section class="ledger" aria-labelledby="ledger-h">
        <h2 id="ledger-h">On the record</h2>
        <ol>
          <li><span class="ref num">Ref. S-01</span><p>Which territories and stock groups carry revenue, and which carry profit?</p><span class="stamp pending">Pending verification</span></li>
          <li><span class="ref num">Ref. O-02</span><p>Where do backorders cluster, and how long do picked orders wait?</p><span class="stamp pending">Pending verification</span></li>
          <li><span class="ref num">Ref. P-03</span><p>How far do supplier lead times drift from what was promised?</p><span class="stamp pending">Pending verification</span></li>
        </ol>
        <a class="mf-back" href="#/directions">Back to the design directions</a>
      </section>
    </div>`;

    const yard = root.querySelector<HTMLElement>('.yard-stacks')!;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { yard.classList.add('in'); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(yard);
    const stamps = root.querySelectorAll('.ledger li');
    const io2 = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && e.target.classList.add('in')), { threshold: 0.6 });
    stamps.forEach((s) => io2.observe(s));
    this.stop = () => { io.disconnect(); io2.disconnect(); };
  },
  unmount() { this.stop?.(); },
};
export default page;
