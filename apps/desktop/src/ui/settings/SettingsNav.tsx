// Settings navigation in the shell's single sidebar while Settings is open (and the phone's settings list): its header
// data (settingsNavHeader – "Settings" with the in-place search, drawn by the frame's header row, shell/views.ts; on the
// phone a page's top row holds the same search) and the pages this connection may use (sections.ts). The search matches page
// titles, every row keyword and (F20) what a page holds (settings-words.ts, loaded once the search holds text); the open page
// stays listed while it holds hits (search-marks.ts pageHits). Enter goes to the open page's next hit, else opens the first
// other page that matches.
// Owns: the page list and the search text. Never: renders page content or header markup.

import { signal } from '@preact/signals';
import { Icon } from '../lib/icons.tsx';
import type { HeaderProps } from '../lib/header.tsx';
import { isMobile } from '../lib/platform.ts';
import { navigate, route } from '../lib/router.ts';
import { can } from '../lib/session.ts';
import { nextSearchHit, pageHits } from './search-marks.ts';
import { resolveVisibleSection, searchSections, visibleSections } from './sections.ts';
import { zh, ZhScope, settingsLang, settingsLocaleClass } from './i18n.ts';
import { settingsWords, wantSettingsWords } from './settings-words.ts';

/** Shared with Settings.tsx so the content can highlight matching rows. */
export const settingsSearch = signal('');
/** The search field is open (it stays open while it holds text). */
const searchOpen = signal(false);

/** The Settings header: "Settings" and the magnifier, whose field takes the title's place. */
export function settingsNavHeader(): HeaderProps {
  const query = settingsSearch.value;
  return {
    title: zh('Settings'),
    search: {
      label: zh('Search settings'), placeholder: zh('Search settings'), open: searchOpen.value || query !== '', query,
      onQuery: (text) => { settingsSearch.value = text; if (text.trim()) wantSettingsWords(); },
      onOpenChange: (open) => { searchOpen.value = open; },
      onSubmit: (text) => {
        if (nextSearchHit()) return;
        const open = route.value.view === 'settings' ? route.value.section : undefined;
        const matches = searchSections(text, visibleSections(can), settingsWords.value);
        const first = matches.find((section) => section.id !== open) ?? matches[0];
        if (first) navigate({ view: 'settings', section: first.id });
      },
    },
  };
}

export function SettingsNav() {
  return (
    <ZhScope>
      <SettingsNavList />
    </ZhScope>
  );
}

function SettingsNavList() {
  // The phone's list shows only while no page is open: nothing is highlighted there.
  const current = route.value.view === 'settings' && !isMobile.value ? resolveVisibleSection(route.value.section, can).id : null;
  const found = new Set(searchSections(settingsSearch.value, visibleSections(can), settingsWords.value).map((section) => section.id));
  const matches = visibleSections(can).filter((section) => found.has(section.id) || (section.id === current && pageHits.value > 0));
  return (
    <nav class={`settings-nav${settingsLocaleClass()}`} lang={settingsLang()} aria-label="Settings pages">
      <ul class="settings-nav-list">
        {matches.map((section) => (
          <li key={section.id}>
            <button type="button" class={`settings-nav-item${section.id === current ? ' selected' : ''}`} aria-current={section.id === current ? 'page' : undefined}
              onClick={() => navigate({ view: 'settings', section: section.id }, { replace: route.value.view === 'settings' })}>
              <Icon name={section.icon} size={18} />
              <span title={section.title}>{section.title}</span>
            </button>
          </li>
        ))}
        {!matches.length && <li class="settings-nav-empty">No matching settings</li>}
      </ul>
    </nav>
  );
}
