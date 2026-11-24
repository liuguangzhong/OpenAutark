// Settings › Devices – the one connect surface, the same on the PC and – B-084 (D6) – on my phone (its secure tunnel
// reaches remote.* / devices.* / phone.pairLink; every row is gated by can(), never by the platform),
// three groups with few rows:
// "This phone" (a phone or a person's browser only): this browser's install (not inside a phone app), notifications
// (pwa.pushConfig / pwa.pushSubscribe – a person has their own variants; inside the Android app one line that the app
// shows them itself), inside the iPhone web app the honest line that iOS lets no app use other apps, and inside a phone
// app "Forget this phone" (native.ts forgetThisPhone – the app asks first).
// "Add a device": a PC or a phone asking here with its code (Accept / Decline) first; Eine-ID 22.11.2026: "Company ID"
// and "My ID" (Copy, each once the company exists – connect-rows.tsx IdRows);
// "Connect a phone" with its QR code in a fixed box, also once the company exists (B-078, D5: the QR carries only the
// PC's Remote ID as the pair link, phone.pairLink; the Android app scans or types it, both screens show the same code) –
// an employee's phone asks the same way and Accept says whose it is (20.11.2026: the person-scoped invite here was a
// second way, F13); the PCs on the PC's network with Connect; "Connect with an ID" – a company's ID, my ID or an address,
// no role to pick: the ID decides (those rows are connect-rows.tsx, shared with the first run's Connect card).
// "Devices": one row per device with a right-click / long-press menu (Rename, Remove); on touch a visible Remove in the
// row's fixed slot; a PC's line ends with the app version it runs (F25, device-version.ts: "0.3.6 – behind <PC> 0.3.8"),
// then – Fest round 22.11.2026 (G) – the round trip to an online PC or a phone in use ("45 ms", "Slow connection · 450 ms",
// connect-text.ts linkHint), in the same reserved hint line.
// Sicher-Runde 19.11.2026 (owner: "Update-Knöpfe als Leiste … nach unten verschwimmend … scrollbar … Update all … ganz oben
// This PC"): "This PC" first with its own Update (behind another PC, or on the desktop an update its updater found), then
// the strip of the others – about five rows high, scrolling, fading out at its foot until its end is in view; every PC row
// keeps one fixed action slot for Update or Wake (E1), a pressed one is busy in its box (E2), what the updater answered is
// the toast (E4); "Update all (n)" in the group head (its box always there) presses every offered Update, this PC last.
// Under it the connection rows (devices-connection.tsx), on the PC and my phone alike.
// W (19.11.2026, owner: "vom Handy bitte eben auch alles, also die PCs updaten … Und natürlich auch erwachen lassen"): on
// a phone or browser the last live list is kept (device-wake.ts) and shown while no PC answers – every own PC then reads
// offline and offers Wake, which goes through the connected PC or the phone's own meeting-server link (wakePc); this
// PC's Update also follows the update state its PC sends the phone (update.state), as the desktop follows its updater.
// Owns: the groups, the phone and device rows, the strip. Never: shows keys or a link's secret as text (the 6-digit codes are meant to be typed).

import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Device, UpdateAnswer } from '../../shared/model/devices.ts';
import type { Person } from '../../shared/model/people.ts';
import type { RelayState } from '../../shared/model/relay.ts';
import type { RemoteState } from '../../shared/model/remote.ts';
import { confirm } from './prompts.ts';
import { listTime } from '../lib/format.ts';
import { isPersonSession } from '../lib/people.ts';
import { isMobile, platform } from '../lib/platform.ts';
import { errorText, rpc } from '../lib/rpc.ts';
import { can, holds } from '../lib/session.ts';
import { pushToast } from '../lib/toasts.ts';
import { updateState } from '../lib/store.ts';
import { disablePush, enablePush, installAvailable, isStandalone, promptInstall, pushStatus } from '../pwa/install.ts';
import { act, ActionButton, Group, Row, Toggle, useAsync, useBusy } from './controls.tsx';
import { forgetThisPhone, inHostedApp, isAndroidApp, isPhoneApp } from '../pwa/native.ts';
import { IOS_PHONE_USE } from '../pwa/hosted.ts';
import { deviceHint, FORGET_HINT, groupDigits, linkHint, phoneDot, PHONE_QR_HINT, pushHint } from './connect-text.ts';
import { ConnectRow, IdRows, IncomingRow, NearbyRows, useConnectState, usePeople } from './connect-rows.tsx';
import { ConnectionGroup } from './devices-connection.tsx';
import { rowAction, splitDevices, UPDATE_ALL_FROM, updateAllText, updateOffered, updateQueue, versionHint, type AnswerText } from './device-version.ts';
import { keepDevices, keptDevices, ownWay, unreachableView, wakePc, wakesFromHere } from './device-wake.ts';

/** The device list: live from the PC (again whenever the connection opens); on a phone or browser the kept one until then. */
function useDevices() {
  const open = rpc.status.value === 'open';
  const list = useAsync(() => (can('devices.list') ? rpc.call('devices.list') : Promise.resolve<Device[]>([])), [open]);
  const [kept, setKept] = useState<Device[] | undefined>(undefined);
  const keeps = platform !== 'desktop';
  useEffect(() => { if (keeps) void keptDevices().then(setKept); }, []);
  useEffect(() => { if (keeps && open && list.data && can('devices.list')) void keepDevices(list.data); }, [list.data]);
  useEffect(() => {
    const offUp = rpc.on('device.upserted', (device) => {
      const current = list.data ?? [];
      list.set(current.some((entry) => entry.id === device.id) ? current.map((entry) => (entry.id === device.id ? device : entry)) : [...current, device]);
    });
    const offRemoved = rpc.on('device.removed', ({ id }) => list.set((list.data ?? []).filter((entry) => entry.id !== id)));
    return () => { offUp(); offRemoved(); };
  }, [list.data]);
  const data = list.data ?? kept;
  // while no PC answers this page, nothing in the list is reachable from here (W)
  return { data: keeps && data && !(open && list.data) ? unreachableView(data) : data, error: data ? null : list.error };
}

// ------------------------------------------------------------------ phones

/**
 * "Connect a phone": the QR of this PC's pair link (phone.pairLink – only the Remote ID; the Remote ID itself first in the
 * hint, so typing works as well). F17: the pair link's ID is this PC's own (not the person code the Remote ID row shows),
 * so the phone's request comes to the PC whose screen shows the QR; the hint's digits are that same ID.
 */
function PhoneQr(props: { remote?: RemoteState }) {
  const remoteId = props.remote?.self.remoteId;
  const link = useAsync(() => (can('phone.pairLink') ? rpc.call('phone.pairLink') : Promise.resolve(null)), [remoteId]);
  const qr = link.data;
  const error = link.error ?? undefined;
  const text = error ?? PHONE_QR_HINT;
  const digits = !error ? qr?.remoteId ?? '' : '';
  const code = digits && <><span class="remote-slot-code" aria-label={`Remote ID ${digits.split('').join(' ')}`}>{groupDigits(digits)}</span> · </>;
  const hint = <span title={digits ? `${digits} · ${text}` : text}>{code}{text}</span>;
  return (
    <Row class="remote-phone-row" label="Connect a phone" hint={hint}>
      <div class={`remote-qr${qr || error || !remoteId ? '' : ' loading'}`} aria-busy={(!qr && !error) || undefined}>
        {qr && <img class="remote-qr-code" src={qr.qrDataUrl} alt="QR code to connect a phone" width={96} height={96} />}
      </div>
    </Row>
  );
}

// ------------------------------------------------------------------ the device list

type UpdateResult = { name: string; answer?: UpdateAnswer; error?: string };
const toast = (text: AnswerText) => pushToast({ title: text.title, ...(text.body ? { body: text.body } : {}), ...(text.tone ? { tone: text.tone } : {}) });

function DeviceRow(props: { device: Device; people: Person[]; devices: Device[]; action?: 'update' | 'wake'; updating: boolean; onUpdate(): void }) {
  const { device } = props;
  const [renaming, setRenaming] = useState(false);
  const [waking, setWaking] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) field.current?.select(); }, [renaming]);
  const finish = (name: string) => {
    setRenaming(false);
    if (name.trim() && name.trim() !== device.name) void act(() => rpc.call('devices.rename', { id: device.id, name: name.trim() }), 'Could not rename');
  };
  const remove = async () => {
    const body = device.kind === 'pc' ? 'The two PCs stop connecting; connecting again needs a new request.' : 'It signs out on all your PCs; connecting again needs a new request from it.';
    if (await confirm({ title: `Remove ${device.name}?`, body, confirmLabel: 'Remove', danger: true })) await act(() => rpc.call('devices.revoke', { id: device.id }), 'Could not remove');
  };
  const dot = device.kind === 'pc' ? device.status : phoneDot(device);
  const personName = (id: string) => props.people.find((person) => person.id === id)?.name;
  const removable = !device.self && can('devices.revoke');
  // the one fixed slot of a PC row (E1): Update (feedback 1b136d01, pressed remotely) or Wake – its box stays when neither is offered
  const action = props.action === 'update' && can('system.update') ? 'update' : props.action === 'wake' && can('devices.wake') ? 'wake' : undefined;
  const wake = async () => {
    setWaking(true);
    await act(async () => {
      await wakePc(device);
      pushToast({ title: `Waking ${device.name}`, body: 'Its app starts there in a moment and connects by itself.' });
    }, `Could not wake ${device.name}`);
    setWaking(false);
  };
  const label = renaming
    ? <input ref={field} class="set-input" aria-label="Device name" maxLength={60} defaultValue={device.name}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.currentTarget.value = device.name; event.currentTarget.blur(); } }} />
    : <><span class={`dot ${dot}`} aria-hidden="true" /> {device.name}</>;
  // B-084: on touch Remove is a visible button – always there on a removable row, so nothing shifts; Rename stays in the long-press menu
  return (
    <Row class="device-row" label={label} hint={[deviceHint(device, personName, listTime), versionHint(device, props.devices), linkHint(device)].filter(Boolean).join(' · ')} reserve
      menu={() => [{ items: [
        ...(can('devices.rename') ? [{ label: 'Rename', onSelect: () => setRenaming(true) }] : []),
        ...(removable ? [{ label: 'Remove', danger: true, onSelect: () => void remove() }] : []),
      ] }]}>
      {device.kind === 'pc' && (
        <span class="device-slot">
          {action === 'update' && <ActionButton label="Update" busy={props.updating} onClick={props.onUpdate} />}
          {action === 'wake' && <ActionButton label="Wake" busy={waking} onClick={() => void wake()} />}
        </span>
      )}
      {isMobile.value && removable ? <button type="button" class="button ghost small danger" onClick={() => void remove()}>Remove</button> : undefined}
    </Row>
  );
}

// ------------------------------------------------------------------ on a phone

/** This browser's install and notifications ("On" = the PC holds its subscription), Forget inside a phone app. */
function BrowserRows() {
  const [busy, run] = useBusy();
  const androidApp = isAndroidApp(); // the app shows notifications itself: no web push switch there
  const status = useAsync(() => (androidApp ? Promise.resolve(undefined) : pushStatus()), []);
  const change = (on: boolean) => void run(async () => {
    const result = await (on ? enablePush() : disablePush());
    pushToast({ title: result.message, tone: result.ok ? 'info' : 'error' });
    status.set(await pushStatus().catch(() => 'off' as const));
  });
  const current = status.data;
  const iosTab = (inHostedApp() || /iPhone|iPad|iPod/.test(navigator.userAgent)) && !isStandalone();
  const hint = pushHint(current, { person: isPersonSession(), chat: holds('chat'), iosTab, androidApp });
  return (
    <Group title={isMobile.value || isPhoneApp() ? 'This phone' : 'This browser'} id="settings-this-phone">
      {!isStandalone() && !isPhoneApp() && (
        <Row label="Install app" hint={installAvailable.value ? undefined : 'Use “Add to Home Screen” in the browser menu'}>
          {installAvailable.value && <button type="button" class="button ghost small" onClick={() => void promptInstall()}>Install</button>}
        </Row>
      )}
      <Row label="Notifications" hint={status.error ?? hint}>
        {current === 'on' && <Toggle label="Notifications" checked disabled={busy} onChange={() => change(false)} />}
        {(current === 'off' || current === 'blocked') && <button type="button" class="button ghost small" disabled={busy} onClick={() => change(true)}>Turn on</button>}
      </Row>
      {inHostedApp() && <Row label="Phone use" hint={IOS_PHONE_USE} />}
      {isPhoneApp() && (
        <Row label="Forget this phone" hint={FORGET_HINT}>
          <button type="button" class="button ghost small danger" onClick={forgetThisPhone}>Forget</button>
        </Row>
      )}
    </Group>
  );
}

/** "Add a device": requests waiting here first, then the Company ID and My ID, the phone QR, PCs nearby and Connect with an ID. */
function AddRows(props: { people: Person[]; remote?: RemoteState; relay?: RelayState }) {
  const [error, setError] = useState<string | null>(null);
  const incoming = props.remote?.incoming ?? [];
  if (!incoming.length && !can('remote.state') && !can('remote.nearby') && !can('remote.connect')) return null;
  return (
    <Group title="Add a device" id="settings-add-device">
      {incoming.map((request) => <IncomingRow key={request.id} request={request} people={props.people} member={props.remote?.self.member === true} />)}
      {can('remote.state') && <IdRows remote={props.remote} relay={props.relay} />}
      {can('remote.state') && props.remote?.self.companyId && <PhoneQr remote={props.remote} />}
      {can('remote.nearby') && <NearbyRows onError={setError} />}
      {can('remote.connect') && <ConnectRow remote={props.remote} error={error} onError={setError} />}
    </Group>
  );
}

// ------------------------------------------------------------------ the group

/** The other devices: about five rows high, scrolling, fading out at its foot until its end is in view (a class: paint only). */
/** A row's action, without Wake when nothing could carry it from here. */
const wakeable = (action: 'update' | 'wake' | undefined, wakes: boolean) => (action === 'wake' && !wakes ? undefined : action);

function DeviceStrip(props: { count: number; children: ComponentChildren }) {
  const box = useRef<HTMLDivElement>(null);
  const mark = () => { const el = box.current; if (el) el.classList.toggle('at-end', el.scrollTop + el.clientHeight >= el.scrollHeight - 2); };
  useEffect(mark, [props.count]);
  return <div ref={box} class="device-strip" tabIndex={0} aria-label="Other devices" onScroll={mark}>{props.children}</div>;
}

export function DevicesGroup() {
  const devices = useDevices();
  const people = usePeople();
  const { remote, relay } = useConnectState();
  const { self, others } = splitDevices(devices.data ?? []);
  const list = self ? [self, ...others] : others;
  const [updating, setUpdating] = useState<ReadonlySet<string>>(new Set());
  // this PC: behind another listed PC, or an update its updater found (the desktop's own; on a phone what its PC sent, W)
  const found = updateState.value?.status === 'available' || updateState.value?.status === 'downloaded';
  const wakes = wakesFromHere(rpc.status.value === 'open', ownWay()); // a Wake pressed here has a way to go (W)
  const queue = can('system.update') ? updateQueue(list, (device) => (device.self && found) || updateOffered(device, list)) : [];
  const ask = async (device: Device): Promise<UpdateResult> => {
    setUpdating((now) => new Set([...now, device.id]));
    try {
      return { name: device.name, answer: await rpc.call('system.update', device.self ? {} : { device: device.id }) };
    } catch (error) {
      return { name: device.name, error: errorText(error) };
    } finally {
      setUpdating((now) => new Set([...now].filter((id) => id !== device.id)));
    }
  };
  const updateOne = async (device: Device) => toast(updateAllText([await ask(device)]));
  // "Update all": the others at once, then this PC (its update closes this window, or the phone's way in)
  const updateAll = async () => {
    const results = await Promise.all(queue.filter((device) => !device.self).map(ask));
    for (const device of queue.filter((entry) => entry.self)) results.push(await ask(device));
    toast(updateAllText(results));
  };
  const row = (device: Device) => (
    <DeviceRow key={device.id} device={device} people={people} devices={list} action={wakeable(rowAction(device, list, device.self && found), wakes)}
      updating={updating.has(device.id)} onUpdate={() => void updateOne(device)} />
  );
  const all = can('system.update') ? (
    <span class="device-all">
      {queue.length >= UPDATE_ALL_FROM && (
        <ActionButton variant="ghost" label={`Update all (${queue.length})`} busy={queue.some((device) => updating.has(device.id))} onClick={() => void updateAll()} />
      )}
    </span>
  ) : undefined;
  return (
    <>
      {platform !== 'desktop' && <BrowserRows />}
      <AddRows people={people} remote={remote.data} relay={relay.data} />
      {can('devices.list') && (
        <Group title="Devices" id="settings-devices" hint={devices.error ?? undefined} actions={all}>
          {self && row(self)}
          {others.length > 0 && <DeviceStrip count={others.length}>{others.map(row)}</DeviceStrip>}
        </Group>
      )}
      {/* my phone too: a secure 'settings' device writes the 'devices' section (handlers/system.ts) – remote.relay needs that transport */}
      {can('settings.update') && can('remote.relay') && <ConnectionGroup relay={relay.data} findable={remote.data?.self.findable} />}
    </>
  );
}
