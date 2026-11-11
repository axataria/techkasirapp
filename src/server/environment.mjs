import process from 'node:process';

// Hosted Edge Functions expose read-only environment variables. Runtime options
// are passed in memory before importing the shared server, without mutating them.
export const environment = new Proxy({}, {
  get(_target, name) { return globalThis.__techkasirEnvironment?.[name] ?? process.env[name]; },
});
