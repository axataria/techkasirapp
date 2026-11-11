import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next','build','--webpack'], {
  stdio: 'inherit', windowsHide: true,
  env: { ...process.env, TECHKASIR_STATIC: 'true', NEXT_PUBLIC_TECHKASIR_API_URL: process.env.NEXT_PUBLIC_TECHKASIR_API_URL || 'https://eumlynnylgdlscpednor.supabase.co/functions/v1/techkasir-api' },
});
if (result.error) throw result.error;
process.exit(result.status || 0);
