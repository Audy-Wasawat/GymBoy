// Rest-timer sounds.
//
// iOS only lets a page make sound after a user gesture, and it stops the page's AudioContext
// ("suspended" or the Safari-only "interrupted") whenever the app goes to the background, a call
// comes in, or another app takes the audio. One shared context is kept and re-armed on taps:
//
// - a stopped context gets resume() inside a tap, which iOS allows;
// - a resume() is never stacked on one that is still pending, and a context is never thrown away
//   while it is still starting (doing that on every tap is what kept the test sound silent);
// - only a context that stays stopped after a resume, or reports "interrupted", is replaced, and
//   the replacement is made inside a tap;
// - coming back to the app tries to resume straight away.
// Sound still only plays while the app is open: a web app cannot sound from the background.

type Ctx = AudioContext

let ctx: Ctx | undefined
/** When the last resume() was asked for; a context still stopped well after it is replaced. */
let resumedAt = 0
const RESUME_GRACE_MS = 800

function Ctor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

function fresh(): Ctx | undefined {
  const C = Ctor()
  if (!C) return undefined
  try {
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {})
  } catch {
    // ignore
  }
  ctx = new C()
  resumedAt = 0
  return ctx
}

function resume(c: Ctx) {
  resumedAt = Date.now()
  void c.resume().catch(() => {})
}

/** A one-sample silent buffer completes the unlock on older iOS versions. */
function tick(c: Ctx) {
  const src = c.createBufferSource()
  src.buffer = c.createBuffer(1, 1, 22050)
  src.connect(c.destination)
  src.start(0)
}

/** Makes sure sound can play. Call it inside a tap; calling it on every tap is cheap and safe. */
export function unlockAudio() {
  try {
    let c = ctx
    const state = c?.state as string | undefined
    if (!c || state === 'closed' || state === 'interrupted') {
      c = fresh()
      if (!c) return
    } else if (state === 'running') {
      return
    } else if (resumedAt && Date.now() - resumedAt > RESUME_GRACE_MS) {
      // Asked to resume earlier and still stopped: iOS will not wake this one, start over.
      c = fresh()
      if (!c) return
    } else if (resumedAt) {
      return // a resume is still on its way
    }
    if (c.state !== 'running') resume(c)
    tick(c)
  } catch {
    // Sound is a nicety; never let it break logging.
  }
}

let installed = false
/**
 * Keeps the audio unlocked for the whole app: any tap re-checks it, and returning to the app tries to
 * resume. Safe to call more than once.
 */
export function installAudioKeeper() {
  if (installed || typeof document === 'undefined') return
  installed = true
  const onGesture = () => { if (!ctx || ctx.state !== 'running') unlockAudio() }
  // touchend and click count as user activation on iOS; pointerdown does not on every version.
  document.addEventListener('touchend', onGesture, { passive: true, capture: true })
  document.addEventListener('click', onGesture, { capture: true })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') resume(ctx)
  })
}

/** The context once it runs, waiting up to `ms` for a pending resume; undefined if it never does. */
async function ready(ms = 400): Promise<Ctx | undefined> {
  const c = ctx
  if (!c || c.state === 'closed') return undefined
  if (c.state !== 'running') {
    try {
      await Promise.race([c.resume(), new Promise((r) => setTimeout(r, ms))])
    } catch {
      // ignore
    }
  }
  return c.state === 'running' ? c : undefined
}

/** What the sound system is doing, for the settings screen ("running", "suspended", "unsupported"…). */
export const audioState = () => (Ctor() ? (ctx?.state as string | undefined) ?? 'none' : 'unsupported')

/** A soft bell: a sine partial stack with a quick attack and a long decay. */
function bell(c: Ctx, at: number, freq: number, gain: number, length = 1.1) {
  const out = c.createGain()
  out.gain.setValueAtTime(0.0001, at)
  out.gain.exponentialRampToValueAtTime(gain, at + 0.012)
  out.gain.exponentialRampToValueAtTime(0.0001, at + length)
  out.connect(c.destination)
  // Partials of a small struck bell (relative frequency, relative level).
  const partials: [number, number][] = [[1, 1], [2.01, 0.45], [3.02, 0.18], [4.17, 0.08]]
  for (const [ratio, level] of partials) {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * ratio
    g.gain.value = level
    osc.connect(g).connect(out)
    osc.start(at)
    osc.stop(at + length + 0.05)
  }
}

/** Rest over: a rising three-note chime, played twice so it is hard to miss in headphones. */
export async function playRestDone() {
  try {
    const c = await ready()
    if (!c) return false
    const t0 = c.currentTime + 0.02
    const notes = [880, 1108.73, 1318.51] // A5, C#6, E6
    for (let r = 0; r < 2; r++) {
      notes.forEach((f, i) => bell(c, t0 + r * 0.95 + i * 0.16, f, 0.3, i === 2 ? 1.2 : 0.7))
    }
    return true
  } catch {
    return false
  }
}

/** A short, quiet tick for the last seconds of a rest. `last` is the higher "go" tick. */
export async function playCountdownTick(last = false) {
  try {
    const c = await ready()
    if (!c) return
    bell(c, c.currentTime + 0.01, last ? 1318.51 : 987.77, 0.14, 0.25)
  } catch {
    // ignore
  }
}

/**
 * Plays the chime now, from a tap in settings, so the volume can be checked. Resolves to whether it
 * played. It waits up to a second for iOS to start the audio.
 */
export async function previewRestDone(): Promise<boolean> {
  unlockAudio()
  const c = await ready(1000)
  if (!c) return false
  return playRestDone()
}
