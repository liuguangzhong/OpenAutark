// Settings › Models › "Speech models on this PC" (B-078: was on the Voice page; still the page's last group): every local speech model that is here or on its way, one row each – its job,
// languages and size in one reserved line, "In use" or its download's progress as text in a fixed cell and Remove
// (voice.removeLocal, after a confirm) in another. Getting and choosing a model is one place: the use rows of Settings ›
// Models (ModelUses.tsx; 20.11.2026: this group's own Use button was a second way).
// The group is the page's last, so a removed model moves nothing below it.
// Owns: these rows. Never: downloads a model or decides what it says (speech-models-text.ts).

import { useEffect } from 'preact/hooks';
import { LOCAL_SPEECH_MODELS, type LocalSpeechModel } from '../../shared/model/local-speech-models.ts';
import { confirm } from './prompts.ts';
import { rpc } from '../lib/rpc.ts';
import { can } from '../lib/session.ts';
import { settings } from '../lib/store.ts';
import { Button } from '../lib/ui.tsx';
import { Group, Note, Row, useBusy } from './controls.tsx';
import { running, speechRowView } from './speech-models-text.ts';
import { localModels, readLocalModels, speechChanges, speechPulls, watchSpeechPulls } from './speech-models.ts';

function SpeechModelRow(props: { model: LocalSpeechModel }) {
  const { model } = props;
  const [removing, runRemove] = useBusy();
  const voice = settings.value?.voice;
  const offered = localModels.value;
  const pull = speechPulls.value[model.id];
  const view = speechRowView({
    model, offer: offered?.models.find((offer) => offer.id === model.id), engine: offered?.engine, pull,
    chosen: (model.purpose === 'stt' ? voice?.localStt : voice?.localTts) === model.id, canPull: false, canChoose: can('settings.update'),
  });
  const remove = async () => {
    if (!(await confirm({ title: `Remove ${model.label}?`, body: 'Its files leave this PC. You can download it again under Settings › Models.', confirmLabel: 'Remove', danger: true }))) return;
    await runRemove(async () => {
      await rpc.call('voice.removeLocal', { id: model.id });
      speechChanges.value = speechChanges.peek() + 1;
      await readLocalModels();
    });
  };
  return (
    <Row class="speech-model-row" label={model.label} hint={`${view.recommended ? 'Recommended · ' : ''}${view.hint}`} reserve>
      <span class="account-slot speech-model-state">{view.primary.kind === 'in-use' || view.primary.kind === 'progress' ? view.primary.label : ''}</span>
      {can('voice.removeLocal') && <Button variant="ghost" class="small" busy={removing} disabled={running(pull)} onClick={() => void remove()}>Remove</Button>}
    </Row>
  );
}

export function SpeechModelRows() {
  useEffect(() => { watchSpeechPulls(); void readLocalModels(); }, []);
  if (!can('voice.localModels')) return null; // a phone that cannot read them would say "None yet"
  const offers = localModels.value?.models ?? [];
  const here = LOCAL_SPEECH_MODELS.filter((model) => offers.some((offer) => offer.id === model.id && offer.installed) || running(speechPulls.value[model.id]));
  return (
    <Group title="Speech models on this PC" id="settings-speech-models">
      {localModels.value !== undefined && !here.length && <Row label={<Note>None yet</Note>} hint="Settings › Models offers them under Speech to text and Text to speech" reserve />}
      {here.map((model) => <SpeechModelRow key={model.id} model={model} />)}
    </Group>
  );
}
