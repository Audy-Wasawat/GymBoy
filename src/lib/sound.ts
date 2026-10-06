// Rest-timer sounds.
//
// iOS only lets a page make sound after a user gesture. It also moves a page's AudioContext to the
// "interrupted" (or "suspended") state whenever the app goes to the background, a call comes in, or
// another app takes the audio, and it often refuses to resume that context without a new gesture.
// The old code made one context for the app's whole life and only resumed it from "suspended", so
// after the first trip out of the app every later alarm was silent.
//
// Now:
// - every tap anywhere (and the tap that saves a set) checks the context and, if it is not running,
//   resumes it or throws it away and makes a fresh one inside that tap, which iOS always allows;
// - coming back to the app tries to resume straight away;
// - an alarm that finds the context stopped tries once to resume it before giving up.
// Sound still only plays while the app is open: a web app cannot sound from the background.

type Ctx = AudioContext

let ctx: Ctx | undefined

function Ctor(): typeof AudioContext | undefined {
  if (typeof window === 'undefined') return undefined
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
}

/**
 * Asks Safari (iOS 17+) for a short, mixable sound: music from another app keeps playing and only
 * ducks under the chime instead of being stopped. Ignored where the Audio Session API is missing.
 */
function mixWithOtherAudio() {
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession
    if (session && session.type !== 'transient') session.type = 'transient'
  } catch {
    // ignore
  }
}

function fresh(): Ctx | undefined {
  mixWithOtherAudio()
  const C = Ctor()
  if (!C) return undefined
  try {
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {})
  } catch {
    // ignore
  }
  ctx = new C()
  return ctx
}

function current(): Ctx | undefined {
  if (!ctx || ctx.state === 'closed') return fresh()
  return ctx
}

/** A one-sample silent buffer completes the unlock on older iOS versions. */
function tick(c: Ctx) {
  const src = c.createBufferSource()
  src.buffer = c.createBuffer(1, 1, 22050)
  src.connect(c.destination)
  src.start(0)
}

/**
 * Makes sure sound can play. Call it inside a tap. A context that is not running (iOS stopped it
 * when the app went to the background, and often keeps it stuck as "interrupted") is replaced with a
 * new one; a context made inside a tap starts running.
 */
export function unlockAudio() {
  try {
    let c = current()
    if (!c) return
    if (c.state !== 'running') {
      void c.resume().catch(() => {})
      c = fresh()
      if (!c) return
      if (c.state === 'suspended') void c.resume().catch(() => {})
    }
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
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume().catch(() => {})
  })
}

async function ready(): Promise<Ctx | undefined> {
  const c = ctx
  if (!c || c.state === 'closed') return undefined
  if (c.state !== 'running') {
    try {
      await Promise.race([c.resume(), new Promise((r) => setTimeout(r, 250))])
    } catch {
      // ignore
    }
  }
  return c.state === 'running' ? c : undefined
}

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
      notes.forEach((f, i) => bell(c, t0 + r * 0.95 + i * 0.16, f, 0.32, i === 2 ? 1.2 : 0.7))
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

/** Plays the chime now (from a tap in settings) so the volume can be checked. */
export function previewRestDone() {
  unlockAudio()
  setTimeout(() => void playRestDone(), 60)
}
