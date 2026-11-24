export interface Page {
  mount(root: HTMLElement): void | Promise<void>;
  unmount?(): void;
}
export type RouteDef = { id: string; load: () => Promise<Page> };

type Hook = (from: string | null, to: string) => Promise<void> | void;

export class Router {
  private current: { id: string; variant: string; page: Page } | null = null;
  private busy = false;
  private queued: string | null = null;
  /**
   * `variant` names a state that needs a fresh mount even on the same route (the data mode):
   * `#/observatory` and `#/observatory?data=verified` are the same page showing different data.
   */
  constructor(
    private routes: Record<string, RouteDef>,
    private root: HTMLElement,
    private hooks: { before?: Hook; after?: Hook } = {},
    private variant: () => string = () => '',
  ) {
    window.addEventListener('hashchange', () => this.resolve());
  }
  path(): string {
    const h = location.hash.replace(/^#/, '') || '/';
    return h.split('?')[0];
  }
  /** start downloading the current route's code early; resolve() reuses the browser's module cache */
  preload() {
    (this.routes[this.path()] ?? this.routes['/']).load().catch(() => undefined);
  }
  async resolve() {
    const path = this.path();
    const variant = this.variant();
    const key = `${path}|${variant}`;
    if (this.busy) { this.queued = key; return; }
    this.busy = true;
    const def = this.routes[path] ?? this.routes['/'];
    const from = this.current?.id ?? null;
    if (from !== def.id || !this.current || this.current.variant !== variant) {
      await this.hooks.before?.(from, def.id);
      this.current?.page.unmount?.();
      this.root.innerHTML = '';
      window.scrollTo(0, 0);
      const page = await def.load();
      document.body.dataset.route = def.id;
      await page.mount(this.root);
      this.current = { id: def.id, variant, page };
      await this.hooks.after?.(from, def.id);
    }
    this.busy = false;
    if (this.queued && this.queued !== key) { this.queued = null; this.resolve(); }
    this.queued = null;
  }
}
