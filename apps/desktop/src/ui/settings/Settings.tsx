// Settings main view for #/settings/<page>: the header (lib/header.tsx: the page's name, Back to the workspace as the lead and,
// right after the title (a near cell, clear of the pane's tab strip in the row), one cell that opens the file behind the page in
// the pane's file tab, on a right click with the system's own app) and the page content. The sidebar shows SettingsNav; its search text
// marks the words in matching rows here (search-marks.ts, F20: blue, colour only). On the phone the frame's own top row names the
// page, holds the same search and Back goes to all settings (shell/views.ts). A page this connection may not use opens the first it may (sections.ts).
// Owns: page → component mapping and when the search marks are applied. Never: setting values – every row is a view on settings.json,
// a file of the data folder, or an RPC; the AI edits the same.

import type { ComponentType } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Boundary } from '../blocks/Boundary.tsx';
import { Header } from '../lib/header.tsx';
import { closeSettings, route, type SettingsPage } from '../lib/router.ts';
import { isPersonSession } from '../lib/people.ts';
import { can } from '../lib/session.ts';
import { accounts, isMobile } from '../lib/store.ts';
import { AboutPage } from './AboutPage.tsx';
import { AccountRow } from './AccountRow.tsx';
import { AppsPage } from './AppsPage.tsx';
import { DayGroup } from './calendar-day.tsx';
import { CalendarsGroup } from './calendar-sources.tsx';
import { Group } from './controls.tsx';
import { DevicesGroup } from './DevicesGroup.tsx';
import { FeedbackPage } from './FeedbackPage.tsx';
import { GeneralPage } from './GeneralPage.tsx';
import { ModelSetup } from './ModelSetup.tsx';
import { ModelUses } from './ModelUses.tsx';
import { openInData, openInTab } from './open-file.ts';
import { groupAccounts, providerGroup, type ProviderGroup } from './providers.ts';
import { ScheduledPage } from './ScheduledPage.tsx';
import { SecretsPage } from './SecretsPage.tsx';
import { SecurityPage } from './SecurityPage.tsx';
import { zh, ZhScope, settingsLang, settingsLocaleClass } from './i18n.ts';
import { clearSearchMarks, markSearch } from './search-marks.ts';
import { resolveVisibleSection } from './sections.ts';
import { settingsSearch } from './SettingsNav.tsx';
import { SkillsPage } from './SkillsPage.tsx';
import { SpeechModelRows } from './speech-models-rows.tsx';
import { LearnedWordsRow, ReadingVoiceRow } from './voice-words.tsx';

const KIND_ORDER: readonly ProviderGroup[] = ['api', 'local'];

/**
 * The providers (the plans on this PC, then the connected API keys and local servers), the uses, the voice (B-078: the
 * former Voice page – the reading voice and the learned words; the call voice is the uses' "Voice conversation" row) and,
 * last, the speech models on this PC (so a removed one moves nothing below it). A session without accounts.detect (a phone,
 * another device) sees only the voice and the speech models, as on the former Voice page.
 */
function ModelsPage() {
  const providers = can('accounts.detect');
  const others = !providers ? [] : groupAccounts(accounts.value.filter((account) => providerGroup(account.provider) !== 'plans'))
    .sort((a, b) => KIND_ORDER.indexOf(providerGroup(a.provider)) - KIND_ORDER.indexOf(providerGroup(b.provider)));
  return (
    <>
      {providers && <Group title="Providers" id="settings-models">
        <ModelSetup>
          {others.flatMap(({ accounts: list }) => list.map((account) => <AccountRow key={account.id} account={account} siblings={list} />))}
        </ModelSetup>
      </Group>}
      {providers && <ModelUses />}
      <Group title="Voice" id="settings-voice">
        <ReadingVoiceRow />
        <LearnedWordsRow />
      </Group>
      <SpeechModelRows />
    </>
  );
}

function CalendarPage() {
  return (
    <div class="calendar-settings">
      {!isPersonSession() && <DayGroup />}{/* a colleague (B-078 D20) connects their own calendars; the day is the owner's */}
      <CalendarsGroup />
    </div>
  );
}

const CONTENT: Readonly<Record<SettingsPage, ComponentType>> = {
  general: GeneralPage,
  models: ModelsPage,
  calendar: CalendarPage,
  scheduled: ScheduledPage,
  secrets: SecretsPage,
  security: SecurityPage,
  apps: AppsPage,
  skills: SkillsPage,
  devices: DevicesGroup,
  feedback: FeedbackPage,
  about: AboutPage,
};

/** The name of the page #/settings/<section> shows on this connection (the phone's top row). */
export function settingsSectionTitle(section: string | undefined): string {
  return zh(resolveVisibleSection(section, can).title);
}

export function Settings() {
  return (
    <ZhScope>
      <SettingsBody />
    </ZhScope>
  );
}

function SettingsBody() {
  const current = route.value;
  const info = resolveVisibleSection(current.view === 'settings' ? current.section : undefined, can);
  const Content = CONTENT[info.id];
  const body = useRef<HTMLDivElement>(null);
  const search = settingsSearch.value;
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [info.id]);
  useEffect(() => () => clearSearchMarks(), []); // the page went: its marks go
  // Re-apply the marks while searching (content may render late, so observe changes briefly).
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    let scrolled = false;
    const apply = () => {
      const first = markSearch(el, search);
      if (first && !scrolled) { scrolled = true; first.scrollIntoView({ block: 'center' }); }
    };
    apply();
    if (!search.trim()) return;
    let pending = 0;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; apply(); });
    });
    observer.observe(el, { childList: true, subtree: true });
    const stop = setTimeout(() => observer.disconnect(), 3000);
    return () => { observer.disconnect(); clearTimeout(stop); if (pending) cancelAnimationFrame(pending); };
  }, [search, info.id]);
  return (
    <div class={`settings-view${settingsLocaleClass()}`} lang={settingsLang()}>
      {!isMobile.value && <Header zone="main" class="settings-top" title={info.title}
        lead={{ id: 'back', icon: 'arrow-left', label: 'Back to workspace', onClick: closeSettings }}
        near={can('system.root') ? [{ id: 'open-file', icon: info.file.path.includes('.') ? 'file' : 'folder', label: info.file.label, onClick: () => void openInTab(info.file.path, info.file.base), contextMenu: () => [{ items: [{ label: 'Open with system', onSelect: () => void openInData(info.file.path, info.file.base) }] }] }] : []} />}
      <div class="settings-body" ref={body}>
        <div class="settings-content" data-section={info.id}>
          <Boundary key={info.id}><Content /></Boundary>
        </div>
      </div>
    </div>
  );
}
