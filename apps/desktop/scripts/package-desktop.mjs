// Owns: the normal packaging CLI plus static NSIS extraction for local Windows builds.
// Never: disables security checks, bypasses a failed CRC, or changes the installed app/profile.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { enableStaticUninstaller } from './nsis-build.mjs';

// Windows runs makensis natively, then asks Wine (even on Windows) to execute the uninstaller stub.
// Linux cross-builds hit that same Wine call; Wine 9 here cannot start the stub (wow64 ntdll). The static
// reader already shipped for that call reconstructs the uninstaller and checks its CRC without executing it.
const buildingWindows = process.argv.some((arg) => arg === '--win' || arg.startsWith('--win'));
if (process.platform === 'win32' || buildingWindows) enableStaticUninstaller(createRequire(import.meta.url));
if (process.env.AUTARK_WINDOWS_SIGNING) {
  // 'azure': Artifact Signing on the CI runner. 'certum' (16.11.2026): a certificate in this PC's store (windows-signing-config.cjs).
  if (!['azure', 'certum'].includes(process.env.AUTARK_WINDOWS_SIGNING) || process.platform !== 'win32') throw new Error('Expected a Windows signing runner: AUTARK_WINDOWS_SIGNING is azure or certum.');
  if (process.argv.some(arg => arg === '-c' || arg.startsWith('--config') || arg.startsWith('-c.'))) throw new Error('Signed builds use the reviewed Windows signing configuration.');
  process.argv.push('--config', fileURLToPath(new URL('./windows-signing-config.cjs', import.meta.url)));
  const require = createRequire(import.meta.url);
  const config = require('./windows-signing-config.cjs');
  const { prepareNsisTools } = await import('./windows-nsis-tools.mjs');
  await prepareNsisTools({ config, projectDir: fileURLToPath(new URL('../', import.meta.url)) });
}
await import('electron-builder/cli.js');
