// The owner's concrete-copy skill editor, on phone and desktop alike.
// Owns: local draft, visible conflict and explicit reload/discard. Never: opens a file on the host PC.
import { useEffect, useState } from 'preact/hooks';
import type { SkillInfo } from '../../shared/model/knowledge.ts';
import type { SkillDocument } from '../../shared/api/methods-skills.ts';
import { SKILL_EDITOR_WRITE_UNAVAILABLE } from '../../shared/api/methods-skills.ts';
import { Dialog, DialogActions } from '../lib/dialog.tsx';
import { Button } from '../lib/ui.tsx';
import { confirm } from './prompts.ts';
import { errorText, rpc } from '../lib/rpc.ts';
import { can } from '../lib/session.ts';
import { useBusy } from './controls.tsx';

export function SkillEditor(props: { skill: SkillInfo; onClose: () => void; onSaved: () => void }) {
  const [document, setDocument] = useState<SkillDocument>();
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, run] = useBusy();
  const dirty = document !== undefined && body !== document.body;
  const discard = () => !dirty || confirm({ title: 'Discard unsaved text?', body: 'Copy any text you want to keep before continuing.', confirmLabel: 'Discard' });
  const close = async () => { if (!busy && await discard()) props.onClose(); };
  useEffect(() => {
    let active = true;
    void rpc.call('skills.open', { id: props.skill.id! }).then(value => {
      if (active) { setDocument(value); setBody(value.body); }
    }).catch(failure => { if (active) setError(errorText(failure)); });
    return () => { active = false; };
  }, [props.skill.id]);
  const reload = () => void run(async () => {
    if (!await discard()) return;
    try {
      const value = await rpc.call('skills.open', { id: props.skill.id! });
      setDocument(value); setBody(value.body); setError('');
    } catch (failure) { setError(errorText(failure)); }
  });
  const save = () => void run(async () => {
    if (!document) return;
    try {
      const value = await rpc.call('skills.edit', { id: props.skill.id!, revision: document.revision, body });
      setDocument(value); setBody(value.body); setError(''); props.onSaved();
    } catch (failure) { setError(errorText(failure)); }
  });
  const readOnly = Boolean(SKILL_EDITOR_WRITE_UNAVAILABLE) || document?.readOnly === true || !can('skills.edit');
  const message = error || (!document ? 'Loading…' : readOnly ? document.readOnlyReason || SKILL_EDITOR_WRITE_UNAVAILABLE : dirty ? 'Unsaved changes' : 'Saved in the original skill file');
  return <Dialog open onClose={() => void close()} title={props.skill.name} width={700} class="skill-editor">
    <p class="skill-editor-location">{props.skill.path}/SKILL.md</p>
    <p class="dialog-text">{props.skill.description}</p>
    <label class="field-label" for="skill-body">Skill text</label>
    <textarea id="skill-body" class="input skill-editor-body" value={body} readOnly={readOnly} disabled={!document || busy} maxLength={200_000}
      onInput={event => setBody(event.currentTarget.value)} spellcheck={false} />
    <DialogActions message={message} tone={error ? 'error' : 'muted'}>
      <Button variant="secondary" disabled={busy} onClick={() => void close()}>Close</Button>
      <Button variant="secondary" disabled={busy} onClick={reload}>Reload original</Button>
      {!readOnly && <Button variant="primary" busy={busy} disabled={!document || !dirty} onClick={save}>Save</Button>}
    </DialogActions>
  </Dialog>;
}
