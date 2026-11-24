// Layout and accessibility of the Simplified Chinese Settings surface. Chrome renders a bundled preview;
// the test skips where Chrome is not installed. No account, secret, or model call.
// Owns: overflow, wrapping, language, and accessible names. Never: the installed app or user data.

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const styles = resolve(root, 'src/ui/styles');
const chrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].find((path) => existsSync(path));
const shots = process.env.SCREENSHOTS ? resolve(process.env.SCREENSHOTS) : '/opt/cursor/artifacts/settings-zh';

test('Chinese settings layout wraps, stays on screen, and exposes Chinese accessible names', { skip: !chrome, timeout: 60_000 }, async () => {
  const bundled = await esbuild.build({
    absWorkingDir: root,
    entryPoints: [resolve(here, 'settings-zh-preview.tsx')],
    bundle: true,
    format: 'iife',
    write: false,
    platform: 'browser',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    logLevel: 'silent',
  });
  const css = ['tokens.css', 'base.css', 'settings.css', 'overlays.css'].map((name) => readFileSync(resolve(styles, name), 'utf8')).join('\n');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    html, body { margin: 0; background: #f3f3f3; }
    .settings-zh-frame { display: flex; min-height: 100vh; }
    .settings-nav { width: 220px; flex: none; background: var(--sidebar); }
    .settings-view { flex: 1 1 auto; min-width: 0; background: var(--surface); }
    .settings-top { padding: 16px 28px 0; }
    .settings-top h2 { margin: 0; font-size: 22px; }
    @media (max-width: 700px) { .settings-nav { display: none; } .settings-body { padding-inline: 16px; } }
  </style><style>${css}</style></head><body><div id="app"></div><script>${bundled.outputFiles[0].text}</script></body></html>`;

  const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 820 } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.waitForSelector('.settings-content');
    const desktop = await page.evaluate(() => {
      const view = document.querySelector('.settings-view') as HTMLElement;
      const content = document.querySelector('.settings-content') as HTMLElement;
      const nav = document.querySelector('.settings-nav') as HTMLElement;
      const hints = [...document.querySelectorAll('.set-row-hint')].map((el) => ({ height: (el as HTMLElement).getBoundingClientRect().height, title: el.getAttribute('title') || '', text: (el.textContent || '').slice(0, 24) }));
      const inputs = [...document.querySelectorAll('input')].map((el) => ({ value: (el as HTMLInputElement).value, label: el.getAttribute('aria-label') }));
      const names = [...document.querySelectorAll('button, input, [role="switch"]')].map((el) => (el as HTMLElement).getAttribute('aria-label') || (el.textContent || '').trim()).filter(Boolean);
      return {
        lang: view.getAttribute('lang'),
        nav: nav.innerText,
        text: content.innerText,
        inputs,
        overflow: view.scrollWidth - view.clientWidth,
        contentOverflow: content.scrollWidth - content.clientWidth,
        hints,
        names,
        dialogTitle: document.querySelector('.dialog-header h2')?.textContent ?? '',
        dialogMessage: document.querySelector('.dialog-message')?.textContent ?? '',
      };
    });
    assert.equal(desktop.lang, 'zh-CN');
    assert.match(desktop.nav, /通用/);
    assert.match(desktop.nav, /技能与记忆/);
    assert.match(desktop.text, /个人资料/);
    assert.match(desktop.text, /无法保存/);
    assert.deepEqual(desktop.inputs.find((input) => input.value === 'Northwind'), { value: 'Northwind', label: '公司' });
    assert.deepEqual(desktop.inputs.find((input) => input.value === 'gpt-4o'), { value: 'gpt-4o', label: '模型名称' });
    assert.ok(desktop.overflow <= 1, `settings view overflow ${desktop.overflow}`);
    assert.ok(desktop.contentOverflow <= 1, `settings content overflow ${desktop.contentOverflow}`);
    const tallest = Math.max(...desktop.hints.map((hint) => hint.height));
    assert.ok(tallest >= 36, `long hint should use at least two lines, ${JSON.stringify(desktop.hints)}`);
    assert.ok(desktop.hints.some((hint) => hint.title.includes('书面协议')), 'a clipped hint keeps the full Chinese text on its tooltip');
    assert.equal(desktop.dialogTitle, '使用你自己的 Google 应用');
    assert.match(desktop.dialogMessage, /客户端密钥/);
    assert.ok(desktop.names.includes('保存') && desktop.names.includes('取消'));
    assert.equal(desktop.text.includes('Could not save'), false);
    assert.equal(desktop.text.includes('Save'), false);

    mkdirSync(shots, { recursive: true });
    const dialog = page.locator('dialog');
    if (await dialog.count()) await dialog.screenshot({ path: resolve(shots, 'settings-zh-dialog.png') });
    await page.evaluate(() => document.querySelector('dialog')?.remove());
    await page.screenshot({ path: resolve(shots, 'settings-zh-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(100);
    const phone = await page.evaluate(() => {
      const view = document.querySelector('.settings-view') as HTMLElement;
      return { overflow: view.scrollWidth - view.clientWidth };
    });
    assert.ok(phone.overflow <= 1, `phone overflow ${phone.overflow}`);
    await page.screenshot({ path: resolve(shots, 'settings-zh-390.png'), fullPage: true });
  } finally {
    await browser.close();
  }
});
