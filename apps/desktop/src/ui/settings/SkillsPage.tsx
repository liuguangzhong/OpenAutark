// Settings skills and memory. Skill rows open the exact-copy editor where its named API is available;
// legacy file tabs, memory folders and desktop-only deletion stay on their existing capabilities. What it reads comes
// again after every reconnect (useAsync, lib/use-load.ts).
// Owns: rows and editor selection. Never: resolves a skill by name for editing.

import { useEffect, useState } from 'preact/hooks';
import type { SkillInfo } from '../../shared/model/knowledge.ts';
import { SKILL_EDITOR_WRITE_UNAVAILABLE } from '../../shared/api/methods-skills.ts';
import { useContextMenu } from '../lib/context-menu.tsx';
import { rpc } from '../lib/rpc.ts';
import { can } from '../lib/session.ts';
import { agentName, agents } from '../lib/store.ts';
import { skillTitle } from '../team/agent-core-model.ts';
import { openFileTab, openWithSystem, pathMenu } from '../workspace/file-tabs.ts';
import { confirm } from './prompts.ts';
import { useLoad } from '../lib/use-load.ts';
import { act, Group, Note, Row, useAsync } from './controls.tsx';
import { MemoryTree } from './MemoryTree.tsx';
import { joined, openInTab } from './open-file.ts';
import { skillRoute, skillRows } from './skill-route.ts';
import { ModesGroup, NewSkill } from './skills-extra.tsx';
import { SkillEditor } from './SkillEditor.tsx';

const isManager = (agentId: string): boolean => agents.value.some((agent) => agent.managerId === agentId);

/** One skill; where the session may read files a click opens its SKILL.md in the file tab. */
function SkillRow(props: { skill: SkillInfo; open: boolean; onEdit?: () => void; onDelete?: () => void }) {
  const { skill, open } = props;
  const file = joined(skill.path, 'SKILL.md');
  const hint = `${skillRoute(skill, agentName, isManager)} · ${skill.description}`;
  const menu = () => [...pathMenu(file), { items: [{ label: 'Open folder', onSelect: () => openWithSystem(skill.path) }] }, ...(props.onDelete ? [{ items: [{ label: 'Delete', danger: true, onSelect: props.onDelete }] }] : [])];
  const context = useContextMenu(menu);
  if (!open && !props.onEdit) return <Row label={skillTitle(skill.name)} hint={hint} reserve={2} />;
  return (
    <button type="button" class="set-row reserve file-open-row" title={file} {...(open ? context : {})} onClick={() => props.onEdit ? props.onEdit() : openFileTab(file)}>
      <div class="set-row-text">
        <div class="set-row-label">{skillTitle(skill.name)}</div>
        <div class="set-row-hint reserved two">{hint}</div>
      </div>
    </button>
  );
}

export function SkillsPage() {
  const open = can('files.readPath');
  // Preserve the established desktop file-tab workflow.
  const editor = !open && can('skills.catalog') && can('skills.open');
  const [selected, setSelected] = useState<SkillInfo>();
  const list = useAsync(() => editor ? rpc.call('skills.catalog') : rpc.call('skills.list', { every: open }), [open, editor]);
  const [memory, setMemory] = useState('');
  useLoad(() => { if (open) void rpc.call('system.root').then((root) => setMemory(joined(root.path, 'memory'))).catch(() => undefined); }, [open]);
  useEffect(() => rpc.on('skills.changed', () => void list.reload()), [list.reload]);
  const skills = skillRows(list.data ?? []);
  const remove = async (skill: SkillInfo) => {
    if (await confirm({ title: `Delete ${skillTitle(skill.name)}?`, body: 'Its folder is deleted.', confirmLabel: 'Delete', danger: true })) await act(() => rpc.call('skills.delete', { name: skill.name }), 'Could not delete');
    void list.reload();
  };
  // skills.delete goes by name: offered only where the name means this one copy; ~/.claude and ~/.codex skills are read-only here (skills/service.ts)
  const deletable = (skill: SkillInfo) => open && skill.source !== 'builtin' && !/[\\/]\.(?:claude|codex)[\\/]skills[\\/]/.test(skill.path) && can('skills.delete') && skills.filter((entry) => entry.name === skill.name).length === 1;
  return (
    <>
      {open && (
        <Group title="Memory" id="settings-memory" hint="What the company, its branches and each agent know, one Markdown file per entry"
          actions={<button type="button" class="button ghost small" onClick={() => void openInTab('memory')}>Open folder</button>}>
          {memory && <MemoryTree root={memory} />}
        </Group>
      )}
      <Group title="Skills" id="settings-skills" hint={skills.length ? `${skills.length} skills` : undefined}
        actions={<>{can('skills.save') && <NewSkill onCreated={() => { void list.reload(); }} />}{open && <button type="button" class="button ghost small" onClick={() => void openInTab('skills', 'workspace')}>Open folder</button>}</>}>
        {editor && <><Row label="Read-only" /><p class="dialog-text">{SKILL_EDITOR_WRITE_UNAVAILABLE}</p></>}
        {list.error && <Row label="Unavailable" hint={list.error} reserve />}
        {list.loading && !list.data && !list.error && <Row label={<Note>Loading…</Note>} reserve />}
        {skills.map((skill) => <SkillRow key={skill.path} skill={skill} open={open} onEdit={editor && skill.id ? () => setSelected(skill) : undefined} {...(deletable(skill) ? { onDelete: () => void remove(skill) } : {})} />)}
      </Group>
      {can('modes.list') && <ModesGroup />}
      {selected && <SkillEditor key={selected.id} skill={selected} onClose={() => setSelected(undefined)} onSaved={() => void list.reload()} />}
    </>
  );
}
