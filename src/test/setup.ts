// A fake IndexedDB so the Dexie data layer can be tested in Node without a browser.
import 'fake-indexeddb/auto'

// Minimal typing for the one Node global used here, so the app build stays free of @types/node.
declare const process: { env: Record<string, string | undefined> }

// Run the suite under several time zones to catch day-boundary and week-start bugs.
// The shell strips a bare `TZ=` prefix, so the zone is passed as GYMBOY_TZ and applied here;
// V8 re-reads process.env.TZ when a Date is created, so setting it before the tests run is enough.
if (process.env.GYMBOY_TZ) process.env.TZ = process.env.GYMBOY_TZ
