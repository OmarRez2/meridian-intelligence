import{$ as e,Ct as t,G as n,L as r,Q as i,St as a,Tt as o,U as s,ct as c,dt as l,et as u,ht as d,it as f,lt as p,mt as m,st as h,t as ee,tt as g,yt as _}from"./index-Cp_ZfTbz.js";import{t as v}from"./journey-B8UVOxhG.js";import{t as y}from"./spark-H1jHWTtR.js";import{t as b}from"./analysis-rk8w6LD-.js";import{n as x,t as S}from"./datastate-BK23a7TI.js";import{t as C}from"./format-BBi0te7M.js";var w={sales:{label:()=>g(`Sales`,`المبيعات`),q:()=>g(`Revenue, recorded profit and losses by segment and family`,`الإيرادات والربح المسجَّل والخسائر حسب الشريحة والعائلة`)},orders:{label:()=>g(`Orders`,`الطلبات`),q:()=>g(`Fill rate, backorders and unpicked demand`,`معدل التلبية والطلبات المؤجلة والطلب غير المجهَّز`)},purchasing:{label:()=>g(`Purchasing`,`المشتريات`),q:()=>g(`Purchase-order value and the receiving gap`,`قيمة أوامر الشراء وفجوة الاستلام`)},inventory:{label:()=>g(`Inventory`,`المخزون`),q:()=>g(`Reorder alerts and months of cover`,`تنبيهات إعادة الطلب وأشهر التغطية`)},suppliers:{label:()=>g(`Suppliers`,`الموردون`),q:()=>g(`Concentration and lead times`,`التركّز ومدد التوريد`)},customers:{label:()=>g(`Customers`,`العملاء`),q:()=>g(`663 accounts and revenue concentration`,`663 حسابًا وتركّز الإيرادات`)}};function T(e,t){if(e.state!==`ready`||!t)return{badge:`<span class="hero-demo">${S(e)}</span>`,segTitle:g(`Demand comes from five customer segments.`,`يأتي الطلب من خمس شرائح من العملاء.`),segLede:g(`Each constellation is a customer segment. No project data is loaded, so every constellation is drawn at the same size.`,`كل كوكبة تمثل شريحة من العملاء. لم تُحمَّل بيانات المشروع، فرُسمت الكوكبات كلها بالحجم نفسه.`),dialTitle:g(`The calendar, read around the rim.`,`التقويم، يُقرأ حول الحافة.`),dialLede:g(`With project data, each column on the rim would be one month of revenue. None is loaded, so the rim stays empty.`,`مع بيانات المشروع، يمثل كل عمود على الحافة شهرًا من الإيرادات. ولم يُحمَّل شيء، فتبقى الحافة فارغة.`),shareSuffix:``};let n=e.dataset,r=n.provenance.status===`synthetic`,i=t.segments.slice().sort((e,t)=>t.share-e.share)[0],a=n.customers.filter(e=>e.t===i.t).length,o=n.months[0],s=n.months[n.months.length-1],u=r?` <span class="demo-pill">${g(`Synthetic values`,`قيم مولَّدة`)}</span>`:``;return{badge:r?`<span class="demo-pill hero-demo">${g(`Viewing synthetic demo data`,`تعرض الآن بيانات تجريبية مولَّدة`)}</span>`:`<span class="hero-demo">${S(e)}</span>`,segTitle:g(`Demand comes from ${t.segments.length} customer segments, one of them dominant.`,`يأتي الطلب من ${t.segments.length} شرائح من العملاء، تهيمن إحداها.`),segLede:g(`Each constellation is a customer segment, sized by its share of revenue. ${d(n.territories[i.t])} — ${c(a)} of ${c(n.customers.length)} customers — bring in ${m(i.share)} of revenue.${u}`,`كل كوكبة شريحة من العملاء، وحجمها بحسب حصتها من الإيرادات. ${d(n.territories[i.t])} — ${c(a)} من ${c(n.customers.length)} عميلًا — تجلب ${m(i.share)} من الإيرادات.${u}`),dialTitle:g(`${n.months.length} months, read around the rim.`,`${n.months.length} شهرًا، تُقرأ حول الحافة.`),dialLede:g(`The lattice unwinds onto the calendar rim. Each column is one month of net revenue, ${l(o.m)} ${o.y} to ${l(s.m)} ${s.y}: ${p(t.totals.revenue)} in all, at a ${m(t.totals.margin)} recorded margin.${u}`,`تنفك الشبكة على حافة التقويم. كل عمود شهر من صافي الإيرادات، من ${l(o.m)} ${o.y} إلى ${l(s.m)} ${s.y}: ${p(t.totals.revenue)} إجمالًا، بهامش مسجَّل ${m(t.totals.margin)}.${u}`),shareSuffix:g(`of revenue`,`من الإيرادات`)}}function E(e,t){if(e.state!==`ready`||!t)return``;let n=e.dataset,r=t.loss,i=t.demand,a=t.purchasing,o=t.inventory;return[r.family!==null&&{tone:`ember`,area:g(`Sales`,`المبيعات`),v:m(r.groupShare,0),t:g(`of recorded losses come from just ${c(r.group.length)} items in ${f(n.categories[r.family])}.`,`من الخسائر المسجَّلة مصدرها ${c(r.group.length)} أصناف من ${f(n.categories[r.family])}.`)},i.families[0]&&{tone:`glacier`,area:g(`Orders`,`الطلبات`),v:c(i.unmet),t:g(`ordered units were never picked, ${m(i.families[0].share+(i.families[1]?.share??0),0)} of them in two product families.`,`وحدة مطلوبة لم تُجهَّز أبدًا، ${m(i.families[0].share+(i.families[1]?.share??0),0)} منها في عائلتين فقط.`)},a.growth&&{tone:`brass`,area:g(`Purchasing`,`المشتريات`),v:`${a.growth.toFixed(1)}×`,t:g(`growth in purchase-order value over ${a.years[0].year}–${a.years[a.years.length-1].year}, while sales grew ${m((a.salesGrowth??1)-1,0)}.`,`نمو في قيمة أوامر الشراء خلال ${a.years[0].year}–${a.years[a.years.length-1].year}، بينما نمت المبيعات ${m((a.salesGrowth??1)-1,0)}.`)},o.shortest&&o.longest&&{tone:`ember`,area:g(`Inventory`,`المخزون`),v:g(`${c(o.shortest.cover)} vs ${c(o.longest.cover)}`,`${c(o.shortest.cover)} مقابل ${c(o.longest.cover)}`),t:g(`months of stock cover: the family that runs short holds the least.`,`شهرًا من تغطية المخزون: العائلة التي تعاني النقص تحتفظ بالأقل.`)}].filter(Boolean).map(e=>`<li class="q tone-${e.tone}"><span class="q-area">${e.area}</span><p class="q-v num">${e.v}</p><p class="q-text">${e.t}</p></li>`).join(``)}function D(e){return e.split(` `).map(e=>`<span class="w">${[...e].map(e=>`<span class="l"><span>${e}</span></span>`).join(``)}</span>`).join(` `)}function te(e){let t={draw:1,lines:1,warp:0,fade:1,stars:1,focus:0};if(e)return[{...t,p:0,dist:36,elev:.52,azim:0,lookY:4.2,plateX:0,shiftY:.16},{...t,p:0,dist:29,elev:.34,azim:-.4,lookY:4.8,plateX:0,shiftY:.22},{...t,p:1,dist:33,elev:.98,azim:-.4,lookY:2.2,plateX:0,shiftY:.22},{...t,p:2,dist:34,elev:.12,azim:.2,lookY:4,plateX:0,shiftY:.2},{...t,p:2,dist:22,elev:1.2,azim:.4,lookY:8.4,plateX:0,shiftY:.2,focus:1},{...t,p:3,dist:64,elev:.7,azim:.55,lookY:2.4,plateX:0,shiftY:.25},{...t,p:3,dist:48,elev:1.05,azim:.9,lookY:0,plateX:0,shiftY:.08,lines:.45}];let n=h.rtl?-1:1;return[{...t,p:0,dist:25,elev:.42,azim:0,lookY:1.2,plateX:6.2,shiftY:0},{...t,p:0,dist:21.5,elev:.3,azim:-.22,lookY:4.2,plateX:8.6,shiftY:0},{...t,p:1,dist:23.5,elev:.8,azim:-.42,lookY:.4,plateX:7.2,shiftY:0},{...t,p:2,dist:27,elev:.1,azim:.18,lookY:3.6,plateX:7.4,shiftY:0},{...t,p:2,dist:17,elev:1.2,azim:.4,lookY:8.4,plateX:7.4,shiftY:0,focus:1},{...t,p:3,dist:26,elev:.55,azim:.55,lookY:2,plateX:7.4,shiftY:0},{...t,p:3,dist:38,elev:1.02,azim:.9,lookY:0,plateX:7,shiftY:0,lines:.45}].map(e=>({...e,plateX:e.plateX*n}))}var ne=(e,t,n)=>{let r={...e};for(let i in e)r[i]=e[i]+(t[i]-e[i])*n;return r},re=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},O=[[60,210],[150,120],[250,160],[330,70],[420,130],[470,230]],k={cleanup:[],async mount(c){let l=a.reduced,f=t(),p=h.rtl,k=await r(),A=k.state===`ready`?b(k.dataset):null,j=k.state===`ready`?ee(k.dataset):null,M=T(k,A),N=E(k,A);c.innerHTML=`
    <div class="home">
      <section class="ch ch-hero" data-ch="0" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="hero-kicker">${g(`DEPI Graduation Project`,`مشروع تخرج DEPI`)}<br/>${g(`Professional Data Analyst track`,`مسار محلل البيانات المحترف`)}</p>
          <h1 id="hero-title" class="display hero-title" aria-label="WWI Supply Chain Intelligence" dir="ltr">
            <span class="line" aria-hidden="true">${D(`WWI Supply Chain`)}</span>
            <span class="line line-2" aria-hidden="true">${D(`Intelligence`)}</span>
          </h1>
          <p class="lede hero-lede">${g(`Wide World Importers buys novelty goods from suppliers, holds them in one warehouse and sells them to 663 businesses. Six graduates reconciled 41 months of its records into one model. This site charts that work as a single sky, then reads it like an instrument.`,`تشتري Wide World Importers السلع الطريفة من الموردين، وتحتفظ بها في مستودع واحد، وتبيعها لـ 663 شركة. وحّد ستة خريجين 41 شهرًا من سجلاتها في نموذج واحد. ويرسم هذا الموقع ذلك العمل سماءً واحدة، ثم يقرؤها كما تُقرأ الآلة الفلكية.`)}</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${g(`Open the Observatory`,`افتح المرصد`)}</a>
            <a class="btn btn-ghost" href="#chapter-challenge" data-scroll>${g(`Begin the story`,`ابدأ القصة`)}</a>
          </div>
          ${M.badge}
        </div>
        <div class="scroll-cue" aria-hidden="true"><span class="cue-dial"></span>${g(`Scroll to turn the dial`,`مرّر لتدير القرص`)}</div>
      </section>

      <section class="ch ch-text" id="chapter-challenge" data-ch="1" aria-labelledby="h-challenge">
        <div class="ch-inner">
          <p class="ch-index num">${g(`I. The market`,`أولًا: السوق`)}</p>
          <h2 class="h-section" id="h-challenge">${M.segTitle}</h2>
          <p class="lede">${g(`The records that explain their orders sit apart: sales in one schema, purchasing in another, stock in a third, each at its own grain and in its own units. A simple question such as “which products go unpicked?” needs them joined first.`,`السجلات التي تفسر طلباتهم متفرقة: المبيعات في مخطط، والمشتريات في آخر، والمخزون في ثالث، ولكلٍّ مستوى تفصيله ووحداته. وسؤال بسيط مثل “أي المنتجات لا تُجهَّز؟” يتطلب ربطها أولًا.`)}</p>
          <p class="hint">${M.segLede}</p>
        </div>
      </section>

      <section class="ch ch-text" id="chapter-routes" data-ch="2" aria-labelledby="h-routes">
        <div class="ch-inner">
          <p class="ch-index num">${g(`II. The network`,`ثانيًا: الشبكة`)}</p>
          <h2 class="h-section" id="h-routes">${g(`Every order moves through one warehouse.`,`كل طلب يمر عبر مستودع واحد.`)}</h2>
          <p class="lede">${g(`The stars fall to the plate and become routes. Purchase orders arrive from seven active suppliers on the outer ring; customer orders leave for the segments they came from. The strain only shows once the records are joined.`,`تهبط النجوم إلى اللوح وتصبح مسارات. تصل أوامر الشراء من سبعة موردين نشطين على الحلقة الخارجية، وتخرج طلبات العملاء إلى الشرائح التي جاءت منها. ولا يظهر الضغط إلا بعد ربط السجلات.`)}</p>
          <ul class="legend" aria-label="${g(`Map legend`,`مفتاح الخريطة`)}">
            <li><span class="key key-brass"></span>${g(`Inbound: suppliers and purchasing`,`الوارد: الموردون والمشتريات`)}</li>
            <li><span class="key key-glacier"></span>${g(`Outbound: customers and sales`,`الصادر: العملاء والمبيعات`)}</li>
            <li><span class="key key-hub"></span>${g(`The warehouse hub`,`المستودع المركزي`)}</li>
          </ul>
          <p class="hint">${f?g(`Routes are illustrative.`,`المسارات توضيحية.`):g(`Point at a node on the plate to identify it. Routes are illustrative.`,`أشر إلى عقدة على اللوح للتعرف عليها. المسارات توضيحية.`)}</p>
        </div>
      </section>

      <section class="ch ch-text" data-ch="3" aria-labelledby="h-prep">
        <div class="ch-inner">
          <p class="ch-index num">${g(`III. Preparation`,`ثالثًا: التحضير`)}</p>
          <h2 class="h-section" id="h-prep">${g(`Raw records settle into layers.`,`تستقر السجلات الخام في طبقات.`)}</h2>
          <p class="lede">${g(`The same points rise into strata, the way the team’s warehouse does: 48 raw Bronze tables, 31 cleaned Silver tables, 18 Gold views. The red points are records that fail a quality rule, such as the 4,626 lines sold at a loss. They are kept as findings, not silently repaired.`,`ترتفع النقاط نفسها في طبقات، كما في مستودع الفريق: 48 جدولًا برونزيًا خامًا، و31 جدولًا فضيًا منظّفًا، و18 عرضًا ذهبيًا. والنقاط الحمراء سجلات تخالف قاعدة جودة، مثل 4,626 سطرًا بيعت بخسارة، وتُحفظ كملاحظات ولا تُصلح بصمت.`)}</p>
          <a class="text-link" href="#/journey">${g(`Follow the full data journey`,`تابع رحلة البيانات كاملة`)}</a>
        </div>
      </section>

      <section class="ch ch-text" data-ch="4" aria-labelledby="h-structure">
        <div class="ch-inner">
          <p class="ch-index num">${g(`IV. Structure`,`رابعًا: البنية`)}</p>
          <h2 class="h-section" id="h-structure">${g(`Order at the top.`,`النظام في القمة.`)}</h2>
          <p class="lede">${g(`Each layer is more ordered than the one beneath it. At the top the points lock into a lattice: seven fact tables and six dimensions with shared definitions, so a measure means the same thing on every page — and 22 of 22 KPIs give the same answer in SQL and in DAX.`,`كل طبقة أكثر انتظامًا مما تحتها. وفي القمة تستقر النقاط في شبكة: سبعة جداول حقائق وستة أبعاد بتعريفات مشتركة، فيحمل المقياس المعنى نفسه في كل صفحة — وتعطي 22 من 22 مؤشرًا الإجابة نفسها في SQL وDAX.`)}</p>
          <ol class="strata">
            <li><span class="num">1</span><b>${g(`Source`,`المصدر`)}</b></li>
            <li><span class="num">2</span><b>${g(`Bronze`,`البرونزي`)}</b></li>
            <li><span class="num">3</span><b>${g(`Silver`,`الفضي`)}</b></li>
            <li><span class="num">4</span><b>${g(`Gold`,`الذهبي`)}</b></li>
            <li><span class="num">5</span><b>${g(`Model`,`النموذج`)}</b></li>
          </ol>
          <a class="text-link" href="#/engineering">${g(`Read the engineering case study`,`اقرأ دراسة الحالة الهندسية`)}</a>
        </div>
      </section>

      <section class="ch ch-text" data-ch="5" aria-labelledby="h-dial">
        <div class="ch-inner">
          <p class="ch-index num">${g(`V. Intelligence`,`خامسًا: الذكاء`)}</p>
          <h2 class="h-section" id="h-dial">${M.dialTitle}</h2>
          <p class="lede">${M.dialLede}</p>
          <a class="btn btn-ghost" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${g(`Explore it in the Observatory`,`استكشفه في المرصد`)}</a>
        </div>
      </section>

      <section class="after" data-ch="6" aria-label="${g(`About the project`,`عن المشروع`)}">
        <div class="after-inner">
          <div class="about">
            <h2 class="h-section">${g(`A supply chain, read end to end.`,`سلسلة إمداد، تُقرأ من أولها إلى آخرها.`)}</h2>
            <dl class="facts">
              <div><dt>${g(`Programme`,`البرنامج`)}</dt><dd>${g(`Digital Egypt Pioneers Initiative (DEPI)`,`مبادرة رواد مصر الرقمية (DEPI)`)}</dd></div>
              <div><dt>${g(`Track`,`المسار`)}</dt><dd>${g(`Professional Data Analyst`,`محلل البيانات المحترف`)}</dd></div>
              <div><dt>${g(`Data`,`البيانات`)}</dt><dd>${g(`Wide World Importers, Jan 2013 – May 2016`,`Wide World Importers، يناير 2013 – مايو 2016`)}</dd></div>
              <div><dt>${g(`Delivered as`,`المُخرَج`)}</dt><dd>${g(`A Power BI report on a SQL Server warehouse, cleaned in Python`,`تقرير Power BI على مستودع SQL Server، نُظّفت بياناته بلغة Python`)}</dd></div>
            </dl>
            <a class="text-link" href="#/overview">${g(`Read the project overview`,`اقرأ نظرة على المشروع`)}</a>
          </div>

          <div class="preview preview-obs">
            <div class="pv-head">
              <h2 class="h-section">${g(`Six domains, one workspace.`,`ستة مجالات، مساحة عمل واحدة.`)}</h2>
              <p class="lede">${g(`The Observatory puts every part of the supply chain under one set of filters. Choose a domain to open it.`,`يضع المرصد كل أجزاء سلسلة الإمداد تحت مجموعة واحدة من المرشحات. اختر مجالًا لفتحه.`)}</p>
              ${S(k)}
            </div>
            ${j?`<ul class="readout">
              ${j.map(e=>`<li><a href="#/observatory?d=${e.id}" style="--tone:${e.tone}"><span class="ro-name">${w[e.id].label()}</span><span class="ro-q">${w[e.id].q()}</span><span class="ro-spark" dir="ltr">${e.v.length?y(e.v,e.tone):`<span class="ro-snap">${g(`Snapshot, no trend`,`لقطة، بلا اتجاه`)}</span>`}</span></a></li>`).join(``)}
            </ul>`:k.state===`ready`?``:x(k,`/`,{compact:!0,headingId:`h-preview-state`})}
          </div>

          <div class="preview preview-journey">
            <div class="pv-head">
              <h2 class="h-section">${g(`From table to decision in seven stages.`,`من الجدول إلى القرار في سبع مراحل.`)}</h2>
              <a class="text-link" href="#/journey">${g(`Open the data journey`,`افتح رحلة البيانات`)}</a>
            </div>
            <ol class="stations">
              ${v.map((e,t)=>`<li style="--i:${t}"><span class="st-dot" aria-hidden="true"></span><span class="st-n num">${t+1}</span><b>${_(e.title)}</b><span>${_(e.line)}</span></li>`).join(``)}
            </ol>
          </div>

          ${N?`
          <div class="questions">
            <h2 class="h-section" id="h-questions">${g(`What the data says`,`ما تقوله البيانات`)}</h2>
            <p class="lede">${g(`Four headlines, computed live from the data in view. Each is developed on the Insights page with its evidence and limits, next to the team’s own decision brief.`,`أربعة عناوين محسوبة لحظيًا من البيانات المعروضة. وتُعرض كلٌّ منها في صفحة الرؤى مع دليله وحدوده، بجانب موجز القرارات الخاص بالفريق.`)}</p>
            <a class="text-link q-link" href="#/insights">${g(`Read the insights`,`اقرأ الرؤى`)}</a>
            <ol class="q-list">${N}</ol>
          </div>`:``}

          <div class="team" aria-labelledby="h-team">
            <div class="team-copy">
              <h2 class="h-section" id="h-team">${g(`Six people, one instrument`,`ستة أشخاص، آلة واحدة`)}</h2>
              <p class="lede">${g(`Data engineering, data quality, warehouse design, Power BI, business analysis, and the integration that holds them together.`,`هندسة البيانات، وجودة البيانات، وتصميم المستودع، وPower BI، وتحليل الأعمال، والتكامل الذي يجمعها معًا.`)}</p>
              <a class="text-link" href="#/team">${g(`Meet the team`,`تعرّف على الفريق`)}</a>
            </div>
            <svg class="asterism" viewBox="0 0 520 300" role="img" aria-label="${g(`The six team members drawn as an asterism of six stars`,`أعضاء الفريق الستة مرسومون كمجموعة من ست نجوم`)}">
              <g class="ast-lines" fill="none" style="stroke:var(--haze)" stroke-opacity=".45">
                <path d="M${O.map(([e,t])=>`${e} ${t}`).join(` L`)}"/>
              </g>
              ${O.map(([e,t],r)=>`<g class="ast-star" transform="translate(${e} ${t})"><circle r="16" fill="none" style="stroke:var(--brass)" stroke-opacity="${n[r]?.leader?1:.5}"/><circle r="4" style="fill:var(--chalk)"/><text y="38" text-anchor="middle">${C(n[r]?_(n[r].first):``)}</text></g>`).join(``)}
            </svg>
          </div>

          <div class="cta">
            <h2 class="display cta-title">${g(`Step inside the instrument.`,`ادخل إلى الآلة.`)}</h2>
            <div class="hero-actions">
              <a class="btn btn-primary" href="#/observatory" data-warp><span class="dial" aria-hidden="true"></span>${g(`Open the Observatory`,`افتح المرصد`)}</a>
              <a class="btn btn-ghost" href="#/present">${g(`Start the presentation`,`ابدأ العرض التقديمي`)}</a>
            </div>
          </div>
          ${s()}
        </div>
      </section>

      <div class="sky-labels" aria-hidden="true">
        ${(e.sky?.rimYears??[]).map(e=>`<span class="yr num" data-y="${e.year}">${e.year}</span>`).join(``)}
        ${(e.sky?.territories??[]).map(e=>`<span class="ter"><b>${C(d(e.label))}</b>${e.share===null?``:`<span class="num">${m(e.share,0)} ${M.shareSuffix}</span>`}</span>`).join(``)}
        <div class="node-tip" role="presentation"><b></b><span></span></div>
      </div>
    </div>`;let P=e.sky,F=c.querySelector(`.home`),I=te(f),L=[...c.querySelectorAll(`[data-ch]`)],R=[],z=()=>{R=L.map(e=>{let t=e.getBoundingClientRect();if(e.dataset.ch===`6`)return t.top+window.scrollY+window.innerHeight*.25;if(f&&e.dataset.ch!==`0`){let t=e.querySelector(`.ch-inner`).getBoundingClientRect();return t.top+window.scrollY+t.height/2-window.innerHeight*.2}return t.top+window.scrollY+t.height/2})},B=-1,V=()=>{let e=window.scrollY+window.innerHeight/2,t=0;for(;t<R.length-2&&e>R[t+1];)t++;let n=re(.18,.82,(e-R[t])/(R[t+1]-R[t])),r=ne(I[t],I[t+1],Math.max(0,Math.min(1,n)));U||i(r);let a=n>.5?t+1:t;a!==B&&(B=a,F.dataset.ch=String(a),L.forEach(e=>e.classList.toggle(`is-active`,Number(e.dataset.ch)===a)))};z(),window.addEventListener(`scroll`,V,{passive:!0});let H=()=>{z(),V()};window.addEventListener(`resize`,H),document.fonts?.ready.then(H),this.cleanup.push(()=>{window.removeEventListener(`scroll`,V),window.removeEventListener(`resize`,H)});let U=!1,ie=c.querySelectorAll(`.hero-title .l > span`),W=c.querySelectorAll(`.hero-kicker, .hero-lede, .hero-actions, .hero-demo, .scroll-cue`),G=!!P&&P.rig.fade>.5&&P.rig.draw>.9&&document.body.dataset.prev!==void 0;if(l||!P||G)P&&(P.ambient=!1),(l||!P)&&i(I[0],!0),L[0].classList.add(`is-active`),F.dataset.ch=`0`,V(),G&&!l&&o.fromTo(W,{opacity:0},{opacity:1,duration:.6,stagger:.05});else{U=!0,Object.assign(P.rig,{...I[0],dist:36,elev:.95,azim:-.6,warp:1,draw:0,fade:0}),Object.assign(P.target,{...I[0],warp:1,draw:0,fade:1,dist:36,elev:.95,azim:-.6});let e={draw:0,warp:1},t=o.timeline({onComplete:()=>{U=!1,V()}});t.to(P.target,{dist:I[0].dist,elev:I[0].elev,azim:I[0].azim,duration:3.2,ease:`expo.out`},0).to(e,{draw:1,duration:2.4,ease:`power2.inOut`,onUpdate:()=>{P.target.draw=e.draw,P.rig.draw=e.draw}},.1).to(e,{warp:0,duration:2.6,ease:`power3.out`,onUpdate:()=>{P.target.warp=e.warp}},.55).fromTo(ie,{yPercent:110,opacity:0},{yPercent:0,opacity:1,duration:1.1,ease:`expo.out`,stagger:.028},.35).fromTo(W,{opacity:0,y:12},{opacity:1,y:0,duration:.9,ease:`power2.out`,stagger:.09,clearProps:`transform`},1).add(()=>{L[0].classList.add(`is-active`),F.dataset.ch=`0`},.8);let n=()=>{t.isActive()&&t.progress(1)},r=e=>{[`ArrowDown`,`PageDown`,` `,`Tab`,`End`].includes(e.key)&&n()};window.addEventListener(`wheel`,n,{passive:!0,once:!0}),window.addEventListener(`touchmove`,n,{passive:!0,once:!0}),window.addEventListener(`keydown`,r),this.cleanup.push(()=>{t.kill(),window.removeEventListener(`wheel`,n),window.removeEventListener(`touchmove`,n),window.removeEventListener(`keydown`,r)})}document.body.dataset.prev=`home`;let K=[...c.querySelectorAll(`.yr`)],q=[...c.querySelectorAll(`.ter`)],ae=(P?.territories??[]).map((e,t)=>({i:t,s:e.share??0})).sort((e,t)=>t.s-e.s).map(e=>e.i),J=q.map(()=>({w:120,h:36})),Y=()=>{J=q.map(e=>({w:e.offsetWidth,h:e.offsetHeight})),P?.invalidate()};Y(),document.fonts?.ready.then(Y),window.addEventListener(`resize`,Y),this.cleanup.push(()=>window.removeEventListener(`resize`,Y));let X=c.querySelector(`.node-tip`),Z={x:-999,y:-999},Q=e=>{e.pointerType===`mouse`&&(Z={x:e.clientX,y:e.clientY},P?.invalidate())};if(window.addEventListener(`pointermove`,Q,{passive:!0}),this.cleanup.push(()=>window.removeEventListener(`pointermove`,Q)),P){let e=new WeakMap,t=(t,n,r,i)=>{let a=e.get(t)??{tf:``,op:``},o=i<.005?`0`:i.toFixed(3);if(o!==a.op&&(t.style.opacity=o,a.op=o),o!==`0`){let e=`translate(${n.toFixed(1)}px, ${r.toFixed(1)}px)`;e!==a.tf&&(t.style.transform=e,a.tf=e)}e.set(t,a)},n=e=>e.forEach(e=>t(e,0,0,0));P.onFrame=()=>{let e=P.rig.p,r=Math.max(0,Math.min(1,(e-2.55)*2.5))*(1-Math.max(0,(P.rig.dist-26)/10));r<=0?n(K):P.rimYears.forEach((e,n)=>{let i=P.project(e.pos);t(K[n],i.x,i.y,i.behind?0:r)});let i=B===1?P.constellationVisibility():0,a=[],o=f||p?8:window.innerWidth*.42,s=!f&&p?window.innerWidth*.58:window.innerWidth-8;i<.02?n(q):ae.forEach(e=>{let n=q[e],r=P.project(P.territories[e].labelPos),{w:c,h:l}=J[e],u={l:r.x-c/2-6,t:r.y-l-4,r:r.x+c/2+6,b:r.y+4},d=r.behind||u.l<o||u.r>s||u.t<70||a.some(e=>u.l<e.r&&u.r>e.l&&u.t<e.b&&u.b>e.t);t(n,r.x,r.y,d?0:i),d||a.push(u)});let c=-1,l=676;if(P.nodeVisibility()>.55&&!f&&P.nodes.forEach((e,t)=>{let n=P.project(e.pos),r=(n.x-Z.x)**2+(n.y-Z.y)**2;r<l&&(l=r,c=t)}),P.setHover(c),c>=0){let e=P.nodes[c],t=P.project(e.pos);X.dataset.node!==String(c)&&(X.dataset.node=String(c),X.querySelector(`b`).textContent=e.label,X.querySelector(`span`).textContent=e.detail,X.dataset.kind=e.kind),X.style.transform=`translate(${p?Math.max(8,t.x-258):Math.min(t.x+18,window.innerWidth-260)}px, ${t.y-14}px)`,X.classList.add(`on`),document.body.style.cursor=`crosshair`}else X.classList.contains(`on`)&&(X.classList.remove(`on`),delete X.dataset.node,document.body.style.cursor=``)},P.invalidate(),this.cleanup.push(()=>{P.onFrame=void 0,P.setHover(-1),document.body.style.cursor=``})}let $=new IntersectionObserver(e=>e.forEach(e=>{e.isIntersecting&&(e.target.classList.add(`seen`),$.unobserve(e.target))}),{threshold:.3});c.querySelectorAll(`.team, .stations`).forEach(e=>$.observe(e)),this.cleanup.push(()=>$.disconnect()),c.querySelectorAll(`[data-scroll]`).forEach(e=>e.addEventListener(`click`,t=>{t.preventDefault();let n=document.querySelector(e.getAttribute(`href`));n?.scrollIntoView({behavior:l?`auto`:`smooth`,block:`center`}),n?.querySelector(`h2`)?.setAttribute(`tabindex`,`-1`),n?.querySelector(`h2`)?.focus({preventScroll:!0})})),c.querySelectorAll(`[data-warp]`).forEach(e=>e.addEventListener(`click`,t=>{if(l||!P)return;t.preventDefault(),u.warped=!0;let n=document.getElementById(`veil`);U=!0,o.timeline().add(()=>i({p:Math.min(1,P.rig.p),warp:1,dist:9,elev:1.25,lookY:0,plateX:0,lines:0,shiftY:0})).to(F,{opacity:0,y:-20,duration:.5,ease:`power2.in`},0).to(n,{opacity:1,duration:.55,ease:`power3.in`},.5).add(()=>{location.hash=e.getAttribute(`href`)},1.05)}))},unmount(){this.cleanup.forEach(e=>e()),this.cleanup=[]}};export{k as default};