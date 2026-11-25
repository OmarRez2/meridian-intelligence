import"./kit-BwHNjVEB.js";import{n as e}from"./format-BBi0te7M.js";import{L as t,n}from"./index-Cp_ZfTbz.js";import{n as r}from"./datastate-BK23a7TI.js";var i={async mount(i){let a=await t(),o=a.state===`ready`?a.dataset:null,s=o?n(o):[],c=o?.months??[],l=(s.length?Math.max(...s):1)/9,u=o?.provenance.status===`synthetic`;i.innerHTML=`
    <div class="mf">
      <header class="mf-hero">
        <p class="mf-crumb"><a href="#/directions">Design directions</a> / Manifest study</p>
        <h1 class="mf-title">Manifest</h1>
        <div class="mf-doc" role="group" aria-label="Document header">
          <div><span>Consignor</span><b>${o?`${o.suppliers.length} suppliers`:`Suppliers`}</b></div>
          <div><span>Port of call</span><b>One warehouse</b></div>
          <div><span>Consignee</span><b>${o?`Customers in ${o.territories.length} territories`:`Customers`}</b></div>
          <div><span>Period</span><b>${o?`${c[0].label} to ${c[c.length-1].label}`:`No data loaded`}</b></div>
          <div class="mf-docstamp"><span class="stamp">${u?`Synthetic demo`:o?`Verified view`:`No data`}</span></div>
        </div>
        <p class="mf-lede">The supply chain read as its own paperwork. Every month is a container; every finding is stamped onto the record once someone has checked it.</p>
      </header>

      <section class="yard" aria-labelledby="yard-h">
        ${a.state===`ready`?`<div class="yard-head"><h2 id="yard-h">Container yard</h2><p>One stack per month. Each container is ${e.money(l)} of ${u?`synthetic`:`verified`} revenue.</p></div>
        <div class="yard-stacks" role="img" aria-label="Stacked container chart of ${u?`synthetic`:`verified`} monthly revenue from ${c[0]?.label} to ${c[c.length-1]?.label}">
          ${s.map((t,n)=>{let r=Math.max(1,Math.round(t/l));return`<div class="stack" style="--n:${r}" title="${c[n].label}: ${e.money(t)}">${Array.from({length:r},(e,t)=>`<i style="--k:${t};--c:${n}" class="${(n+t)%7==0?`y`:``}"></i>`).join(``)}${c[n].m===0?`<em>${c[n].y}</em>`:``}</div>`}).join(``)}
        </div>`:`<div class="yard-head"><h2 id="yard-h">Container yard</h2></div>${r(a,`/directions/manifest`,{compact:!0,headingId:`yard-state`})}<div class="yard-stacks"></div>`}
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
    </div>`;let d=i.querySelector(`.yard-stacks`),f=new IntersectionObserver(([e])=>{e.isIntersecting&&(d.classList.add(`in`),f.disconnect())},{threshold:.3});f.observe(d);let p=i.querySelectorAll(`.ledger li`),m=new IntersectionObserver(e=>e.forEach(e=>e.isIntersecting&&e.target.classList.add(`in`)),{threshold:.6});p.forEach(e=>m.observe(e)),this.stop=()=>{f.disconnect(),m.disconnect()}},unmount(){this.stop?.()}};export{i as default};