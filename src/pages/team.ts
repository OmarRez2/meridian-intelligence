import '../styles/team.css';
import type { Page } from '../lib/router';
import { pageHeader, nextChapter, siteFooter, statusBadge } from '../components/shell';
import { revealOnScroll } from '../components/tabs';
import { MEMBERS, WORKSTREAMS, TECHNOLOGIES, RESOURCES, type Member } from '../content/site';
import { esc } from '../lib/format';
import { L, tr } from '../i18n';

const BASE = import.meta.env.BASE_URL;
/** Leader at the top of the chart, the five workstreams fanned beneath (viewBox 1000 x 280). */
const LEADER: [number, number] = [500, 56];
const TEAM_POS: [number, number][] = [[110, 214], [305, 236], [500, 246], [695, 236], [890, 214]];

const initials = (m: Member) => tr(m.name).split(/\s+/).slice(0, 2).map((w) => [...w][0]).join(L('', ' '));

function portrait(m: Member, size: 'lg' | 'md') {
  if (!m.portrait) {
    return `<div class="pt pt-${size} pt-mono" role="img" aria-label="${esc(tr(m.name))}"><span>${esc(initials(m))}</span></div>`;
  }
  const px = size === 'lg' ? 320 : 200;
  return `<div class="pt pt-${size}"><picture><source srcset="${BASE}team/${m.portrait}.webp" type="image/webp"><img src="${BASE}team/${m.portrait}.jpg" alt="${L(`Portrait of ${esc(m.name.en)}`, `صورة ${esc(m.name.ar)}`)}" width="${px}" height="${px}" loading="lazy" decoding="async"></picture></div>`;
}

function links(m: Member) {
  if (!m.links.length) return '';
  const label = { linkedin: 'LinkedIn', github: 'GitHub' };
  return `<p class="m-links">${m.links.map((l) => `<a href="${esc(l.href)}" rel="noopener noreferrer" target="_blank" aria-label="${esc(tr(m.name))}: ${label[l.kind]} ${L('(opens in a new tab)', '(يُفتح في علامة تبويب جديدة)')}"><span class="ml-k">${label[l.kind]}</span><span class="ml-arrow" aria-hidden="true">↗</span></a>`).join('')}</p>`;
}

function profile(m: Member) {
  return `
    <p class="m-role">${tr(m.role)}</p>
    <p class="m-summary">${tr(m.summary)}</p>
    <ul class="m-high">${m.highlights.map((h) => `<li>${tr(h)}</li>`).join('')}</ul>
    <ul class="m-skills" aria-label="${L('Skills', 'المهارات')}">${m.skills.map((k) => `<li>${esc(tr(k))}</li>`).join('')}</ul>
    ${links(m)}`;
}

const page: Page & { cleanup: (() => void)[] } = {
  cleanup: [],
  mount(root) {
    const leader = MEMBERS.find((m) => m.leader)!;
    const team = MEMBERS.filter((m) => !m.leader);
    root.innerHTML = `
    <div class="team-page page-pad">
      ${pageHeader('team', L('Six people, one instrument.', 'ستة أشخاص، آلة واحدة.'), L('Six data professionals behind the DEPI Graduation Project, each owning one part of the journey from raw source data to a business recommendation.', 'ستة من محترفي البيانات وراء مشروع تخرج DEPI، يتولّى كلٌّ منهم جزءًا من الرحلة، من بيانات المصدر الخام حتى التوصية للأعمال.'))}

      <section class="section" aria-labelledby="tm-chart">
        <h2 class="sr-only" id="tm-chart">${L('Team structure', 'هيكل الفريق')}</h2>
        <svg class="hierarchy" viewBox="0 0 1000 290" role="img" aria-label="${L(`${leader.name.en}, team leader, at the top; the five workstream leads beneath, each reporting to the team leader.`, `${leader.name.ar}، قائد الفريق، في الأعلى؛ وتحته قادة مسارات العمل الخمسة، ويرفع كلٌّ منهم إلى قائد الفريق.`)}">
          ${TEAM_POS.map(([x, y], i) => `<path class="h-line" data-m="${i + 1}" d="M${LEADER[0]} ${LEADER[1] + 22} C ${LEADER[0]} ${(LEADER[1] + y) / 2 + 10}, ${x} ${(LEADER[1] + y) / 2 - 10}, ${x} ${y - 16}"/>`).join('')}
          <g class="h-node h-leader" data-m="0" transform="translate(${LEADER[0]} ${LEADER[1]})"><circle class="halo" r="34"/><circle class="ring" r="20"/><circle class="ring2" r="27"/><circle class="core" r="6"/></g>
          ${TEAM_POS.map(([x, y], i) => `<g class="h-node" data-m="${i + 1}" transform="translate(${x} ${y})"><circle class="halo" r="26"/><circle class="ring" r="14"/><circle class="core" r="4.5"/><text y="40" text-anchor="middle">${esc(tr(team[i].first))}</text></g>`).join('')}
        </svg>

        <article class="leader" data-m="0" tabindex="0" aria-labelledby="ld-name">
          ${portrait(leader, 'lg')}
          <div class="ld-text">
            <p class="ld-kicker">${L('Team leader', 'قائد الفريق')}</p>
            <h3 class="display" id="ld-name">${esc(tr(leader.name))}</h3>
            ${profile(leader)}
          </div>
        </article>

        <ul class="members">
          ${team.map((m, i) => `
          <li class="member" data-m="${i + 1}" tabindex="0" aria-labelledby="mb-${m.id}">
            <div class="m-head">
              ${portrait(m, 'md')}
              <h3 id="mb-${m.id}">${esc(tr(m.name))}</h3>
            </div>
            <div class="m-text">${profile(m)}</div>
          </li>`).join('')}
        </ul>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-work">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-work">${L('Who led what', 'من قاد ماذا')}</h2>
          <p class="sec-note">${L('Each workstream had one lead; the team leader tied them into a single delivery.', 'لكل مسار عمل قائد واحد، وربطها قائد الفريق في مُخرَج واحد.')}</p>
        </div>
        <ul class="workstreams" data-reveal>
          ${WORKSTREAMS.map((w) => { const m = MEMBERS.find((x) => x.id === w.lead)!; return `<li><span class="ws-work">${tr(w.work)}</span><span class="ws-lead">${m.portrait ? `<img src="${BASE}team/${m.portrait}.webp" alt="" width="32" height="32" loading="lazy">` : `<span class="ws-mono" aria-hidden="true">${esc(initials(m))}</span>`}${esc(tr(m.name))}</span></li>`; }).join('')}
        </ul>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-tech">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-tech">${L('Technologies', 'التقنيات')}</h2>
          <p class="sec-note">${L('The tools the project uses, and what each one is for.', 'الأدوات التي يستخدمها المشروع، ووظيفة كل منها.')}</p>
        </div>
        <dl class="tech" data-reveal>
          ${TECHNOLOGIES.map((t) => `<div><dt dir="ltr">${t.label}</dt><dd>${tr(t.use)}</dd></div>`).join('')}
        </dl>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-res">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-res">${L('Deliverables', 'المخرجات')}</h2>
          <p class="sec-note">${L('Files stay in the project repository; links are added once the team decides what to publish.', 'تبقى الملفات في مستودع المشروع، وتُضاف الروابط بعد أن يقرر الفريق ما يُنشر.')}</p>
        </div>
        <ul class="resources" data-reveal>
          ${RESOURCES.map((r) => `<li><div><span class="r-kind">${tr(r.kind)}</span><span class="r-label">${tr(r.label)}</span><span class="r-note">${tr(r.note)}</span><span class="r-state">${statusBadge(r.status)}</span></div></li>`).join('')}
        </ul>
      </section>

      ${nextChapter('team', L('Return to the beginning and read the network again.', 'عُد إلى البداية واقرأ الشبكة من جديد.'))}
      ${siteFooter()}
    </div>`;

    /* the chart and the plates light each other */
    const nodes = [...root.querySelectorAll<SVGGElement>('.h-node')];
    const lines = [...root.querySelectorAll<SVGPathElement>('.h-line')];
    const cards = [...root.querySelectorAll<HTMLElement>('[data-m].leader, .member')];
    const light = (i: number | null) => {
      nodes.forEach((n) => n.classList.toggle('lit', i !== null && Number(n.dataset.m) === i));
      lines.forEach((l) => l.classList.toggle('lit', i !== null && (i === 0 || Number(l.dataset.m) === i)));
      cards.forEach((c) => c.classList.toggle('lit', Number(c.dataset.m) === i));
    };
    cards.forEach((c) => {
      const i = Number(c.dataset.m);
      c.addEventListener('pointerenter', () => light(i));
      c.addEventListener('pointerleave', () => light(null));
      c.addEventListener('focus', () => light(i));
      c.addEventListener('blur', () => light(null));
    });
    const chart = root.querySelector('.hierarchy')!;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { chart.classList.add('seen'); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(chart);
    this.cleanup.push(() => io.disconnect(), revealOnScroll(root));
  },
  unmount() { this.cleanup.forEach((f) => f()); this.cleanup = []; },
};
export default page;
