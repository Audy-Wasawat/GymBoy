// Runs the whole test suite once per time zone so day-boundary and week-start bugs surface.
// The zone reaches the tests through GYMBOY_TZ (see src/test/setup.ts).
import { spawnSync } from 'node:child_process'

const zones = ['Asia/Bangkok', 'Asia/Shanghai', 'America/Los_Angeles', 'Pacific/Auckland']
let failed = false
for (const tz of zones) {
  console.log(`\n=== TZ ${tz} ===`)
  const r = spawnSync('npx', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GYMBOY_TZ: tz }
  })
  if (r.status !== 0) failed = true
}
process.exit(failed ? 1 : 0)
