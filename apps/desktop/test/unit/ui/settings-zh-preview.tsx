// Static Settings surface for the Chinese layout check. No accounts, secrets, or network.
// Owns: a Settings-shaped tree the catalog translates. Never: saved settings or a model call.

import { render } from 'preact';
import { Dialog, DialogActions } from '../../../src/ui/lib/dialog.tsx';
import { Button } from '../../../src/ui/lib/ui.tsx';
import { Group, Row, Segmented, TextField, Toggle } from '../../../src/ui/settings/controls.tsx';
import { setSettingsLocaleForTest, settingsLang, settingsLocaleClass, ZhScope } from '../../../src/ui/settings/i18n.ts';

const NAV = ['General', 'Models', 'Calendar', 'Scheduled', 'Secrets', 'Security', 'Apps', 'Skills & memory', 'Devices', 'Feedback', 'About'];

function PreviewBody() {
  const localeClass = settingsLocaleClass();
  return (
    <div class="settings-zh-frame">
      <nav class={`settings-nav${localeClass}`} lang={settingsLang()} aria-label="Settings pages">
        <ul class="settings-nav-list">
          {NAV.map((title, index) => (
            <li key={title}>
              <button type="button" class={`settings-nav-item${index === 0 ? ' selected' : ''}`} aria-current={index === 0 ? 'page' : undefined}>
                <span title={title}>{title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div class={`settings-view${localeClass}`} lang={settingsLang()}>
        <header class="settings-top"><h2>General</h2></header>
        <div class="settings-body">
          <div class="settings-content" data-section="general">
            <Group title="Profile" hint="Your name, photo and the company name">
              <Row label="Your name"><TextField label="Your name" value="" placeholder="Your name" onCommit={() => undefined} /></Row>
              <Row label="Company" hint="Used by your agents"><TextField label="Company" value="Northwind" onCommit={() => undefined} /></Row>
            </Group>
            <Group title="Appearance">
              <Row label="Theme" hint="More of the look is theme.css in the data folder – ask your AI">
                <Segmented label="Theme" value="system" options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} onChange={() => undefined} />
              </Row>
            </Group>
            <Group title="Models">
              <Row label="Model name" hint="gpt-4o stays the stored id">
                <TextField label="Model name" value="gpt-4o" onCommit={() => undefined} />
              </Row>
              <Row label="Enter sends" hint="Enter an address that starts with https:// (or http:// on your network)">
                <Toggle label="Enter sends" checked={false} onChange={() => undefined} />
              </Row>
            </Group>
            <Group title="Notifications">
              <Row label="Sound" hint="This PC · in the Autark app on Android scan this or type these digits – on an iPhone in the web app from openautark.com, added to the Home Screen from Safari – then accept here when both show the same code">
                <Toggle label="Sound" checked onChange={() => undefined} />
              </Row>
              <Row label="Agreements" reserve={2} hint="These are written agreements, not access controls. The app enforces the switches separately; written agreements cannot override them. Your team changes a text only when you clearly want it.">
                <button type="button" class="button secondary small">Could not save</button>
              </Row>
            </Group>
            <Dialog open title="Use your own Google app" onClose={() => undefined} width={520}>
              <p>Client ID and secret of a Google Cloud desktop app</p>
              <p>settings.json</p>
              <DialogActions message="Enter the client secret to save" tone="error">
                <Button variant="secondary" class="small" onClick={() => undefined}>Cancel</Button>
                <Button variant="primary" class="small" onClick={() => undefined}>Save</Button>
              </DialogActions>
            </Dialog>
          </div>
        </div>
      </div>
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

setSettingsLocaleForTest('zh-CN');
const app = document.getElementById('app');
if (app) render(<Preview />, app);
