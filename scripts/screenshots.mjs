import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { mkdirSync } from 'fs';

const BASE = process.env.PROD_URL || 'https://marginplate-two.vercel.app';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const EMAIL = 'maria@test.dev';
const PASSWORD = process.env.DEMO_PASSWORD || 'DemoPass2026!';

mkdirSync('docs/screenshots', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--user-data-dir=C:/Users/asus/marginplate/.browser-tmp',
  ],
});

const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 });

// Sign in with the anon client from browser context (same storage key as the app's client)
await page.addScriptTag({
  url: 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
});
const signin = await page.evaluate(async ({ url, anon, email, password }) => {
  const sb = window.supabase.createClient(url, anon);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  return error ? { error: error.message } : { ok: true };
}, {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  email: EMAIL,
  password: PASSWORD,
});
console.log('signin:', JSON.stringify(signin));

await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
await new Promise(r => setTimeout(r, 2500));

const routes = {
  dashboard: '/dashboard',
  alerts: '/alerts',
  recipes: '/recipes',
  suppliers: '/suppliers',
  invoices: '/invoices',
};

for (const [name, route] of Object.entries(routes)) {
  if (!page.url().endsWith(route)) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle2', timeout: 60000 });
  }
  await new Promise(r => setTimeout(r, 3000));
  const path = `docs/screenshots/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  const body = await page.evaluate(() => document.body.innerText.slice(0, 120).replace(/\n+/g, ' | '));
  console.log(name, '->', path, '| body:', body.slice(0, 100));
}

await browser.close();
console.log('done');