// Faithful Settings preview: the same label/hint pairs as General, Models and Security, activated by the
// browser locale (what Electron reports as navigator.language for a Chinese Windows user). No account or secret.
// Owns: those pairings, wrapping, and the locale gate. Never: the installed app or user data.

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import { chromium, type Page } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const styles = resolve(root, 'src/ui/styles');
const chrome = ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium'].find((path) => existsSync(path));
const shots = process.env.SCREENSHOTS ? resolve(process.env.SCREENSHOTS) : '/opt/cursor/artifacts/settings-zh';

const css = () => ['tokens.css', 'base.css', 'settings.css', 'overlays.css'].map((name) => readFileSync(resolve(styles, name), 'utf8')).join('\n');

async function html(): Promise<string> {
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
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; background: #f3f3f3; }
    .settings-zh-frame { display: flex; min-height: 100vh; }
    .settings-nav { width: 220px; flex: none; background: var(--sidebar); }
    .settings-view { flex: 1 1 auto; min-width: 0; background: var(--surface); }
    .settings-top { padding: 16px 28px 0; }
    .settings-top h2 { margin: 0; font-size: 22px; }
    @media (max-width: 700px) { .settings-nav { display: none; } .settings-body { padding-inline: 16px; } }
  </style><style>${css()}</style></head><body><div id="app"></div><script>${bundled.outputFiles[0].text}</script></body></html>`;
}

async function row(page: Page, label: string): Promise<string> {
  return page.locator('.set-row').filter({ has: page.locator('.set-row-label', { hasText: label }) }).innerText();
}

test('Chinese Windows locale renders the real Settings pairs; English does not', { skip: !chrome, timeout: 90_000 }, async () => {
  const pageHtml = await html();
  const browser = await chromium.launch({ executablePath: chrome, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  mkdirSync(shots, { recursive: true });
  try {
    const zh = await browser.newContext({ locale: 'zh-CN', viewport: { width: 1280, height: 900 } });
    const page = await zh.newPage();
    await page.setContent(pageHtml, { waitUntil: 'load' });
    await page.waitForSelector('[data-section="general"]');
    assert.equal(await page.evaluate(() => navigator.language), 'zh-CN');
    assert.equal(await page.locator('.settings-view').getAttribute('lang'), 'zh-CN');

    const enter = await row(page, '按 Enter 发送');
    assert.match(enter, /Shift\+Enter/);
    assert.match(enter, /换行/);
    assert.doesNotMatch(enter, /https:\/\//);
    const sound = await row(page, '声音');
    assert.match(sound, /待办/);
    assert.doesNotMatch(sound, /iPhone|Android/);
    assert.equal(await page.locator('input[aria-label="公司"]').inputValue(), 'Northwind');
    const view = page.locator('.settings-view');
    const box = await view.evaluate((el) => ({ overflow: el.scrollWidth - el.clientWidth }));
    assert.ok(box.overflow <= 1, `overflow ${box.overflow}`);
    await page.screenshot({ path: resolve(shots, 'settings-zh-general-1280.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: resolve(shots, 'settings-zh-general-390.png'), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByRole('button', { name: '模型' }).click();
    await page.waitForSelector('[data-section="models"]');
    const work = await row(page, '工作');
    assert.match(work, /每一次智能体回合/);
    assert.match(work, /gpt-4o/);
    assert.equal(await page.locator('input[aria-label="模型名称"]').inputValue(), 'gpt-4o');
    await page.screenshot({ path: resolve(shots, 'settings-zh-models-1280.png'), fullPage: true });

    await page.getByRole('button', { name: '安全' }).click();
    await page.waitForSelector('[data-section="security"]');
    const secure = await page.locator('[data-section="security"]').innerText();
    assert.match(secure, /信任 AI/);
    assert.match(secure, /安全模式/);
    assert.match(secure, /付款、订阅/);
    assert.equal(secure.includes('无法保存'), false);
    assert.equal(secure.includes('Could not save'), false);
    assert.equal(secure.includes('使用你自己的 Google 应用'), false);
    await page.screenshot({ path: resolve(shots, 'settings-zh-security-1280.png'), fullPage: true });

    await page.getByRole('button', { name: '日历' }).click();
    await page.waitForSelector('[data-section="calendar"]');
    const google = await row(page, '使用你自己的 Google 应用');
    assert.match(google, /客户端 ID 和密钥/);
    await page.getByRole('button', { name: '设置', exact: true }).click();
    await page.locator('dialog h2').waitFor();
    assert.equal(await page.locator('dialog h2').innerText(), '使用你自己的 Google 应用');
    const dialogText = await page.locator('dialog').innerText();
    assert.match(dialogText, /凭据/);
    assert.match(dialogText, /7 天后失效/);
    assert.match(dialogText, /请输入客户端密钥后再保存/);
    assert.match(dialogText, /取消/);
    assert.match(dialogText, /保存/);
    assert.equal(dialogText.includes('无法保存'), false);
    await page.locator('dialog').screenshot({ path: resolve(shots, 'settings-zh-dialog.png') });

    const en = await browser.newContext({ locale: 'en-US', viewport: { width: 1280, height: 900 } });
    const english = await en.newPage();
    await english.setContent(pageHtml, { waitUntil: 'load' });
    await english.waitForSelector('[data-section="general"]');
    assert.equal(await english.evaluate(() => navigator.language), 'en-US');
    assert.equal(await english.locator('.settings-view').getAttribute('lang'), null);
    const englishEnter = await row(english, 'Enter sends');
    assert.match(englishEnter, /Shift\+Enter for a new line/);
    assert.equal((await english.locator('.settings-content').innerText()).includes('按 Enter 发送'), false);
    await en.close();
    await zh.close();
  } finally {
    await browser.close();
  }
});
