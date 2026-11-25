/* empty css            */import{$ as e,D as t,G as n,L as r,Q as i,St as a,Tt as o,W as s,at as c,ct as l,h as u,ht as d,it as f,lt as p,mt as m,st as h,tt as g,ut as _,yt as v}from"./index-Cp_ZfTbz.js";import{t as y}from"./analysis-rk8w6LD-.js";import{t as b}from"./journey-B8UVOxhG.js";import{t as x}from"./findings-DhaJmsu_.js";import{n as S,t as C}from"./datastate-BK23a7TI.js";import{a as w,r as T,t as E}from"./kit-BwHNjVEB.js";import{a as D,s as O,t as k}from"./lab-CeWo_j43.js";import{a as A,c as j,d as M,i as N,l as P,s as F,u as I}from"./lab-Ds85_8Ru.js";import{a as L,c as R,g as z,t as B}from"./sim-Dj8r471b.js";import{t as V}from"./format-BBi0te7M.js";var H=`/meridian-intelligence/`,U=()=>h.rtl?-1:1,W=e=>({draw:1,lines:1,warp:0,fade:1,shiftY:0,stars:1,focus:0,...e,plateX:(e.plateX??0)*U()});function G(e,r,i,a,o){let h=n.find(e=>e.leader),y=(e,t,n=``)=>`<div class="pk"><p class="pk-v num">${e}</p><p class="pk-l">${t}</p>${n?`<p class="pk-n">${n}</p>`:``}</div>`,S=e=>()=>r&&i?e():a;return[{id:`title`,kicker:()=>g(`DEPI Graduation Project`,`مشروع تخرج DEPI`),rig:W({p:0,dist:25,elev:.42,azim:0,lookY:1.2,plateX:6.2}),html:()=>`
        <h1 class="display ps-title" dir="ltr">WWI Supply Chain<br/><em>Intelligence</em></h1>
        <p class="ps-lede">${g(`Reconciling the sales, purchasing and inventory records of a wholesale business into one analytical model, a Power BI report and evidence-backed recommendations.`,`توحيد سجلات المبيعات والمشتريات والمخزون لشركة جملة في نموذج تحليلي واحد، وتقرير Power BI، وتوصيات مدعومة بالأدلة.`)}</p>
        <p class="ps-meta">${g(`Professional Data Analyst track`,`مسار محلل البيانات المحترف`)} · ${g(`Team leader`,`قائد الفريق`)}: ${V(v(h.name))}</p>`},{id:`problem`,kicker:()=>g(`The business problem`,`مشكلة العمل`),rig:W({p:0,dist:21.5,elev:.3,azim:-.22,lookY:4.2,plateX:8.6}),html:()=>`
        <h2 class="display ps-h">${g(`One company, three ledgers that do not line up.`,`شركة واحدة، وثلاثة سجلات لا تتطابق.`)}</h2>
        <ul class="ps-points">
          <li><b>${g(`Different grains`,`مستويات تفصيل مختلفة`)}</b> ${g(`order line, invoice line, purchase-order line, stock transaction`,`سطر الطلب، وسطر الفاتورة، وسطر أمر الشراء، ومعاملة المخزون`)}</li>
          <li><b>${g(`Different units`,`وحدات مختلفة`)}</b> ${g(`single items for sales, outer packs for purchasing`,`قطع مفردة للمبيعات، وعبوات خارجية للمشتريات`)}</li>
          <li><b>${g(`Different dates`,`تواريخ مختلفة`)}</b> ${g(`ordered, invoiced, expected, received`,`الطلب، والفوترة، والتوقع، والاستلام`)}</li>
        </ul>
        <p class="ps-lede">${g(`Management could not follow demand from order to pick to invoice, or see the products, suppliers and stock behind the results.`,`لم تستطع الإدارة تتبّع الطلب من الطلبية إلى التجهيز إلى الفاتورة، ولا رؤية المنتجات والموردين والمخزون وراء النتائج.`)}</p>`},{id:`data`,kicker:()=>g(`The data`,`البيانات`),rig:W({p:1,dist:23.5,elev:.8,azim:-.42,lookY:.4,plateX:7.2}),html:S(()=>`
        <h2 class="display ps-h">${g(`${r.months.length} months of a wholesale business.`,`${r.months.length} شهرًا من عمل شركة جملة.`)}</h2>
        <div class="pk-grid">
          ${y(l(i.totals.customers),g(`customers in five segments`,`عميلًا في خمس شرائح`))}
          ${y(l(i.totals.items),g(`stock items`,`صنفًا في المخزون`))}
          ${y(l(i.totals.orders),g(`customer orders`,`طلبًا من العملاء`))}
          ${y(l(r.purchaseOrders.length),g(`purchase orders`,`أمر شراء`))}
        </div>
        <p class="ps-note">${C(e)} ${c(r.provenance.coverage.from)} – ${c(r.provenance.coverage.to)}</p>`)},{id:`method`,kicker:()=>g(`Method`,`المنهجية`),rig:W({p:2,dist:27,elev:.1,azim:.18,lookY:3.6,plateX:7.4}),html:()=>`
        <h2 class="display ps-h">${g(`Seven stages, source to recommendation.`,`سبع مراحل، من المصدر إلى التوصية.`)}</h2>
        <ol class="ps-stages">${b.map((e,t)=>`<li><span class="num">${t+1}</span><b>${v(e.title)}</b>${s(e.state)}</li>`).join(``)}</ol>`},{id:`engineering`,kicker:()=>g(`Engineering`,`الهندسة`),rig:W({p:2,dist:17,elev:1.2,azim:.4,lookY:8.4,plateX:7.4,focus:1}),html:()=>`
        <h2 class="display ps-h">${g(`Layers, a star schema, and proof.`,`طبقات، ومخطط نجمي، وإثبات.`)}</h2>
        <ol class="ps-layers">
          <li><span class="num">48</span>${g(`Bronze tables`,`جدولًا برونزيًا`)}</li>
          <li><span class="num">31</span>${g(`Silver tables, 14 Python cleaners`,`جدولًا فضيًا، 14 مكوّن تنظيف`)}</li>
          <li><span class="num">18</span>${g(`Gold views`,`عرضًا ذهبيًا`)}</li>
          <li><span class="num">14</span>${g(`model tables, 42 DAX measures`,`جدولًا في النموذج، 42 مقياس DAX`)}</li>
        </ol>
        <div class="pk-grid pk-tests">
          ${y(`22/22`,g(`KPIs: SQL = DAX`,`مؤشرًا: SQL = DAX`))}
          ${y(`81/81`,g(`visual queries`,`استعلامًا مرئيًا`))}
          ${y(`4/4`,g(`integrity tests`,`اختبارات سلامة`))}
          ${y(`12`,g(`source reconciliations`,`مطابقة مع المصدر`))}
        </div>
        <p class="ps-note">${s(`pending`,g(`From project files; team approval pending`,`من ملفات المشروع؛ الاعتماد بانتظار الفريق`))}</p>`},{id:`kpis`,kicker:()=>g(`The numbers`,`الأرقام`),rig:W({p:3,dist:26,elev:.55,azim:.55,lookY:2,plateX:7.4}),html:S(()=>`
        <h2 class="display ps-h">${g(`Reconciled to the cent.`,`مطابقة حتى آخر سنت.`)}</h2>
        <div class="pk-grid">
          ${y(p(i.totals.revenue),g(`net revenue`,`صافي الإيرادات`))}
          ${y(m(i.totals.margin),g(`recorded gross margin`,`الهامش الإجمالي المسجَّل`))}
          ${y(m(i.totals.fill,2),g(`unit fill rate`,`معدل تلبية الوحدات`))}
          ${y(m(i.totals.onTime,2),g(`on-time delivery`,`التسليم في الموعد`))}
        </div>
        <div class="ps-chart" data-chart="rev"></div>
        <p class="ps-note">${g(`Every figure is recomputed from the source exports and matches the team’s 13 SQL benchmarks exactly.`,`كل رقم مُعاد حسابه من مستخرجات المصدر ومطابق تمامًا لمعايير الفريق الثلاثة عشر المحسوبة بـ SQL.`)}</p>`),after:e=>{let n=e.querySelector(`[data-chart=rev]`);if(!n||!r)return;let i=new T(n);o.push(i);let a=r,s=e=>a.months.map(t=>e(a.facts.filter(e=>e.mi===t.i)));i.update({labels:r.months.map(e=>_(e.y,e.m)),ticks:r.months.filter(e=>e.m===0).map(e=>({i:e.i,text:String(e.y)})),format:p,series:[{key:`r`,name:g(`Net revenue`,`صافي الإيرادات`),color:`var(--glacier)`,fill:!0,values:s(t)},{key:`p`,name:g(`Recorded gross profit`,`الربح الإجمالي المسجَّل`),color:`var(--brass)`,values:s(u)}]})}},{id:`explore`,kicker:()=>g(`Live analytics`,`تحليلات حية`),rig:W({p:3,dist:38,elev:1.02,azim:.9,lookY:0,plateX:7,lines:.45}),html:S(()=>`
        <h2 class="display ps-h">${g(`Ask the data directly.`,`اسأل البيانات مباشرة.`)}</h2>
        <p class="ps-lede">${g(`Select a segment to redraw its monthly revenue. The same engine drives the Observatory.`,`اختر شريحة لإعادة رسم إيراداتها الشهرية. وهو المحرك نفسه الذي يشغّل المرصد.`)}</p>
        <div class="ps-explore"><div class="ps-bars"></div><div class="ps-chart" data-chart="seg"></div></div>`),after:e=>{if(!r||!i)return;let n=e.querySelector(`[data-chart=seg]`),a=e.querySelector(`.ps-bars`),s=new T(n);o.push(s);let c=null,l=r.months.filter(e=>e.m===0).map(e=>({i:e.i,text:String(e.y)})),u=()=>{let e=r.facts.filter(e=>c===null||e.t===c);s.update({labels:r.months.map(e=>_(e.y,e.m)),ticks:l,format:p,series:[{key:`s`,name:c===null?g(`All segments`,`كل الشرائح`):d(r.territories[c]),color:`var(--glacier)`,fill:!0,values:r.months.map(n=>t(e.filter(e=>e.mi===n.i)))}]}),f.update(i.segments.map(e=>({key:e.t,label:d(e.label),value:e.revenue})),c)},f=new E(a,{color:`var(--glacier)`,format:p,onPick:e=>{c=c===e?null:e,u()}});u()}},{id:`team-findings`,kicker:()=>g(`The team’s findings`,`نتائج الفريق`),rig:W({p:3,dist:26,elev:.55,azim:.2,lookY:2,plateX:7.4}),html:()=>`
        <h2 class="display ps-h">${g(`Four decisions the data supports.`,`أربعة قرارات تدعمها البيانات.`)}</h2>
        <ol class="ps-findings">${x.slice(0,4).map(e=>{let t=i&&r?.provenance.status!==`synthetic`?e.recheck(i):null,n=t?Math.abs(t.got-t.expected)<=(t.unit===`pct`?5e-5:t.unit===`money`?.005:0):null;return`<li><span class="num">${e.rank}</span><div><b>${v(e.question)}</b><p>${v(e.finding)}</p>${n===null?``:`<span class="tf-check ${n?`is-ok`:`is-off`}">${n?`✓`:`≠`} ${n?g(`Website recheck matches`,`إعادة التحقق في الموقع مطابقة`):g(`Website recheck differs`,`إعادة التحقق في الموقع مختلفة`)}</span>`}</div></li>`}).join(``)}</ol>
        <p class="ps-note">${s(`pending`,g(`Team finding · approval pending`,`نتيجة الفريق · بانتظار الاعتماد`))}</p>`},{id:`web-findings`,kicker:()=>g(`Beyond the brief`,`أبعد من الموجز`),rig:W({p:1,dist:30,elev:.9,azim:-.3,lookY:.4,plateX:7.2}),html:S(()=>{let e=i.demand,t=i.inventory,n=i.purchasing,a=e.families[0],o=e.families[1];return`
        <h2 class="display ps-h">${g(`Stock sits where demand is already met.`,`المخزون يتكدس حيث يُلبّى الطلب أصلًا.`)}</h2>
        <div class="pk-grid">
          ${a?y(m(a.share+(o?.share??0),0),g(`of unpicked units are in ${f(r.categories[a.c])}${o?` and ${f(r.categories[o.c])}`:``}`,`من الوحدات غير المجهَّزة في ${f(r.categories[a.c])}${o?` و${f(r.categories[o.c])}`:``}`)):``}
          ${t.shortest?y(g(`${l(t.shortest.cover)} mo`,`${l(t.shortest.cover)} شهرًا`),g(`median cover in ${f(r.categories[t.shortest.c])}, the family that runs short`,`وسيط التغطية في ${f(r.categories[t.shortest.c])}، العائلة التي تعاني النقص`)):``}
          ${t.longest?y(g(`${l(t.longest.cover)} mo`,`${l(t.longest.cover)} شهرًا`),g(`median cover in ${f(r.categories[t.longest.c])}`,`وسيط التغطية في ${f(r.categories[t.longest.c])}`)):``}
          ${n.growth?y(`${n.growth.toFixed(1)}×`,g(`growth in purchase-order value, ${n.years[0].year}–${n.years[n.years.length-1].year}`,`نمو قيمة أوامر الشراء، ${n.years[0].year}–${n.years[n.years.length-1].year}`)):``}
        </div>
        <p class="ps-note">${r.provenance.status===`synthetic`?s(`synthetic`):s(`unverified`,g(`Website analysis · not reviewed by the team`,`تحليل الموقع · لم يراجعه الفريق`))}</p>`})},{id:`lab-profit`,kicker:()=>g(`Analytics Lab · Profit`,`مختبر التحليلات · الربحية`),rig:W({p:3,dist:40,elev:1.1,azim:-.6,lookY:1.4,plateX:7.2,lines:.5}),html:S(()=>{let e=A(r,`revenue`),t=P(r),[n]=t.patterns,i=e.rows.filter(e=>e.cls===`A`&&!e.highMargin).length,a=e.rows.filter(e=>e.cls===`A`).length;return`
        <h2 class="display ps-h">${g(`Profit is concentrated, and the losses are not random.`,`الربح متركّز، والخسائر ليست عشوائية.`)}</h2>
        <div class="pk-grid">
          ${y(m(e.pareto.share),g(`of revenue from the top 20% of items (${l(e.pareto.items)} of ${l(e.rows.length)})`,`من الإيرادات من أعلى 20٪ من الأصناف (${l(e.pareto.items)} من ${l(e.rows.length)})`))}
          ${y(`${l(i)}/${l(a)}`,g(`class-A items earn below the median margin`,`من أصناف الفئة A هامشها دون الوسيط`))}
          ${y(m(n.lineShare),g(`of the ${l(t.total.lines)} loss-making lines are on ${l(n.items)} items priced below cost`,`من ${l(t.total.lines)} سطرًا خاسرًا تقع على ${l(n.items)} أصناف سعرها دون التكلفة`),t.k80Structural?g(`They are also the fewest items that pass 80% of loss lines.`,`وهي أيضًا أقل عدد من الأصناف يتجاوز 80٪ من الأسطر الخاسرة.`):``)}
          ${y(`${l(t.activeMonths)}/${l(t.months)}`,g(`months with loss-making lines`,`شهرًا فيها أسطر خاسرة`))}
        </div>
        <div class="ps-lab-chart" data-chart="pulse"></div>
        <p class="ps-note">${s(`unverified`,g(`Website analysis · not reviewed by the team`,`تحليل الموقع · لم يراجعه الفريق`))} <a class="text-link" href="#/lab">${g(`Open the Analytics Lab`,`افتح مختبر التحليلات`)}</a></p>`}),after:e=>{if(!r)return;let t=P(r),n=new D(e.querySelector(`[data-chart=pulse]`),p);o.push(n),n.update(t.byMonth.map(e=>({y:r.months[e.mi].y,m:r.months[e.mi].m,lines:e.lines,loss:e.loss})))}},{id:`lab-supply`,kicker:()=>g(`Analytics Lab · Supply and stock`,`مختبر التحليلات · التوريد والمخزون`),rig:W({p:0,dist:40,elev:.95,azim:-.5,lookY:3,plateX:7,lines:.5}),html:S(()=>{let e=M(r),t=j(r),n=I(r,12);return`
        <h2 class="display ps-h">${g(`Manage dependence and stock, not punctuality.`,`أدِر الاعتماد والمخزون، لا الالتزام بالمواعيد.`)}</h2>
        <div class="ps-explore">
          <div class="ps-lab-ring" data-chart="ring"></div>
          <div class="pk-grid ps-lab-k">
            ${y(`${l(e.singleSourced.length)}/${l(e.families.length)}`,g(`product families with a single supplier`,`عائلات منتجات لها مورد واحد`))}
            ${y(e.hhi.spend.toFixed(2),g(`spend concentration (HHI), descriptive only`,`تركّز الإنفاق (HHI)، وصفي فقط`),g(`Lead times ${l(e.lead.min)}–${l(e.lead.max)} days, all on time: nothing to rank.`,`مدد التوريد ${l(e.lead.min)}–${l(e.lead.max)} أيام، وكلها في موعدها: لا شيء للترتيب.`))}
            ${y(m(t.rate),g(`of ordered units never picked, rising each complete year`,`من الوحدات المطلوبة لم تُجهَّز، وتزداد كل سنة كاملة`))}
            ${y(g(`${l(n.cover.median)} mo`,`${l(n.cover.median)} شهرًا`),g(`median stock cover per item`,`وسيط تغطية المخزون للصنف`),g(`${m(n.excessShare)} of stock value sits beyond 12 months.`,`${m(n.excessShare)} من قيمة المخزون تتجاوز 12 شهرًا.`))}
          </div>
        </div>
        <p class="ps-note">${s(`unverified`,g(`Website analysis · not reviewed by the team`,`تحليل الموقع · لم يراجعه الفريق`))} <a class="text-link" href="#/lab">${g(`Open the Analytics Lab`,`افتح مختبر التحليلات`)}</a></p>`}),after:e=>{if(!r)return;let t=M(r);O(e.querySelector(`[data-chart=ring]`),t.rows.filter(e=>e.spend>0).map(e=>({label:e.label,share:e.spendShare,pos:e.pos,group:e.group})),t.hhi.spend,N)}},{id:`lab-forecast`,kicker:()=>g(`Analytics Lab · Forecast check`,`مختبر التحليلات · فحص التوقّع`),rig:W({p:3,dist:44,elev:1.15,azim:.2,lookY:1,plateX:7,lines:.4}),html:S(()=>{let e=F(r),[t,n]=e.horizons;if(!t.n||!t.best)return a;let i=e=>e.models.find(e=>e.model===`naive`);return`
        <h2 class="display ps-h">${e.skilful?g(`One simple rule beat “last month” at every horizon.`,`قاعدة بسيطة واحدة تفوّقت على «الشهر السابق» في كل أفق.`):g(`No simple rule beat “last month” at every horizon.`,`لم تتفوّق أي قاعدة بسيطة على «الشهر السابق» في كل أفق.`)}</h2>
        <div class="pk-grid">
          ${y(m(t.best.mape),g(`average miss one month ahead (best rule), against ${m(i(t).mape)} for “last month”`,`متوسط الفارق لشهر واحد (أفضل قاعدة)، مقابل ${m(i(t).mape)} لـ«الشهر السابق»`))}
          ${y(m((n.best??i(n)).mape),n.beatsNaive?g(`average miss three months ahead (best rule)`,`متوسط الفارق لثلاثة أشهر (أفضل قاعدة)`):g(`average miss three months ahead; nothing beat “last month”`,`متوسط الفارق لثلاثة أشهر؛ لم يتفوّق شيء على «الشهر السابق»`))}
          ${y(`<bdi dir="ltr">${l(n.n)}–${l(t.n)}</bdi>`,g(`past months scored, each forecast from earlier data only`,`شهرًا سابقًا مُقيَّمًا، كل توقّع من بيانات أسبق فقط`))}
          ${y(g(`None`,`لا يوجد`),g(`forward forecast published`,`توقّع مستقبلي منشور`),g(`A historical miss is not a prediction interval.`,`الفارق التاريخي ليس فترة تنبؤ.`))}
        </div>
        <div class="ps-lab-chart" data-chart="backtest"></div>
        <p class="ps-note">${s(`unverified`,g(`Methodology demo · historical backtest, not a forecast`,`عرض منهجي · اختبار رجعي تاريخي، لا توقّع`))} <a class="text-link" href="#/lab">${g(`Open the Analytics Lab`,`افتح مختبر التحليلات`)}</a></p>`}),after:e=>{if(!r)return;let t=F(r),n=t.horizons[0].best,i=e.querySelector(`[data-chart=backtest]`);if(!i||!n)return;let a={naive:g(`Last month`,`الشهر السابق`),seasonal:g(`Same month last year`,`الشهر نفسه من العام السابق`),avg3:g(`3-month average`,`متوسط 3 أشهر`),avg12:g(`12-month average`,`متوسط 12 شهرًا`)},s=new k(i,!0);o.push(s),s.update({months:r.months,actual:t.series.map(e=>e.value),warmup:t.warmup,points:n.points,model:a[n.model],h:1,fmt:p})}},{id:`sim-price`,kicker:()=>g(`Decision Simulator · Price`,`محاكي القرار · السعر`),rig:W({p:3,dist:38,elev:.85,azim:-1.4,lookY:1.5,plateX:7,lines:.5}),html:S(()=>{let e=.05,t={kind:`all`},n=R(r,t,e);if(n.kind!==`floor`)return a;let i=z(r,{...L,price:{scope:t,change:e}});return`
        <h2 class="display ps-h">${g(`A ${m(e,0)} price rise pays, unless volume falls by more than ${m(-n.volumeChange)}.`,`رفع الأسعار ${m(e,0)} مُجدٍ، ما لم تنخفض الكمية بأكثر من ${m(-n.volumeChange)}.`)}</h2>
        <div class="pk-grid">
          ${y(`+${p(i.delta)}`,g(`gross profit at recorded volume: arithmetic, no assumption`,`إجمالي الربح عند الكمية المسجّلة: حساب بلا افتراض`))}
          ${y(m(-n.volumeChange),g(`volume it could lose before profit falls below recorded`,`الكمية التي يمكن فقدها قبل أن ينخفض الربح عن المسجَّل`))}
          ${y(`<bdi dir="ltr">${(n.elasticity??0).toFixed(2).replace(`-`,`−`)}</bdi>`,g(`break-even elasticity: customers would have to be more price-sensitive than this`,`مرونة التعادل: يجب أن يكون العملاء أشد حساسية للسعر من ذلك`))}
          <div class="pk ps-sim-pick">
            <p class="pk-l" id="ps-sim-lab">${g(`Assume a volume response`,`افترض استجابة للكمية`)}</p>
            <div class="ps-sim-opts" role="radiogroup" aria-labelledby="ps-sim-lab">
              ${[0,-1,-2,-3].map(e=>`<label><input type="radio" name="ps-sim-e" value="${e}"${e===0?` checked`:``}><span class="num" dir="ltr">${e===0?`0`:`−${-e}`}</span></label>`).join(``)}
            </div>
            <p class="pk-n" data-ps-sim-out aria-live="polite"></p>
          </div>
        </div>
        <div class="ps-lab-chart ps-sim-bridge" data-chart="bridge"></div>
        <p class="ps-note">${s(`unverified`,g(`Scenario arithmetic · not a forecast, not a causal estimate`,`حساب سيناريو · لا توقّع ولا تقدير سببي`))} <a class="text-link" href="#/simulator?p=0.05&amp;ps=a" data-ps-sim-link>${g(`Open this scenario in the Simulator`,`افتح هذا السيناريو في المحاكي`)}</a></p>`}),after:e=>{if(!r)return;let t=e.querySelector(`[data-chart=bridge]`);if(!t)return;let n=new B(t);o.push(n);let i=t=>{let i=z(r,{...L,price:{scope:{kind:`all`},change:.05},elasticity:t}),a=e=>i.steps.find(t=>t.key===e).delta;n.update(i.baseline.profit,[{key:`price`,label:g(`Price +5%`,`السعر ‎+5%`),short:g(`Price`,`السعر`),basis:`decision`,delta:a(`price`)},{key:`volume`,label:g(`Volume response`,`استجابة الكمية`),short:g(`Volume`,`الكمية`),basis:`assumed`,delta:a(`volume`)},{key:`end`,label:g(`Scenario`,`السيناريو`),basis:`total`,delta:0}]);let o=e.querySelector(`[data-ps-sim-out]`),s=i.delta,c=s>=0?`+`:`−⁠`,l=`<bdi dir="ltr">−${-t}</bdi>`,u=`<bdi>${V(c+p(Math.abs(s)))}</bdi>`;o.innerHTML=t===0?g(`Volume unchanged (an assumption): ${u}. Nothing here says customers would behave this way.`,`الكمية ثابتة (افتراض): ${u}. ولا شيء هنا يقول إن العملاء سيتصرفون هكذا.`):g(`At an assumed elasticity of ${l}: ${u} vs recorded; ${m(i.load.share,0)} of the movement rests on the assumption.`,`عند مرونة مفترضة ${l}: ${u} مقابل المسجَّل؛ و${m(i.load.share,0)} من الحركة يستند إلى الافتراض.`),e.querySelector(`[data-ps-sim-link]`).href=`#/simulator?p=0.05&ps=a${t?`&e=${t}`:``}`};e.querySelector(`.ps-sim-opts`).addEventListener(`change`,e=>i(Number(e.target.value))),i(0)}},{id:`recs`,kicker:()=>g(`Recommendations`,`التوصيات`),rig:W({p:0,dist:30,elev:.5,azim:.4,lookY:3,plateX:7}),html:()=>`
        <h2 class="display ps-h">${g(`What to do on Monday.`,`ما يجب فعله صباح الاثنين.`)}</h2>
        <ol class="ps-recs">
          <li><b>${g(`Sales`,`المبيعات`)}</b> ${g(`Verify cost and price on the four loss-making zombie-mask sizes; reprice or delist.`,`التحقق من تكلفة وسعر مقاسات قناع الزومبي الأربعة الخاسرة؛ ثم إعادة التسعير أو السحب.`)}</li>
          <li><b>${g(`Inventory`,`المخزون`)}</b> ${g(`Review replenishment for the short apparel sizes and packaging consumables first.`,`مراجعة إعادة التموين لمقاسات الملابس الناقصة ومستهلكات التغليف أولًا.`)}</li>
          <li><b>${g(`Purchasing`,`المشتريات`)}</b> ${g(`Reconcile purchase-order value with supplier invoices, and close the 25,949 open outers with Fabrikam and Litware.`,`مطابقة قيمة أوامر الشراء مع فواتير الموردين، وإغلاق 25,949 عبوة مفتوحة مع Fabrikam وLitware.`)}</li>
          <li><b>${g(`Operations`,`العمليات`)}</b> ${g(`Track the backorder rate monthly as a service KPI.`,`متابعة معدل التأجيل شهريًا مؤشرًا للخدمة.`)}</li>
        </ol>
        <p class="ps-note">${s(`pending`,g(`For the team’s review`,`لمراجعة الفريق`))}</p>`},{id:`team`,kicker:()=>g(`The team`,`الفريق`),rig:W({p:0,dist:34,elev:.75,azim:.6,lookY:4,plateX:6}),html:()=>`
        <h2 class="display ps-h">${g(`Six people, one instrument.`,`ستة أشخاص، آلة واحدة.`)}</h2>
        <ul class="ps-team">${n.map(e=>`<li class="${e.leader?`is-lead`:``}">${e.portrait?`<img src="${H}team/${e.portrait}.webp" alt="" width="96" height="96" loading="lazy">`:`<span class="ps-mono" aria-hidden="true">${V(v(e.name).split(/\s+/).slice(0,2).map(e=>[...e][0]).join(g(``,` `)))}</span>`}<b>${V(v(e.name))}</b><span>${e.leader?`${g(`Team leader`,`قائد الفريق`)} · `:``}${v(e.role)}</span></li>`).join(``)}</ul>`},{id:`close`,kicker:()=>g(`Thank you`,`شكرًا لكم`),rig:W({p:0,dist:44,elev:1.05,azim:.3,lookY:0,plateX:0,stars:1}),html:()=>`
        <h2 class="display ps-title ps-close">${g(`Questions?`,`أسئلتكم؟`)}</h2>
        <div class="ps-status">
          <p>${s(`completed`)} ${g(`Warehouse, model, report and reconciliation built and tested.`,`المستودع والنموذج والتقرير والمطابقة: بُنيت واختُبرت.`)}</p>
          <p>${s(`progress`)} ${g(`Slicer and drill-through testing; team approval of scope and model.`,`اختبار المقطّعات والتعمق؛ واعتماد الفريق للنطاق والنموذج.`)}</p>
        </div>
        <p class="ps-meta">WWI Supply Chain Intelligence · ${g(`DEPI Graduation Project`,`مشروع تخرج DEPI`)}</p>`}]}var K={cleanup:[],async mount(t){let n=await r(),s=n.state===`ready`?n.dataset:null,c=s?y(s):null,l=[],u=G(n,s,c,n.state===`ready`?``:S(n,`/present`,{compact:!0,headingId:`ps-ds`}),l),d=new URLSearchParams(location.hash.split(`?`)[1]??``),f=Math.min(u.length-1,Math.max(0,Number(d.get(`s`)??1)-1||0));document.body.classList.add(`presenting`),t.innerHTML=`
    <div class="present" role="region" aria-roledescription="${g(`presentation`,`عرض تقديمي`)}" aria-label="${g(`Presentation mode`,`وضع العرض التقديمي`)}">
      <div class="ps-stage">
        <section class="ps-slide" aria-roledescription="${g(`slide`,`شريحة`)}" aria-live="polite"></section>
      </div>
      <nav class="ps-bar" aria-label="${g(`Presentation controls`,`أدوات التحكم في العرض`)}">
        <a class="ps-exit" href="#/">${g(`Exit`,`خروج`)}</a>
        <div class="ps-progress" aria-hidden="true"><span></span></div>
        <p class="ps-count num" aria-live="off"></p>
        <button class="ps-btn ps-prev" type="button">${g(`Previous`,`السابق`)}</button>
        <button class="ps-btn ps-next" type="button">${g(`Next`,`التالي`)}</button>
        <button class="ps-btn ps-lang" type="button" lang="${h.rtl?`en`:`ar`}">${h.rtl?`English`:`العربية`}</button>
        <button class="ps-btn ps-full" type="button" aria-pressed="false">${g(`Full screen`,`ملء الشاشة`)}</button>
      </nav>
      <p class="sr-only">${g(`Use the arrow keys or Space to move between slides, F for full screen, and Escape to leave.`,`استخدم مفاتيح الأسهم أو المسافة للتنقل بين الشرائح، وF لملء الشاشة، وEscape للخروج.`)}</p>
    </div>`;let p=t.querySelector(`.ps-slide`),m=t.querySelector(`.ps-count`),_=t.querySelector(`.ps-progress span`),v=t.querySelector(`.ps-prev`),b=t.querySelector(`.ps-next`),x=()=>a.still,C=e=>{l.splice(0).forEach(e=>e.destroy()),w(null);let t=u[e];p.dataset.slide=t.id,p.setAttribute(`aria-label`,g(`Slide ${e+1} of ${u.length}: ${t.kicker()}`,`الشريحة ${e+1} من ${u.length}: ${t.kicker()}`)),p.innerHTML=`<p class="ps-kicker"><span class="num">${String(e+1).padStart(2,`0`)}</span> ${t.kicker()}</p>${t.html()}`,t.after?.(p),m.textContent=`${e+1} / ${u.length}`,_.style.transform=`scaleX(${(e+1)/u.length})`,v.disabled=e===0,b.disabled=e===u.length-1,history.replaceState(null,``,`#/present?${new URLSearchParams({...Object.fromEntries(new URLSearchParams(location.hash.split(`?`)[1]??``)),s:String(e+1)}).toString()}`)},T=async(t,n=!1)=>{if(t=Math.max(0,Math.min(u.length-1,t)),t===f&&!n)return;let r=t>f?1:-1;f=t;let a=e.sky;a&&(a.ambient=!1,i(u[t].rig,n||x())),n||x()?C(t):(await o.to(p,{opacity:0,x:-24*r*U(),duration:.28,ease:`power2.in`}),C(t),o.fromTo(p,{opacity:0,x:24*r*U()},{opacity:1,x:0,duration:.6,ease:`expo.out`,clearProps:`transform`}),o.fromTo(p.querySelectorAll(`.ps-h, .ps-title, .pk, .ps-points li, .ps-stages li, .ps-layers li, .ps-findings li, .ps-recs li, .ps-team li`),{opacity:0,y:12},{opacity:1,y:0,duration:.7,stagger:.05,ease:`expo.out`,delay:.1,clearProps:`transform`}))},E=()=>h.rtl?`ArrowLeft`:`ArrowRight`,D=()=>h.rtl?`ArrowRight`:`ArrowLeft`,O=e=>{let t=e.target;t.closest(`input, select, textarea, .barlist, svg.trend, .bridge-svg`)||(e.key===E()||e.key===`PageDown`||e.key===` `&&t.tagName!==`BUTTON`&&t.tagName!==`A`?(e.preventDefault(),T(f+1)):e.key===D()||e.key===`PageUp`?(e.preventDefault(),T(f-1)):e.key===`Home`?(e.preventDefault(),T(0)):e.key===`End`?(e.preventDefault(),T(u.length-1)):e.key===`f`||e.key===`F`?A():e.key===`Escape`&&!document.fullscreenElement&&(location.hash=`#/`))},k=t.querySelector(`.ps-full`),A=()=>{document.fullscreenElement?document.exitFullscreen?.().catch(()=>void 0):document.documentElement.requestFullscreen?.().catch(()=>void 0)},j=()=>k.setAttribute(`aria-pressed`,String(!!document.fullscreenElement)),M=()=>{let e=Number(new URLSearchParams(location.hash.split(`?`)[1]??``).get(`s`));e>=1&&e-1!==f&&T(e-1)};window.addEventListener(`hashchange`,M),document.addEventListener(`keydown`,O),document.addEventListener(`fullscreenchange`,j),v.addEventListener(`click`,()=>T(f-1)),b.addEventListener(`click`,()=>T(f+1)),k.addEventListener(`click`,A),t.querySelector(`.ps-lang`).addEventListener(`click`,()=>document.querySelector(`.lang-toggle`)?.click()),p.addEventListener(`click`,e=>{e.target.closest(`a, button, input, label, select, svg, .barlist, .ps-chart, .ps-sim-pick`)||T(f+1)}),requestAnimationFrame(()=>T(f,!0)),this.cleanup.push(()=>{window.removeEventListener(`hashchange`,M),document.removeEventListener(`keydown`,O),document.removeEventListener(`fullscreenchange`,j),document.body.classList.remove(`presenting`),document.fullscreenElement&&document.exitFullscreen?.().catch(()=>void 0),l.forEach(e=>e.destroy()),w(null),e.sky&&(e.sky.ambient=!0)})},unmount(){this.cleanup.forEach(e=>e()),this.cleanup=[]}};export{K as default};