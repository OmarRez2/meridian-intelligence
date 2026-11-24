/**
 * Accessible tabs (WAI-ARIA pattern) over existing markup:
 *   <div role="tablist"><button role="tab" data-tab="a">…</button>…</div>
 * Arrow keys move and select, Home/End jump. The caller renders the panel content in `onSelect`.
 */
export function wireTabs(list: HTMLElement, onSelect: (id: string, index: number) => void, initial = 0) {
  const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role=tab]')];
  const select = (i: number, focus = false) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    if (focus) tabs[i].focus();
    onSelect(tabs[i].dataset.tab!, i);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      const vertical = list.getAttribute('aria-orientation') === 'vertical';
      const next = vertical ? 'ArrowDown' : 'ArrowRight';
      const prev = vertical ? 'ArrowUp' : 'ArrowLeft';
      let n = -1;
      if (e.key === next) n = (i + 1) % tabs.length;
      else if (e.key === prev) n = (i + tabs.length - 1) % tabs.length;
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = tabs.length - 1;
      if (n < 0) return;
      e.preventDefault();
      select(n, true);
    });
  });
  select(initial);
  return { select };
}

/** Disclosure buttons: <button aria-expanded aria-controls="id"> toggling a [hidden] region. */
export function wireDisclosures(root: HTMLElement) {
  root.querySelectorAll<HTMLButtonElement>('button[aria-controls][aria-expanded]').forEach((b) => {
    b.addEventListener('click', () => {
      const region = root.querySelector<HTMLElement>(`#${b.getAttribute('aria-controls')}`);
      if (!region) return;
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      region.hidden = !open;
    });
  });
}

/** One-time reveal when an element first scrolls into view. Respects reduced motion via CSS. */
export function revealOnScroll(root: HTMLElement, selector = '[data-reveal]') {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('seen'); io.unobserve(e.target); } }), { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
  root.querySelectorAll(selector).forEach((el) => io.observe(el));
  return () => io.disconnect();
}
