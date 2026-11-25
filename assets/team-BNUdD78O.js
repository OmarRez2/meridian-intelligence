import{G as e,H as t,J as n,K as r,U as i,V as a,W as o,Y as s,tt as c,yt as l}from"./index-Cp_ZfTbz.js";import{t as u}from"./tabs-CCYbcGZq.js";import{t as d}from"./format-BBi0te7M.js";var f=`/meridian-intelligence/`,p=[500,56],m=[[110,214],[305,236],[500,246],[695,236],[890,214]],h=e=>l(e.name).split(/\s+/).slice(0,2).map(e=>[...e][0]).join(c(``,` `));function g(e,t){if(!e.portrait)return`<div class="pt pt-${t} pt-mono" role="img" aria-label="${d(l(e.name))}"><span>${d(h(e))}</span></div>`;let n=t===`lg`?320:200;return`<div class="pt pt-${t}"><picture><source srcset="${f}team/${e.portrait}.webp" type="image/webp"><img src="${f}team/${e.portrait}.jpg" alt="${c(`Portrait of ${d(e.name.en)}`,`صورة ${d(e.name.ar)}`)}" width="${n}" height="${n}" loading="lazy" decoding="async"></picture></div>`}function _(e){if(!e.links.length)return``;let t={linkedin:`LinkedIn`,github:`GitHub`};return`<p class="m-links">${e.links.map(n=>`<a href="${d(n.href)}" rel="noopener noreferrer" target="_blank" aria-label="${d(l(e.name))}: ${t[n.kind]} ${c(`(opens in a new tab)`,`(يُفتح في علامة تبويب جديدة)`)}"><span class="ml-k">${t[n.kind]}</span><span class="ml-arrow" aria-hidden="true">↗</span></a>`).join(``)}</p>`}function v(e){return`
    <p class="m-role">${l(e.role)}</p>
    <p class="m-summary">${l(e.summary)}</p>
    <ul class="m-high">${e.highlights.map(e=>`<li>${l(e)}</li>`).join(``)}</ul>
    <ul class="m-skills" aria-label="${c(`Skills`,`المهارات`)}">${e.skills.map(e=>`<li>${d(l(e))}</li>`).join(``)}</ul>
    ${_(e)}`}var y={cleanup:[],mount(_){let y=e.find(e=>e.leader),b=e.filter(e=>!e.leader);_.innerHTML=`
    <div class="team-page page-pad">
      ${t(`team`,c(`Six people, one instrument.`,`ستة أشخاص، آلة واحدة.`),c(`Six data professionals behind the DEPI Graduation Project, each owning one part of the journey from raw source data to a business recommendation.`,`ستة من محترفي البيانات وراء مشروع تخرج DEPI، يتولّى كلٌّ منهم جزءًا من الرحلة، من بيانات المصدر الخام حتى التوصية للأعمال.`))}

      <section class="section" aria-labelledby="tm-chart">
        <h2 class="sr-only" id="tm-chart">${c(`Team structure`,`هيكل الفريق`)}</h2>
        <svg class="hierarchy" viewBox="0 0 1000 290" role="img" aria-label="${c(`${y.name.en}, team leader, at the top; the five workstream leads beneath, each reporting to the team leader.`,`${y.name.ar}، قائد الفريق، في الأعلى؛ وتحته قادة مسارات العمل الخمسة، ويرفع كلٌّ منهم إلى قائد الفريق.`)}">
          ${m.map(([e,t],n)=>`<path class="h-line" data-m="${n+1}" d="M${p[0]} ${p[1]+22} C ${p[0]} ${(p[1]+t)/2+10}, ${e} ${(p[1]+t)/2-10}, ${e} ${t-16}"/>`).join(``)}
          <g class="h-node h-leader" data-m="0" transform="translate(${p[0]} ${p[1]})"><circle class="halo" r="34"/><circle class="ring" r="20"/><circle class="ring2" r="27"/><circle class="core" r="6"/></g>
          ${m.map(([e,t],n)=>`<g class="h-node" data-m="${n+1}" transform="translate(${e} ${t})"><circle class="halo" r="26"/><circle class="ring" r="14"/><circle class="core" r="4.5"/><text y="40" text-anchor="middle">${d(l(b[n].first))}</text></g>`).join(``)}
        </svg>

        <article class="leader" data-m="0" tabindex="0" aria-labelledby="ld-name">
          ${g(y,`lg`)}
          <div class="ld-text">
            <p class="ld-kicker">${c(`Team leader`,`قائد الفريق`)}</p>
            <h3 class="display" id="ld-name">${d(l(y.name))}</h3>
            ${v(y)}
          </div>
        </article>

        <ul class="members">
          ${b.map((e,t)=>`
          <li class="member" data-m="${t+1}" tabindex="0" aria-labelledby="mb-${e.id}">
            <div class="m-head">
              ${g(e,`md`)}
              <h3 id="mb-${e.id}">${d(l(e.name))}</h3>
            </div>
            <div class="m-text">${v(e)}</div>
          </li>`).join(``)}
        </ul>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-work">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-work">${c(`Who led what`,`من قاد ماذا`)}</h2>
          <p class="sec-note">${c(`Each workstream had one lead; the team leader tied them into a single delivery.`,`لكل مسار عمل قائد واحد، وربطها قائد الفريق في مُخرَج واحد.`)}</p>
        </div>
        <ul class="workstreams" data-reveal>
          ${s.map(t=>{let n=e.find(e=>e.id===t.lead);return`<li><span class="ws-work">${l(t.work)}</span><span class="ws-lead">${n.portrait?`<img src="${f}team/${n.portrait}.webp" alt="" width="32" height="32" loading="lazy">`:`<span class="ws-mono" aria-hidden="true">${d(h(n))}</span>`}${d(l(n.name))}</span></li>`}).join(``)}
        </ul>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-tech">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-tech">${c(`Technologies`,`التقنيات`)}</h2>
          <p class="sec-note">${c(`The tools the project uses, and what each one is for.`,`الأدوات التي يستخدمها المشروع، ووظيفة كل منها.`)}</p>
        </div>
        <dl class="tech" data-reveal>
          ${n.map(e=>`<div><dt dir="ltr">${e.label}</dt><dd>${l(e.use)}</dd></div>`).join(``)}
        </dl>
      </section>

      <section class="section sec-grid" aria-labelledby="tm-res">
        <div class="sec-aside">
          <h2 class="sec-title" id="tm-res">${c(`Deliverables`,`المخرجات`)}</h2>
          <p class="sec-note">${c(`Files stay in the project repository; links are added once the team decides what to publish.`,`تبقى الملفات في مستودع المشروع، وتُضاف الروابط بعد أن يقرر الفريق ما يُنشر.`)}</p>
        </div>
        <ul class="resources" data-reveal>
          ${r.map(e=>`<li><div><span class="r-kind">${l(e.kind)}</span><span class="r-label">${l(e.label)}</span><span class="r-note">${l(e.note)}</span><span class="r-state">${o(e.status)}</span></div></li>`).join(``)}
        </ul>
      </section>

      ${a(`team`,c(`Return to the beginning and read the network again.`,`عُد إلى البداية واقرأ الشبكة من جديد.`))}
      ${i()}
    </div>`;let x=[..._.querySelectorAll(`.h-node`)],S=[..._.querySelectorAll(`.h-line`)],C=[..._.querySelectorAll(`[data-m].leader, .member`)],w=e=>{x.forEach(t=>t.classList.toggle(`lit`,e!==null&&Number(t.dataset.m)===e)),S.forEach(t=>t.classList.toggle(`lit`,e!==null&&(e===0||Number(t.dataset.m)===e))),C.forEach(t=>t.classList.toggle(`lit`,Number(t.dataset.m)===e))};C.forEach(e=>{let t=Number(e.dataset.m);e.addEventListener(`pointerenter`,()=>w(t)),e.addEventListener(`pointerleave`,()=>w(null)),e.addEventListener(`focus`,()=>w(t)),e.addEventListener(`blur`,()=>w(null))});let T=_.querySelector(`.hierarchy`),E=new IntersectionObserver(([e])=>{e.isIntersecting&&(T.classList.add(`seen`),E.disconnect())},{threshold:.3});E.observe(T),this.cleanup.push(()=>E.disconnect(),u(_))},unmount(){this.cleanup.forEach(e=>e()),this.cleanup=[]}};export{y as default};