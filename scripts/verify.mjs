import { spawnSync } from 'node:child_process';

// Cross-platform V3 acceptance: compile the frontend before testing its server.
for (const args of [
  ['node_modules/typescript/bin/tsc', '--noEmit'],
  ['node_modules/next/dist/bin/next', 'build', '--webpack'],
  ['verify.mjs'],
  ['next.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: new URL('../', import.meta.url), stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('TechKasir V3 acceptance passed.');
