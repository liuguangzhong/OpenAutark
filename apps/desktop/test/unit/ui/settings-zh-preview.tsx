// Settings preview using the same label/hint pairs as the desktop pages.
// GeneralPage.tsx (desktop window: theme and Start with Windows are shown), models-uses.ts, security-model.ts,
// and the Google app dialog in calendar-sources.tsx. No account, secret, or network.
// Owns: that faithful tree. Never: a second copy of the product rules, or a model call.

import { useState } from 'preact/hooks';
import { render } from 'preact';
import { USE_ABOUT, USE_LABELS } from '../../../src/shared/model/models-uses.ts';
import { Dialog, DialogActions } from '../../../src/ui/lib/dialog.tsx';
import { Button } from '../../../src/ui/lib/ui.tsx';
import { Group, Row, Segmented, TextField, Toggle } from '../../../src/ui/settings/controls.tsx';
import { settingsLang, settingsLocaleClass, ZhScope } from '../../../src/ui/settings/i18n.ts';
import { MODE_ROWS, MODE_TEXT, SWITCH_HINT } from '../../../src/ui/settings/security-model.ts';

const NAV = [
  ['general', 'General'],
  ['models', 'Models'],
  ['security', 'Security'],
  ['calendar', 'Calendar'],
] as const;

type PageId = (typeof NAV)[number][0];

function GeneralRows() {
  return (
    <div data-section="general">
      <Group title="Profile">
        <Row label="Your name"><TextField label="Your name" value="Ada" onCommit={() => undefined} /></Row>
        <Row label="Company" hint="Used by your agents"><TextField label="Company" value="Northwind" onCommit={() => undefined} /></Row>
      </Group>
      <Group title="Appearance">
        <Row label="Theme" hint="More of the look is theme.css in the data folder – ask your AI" reserve>
          <Segmented label="Theme" value="system" options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={() => undefined} />
        </Row>
        <Row label="Labels size" hint="Headings, chat names, setting names and other short texts · 10–17 px, 13 by default">
          <span class="set-px-unit">13 px</span>
        </Row>
      </Group>
      <Group title="Notifications">
        <Row label="Sound" hint="To-dos for you, blockers and important messages always arrive">
          <Toggle label="Sound" checked onChange={() => undefined} />
        </Row>
        <Row label="While an agent uses this PC" hint="A line at the bottom says who and what, with Watch to open the screen">
          <Toggle label="Show a line while an agent uses this PC" checked onChange={() => undefined} />
        </Row>
      </Group>
      <Group title="Behavior">
        <Row label="Start with Windows" hint="Opens the app when the PC starts and keeps agents working in the background">
          <Toggle label="Start with Windows" checked={false} onChange={() => undefined} />
        </Row>
        <Row label="Keep the screen on while agents work" hint="Also keeps this PC awake for agent work at night">
          <Toggle label="Keep the screen on while agents work" checked onChange={() => undefined} />
        </Row>
        <Row label="Enter sends" hint="Shift+Enter for a new line">
          <Toggle label="Enter sends" checked onChange={() => undefined} />
        </Row>
      </Group>
    </div>
  );
}

function ModelRows() {
  return (
    <div data-section="models">
      <Group title="Providers">
        <Row label="Model name" hint="A model name the server does not list">
          <TextField label="Model name" value="gpt-4o" onCommit={() => undefined} />
        </Row>
      </Group>
      <Group title="Uses" id="settings-uses">
        <Row label={USE_LABELS.work} hint={USE_ABOUT.work}>
          <span class="set-note">gpt-4o</span>
        </Row>
        <Row label={USE_LABELS.decision} hint={USE_ABOUT.decision} />
        <Row label={USE_LABELS.stt} hint={USE_ABOUT.stt} />
      </Group>
      <Group title="Voice">
        <Row label="Reading voice" hint="Reads replies aloud in conversations" />
      </Group>
    </div>
  );
}

function SecurityRows() {
  return (
    <div data-section="security">
      <Group title="Security" hint="Each of your PCs keeps its own security mode and switches; these count for everything agents do on this PC">
        {MODE_ROWS.map((mode) => (
          <Row key={mode.id} label={mode.title} hint={MODE_TEXT[mode.id]}>
            <span class="set-note">{mode.text}</span>
          </Row>
        ))}
        <Row label="Spending money" hint={SWITCH_HINT.money}>
          <span class="set-note">Closed in Secure mode</span>
        </Row>
      </Group>
    </div>
  );
}

function CalendarRows(props: { onGoogle: () => void }) {
  return (
    <div data-section="calendar">
      <Group title="Calendars">
        <Row label="Use your own Google app" hint="Client ID and secret of a Google Cloud desktop app">
          <button type="button" class="button secondary small" onClick={props.onGoogle}>Set up</button>
        </Row>
      </Group>
    </div>
  );
}

function GoogleDialog(props: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={props.open} onClose={props.onClose} title="Use your own Google app" width={520}>
      <p class="dialog-text">Google Cloud › Credentials › OAuth client ID of type “Desktop app”. While that app is in “Testing”, the sign-in ends after 7 days.</p>
      <label class="field-label">Client ID</label>
      <input class="input" type="text" aria-label="Client ID" value="" placeholder="….apps.googleusercontent.com" readOnly />
      <DialogActions message="Enter the client secret to save" tone="muted">
        <Button variant="secondary" class="small" onClick={props.onClose}>Cancel</Button>
        <Button variant="primary" class="small" onClick={props.onClose}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function PreviewBody() {
  const [page, setPage] = useState<PageId>('general');
  const [google, setGoogle] = useState(false);
  const localeClass = settingsLocaleClass();
  return (
    <div class="settings-zh-frame">
      <nav class={`settings-nav${localeClass}`} lang={settingsLang()} aria-label="Settings pages">
        <ul class="settings-nav-list">
          {NAV.map(([id, title]) => (
            <li key={id}>
              <button type="button" class={`settings-nav-item${page === id ? ' selected' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => setPage(id)}>
                <span title={title}>{title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div class={`settings-view${localeClass}`} lang={settingsLang()}>
        <header class="settings-top"><h2>{NAV.find(([id]) => id === page)?.[1]}</h2></header>
        <div class="settings-body">
          <div class="settings-content">
            {page === 'general' && <GeneralRows />}
            {page === 'models' && <ModelRows />}
            {page === 'security' && <SecurityRows />}
            {page === 'calendar' && <CalendarRows onGoogle={() => setGoogle(true)} />}
          </div>
        </div>
      </div>
      <GoogleDialog open={google} onClose={() => setGoogle(false)} />
    </div>
  );
}

function Preview() {
  return (
    <ZhScope>
      <PreviewBody />
    </ZhScope>
  );
}

const app = document.getElementById('app');
if (app) render(<Preview />, app);
