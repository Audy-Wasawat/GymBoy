// iOS only lets a page make sound after a user gesture, so the context is unlocked on the tap
// that saves a set. The alarm only plays while the app is open; there is no lock-screen alert.
let ctx: AudioContext | undefined

function context() {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!ctx && Ctor) ctx = new Ctor()
  return ctx
}

export function unlockAudio() {
  try {
    const c = context()
    if (!c) return
    if (c.state === 'suspended') void c.resume()
    // A silent one-sample buffer completes the unlock on older iOS versions.
    const src = c.createBufferSource()
    src.buffer = c.createBuffer(1, 1, 22050)
    src.connect(c.destination)
    src.start(0)
  } catch {
    // Sound is a nicety; never let it break logging.
  }
}

/** Three short beeps. */
export function playRestDone() {
  try {
    const c = context()
    if (!c || c.state !== 'running') return
    for (let i = 0; i < 3; i++) {
      const at = c.currentTime + i * 0.3
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
      osc.connect(gain).connect(c.destination)
      osc.start(at)
      osc.stop(at + 0.22)
    }
  } catch {
    // ignore
  }
}
