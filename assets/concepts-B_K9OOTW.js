import{X as e,wt as t}from"./index-Cp_ZfTbz.js";var n=[`Originality`,`Visual impact`,`Usability`,`Credibility`,`Feasibility`,`Motion potential`,`Mobile`,`Fit with supply chain`,`Room to grow`],r={meridian:[5,5,4,4,4,5,4,5,5],manifest:[4,4,5,5,5,3,5,5,4],tidewater:[5,4,3,3,3,4,3,4,3]},i={mount(i){i.innerHTML=`
    <div class="concepts page-pad">
      <header class="c-head">
        <h1 class="display c-title">Three ways to tell the same story</h1>
        <p class="lede">Each direction has its own metaphor, type, colour and motion. Meridian is the recommendation and has the most polish. Manifest and Tidewater are lighter studies, built far enough to judge their character.</p>
      </header>

      <article class="dir dir-meridian">
        <a class="dir-art" href="#/" aria-label="Open the Meridian prototype">${e()}<span class="dir-routes"></span></a>
        <div class="dir-copy">
          <p class="dir-tag rec">Recommended</p>
          <h2 class="dir-name">Meridian</h2>
          <p class="dir-line">The supply chain as a planisphere, the rotating star chart navigators used to read the sky.</p>
          <dl class="dir-spec">
            <div><dt>Metaphor</dt><dd>Suppliers, the warehouse and customers are stars on one instrument. Its calendar rim becomes a 48-month time axis.</dd></div>
            <div><dt>Type</dt><dd>Cormorant Garamond for engraved display lines; IBM Plex Sans and Plex Sans Condensed for data.</dd></div>
            <div><dt>Colour</dt><dd><span class="sw" style="background:#060f22"></span><span class="sw" style="background:#13305c"></span><span class="sw" style="background:#e8edf2"></span><span class="sw" style="background:#d4a85a"></span><span class="sw" style="background:#8fd8e8"></span><span class="sw" style="background:#ef7a8a"></span> Cyanotype night. Brass for inbound, glacier for outbound, ember only for risk.</dd></div>
            <div><dt>Motion</dt><dd>One particle system morphs on the GPU: constellations, then routes, then refinement strata, then a radial chart. Scroll drives a damped camera.</dd></div>
            <div><dt>Analytics</dt><dd>A calm instrument-panel workspace. The sky dims behind it, so charts stay readable.</dd></div>
          </dl>
          <a class="btn btn-primary" href="#/"><span class="dial" aria-hidden="true"></span>Open Meridian</a>
        </div>
      </article>

      <article class="dir dir-manifest">
        <div class="dir-copy">
          <p class="dir-tag">Alternative study</p>
          <h2 class="dir-name">Manifest</h2>
          <p class="dir-line">The supply chain as shipping paperwork: bills of lading, container stacks and customs stamps.</p>
          <dl class="dir-spec">
            <div><dt>Metaphor</dt><dd>Each month is a container; volume is stack height. Findings are stamped onto the record.</dd></div>
            <div><dt>Type</dt><dd>IBM Plex Sans Condensed at heavy weights, set like stencilled freight markings.</dd></div>
            <div><dt>Colour</dt><dd><span class="sw" style="background:#d7d9d4"></span><span class="sw" style="background:#1d2326"></span><span class="sw" style="background:#f2b705"></span><span class="sw" style="background:#2f5d8a"></span><span class="sw" style="background:#c8432b"></span> Corrugated steel, safety yellow, container blue, customs red.</dd></div>
            <div><dt>Motion</dt><dd>Mechanical and stepped: containers drop into place, stamps strike. No easing curves that feel organic.</dd></div>
            <div><dt>Analytics</dt><dd>The most legible of the three. It reads like an operational document.</dd></div>
          </dl>
          <a class="btn btn-ghost" href="#/directions/manifest">Open the Manifest study</a>
        </div>
        <a class="dir-art" href="#/directions/manifest" aria-label="Open the Manifest study">
          <div class="mf-art"><b>MANIFEST</b><span class="mf-stamp">Received</span><div class="mf-stack">${Array.from({length:24},(e,t)=>`<i style="--h:${30+t*37%60}%"></i>`).join(``)}</div></div>
        </a>
      </article>

      <article class="dir dir-tide">
        <a class="dir-art" href="#/directions/tidewater" aria-label="Open the Tidewater study"><canvas class="tide-mini"></canvas></a>
        <div class="dir-copy">
          <p class="dir-tag">Alternative study</p>
          <h2 class="dir-name">Tidewater</h2>
          <p class="dir-line">The supply chain as a harbour: stock rises and falls like water against a tide gauge.</p>
          <dl class="dir-spec">
            <div><dt>Metaphor</dt><dd>Inventory is a water level; demand is a current; the reorder level is a mark on the harbour wall.</dd></div>
            <div><dt>Type</dt><dd>IBM Plex Sans Light at very large sizes, with generous leading.</dd></div>
            <div><dt>Colour</dt><dd><span class="sw" style="background:#dcebe6"></span><span class="sw" style="background:#0f3d40"></span><span class="sw" style="background:#3f8f88"></span><span class="sw" style="background:#e2725b"></span> Sea glass, deep harbour, current teal, buoy coral.</dd></div>
            <div><dt>Motion</dt><dd>Continuous and fluid: contour fields drift, gauges settle with soft overshoot.</dd></div>
            <div><dt>Analytics</dt><dd>Beautiful for inventory and flow, but it strains for sales and supplier comparisons.</dd></div>
          </dl>
          <a class="btn btn-ghost" href="#/directions/tidewater">Open the Tidewater study</a>
        </div>
      </article>

      <section class="eval" aria-labelledby="eval-h">
        <h2 class="h-section" id="eval-h">How the directions compare</h2>
        <p class="lede">Scored 1 to 5 by the design lead. They are judgements to argue with, not measurements.</p>
        <div class="eval-wrap">
          <table class="eval-table">
            <thead><tr><th scope="col">Criterion</th><th scope="col">Meridian</th><th scope="col">Manifest</th><th scope="col">Tidewater</th></tr></thead>
            <tbody>${n.map((e,t)=>`<tr><th scope="row">${e}</th>${[`meridian`,`manifest`,`tidewater`].map(e=>`<td><span class="pips" aria-label="${r[e][t]} of 5">${Array.from({length:5},(n,i)=>`<i class="${i<r[e][t]?`on`:``}"></i>`).join(``)}</span></td>`).join(``)}</tr>`).join(``)}
            <tr class="total"><th scope="row">Total</th>${[`meridian`,`manifest`,`tidewater`].map(e=>`<td class="num">${r[e].reduce((e,t)=>e+t,0)} / 45</td>`).join(``)}</tr></tbody>
          </table>
        </div>
        <div class="verdict prose">
          <h3>Why Meridian</h3>
          <p>Meridian is the only direction where the spectacle is itself an analytical object: the dial the visitor turns on the homepage is a real time axis, and the morph from scattered points to ordered strata to a chart is the project's method made visible. It delivers the cinematic ambition of the brief without letting it leak into the dashboard.</p>
          <p>Manifest is the safest choice and scores best on usability and credibility. It's the right fallback if the team wants something quieter. Elements of it, such as stamped findings and a document-like engineering page, could carry over into Meridian's internal pages.</p>
          <p>Tidewater is the most atmospheric, but its metaphor only fits inventory well, and its continuous motion competes with charts.</p>
        </div>
      </section>
    </div>`;let a=i.querySelector(`.tide-mini`),o=a.getContext(`2d`),s=0,c=e=>{let t=a.width=a.clientWidth*2,n=a.height=a.clientHeight*2;o.fillStyle=`#dcebe6`,o.fillRect(0,0,t,n);for(let r=0;r<14;r++){o.beginPath();for(let i=0;i<=t;i+=8){let t=n*(.15+r*.06)+Math.sin(i*.006+r*.7+e*6e-4)*18+Math.sin(i*.013-e*4e-4+r)*9;i===0?o.moveTo(i,t):o.lineTo(i,t)}o.strokeStyle=r===8?`#e2725b`:`rgba(15,61,64,0.45)`,o.lineWidth=r===8?3:1.4,o.stroke()}};if(t())c(0);else{let e=t=>{c(t),s=requestAnimationFrame(e)};s=requestAnimationFrame(e)}this.stop=()=>cancelAnimationFrame(s)},unmount(){this.stop?.()}};export{i as default};