// Settings Simplified Chinese catalog (fork localization on 0.3.18).
// Owns: locale gating, exact copy, dynamic names, and strings that must stay literal. Never: a model, a secret, or a user profile.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { lookupSettingsText, setSettingsLocaleForTest, setSettingsZhActiveForTest, settingsLang, zh, zhSearchExtra } from '../../../src/ui/settings/i18n.ts';
import { searchSections } from '../../../src/ui/settings/sections.ts';

afterEach(() => {
  setSettingsLocaleForTest(null);
  setSettingsZhActiveForTest(false);
});

test('the desktop pages keep each hint with its own control', () => {
  const general = readFileSync(new URL('../../../src/ui/settings/GeneralPage.tsx', import.meta.url), 'utf8');
  assert.match(general, /label="Enter sends" hint=\{prefs\.enterSends \? 'Shift\+Enter for a new line' : 'Ctrl\+Enter sends'\}/);
  assert.match(general, /label="Sound" hint="To-dos for you, blockers and important messages always arrive"/);
  assert.doesNotMatch(general, /label="Enter sends"[\s\S]{0,120}https:\/\//);
  assert.doesNotMatch(general, /label="Sound"[\s\S]{0,200}iPhone/);
  const security = readFileSync(new URL('../../../src/ui/settings/SecurityPage.tsx', import.meta.url), 'utf8');
  assert.equal(security.includes('Could not save'), false);
});

test('Electron\'s Chinese Windows locale (navigator.language zh-CN) is the switch', () => {
  for (const locale of ['zh-CN', 'zh-Hans-CN']) {
    setSettingsLocaleForTest(locale);
    setSettingsZhActiveForTest(true);
    assert.equal(zh('Enter sends'), '按 Enter 发送', locale);
    assert.equal(zh('Shift+Enter for a new line'), 'Shift+Enter 换行', locale);
  }
  setSettingsLocaleForTest('en-US');
  setSettingsZhActiveForTest(true);
  assert.equal(zh('Enter sends'), 'Enter sends');
  assert.equal(zh('gpt-4o'), 'gpt-4o');
});

test('Chinese settings copy is off unless the UI language is Chinese and Settings is active', () => {
  assert.equal(zh('Save'), 'Save');
  assert.equal(settingsLang(), undefined);
  setSettingsLocaleForTest('zh-CN');
  assert.equal(zh('Save'), 'Save', 'a Chinese PC outside Settings keeps the rest of the app in English');
  assert.equal(settingsLang(), 'zh-CN');
  setSettingsZhActiveForTest(true);
  assert.equal(zh('Save'), '保存');
  assert.equal(zh('  Close  '), '  关闭  ');
});

test('labels, validation and save prompts translate; ids, paths and commands do not', () => {
  setSettingsLocaleForTest('zh-CN');
  setSettingsZhActiveForTest(true);
  assert.equal(zh('General'), '通用');
  assert.equal(zh('Could not save'), '无法保存');
  assert.equal(zh('Enter an address that starts with https:// (or http:// on your network)'), '请输入以 https:// 开头的地址（局域网可用 http://）');
  assert.equal(zh('gpt-4o'), 'gpt-4o');
  assert.equal(zh('claude-sonnet-4'), 'claude-sonnet-4');
  assert.equal(zh('openai'), 'openai');
  assert.equal(zh('settings.json'), 'settings.json');
  assert.equal(zh('devices.findable'), 'devices.findable');
  assert.equal(zh('npx -y @modelcontextprotocol/server-filesystem C:/Docs'), 'npx -y @modelcontextprotocol/server-filesystem C:/Docs');
  assert.equal(lookupSettingsText('This PC does not accept connection requests (settings.json devices.findable)').includes('settings.json'), true);
  assert.equal(lookupSettingsText('This PC does not accept connection requests (settings.json devices.findable)').includes('devices.findable'), true);
});

test('dynamic settings prompts keep the person\'s names and translate the sentence', () => {
  const remove = lookupSettingsText('Remove My PC?');
  assert.match(remove, /My PC/);
  assert.match(remove, /移除/);
  assert.equal(lookupSettingsText('On your PC: Opens the app when the PC starts and keeps agents working in the background'), '在这台电脑上：电脑启动时打开应用，并让智能体在后台继续工作');
  assert.equal(lookupSettingsText('Headings, chat names, setting names and other short texts · 10–17 px, 13 by default'), '标题、对话名称、设置名称和其他短文本 · 10–17 px，默认 13');
  assert.equal(lookupSettingsText('Labels size smaller'), '标签字号 减小');
  assert.equal(lookupSettingsText('Delete 3 entries?'), '要删除 3 项吗？');
});

test('Settings search accepts Chinese and English while Chinese is on', () => {
  setSettingsLocaleForTest('zh-CN');
  setSettingsZhActiveForTest(true);
  assert.equal(zhSearchExtra('general').includes('通用'), true);
  assert.equal(searchSections('通用').some((section) => section.id === 'general'), true);
  assert.equal(searchSections('general').some((section) => section.id === 'general'), true);
  assert.equal(searchSections('开机').some((section) => section.id === 'general'), true);
  setSettingsLocaleForTest('en-US');
  assert.equal(searchSections('通用').some((section) => section.id === 'general'), false);
});

test('Traditional and Simplified locale tags both use this catalog', () => {
  for (const locale of ['zh', 'zh-CN', 'zh-Hans-CN', 'zh-TW', 'zh_HK']) {
    setSettingsLocaleForTest(locale);
    setSettingsZhActiveForTest(true);
    assert.equal(zh('Settings'), '设置', locale);
  }
});
