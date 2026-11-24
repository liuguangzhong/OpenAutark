// Settings › Apps: the connected apps, read from <data>/connectors/mcp.json and mail.json (apps.list), each with its address and
// status in one reserved line, one action in a fixed cell and its on/off switch; the menu offers tools, a token, the file
// view (mcp.json / mail.json in the pane) and Remove. Structured apps.* calls mutate named entries. apps.changed and every
// reconnect (useAsync) reload the list.
// Sign-in and stdio commands run on the PC: on the desktop the sign-in page opens in the system browser; 16.11.2026 on the
// owner's phone (it manages the PC's files, files.writePath) it opens in the PC's pane, which the phone's sheet shows
// (side.open), and a mailbox is removed from there too; a device without that keeps the line "Sign in in the PC browser".
// Owns: these rows and the tools dialog. Never: holds a token, header value or vault id.

import { useEffect, useState } from 'preact/hooks';
import type { ConnectedApp } from '../../shared/model/apps.ts';
import { Dialog, DialogActions } from '../lib/dialog.tsx';
import { confirm } from './prompts.ts';
import type { MenuItem } from '../lib/popover.tsx';
import { openExternal } from '../lib/platform.ts';
import { rpc } from '../lib/rpc.ts';
import { can, isOwner } from '../lib/session.ts';
import { pushToast } from '../lib/toasts.ts';
import { Button } from '../lib/ui.tsx';
import { setUpWithAi } from '../team/set-up-with-ai.ts';
import { openInPcPane, opensInPcPane } from '../workspace/phone-tabs.ts';
import { act, ActionButton, Group, Note, Row, Toggle, useAsync, useBusy } from './controls.tsx';
import { AddApps, TokenDialog } from './apps-add.tsx';
import { appAction, appLine, toolCount } from './apps-files.ts';
import { openInTab } from './open-file.ts';

function AppRow(props: { app: ConnectedApp; onChanged: () => void; onTools: () => void; onToken: () => void }) {
  const { app } = props;
  const [busy, run] = useBusy();
  const canToggle = can('apps.setEnabled');
  const canRemove = can('apps.remove') && (app.transport !== 'mail' || can('files.writePath'));
  const canToken = can('apps.setToken') && app.transport === 'http' && can('secrets.save');
  const inPane = !isOwner() && opensInPcPane(); // the phone: the sign-in page opens in the PC's pane, shown in its sheet
  const hostSignInNeeded = !isOwner() && !inPane && app.status === 'waiting';
  const action = hostSignInNeeded ? undefined : appAction(app);
  const press = () => {
    if (action?.kind === 'page') { if (isOwner()) openExternal(app.signInUrl!); else if (inPane) void openInPcPane(app.signInUrl!); return; }
    void run(async () => {
      const tested = await rpc.call('apps.reconnect', { id: app.id, name: app.name, transport: app.transport });
      if (action?.kind === 'test' && tested.status === 'ok') pushToast({ title: `${tested.name} works`, body: toolCount(tested.tools) });
      props.onChanged();
    });
  };
  const setOn = (enabled: boolean) => void act(() => rpc.call('apps.setEnabled', { id: app.id, name: app.name, transport: app.transport, enabled }), 'Could not save');
  const remove = async () => {
    const ok = await confirm({ title: `Remove ${app.name}?`, body: 'Its tools leave every agent and its sign-in ends. A key it uses stays in Settings › Secrets.', confirmLabel: 'Remove', danger: true });
    if (ok) await act(() => rpc.call('apps.remove', { id: app.id, name: app.name, transport: app.transport }), 'Could not remove it');
  };
  const menu = () => {
    const items: MenuItem[] = [{ label: 'Show tools', onSelect: props.onTools }];
    if (canToken) items.push({ label: 'Add a token', onSelect: props.onToken });
    if (can('files.writePath') && can('system.root')) { const file = app.transport === 'mail' ? 'mail.json' : 'mcp.json'; items.push({ label: `Open ${file}`, onSelect: () => void openInTab(`connectors/${file}`) }); }
    return [{ items }, ...(canRemove ? [{ items: [{ label: 'Remove', danger: true, onSelect: () => void remove() }] }] : [])];
  };
  return (
    <Row class="apps-row" label={app.name} hint={hostSignInNeeded ? `${app.address} · Sign in in the PC browser` : appLine(app)} reserve menu={menu}>
      <span class="account-slot">
        {action && (action.kind === 'page' || can('apps.reconnect')) && <ActionButton label={action.label} busy={busy || action.wait} onClick={press} />}
      </span>
      {canToggle && <Toggle label={`${app.name} on`} checked={app.status !== 'off'} onChange={setOn} />}
    </Row>
  );
}

function ToolsDialog(props: { app: ConnectedApp | undefined; onClose: () => void }) {
  const { app } = props;
  return (
    <Dialog open={app !== undefined} onClose={props.onClose} title={app ? `${app.name}: ${toolCount(app.tools)}` : undefined} width={520} class="anchored">
      {app && (
        <>
          <ul class="apps-tools" aria-label="Tools">
            {app.toolNames.map((tool) => <li key={tool} title={tool}>{tool}</li>)}
            {app.tools > app.toolNames.length && <li class="apps-tools-more">and {app.tools - app.toolNames.length} more</li>}
            {!app.toolNames.length && <li class="apps-tools-more">The app lists its tools once it is connected</li>}
          </ul>
          <DialogActions><Button variant="primary" onClick={props.onClose}>Done</Button></DialogActions>
        </>
      )}
    </Dialog>
  );
}

export function AppsPage() {
  const list = useAsync(() => rpc.call('apps.list'), []);
  const [toolsOf, setToolsOf] = useState<string | undefined>();
  const [tokenFor, setTokenFor] = useState<ConnectedApp | null>(null);
  useEffect(() => rpc.on('apps.changed', () => void list.reload()), [list.reload]); // a reconnect reloads it too (useAsync)
  const apps = list.data ?? [];
  return (
    <>
      <Group title="Connected" id="settings-apps"
        actions={<button type="button" class="button ghost small" onClick={() => void setUpWithAi('Connect an app: ')}>Set up with AI</button>}>
        {list.error && <Row label="Unavailable" hint={list.error} reserve />}
        {list.loading && !list.data && !list.error && <Row label={<Note>Loading…</Note>} reserve />}
        {list.data && !apps.length && <Row label="No apps connected yet" reserve />}
        {apps.map((app) => <AppRow key={app.id} app={app} onChanged={() => void list.reload()} onTools={() => setToolsOf(app.id)} onToken={() => setTokenFor(app)} />)}
      </Group>
      <ToolsDialog app={apps.find((app) => app.id === toolsOf)} onClose={() => setToolsOf(undefined)} />
      <TokenDialog target={tokenFor ? { kind: 'app', app: tokenFor } : null} onClose={() => setTokenFor(null)} />
      {can('apps.add') && list.data && <AddApps apps={apps} />}
    </>
  );
}
