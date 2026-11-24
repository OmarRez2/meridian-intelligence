import { esc } from '../lib/format';

/**
 * Tiny syntax highlighter for the SQL and DAX snippets on the engineering page.
 * Tokenises once with a single regex; every token is escaped before it is wrapped.
 */
const SQL_KW = new Set('select from where join left right inner outer on as and or not null is case when then else end group by order having count distinct sum min max avg with union all insert into values update set delete create view table top in exists between like cast convert'.split(' '));
const DAX_FN = new Set('divide calculate sameperiodlastyear sumx sum averagex countrows distinctcount filter all allselected values related selectedvalue max min if switch true false blank datesytd edate var return keepfilters removefilters treatas'.split(' '));

export type Lang = 'sql' | 'dax';

export function highlight(code: string, lang: Lang): string {
  const re = /(--[^\n]*|\/\/[^\n]*)|('(?:[^']|'')*')|("(?:[^"])*")|(\[[^\]\n]+\])|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][A-Za-z0-9_]*)|(\s+)|(.)/g;
  let out = '';
  for (const m of code.matchAll(re)) {
    const [tok, comment, squote, dquote, bracket, num, word] = m;
    if (comment) out += `<span class="c-com">${esc(comment)}</span>`;
    else if (squote) out += `<span class="${lang === 'dax' ? 'c-tbl' : 'c-str'}">${esc(squote)}</span>`;
    else if (dquote) out += `<span class="c-str">${esc(dquote)}</span>`;
    else if (bracket) out += `<span class="c-col">${esc(bracket)}</span>`;
    else if (num) out += `<span class="c-num">${num}</span>`;
    else if (word) {
      const w = word.toLowerCase();
      if (lang === 'sql' && SQL_KW.has(w)) out += `<span class="c-kw">${esc(word)}</span>`;
      else if (lang === 'dax' && DAX_FN.has(w)) out += `<span class="c-kw">${esc(word)}</span>`;
      else out += esc(word);
    } else out += esc(tok);
  }
  return out;
}

export function codeBlock(code: string, lang: Lang, label: string) {
  const lines = code.split('\n').length;
  return `<figure class="code"><figcaption><span>${esc(label)}</span><span class="code-lang">${lang.toUpperCase()}</span></figcaption><pre class="code-pre" style="--lines:${lines}" tabindex="0" aria-label="${esc(label)}, ${lang.toUpperCase()} code"><code>${highlight(code, lang)}</code></pre></figure>`;
}
