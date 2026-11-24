// Settings › Scheduled (owner 21.11.2026: "ein Bereich in den Einstellungen, wo man alle automatischen Chatnachrichten
// verwalten kann – die immer wiederkommen oder einmal kommen – ändern, Texte umschreiben, alles bearbeiten, löschen und neue
// hinzufügen. Da wählt man den Chat aus."). Two parts (Nachricht 3, same day): on top the person's own scheduled messages,
// one group per chat (tasks/schedule-edit.ts); below, quiet, what the agents set up for themselves – they keep those
// themselves, the person can step in: find an agent, Show → that agent's messages and reminders in a group under the
// part (nothing above moves). A row: the text, then (an agent's) the chat or "Reminder", the rule in words when it repeats,
// the next run or its state (tasks/schedule-state.ts) and the level; on the right a switch (on = it runs, off = paused),
// Edit and Delete in fixed cells – the same three in the row's right-click menu. Edit and "New message" open
// ScheduleDialog.tsx. The list is the shared schedules signal (tasks/schedules.ts), kept fresh by schedule.upserted /
// schedule.removed, so a change from a chat or an agent shows here.
// Owns: this page. Never: builds specs or holds its own copy of the schedules.

import { useEffect, useState } from 'preact/hooks';
import type { Schedule } from '../../shared/model/tasks.ts';
import { HUMAN_ID } from '../../shared/ids.ts';
import { STATE_TEXT, whenText } from '../chat/details/Schedules.tsx';
import { localZone } from '../chat/composer/schedule-mode.ts';
import { repeats, ruleLine } from '../chat/composer/schedule-rule.ts';
import { chatTitle } from '../lib/chat-naming.ts';
import { plainPreview } from '../lib/format.ts';
import type { MenuSection } from '../lib/popover.tsx';
import { rpc } from '../lib/rpc.ts';
import { can } from '../lib/session.ts';
import { agentName, conversations } from '../lib/store.ts';
import { confirm } from './prompts.ts';
import { agentEntries, groupByChat, levelOf, scheduleText } from '../tasks/schedule-edit.ts';
import { byNextRun, scheduleState } from '../tasks/schedule-state.ts';
import { ensureSchedules, schedules, schedulesLoaded } from '../tasks/schedules.ts';
import { act, Group, Row, Toggle } from './controls.tsx';
import { ScheduleDialog, type ScheduleTarget } from './ScheduleDialog.tsx';

const LEVEL_TEXT = { normal: '', important: 'Important', silent: 'Silent' } as const;

function chatName(conversationId: string | undefined): string {
  const chat = conversationId ? conversations.value.find((entry) => entry.id === conversationId) : undefined;
  return chat ? chatTitle(chat) : 'Other chat';
}

/** The second line: where (an agent's: its chat, or "Reminder"), the rule, the next run or the state, the level. */
function rowHint(schedule: Schedule, where: boolean): string {
  const state = scheduleState(schedule);
  return [
    where && (schedule.kind === 'reminder' ? 'Reminder' : `In ${chatName(schedule.conversationId)}`),
    repeats(schedule.spec) && ruleLine(schedule.spec, { tz: schedule.spec.tz || localZone() }),
    state === 'next' ? `Next ${whenText(schedule.nextAt!)}` : STATE_TEXT[state],
    schedule.kind === 'message' && LEVEL_TEXT[levelOf(schedule)],
  ].filter(Boolean).join(' · ');
}

function ScheduleRow(props: { schedule: Schedule; where?: boolean; onEdit: () => void }) {
  const { schedule } = props;
  const setActive = (active: boolean) => void act(() => rpc.call('schedules.update', { id: schedule.id, active }), active ? 'Could not resume' : 'Could not pause');
  const remove = async () => {
    if (!await confirm({ title: 'Delete schedule?', body: plainPreview(scheduleText(schedule), 120), confirmLabel: 'Delete', danger: true })) return;
    await act(() => rpc.call('schedules.delete', { id: schedule.id }), 'Could not delete');
  };
  const menu = (): MenuSection[] => [{ items: [
    ...(can('schedules.update') ? [{ label: schedule.active ? 'Pause' : 'Resume', onSelect: () => setActive(!schedule.active) }, { label: 'Edit', onSelect: props.onEdit }] : []),
    ...(can('schedules.delete') ? [{ label: 'Delete', danger: true, onSelect: () => void remove() }] : []),
  ] }];
  return (
    <Row label={plainPreview(scheduleText(schedule), 120)} hint={rowHint(schedule, !!props.where)} reserve menu={menu} class={schedule.active ? undefined : 'scheduled-off'}>
      <Toggle checked={schedule.active} label={schedule.active ? 'Pause' : 'Resume'} disabled={!can('schedules.update')} onChange={setActive} />
      {can('schedules.update') && <button type="button" class="button ghost small" aria-haspopup="dialog" onClick={props.onEdit}>Edit</button>}
      {can('schedules.delete') && <button type="button" class="button ghost small" onClick={() => void remove()}>Delete</button>}
    </Row>
  );
}

/** The agents' own part: find one, Show its schedules in a group below. */
function AgentPart(props: { list: Schedule[]; onEdit: (schedule: Schedule) => void }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const entries = agentEntries(props.list, agentName, query);
  const own = picked ? props.list.filter((schedule) => schedule.ownerId === picked).sort(byNextRun) : [];
  return (
    <>
      <Group title="Set up by agents" id="settings-scheduled-agents" hint="The agents keep their own messages and reminders; change one here when you want to">
        <Row label="Find an agent">
          <input class="set-input" type="search" aria-label="Find an agent" placeholder="Name" value={query}
            onInput={(event) => setQuery((event.currentTarget as HTMLInputElement).value)} />
        </Row>
        {!entries.length && <Row label={query.trim() ? 'No agent by that name' : 'No agent has set anything up'} reserve />}
        {entries.map((entry) => (
          <Row key={entry.agentId} label={entry.name} reserve
            hint={`${entry.count} set up${entry.nextAt !== undefined ? ` · next ${whenText(entry.nextAt)}` : ''}`}>
            <button type="button" class="button ghost small" aria-pressed={entry.agentId === picked}
              onClick={() => setPicked(entry.agentId === picked ? null : entry.agentId)}>Show</button>
          </Row>
        ))}
      </Group>
      {picked && (
        <Group title={agentName(picked)} id="settings-scheduled-agent">
          {!own.length && <Row label="Nothing set up" reserve />}
          {own.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} where onEdit={() => props.onEdit(schedule)} />)}
        </Group>
      )}
    </>
  );
}

export function ScheduledPage() {
  useEffect(() => ensureSchedules(), []);
  const [editing, setEditing] = useState<ScheduleTarget | null>(null);
  const groups = groupByChat(schedules.value.filter((schedule) => schedule.ownerId === HUMAN_ID));
  return (
    <>
      <Group title="Yours" id="settings-scheduled" hint="Messages you set to go out later – once or on repeat – by chat"
        actions={can('messages.schedule') && <button type="button" class="button ghost small" aria-haspopup="dialog" onClick={() => setEditing('new')}>New message</button>}>
        {!schedulesLoaded.value && <Row label="Loading…" reserve />}
        {schedulesLoaded.value && !groups.length && <Row label="Nothing scheduled" hint="New message sets one up – or Schedule… in a chat's composer" reserve />}
      </Group>
      {groups.map((group) => (
        <Group key={group.conversationId ?? 'none'} title={chatName(group.conversationId)}>
          {group.schedules.map((schedule) => <ScheduleRow key={schedule.id} schedule={schedule} onEdit={() => setEditing(schedule)} />)}
        </Group>
      ))}
      {schedulesLoaded.value && <AgentPart list={schedules.value} onEdit={setEditing} />}
      <ScheduleDialog target={editing} onClose={() => setEditing(null)} />
    </>
  );
}
