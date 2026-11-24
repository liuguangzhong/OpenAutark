// The rows that connect PCs, shared by Settings › Devices (DevicesGroup.tsx) and the first run's Connect card
// (onboarding/ConnectCard.tsx). Eine-ID 22.11.2026 (owner: "eine Firmen-ID … pro Firma", "pro User noch den Code … nur
// für einen selber", no picking between employee and the rest): "Company ID" first (Copy; new members type it; the hint
// says whether the meeting server lets PCs in other networks find it) and "My ID" (Copy; my other PCs type it) – each only
// once the company exists (set up or connected) –, the PCs on this network (remote.nearby) with Connect (by their
// company's ID), "Connect with an ID" – one field for a company's ID, my ID or an address, no role: the PC asked decides
// from the ID, its one fixed line says what came of it ("Joining Dojo as a new member · code 1234"); while it waits as a
// new member the field is "Your name" (my profile name first, remote.name on change) –, and a PC or my phone asking here
// with its code (Accept – a new member with their name, prefilled with the one they proposed, or on the company's own PC
// one of the people; a phone with whose phone it is: Me or one of the people (F1) – / Decline); plus the live-state
// hooks they read.
// F09: the PCs on this network grouped by PC – a PC with several companies is one label row with a row per company under
// it; the slot stays one fixed row while the network is asked or nobody answers (with Refresh), so the rows below never
// jump. F17: a request waiting on another of my PCs shows here too and names it (Accept is decided there). F13: the person
// picker offers "New person…" (a name in the same fixed cell; Accept makes the person as the device links), and
// IncomingRow takes `newPerson` – the person already named elsewhere (Team › Add person) – instead of the picker, or
// `personId` – the picker set to one in the team (their page's "Invite a device", team/PersonJoin.tsx).
// Owns: these rows and hooks. Never: shows keys, or accepts without the person's click.

import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Person } from '../../shared/model/people.ts';
import type { RelayState } from '../../shared/model/relay.ts';
import type { NearbyPc, NewPerson, RemoteIncoming, RemoteState } from '../../shared/model/remote.ts';
import { people as everyone } from '../lib/people.ts';
import { errorText, rpc } from '../lib/rpc.ts';
import { can } from '../lib/session.ts';
import { settings } from '../lib/store.ts';
import { pushToast, toastError } from '../lib/toasts.ts';
import { zh } from './i18n.ts';
import { Button } from '../lib/ui.tsx';
import { act, Row, TextField, useAsync, useBusy } from './controls.tsx';
import { COMPANY_ID_BASE, MY_ID_HINT, connectLine, groupDigits, incomingText, nearbyGroups, nearbyHint, nearbyTarget, remoteIdHint, typedTarget, waitsAsMember } from './connect-text.ts';

/** A value kept current by an event (`on` returns its unsubscribe) and read again after every reconnect (useAsync). */
export function useLive<T>(readable: boolean, load: () => Promise<T>, on?: (set: (next: T) => void) => () => void) {
  const state = useAsync(() => (readable ? load() : Promise.resolve(undefined)), [readable]);
  useEffect(() => (readable && on ? on((next) => state.set(next)) : undefined), [readable]);
  return state;
}

/** This PC's connect state (remote.state) and the meeting server's (remote.relay), both kept current. */
export function useConnectState() {
  const remote = useLive(can('remote.state'), () => rpc.call('remote.state'), (set) => rpc.on('remote.updated', set));
  const relay = useLive<RelayState>(can('remote.relay'), () => rpc.call('remote.relay'), (set) => rpc.on('relay.updated', set));
  return { remote, relay };
}

/** The people an employee's device can belong to (the owner and removed people left out; live – a new person shows at once). */
export function usePeople(): Person[] {
  return everyone.value.filter((person) => person.id !== 'human' && person.status !== 'revoked');
}

/** F13: the picker's value for "New person…" (person ids are 'per_…'). */
export const NEW_PERSON = 'new';

/** One of the people (`me`: a first option for no person); `newPerson` adds "New person…" (value NEW_PERSON). */
export function PersonSelect(props: { people: Person[]; value: string; onChange: (id: string) => void; label: string; me?: string; newPerson?: boolean }) {
  return (
    <select class="set-input remote-role" aria-label={props.label} value={props.value} onChange={(event) => props.onChange((event.currentTarget as HTMLSelectElement).value)}>
      {props.me !== undefined && <option value="">{props.me}</option>}
      {props.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
      {props.newPerson && <option value={NEW_PERSON}>New person…</option>}
    </select>
  );
}

/** My profile name – the name I propose as a new member (remote.connect / remote.name). */
const profileName = (): string => settings.value?.profile.name?.trim() ?? '';

/**
 * Eine-ID: "Company ID" (the same on every member's PC; new members type it; the hint: through the meeting server, or
 * only on this network) and "My ID" (the same on all my devices) with Copy – each only once it exists (the company set up
 * or connected), nothing in its place before.
 */
export function IdRows(props: { remote?: RemoteState; relay?: RelayState }) {
  const self = props.remote?.self;
  return (
    <>
      {self?.companyId && <IdRow label="Company ID" id={self.companyId} hint={remoteIdHint(props.relay, self.findable, COMPANY_ID_BASE)} />}
      {self?.myId && <IdRow label="My ID" id={self.myId} hint={MY_ID_HINT} />}
    </>
  );
}

function IdRow(props: { label: string; id?: string; hint: string }) {
  const { id } = props;
  const copy = () => {
    if (id) navigator.clipboard.writeText(groupDigits(id)).then(() => pushToast({ title: zh(`${props.label} copied`) }), (cause: unknown) => toastError(cause, zh('Could not copy')));
  };
  return (
    <Row label={props.label} hint={props.hint} reserve>
      <span class="remote-id">{id ? groupDigits(id) : ''}</span>
      <button type="button" class="button ghost small" disabled={!id} onClick={copy}>Copy</button>
    </Row>
  );
}

/**
 * The PCs on this network that accept requests, each with Connect (by its company's ID: a new member there) – F09: one
 * group per PC, a PC with several companies as a label row with one row per company. While asking, or when nobody
 * answers, one fixed row with Refresh holds the place.
 */
export function NearbyRows(props: { onError: (text: string | null) => void }) {
  const nearby = useAsync(() => (can('remote.nearby') ? rpc.call('remote.nearby', {}) : Promise.resolve<NearbyPc[]>([])), []);
  const [busy, run] = useBusy();
  const [asking, setAsking] = useState(false);
  const refresh = () => {
    setAsking(true);
    void rpc.call('remote.nearby', { refresh: true }).then(nearby.set, () => undefined).finally(() => setAsking(false));
  };
  const connect = (pc: NearbyPc) => void run(async () => {
    props.onError(null);
    try { await rpc.call('remote.connect', connectParams(nearbyTarget(pc))); } catch (cause) { props.onError(errorText(cause)); }
  });
  const menu = () => [{ items: [{ label: 'Refresh list', onSelect: refresh }] }];
  const button = (pc: NearbyPc) => (
    <Button variant="ghost" class="small" disabled={busy || pc.state === 'waiting'} onClick={() => connect(pc)}>{pc.state === 'waiting' ? 'Waiting…' : 'Connect'}</Button>
  );
  const groups = nearbyGroups((nearby.data ?? []).filter((pc) => pc.state !== 'linked'));
  const looking = nearby.loading || asking;
  if (!groups.length) {
    return (
      <Row label="PCs on this network" hint={looking ? 'Looking…' : 'None accepts connection requests right now'} reserve>
        <Button variant="ghost" class="small" busy={looking} onClick={refresh}>Refresh</Button>
      </Row>
    );
  }
  return (
    <>
      {groups.map((group) => group.pcs.length === 1
        ? <Row key={group.key} label={group.name} hint={nearbyHint(group.pcs[0], false)} reserve menu={menu}>{button(group.pcs[0])}</Row>
        : (
          <Fragment key={group.key}>
            <Row label={group.name} hint="On this network" reserve menu={menu} />
            {group.pcs.map((pc) => (
              <Row key={`${pc.deviceId}:${pc.fingerprint}`} class="remote-company-row" label={pc.company ?? pc.name} hint={nearbyHint(pc, true)} reserve menu={menu}>{button(pc)}</Row>
            ))}
          </Fragment>
        ))}
    </>
  );
}

/** remote.connect's params: the ID or address, and my profile name as the name I propose (if I have one). */
function connectParams(target: string): { target: string; name?: string } {
  const name = profileName();
  return name ? { target, name } : { target };
}

/**
 * "Connect with an ID": a company's ID, my ID or an address – no role, the PC asked decides from the ID – and the line
 * with this PC's request (what it becomes, its code, Cancel) or the last error. While it waits as a new member the field
 * cell holds "Your name" (the name the other side shows; a change goes there at once, remote.name). Review H1: where the
 * ID typed would make this PC one of another person's devices (status 'confirm'), the line asks first and Connect's
 * place holds "Yes, add" (remote.confirm) beside Cancel – the code shows only after the yes.
 */
export function ConnectRow(props: { remote?: RemoteState; error: string | null; onError: (text: string | null) => void }) {
  const [target, setTarget] = useState('');
  const [busy, run] = useBusy();
  const out = props.remote?.outgoing;
  const line = connectLine(out, props.error);
  const member = waitsAsMember(out);
  const confirming = out?.status === 'confirm';
  const connect = () => void run(async () => {
    props.onError(null);
    try { await rpc.call('remote.connect', connectParams(target.trim())); setTarget(''); } catch (cause) { props.onError(errorText(cause)); }
  });
  const confirm = () => void run(async () => {
    props.onError(null);
    try { await rpc.call('remote.confirm'); } catch (cause) { props.onError(errorText(cause)); }
  });
  const rename = (name: string) => {
    if (name.trim()) void rpc.call('remote.name', { name: name.trim() }).catch((cause) => toastError(cause, zh('Could not change the name')));
  };
  const end = () => void rpc.call('remote.cancel').catch((cause) => toastError(cause, zh('Could not cancel')));
  return (
    <div class="set-row remote-connect-row">
      <div class="set-row-text">
        <div class="set-row-label">{member ? 'Your name' : 'Connect with an ID'}</div>
        <div class="set-row-hint remote-slot" role="status">
          <span class="remote-slot-line">
            <span class={`remote-slot-title${line.tone ? ` ${line.tone}` : ''}`} title={line.text}>{line.text}</span>
            {line.code && <span class="remote-slot-code" aria-label={`Code ${line.code.split('').join(' ')}`}>code {line.code}</span>}
            {line.action && <button type="button" class="text-button" onClick={end}>{line.action === 'cancel' ? 'Cancel' : 'Close'}</button>}
          </span>
        </div>
      </div>
      <div class="set-row-control">
        <div class="set-inline">
          {member
            ? <TextField label="Your name" placeholder="Your name" maxLength={80} value={out?.myName ?? profileName()} onCommit={rename} />
            : (
              <input class="set-input" aria-label="ID or address of the other PC" placeholder="Company ID, your ID or an address" value={target} autoComplete="off"
                onInput={(event) => { setTarget(typedTarget((event.currentTarget as HTMLInputElement).value)); props.onError(null); }}
                onKeyDown={(event) => { if (event.key === 'Enter' && target.trim()) connect(); }} />
            )}
          {confirming
            ? <Button variant="primary" class="small" busy={busy} onClick={confirm}>Yes, add</Button>
            : <Button variant="ghost" class="small" busy={busy} disabled={!target.trim() || out?.status === 'waiting'} onClick={connect}>Connect</Button>}
        </div>
      </div>
    </div>
  );
}

/**
 * A PC or a phone asking here – or (F17, `via`) on another of my PCs, which then decides it: its code to compare, Accept /
 * Decline; `onDecided` after the answer went in. Eine-ID: a new member ('employee') opens with the name field, prefilled
 * with the name they proposed (it follows their changes until someone types here); on the company's own PC Escape turns
 * the cell into the select of the people (an existing person), whose "New person…" brings the field back – on a member's
 * PC (`member`, remote.state self.member: the company makes the person) no person is offered, only the name. A phone
 * (F1) is accepted with whose phone it is – Me (full access) first, or one of the people, whose access it then gets;
 * "New person…" there too. Accept needs a name or a person.
 * `newPerson` (Team › Add person) names the person already: no picker, and a request as one of my devices cannot be
 * accepted there. The hint (two fixed lines) says what the device becomes; the cell is always there for a phone or a new
 * member, so nothing moves when people load or another one is picked.
 */
export function IncomingRow(props: { request: RemoteIncoming; people: Person[]; member?: boolean; newPerson?: NewPerson; personId?: string; onDecided?: (accepted: boolean) => void }) {
  const { request, newPerson: given } = props;
  const employee = request.role === 'employee';
  const phone = request.role === 'phone';
  const choosable = props.member ? [] : props.people; // review L7: on a member's PC the company makes the person
  // '' = Me for a phone, the first person for a new member once Escape left the name field
  const [picked, setPerson] = useState(props.personId ?? (employee ? NEW_PERSON : ''));
  const [typed, setName] = useState<string | null>(null); // null: nothing typed here – the proposed name shows
  const name = typed ?? request.proposedName ?? '';
  const field = useRef<HTMLInputElement>(null);
  const opened = useRef(picked);
  const [busy, run] = useBusy();
  const person = employee ? picked || choosable[0]?.id || NEW_PERSON : picked;
  const typing = !given && (employee || phone) && person === NEW_PERSON;
  useEffect(() => { if (typing && picked === NEW_PERSON && opened.current !== NEW_PERSON) field.current?.focus(); opened.current = picked; }, [typing, picked]);
  const fresh: NewPerson | undefined = given ?? (typing && name.trim() ? { name: name.trim() } : undefined);
  const chosen = person && person !== NEW_PERSON ? choosable.find((entry) => entry.id === person)?.name : undefined;
  const owner = fresh?.name ?? (typing ? undefined : chosen);
  const mine = !employee && !phone; // my own PC: never a person's
  const blocked = mine && Boolean(given);
  const who = mine ? {} : fresh ? { newPerson: fresh } : !typing && person ? { personId: person } : {};
  const ready = !blocked && (mine || (given ? Boolean(given.name.trim()) : typing ? Boolean(fresh) : !employee || Boolean(person)));
  const answer = (accept: boolean) => void run(async () => {
    const done = await act(() => rpc.call('remote.decide', { id: request.id, accept, ...(accept ? who : {}) }), accept ? 'Could not accept' : 'Could not decline');
    if (done) props.onDecided?.(accept);
  });
  const words = incomingText(request, settings.value?.profile.company);
  const becomes = phone
    ? owner ? `Becomes ${owner}'s phone with ${owner}'s access` : typing ? 'Becomes the new person’s phone with their access' : 'Becomes your own phone with full access'
    : employee ? owner ? `Becomes ${owner}'s PC` : 'Needs a name' : blocked ? `Asks to be one of your devices, not ${given!.name}'s` : '';
  const hint = becomes ? `${becomes} · ${words.hint}` : words.hint;
  return (
    <Row label={<><span class="dot pairing" aria-hidden="true" /> {words.label}</>}
      hint={mine && !blocked ? hint : <span class="set-row-hint reserved two" title={hint}>{hint}</span>}>
      <span class="remote-slot-code" aria-label={`Code ${request.code.split('').join(' ')}`}>{request.code}</span>
      {typing && (
        <input ref={field} class="set-input remote-role" aria-label="Name of the new person" placeholder="Name" maxLength={80} value={name} autoComplete="off"
          title={employee && choosable.length ? 'Escape: one of the people instead' : undefined}
          onInput={(event) => setName((event.currentTarget as HTMLInputElement).value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && (phone || choosable.length)) { setPerson(''); setName(null); }
            if (event.key === 'Enter' && ready && !busy) answer(true);
          }} />
      )}
      {!typing && !given && employee && <PersonSelect people={choosable} value={person} onChange={setPerson} label="This PC belongs to" newPerson />}
      {!typing && !given && phone && <PersonSelect people={choosable} value={person} onChange={setPerson} label="This phone belongs to" me="Me" newPerson />}
      <Button variant="primary" class="small" disabled={busy || !ready} onClick={() => answer(true)}>Accept</Button>
      <Button variant="ghost" class="small" disabled={busy} onClick={() => answer(false)}>Decline</Button>
    </Row>
  );
}
