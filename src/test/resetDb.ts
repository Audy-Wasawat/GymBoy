import { db } from '../db/db'

/** Wipes every table so each test starts from a fresh install. */
export async function resetDb() {
  await Promise.all(db.tables.map((t) => t.clear()))
}
