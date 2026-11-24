// Renders the social preview image (public/og-cover.png, 1200x630) from the live hero.
// Usage: node scripts/og-cover.mjs   (dev server must be running; BASE_URL overrides the default)
import { chromium } from 'playwright-core';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/og-cover.png');
const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(BASE);
await page.waitForTimeout(4500);
// the preview image carries the title and the instrument only: no navigation chrome or buttons
await page.addStyleTag({ content: '#site-nav, .hero-actions, .scroll-cue, .hero-demo, .hero-lede, .ter { visibility: hidden !important; }' });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT });
await browser.close();
console.log('wrote', OUT);
