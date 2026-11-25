import{L as e,wt as t}from"./index-Cp_ZfTbz.js";import{t as n}from"./format-BBi0te7M.js";import{n as r}from"./datastate-BK23a7TI.js";var i={async mount(i){let a=await e(),o=a.state===`ready`?a.dataset:null,s=(o?.categories??[]).map((e,t)=>{let n=o.items.filter(e=>e.c===t),r=n.reduce((e,t)=>e+t.onHand,0),i=n.reduce((e,t)=>e+t.reorder,0);return{c:e,level:Math.min(.95,r/(i*2.2)),mark:1/2.2,below:r<i}});i.innerHTML=`
    <div class="tw">
      <section class="tw-hero">
        <canvas class="tw-field" aria-hidden="true"></canvas>
        <div class="tw-copy">
          <p class="tw-crumb"><a href="#/directions">Design directions</a> / Tidewater study</p>
          <h1 class="tw-title">Stock rises and falls<br/>like a tide.</h1>
          <p class="tw-lede">Tidewater reads the supply chain as a harbour. Demand is the current, inventory is the water level, and every reorder level is a line painted on the harbour wall.</p>
        </div>
      </section>
      <section class="tw-gauges" aria-labelledby="g-h">
        <h2 id="g-h">Tide gauges by stock group</h2>
        ${a.state===`ready`?`<p class="tw-note">${o.provenance.status===`synthetic`?`Synthetic levels.`:`Levels from the verified export.`} The coral line on each gauge is the combined reorder level.</p>
        <ul class="gauges">
          ${s.map(e=>`<li class="gauge${e.below?` low`:``}" style="--lvl:${e.level};--mark:${e.mark}"><div class="tube" role="img" aria-label="${n(e.c)}: ${e.below?`below`:`above`} reorder level"><span class="water"></span><span class="mark"></span></div><b>${n(e.c)}</b></li>`).join(``)}
        </ul>`:`${r(a,`/directions/tidewater`,{compact:!0,headingId:`g-state`})}<ul class="gauges"></ul>`}
        <a class="tw-back" href="#/directions">Back to the design directions</a>
      </section>
    </div>`;let c=i.querySelector(`.tw-field`),l=c.getContext(`2d`),u=0,d=e=>{let t=Math.min(2,devicePixelRatio),n=c.clientWidth,r=c.clientHeight;c.width!==n*t&&(c.width=n*t,c.height=r*t),l.setTransform(t,0,0,t,0,0),l.clearRect(0,0,n,r);for(let t=0;t<26;t++){l.beginPath();for(let i=-10;i<=n+10;i+=10){let n=r*(.08+t*.036)+Math.sin(i*.0042+t*.45+e*35e-5)*26+Math.sin(i*.011-e*5e-4+t*1.3)*10+Math.cos(i*.0021+e*2e-4)*14;i===-10?l.moveTo(i,n):l.lineTo(i,n)}let i=t===15;l.strokeStyle=i?`rgba(226,114,91,0.9)`:`rgba(15,61,64,${.12+t/26*.35})`,l.lineWidth=i?2.2:1,l.stroke()}};if(t())d(0);else{let e=t=>{d(t),u=requestAnimationFrame(e)};u=requestAnimationFrame(e)}requestAnimationFrame(()=>i.querySelector(`.gauges`)?.classList.add(`in`)),this.stop=()=>cancelAnimationFrame(u)},unmount(){this.stop?.()}};export{i as default};