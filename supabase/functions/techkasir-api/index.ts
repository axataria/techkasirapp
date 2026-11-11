// Supabase supplies the database secret server-side. No database or service-role
// key is shipped to Firebase Hosting or the browser.
const database = Deno.env.get('TECHKASIR_DATABASE_URL') || Deno.env.get('SUPABASE_DB_URL') || Deno.env.get('DATABASE_URL');
if (!database) throw Error('Supabase database connection is missing');
const runtime = globalThis as typeof globalThis & { __techkasirEnvironment: Record<string, string> };
runtime.__techkasirEnvironment = {
  DATABASE_URL: database,
  TECHKASIR_DATABASE_ROLE: 'techkasir_app',
  TECHKASIR_REQUIRE_POSTGRES: 'true',
  TECHKASIR_EDGE: 'true',
  TECHKASIR_APP_ORIGIN: 'https://kasirlaptoplab.web.app',
};

const { handleStoreRequest } = await import('./src/server/store.mjs');
const { createWebHandler } = await import('./src/server/web-handler.mjs');
const handler = createWebHandler(handleStoreRequest, { origin: 'https://kasirlaptoplab.web.app' });
Deno.serve({ port: Number(Deno.env.get('PORT') || 8000), hostname: '0.0.0.0' }, handler);
