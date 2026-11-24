// Simplified Chinese for the Settings surface only (fork localization on 0.3.18).
// The English source strings stay the source of truth so existing checks keep reading them. When the UI language is
// Chinese and a Settings view is on screen, visible copy is replaced from the catalog; config keys, model ids, paths,
// commands and provider ids are not catalog entries, so they stay as stored.
// Owns: locale detection, the Settings render scope, and lookup. Never: settings.json fields, RPC names, or copy outside Settings.

import { Fragment, options, type ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';
import { route } from '../lib/router.ts';
import { ZH_DICT } from './zh-dict.generated.ts';

const UI_ATTRS = ['aria-label', 'placeholder', 'title', 'alt'] as const;

let depth = 0;
let mounted = 0;
let localeOverride: string | null = null;
let forceActive = false;
let hooked = false;

/** Test hook. `null` follows the runtime language. */
export function setSettingsLocaleForTest(locale: string | null): void {
  localeOverride = locale;
}

/** Test hook: translate even when the route is not Settings (unit tests have no shell). */
export function setSettingsZhActiveForTest(active: boolean): void {
  forceActive = active;
}

function language(): string {
  if (localeOverride) return localeOverride;
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  try { return Intl.DateTimeFormat().resolvedOptions().locale || 'en'; } catch { return 'en'; }
}

/** Simplified Chinese catalog is used for every Chinese UI language; Traditional Chinese is not a separate catalog. */
export function isZhLocale(): boolean {
  const lang = language().toLowerCase().replace(/_/g, '-');
  return lang === 'zh' || lang.startsWith('zh-');
}

function onSettingsRoute(): boolean {
  try { return route.peek().view === 'settings'; } catch { return false; }
}

/** `lang` for the Settings root. Undefined keeps the document language. */
export function settingsLang(): 'zh-CN' | undefined {
  return isZhLocale() ? 'zh-CN' : undefined;
}

/** Extra class for long-copy layout. Empty when the catalog is off. */
export function settingsLocaleClass(): string {
  return isZhLocale() ? ' settings-locale-zh' : '';
}

/** Chinese search words for a Settings page. Empty unless the UI language is Chinese. */
export function zhSearchExtra(id: string): string {
  if (!isZhLocale()) return '';
  return ZH_SEARCH[id] ?? '';
}

const ZH_SEARCH: Readonly<Record<string, string>> = {
  general: '通用 个人资料 外观 主题 深色 浅色 通知 声音 行为 开机 公司 字号',
  models: '模型 服务商 账号 密钥 语音 用量 嵌入 本地',
  calendar: '日历 日程 工作时间 谷歌',
  scheduled: '定时 稍后发送 重复 提醒',
  secrets: '机密 密码 密钥 登录',
  security: '安全 信任 权限 文件夹 命令 花钱',
  apps: '应用 连接 集成',
  skills: '技能 记忆 知识',
  devices: '设备 连接 手机 这台电脑',
  feedback: '反馈 报告 建议',
  about: '关于 版本 更新 备份 数据文件夹',
};

function norm(text: string): string {
  return text.replace(/\u2011/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\u00a0/g, ' ');
}

function core(text: string): { lead: string; body: string; tail: string } {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text);
  return { lead: match?.[1] ?? '', body: match?.[2] ?? text, tail: match?.[3] ?? '' };
}

let patternDepth = 0;

function catalog(body: string): string | undefined {
  return ZH_DICT[norm(body)];
}

/** Patterns for copy built around a name, a count or a path. Names and paths are kept. */
function patterned(body: string): string | null {
  const text = norm(body);
  const rules: Array<{ re: RegExp; to: (match: RegExpMatchArray) => string }> = [
    { re: /^On your PC: ([\s\S]+)$/, to: (m) => `在这台电脑上：${nested(m[1])}` },
    { re: /^Remove (.+)\?$/, to: (m) => `要移除「${m[1]}」吗？` },
    { re: /^Delete (\d+) entr(?:y|ies)\?$/, to: (m) => `要删除 ${m[1]} 项吗？` },
    { re: /^Delete (.+)\?$/, to: (m) => `要删除「${m[1]}」吗？` },
    { re: /^Leave (.+)\?$/, to: (m) => `要离开「${m[1]}」吗？` },
    { re: /^Use a reset for (.+)\?$/, to: (m) => `要为「${m[1]}」使用一次重置吗？` },
    { re: /^Keep (.+) on this PC only\?$/, to: (m) => `仅在这台电脑上保留「${m[1]}」吗？` },
    { re: /^Use (.+) in this company\?$/, to: (m) => `要在此公司使用「${m[1]}」吗？` },
    { re: /^Could not wake (.+)$/, to: (m) => `无法唤醒「${m[1]}」` },
    { re: /^Waking (.+)$/, to: (m) => `正在唤醒「${m[1]}」` },
    { re: /^(.+) copied$/, to: (m) => `${nested(m[1])}已复制` },
    { re: /^(.+) works$/, to: (m) => `「${m[1]}」可用` },
    { re: /^(.+) exported$/, to: (m) => `已导出「${m[1]}」` },
    { re: /^(\d+) entr(?:y|ies) exported$/, to: (m) => `已导出 ${m[1]} 项` },
    { re: /^Version (.+) available$/, to: (m) => `有新版本 ${m[1]}` },
    { re: /^Version (.+) ready$/, to: (m) => `版本 ${m[1]} 已准备好` },
    { re: /^Downloading (\d+) ?%$/, to: (m) => `正在下载 ${m[1]}%` },
    { re: /^Update all \((\d+)\)$/, to: (m) => `全部更新（${m[1]}）` },
    { re: /^(\d+) languages$/, to: (m) => `${m[1]} 种语言` },
    { re: /^(\d+) MB on this PC$/, to: (m) => `本机占用 ${m[1]} MB` },
    { re: /^(\d+) MB download$/, to: (m) => `下载约 ${m[1]} MB` },
    { re: /^(\d+) models?$/, to: (m) => `${m[1]} 个模型` },
    { re: /^(\d+) skills$/, to: (m) => `${m[1]} 个技能` },
    { re: /^Field (\d+) name$/, to: (m) => `字段 ${m[1]} 名称` },
    { re: /^Field (\d+) type$/, to: (m) => `字段 ${m[1]} 类型` },
    { re: /^Field (\d+) value$/, to: (m) => `字段 ${m[1]} 的值` },
    { re: /^Remove field (\d+)$/, to: (m) => `移除字段 ${m[1]}` },
    { re: /^Remove row (\d+)$/, to: (m) => `移除第 ${m[1]} 行` },
    { re: /^Name (\d+)$/, to: (m) => `名称 ${m[1]}` },
    { re: /^(.+) smaller$/, to: (m) => `${nested(m[1])} 减小` },
    { re: /^(.+) larger$/, to: (m) => `${nested(m[1])} 增大` },
    { re: /^Headings, chat names, setting names and other short texts · (\d+)–(\d+) px, (\d+) by default$/, to: (m) => `标题、对话名称、设置名称和其他短文本 · ${m[1]}–${m[2]} px，默认 ${m[3]}` },
    { re: /^Chats, prompts and other long texts · (\d+)–(\d+) px, (\d+) by default – also (⌘|Ctrl) \+ and −$/, to: (m) => `对话、提示词和其他长文本 · ${m[1]}–${m[2]} px，默认 ${m[3]}，也可用 ${m[4]} 与 + / −` },
    { re: /^Chats, prompts and other long texts · (\d+)–(\d+) px, (\d+) by default$/, to: (m) => `对话、提示词和其他长文本 · ${m[1]}–${m[2]} px，默认 ${m[3]}` },
    { re: /^Joining (.+) as a new member$/, to: (m) => `正在以新成员加入「${m[1]}」` },
    { re: /^Joined (.+) as a new member$/, to: (m) => `已作为新成员加入「${m[1]}」` },
    { re: /^Connected with (.+)$/, to: (m) => `已与「${m[1]}」连接` },
    { re: /^(.+) declined: ([\s\S]+)$/, to: (m) => `「${m[1]}」已拒绝：${m[2]}` },
    { re: /^(.+) declined$/, to: (m) => `「${m[1]}」已拒绝` },
    { re: /^Nobody accepted on (.+) in time$/, to: (m) => `「${m[1]}」上没有人及时接受` },
    { re: /^Could not connect to (.+): ([\s\S]+)$/, to: (m) => `无法连接到「${m[1]}」：${m[2]}` },
    { re: /^Could not connect to (.+)$/, to: (m) => `无法连接到「${m[1]}」` },
    { re: /^Asking (.+)$/, to: (m) => `正在询问「${m[1]}」` },
    { re: /^(.+) is one of your devices now$/, to: (m) => `「${m[1]}」现在是你的设备之一` },
    { re: /^Add this PC to (.+)'s devices\? Everything here is shared with them\.$/, to: (m) => `要把这台电脑加入「${m[1]}」的设备吗？这里的内容都会与对方共享。` },
    { re: /^Phone (.+) asks (.+) to connect$/, to: (m) => `手机「${m[1]}」请求在「${m[2]}」上连接` },
    { re: /^Phone (.+) asks to connect$/, to: (m) => `手机「${m[1]}」请求连接` },
    { re: /^Accept only if the phone shows the code (.+)$/, to: (m) => `仅当手机上显示验证码 ${m[1]} 时接受` },
    { re: /^Accept only if (.+) shows the code (.+)$/, to: (m) => `仅当「${m[1]}」显示验证码 ${m[2]} 时接受` },
    { re: /^(.+) wants to join (.+) as a new member$/, to: (m) => `「${m[1]}」想作为新成员加入「${m[2]}」` },
    { re: /^(.+) wants to be one of your devices$/, to: (m) => `「${m[1]}」想成为你的设备之一` },
    { re: /^Key from (.+)$/, to: (m) => `密钥来自 ${m[1]}` },
    { re: /^The key in (.+) is missing or was rejected – set a valid key and restart Autark, or remove this connection$/, to: (m) => `环境变量 ${m[1]} 中的密钥缺失或被拒绝。请设置有效密钥并重启 Autark，或移除这个连接` },
    { re: /^Autark stops using the key in (.+); the variable itself stays as it is\.$/, to: (m) => `Autark 将不再使用 ${m[1]} 中的密钥；变量本身保持不变。` },
    { re: /^(.+) · meeting server connected$/, to: (m) => `${nested(m[1])} · 已连接会面服务器` },
    { re: /^(.+) · only this network \(meeting server off\)$/, to: (m) => `${nested(m[1])} · 仅此网络（会面服务器已关闭）` },
    { re: /^(.+) · only this network for now \(([\s\S]+)\)$/, to: (m) => `${nested(m[1])} · 目前仅此网络（${m[2]}）` },
    { re: /^This local history keeps the latest (\d+) entries and up to (\d+) characters per value\. This covers security switches, library sharing and agreement texts, not every security event\. File edits are not attributed to a person or agent; a person entry identifies the session, not who operated it\. Quick edits may appear as one\. The history is not tamper-proof\.$/, to: (m) => `这份本地记录保留最近 ${m[1]} 条，每项最多 ${m[2]} 个字符。它涵盖安全开关、资料库分享和协议文本，不是每一条安全事件。文件编辑不会记到某个人或某个智能体；人员记录标识的是会话，不是操作者本人。很快的连续修改可能显示为一条。这份记录不能防止篡改。` },
  ];
  for (const rule of rules) {
    const match = rule.re.exec(text);
    if (match) return rule.to(match);
  }
  return null;
}

function nested(text: string): string {
  const hit = catalog(text);
  if (hit) return hit;
  if (patternDepth > 3) return text;
  patternDepth += 1;
  try { return patterned(text) ?? text; } finally { patternDepth -= 1; }
}

/** Replace a known Settings string. Unknown text, including ids and paths, is returned unchanged. */
export function lookupSettingsText(input: string): string {
  if (!input) return input;
  const parts = core(input);
  if (!parts.body) return input;
  const hit = catalog(parts.body) ?? (() => {
    if (patternDepth > 3) return null;
    patternDepth += 1;
    try { return patterned(parts.body); } finally { patternDepth -= 1; }
  })();
  if (!hit || hit === parts.body) return input;
  return `${parts.lead}${hit}${parts.tail}`;
}

/** Settings copy while the Settings route is open, or while a Settings subtree is rendering. */
export function zh(text: string): string {
  if (!isZhLocale() || !(forceActive || depth > 0 || onSettingsRoute())) return text;
  return lookupSettingsText(text);
}

function translateChildren(children: unknown): unknown {
  if (typeof children === 'string') return lookupSettingsText(children);
  if (Array.isArray(children)) return children.map(translateChildren);
  return children;
}

function translateDom(vnode: { type: unknown; props?: Record<string, unknown> | null }): void {
  const props = vnode.props;
  if (!props) return;
  const dom = typeof vnode.type === 'string';
  const fragment = vnode.type === Fragment;
  if (!dom && !fragment) return;
  if (dom) {
    for (const key of UI_ATTRS) {
      if (typeof props[key] === 'string') props[key] = lookupSettingsText(props[key]);
    }
  }
  if ('children' in props) props.children = translateChildren(props.children) as never;
}

interface ScopeVNode { type?: unknown }
interface SettingsHooks {
  vnode?(vnode: { type: unknown; props?: Record<string, unknown> | null }): void;
  /** Before-diff. Preact 10.29's published build calls `__b`; its sources name `_diff`. */
  __b?(vnode: ScopeVNode): void;
  _diff?(vnode: ScopeVNode): void;
  diffed?(vnode: ScopeVNode): void;
}

const openScopes = new WeakSet<object>();

function enterScope(vnode: ScopeVNode): void {
  if (vnode.type !== ZhScope || openScopes.has(vnode)) return;
  openScopes.add(vnode);
  depth += 1;
}

function leaveScope(vnode: ScopeVNode): void {
  if (vnode.type !== ZhScope || !openScopes.has(vnode)) return;
  openScopes.delete(vnode);
  depth -= 1;
}

function install(): void {
  if (hooked) return;
  hooked = true;
  const hooks = options as SettingsHooks;
  const prevVNode = hooks.vnode;
  hooks.vnode = (vnode) => {
    if ((depth > 0 || mounted > 0) && isZhLocale()) translateDom(vnode);
    prevVNode?.(vnode);
  };
  const prevBefore = hooks.__b;
  hooks.__b = (vnode) => { enterScope(vnode); prevBefore?.(vnode); };
  const prevDiff = hooks._diff;
  hooks._diff = (vnode) => { enterScope(vnode); prevDiff?.(vnode); };
  const prevDiffed = hooks.diffed;
  hooks.diffed = (vnode) => {
    prevDiffed?.(vnode);
    leaveScope(vnode);
  };
}

/** Marks a Settings subtree so only that UI is translated. */
export function ZhScope(props: { children?: ComponentChildren }) {
  const counted = useRef(false);
  if (!counted.current) { counted.current = true; mounted += 1; }
  useLayoutEffect(() => () => { mounted -= 1; }, []);
  return props.children;
}

install();
