// Settings confirmations. The shared dialog lives outside the Settings tree, so its title, body and buttons are
// translated here before they are shown. Stored values and names inside the sentences stay as the patterns leave them.
// Owns: Settings confirm, rename and choice prompts. Never: dialogs opened from other pages.

import { askText as askTextRaw, choose as chooseRaw, confirm as confirmRaw } from '../lib/dialog.tsx';
import { zh } from './i18n.ts';

/** Asks once in the Settings voice. Resolves true when confirmed. */
export function confirm(options: { title: string; body?: string; confirmLabel?: string; danger?: boolean }): Promise<boolean> {
  return confirmRaw({
    ...options,
    title: zh(options.title),
    body: options.body === undefined ? undefined : zh(options.body),
    confirmLabel: zh(options.confirmLabel ?? 'Confirm'),
    cancelLabel: zh('Cancel'),
    closeLabel: zh('Close'),
  });
}

/** Asks for one line of text. Resolves the trimmed text, or null when cancelled or left empty. */
export function askText(options: { title: string; label: string; value?: string; confirmLabel?: string }): Promise<string | null> {
  return askTextRaw({
    ...options,
    title: zh(options.title),
    label: zh(options.label),
    confirmLabel: zh(options.confirmLabel ?? 'Save'),
    cancelLabel: zh('Cancel'),
    closeLabel: zh('Close'),
  });
}

/** Asks to pick one option. Resolves the picked value, or null when cancelled. */
export function choose(options: {
  title: string; body?: string; choices: Array<{ value: string; label: string; hint?: string }>; value: string; confirmLabel?: string;
}): Promise<string | null> {
  return chooseRaw({
    ...options,
    title: zh(options.title),
    body: options.body === undefined ? undefined : zh(options.body),
    confirmLabel: zh(options.confirmLabel ?? 'Confirm'),
    cancelLabel: zh('Cancel'),
    closeLabel: zh('Close'),
    choices: options.choices.map((choice) => ({ ...choice, label: zh(choice.label), hint: choice.hint === undefined ? undefined : zh(choice.hint) })),
  });
}
