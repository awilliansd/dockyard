const SOUND_KEY = 'shipyard:ai-sound-enabled'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext()
  }
  return audioCtx
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem(SOUND_KEY) !== 'false'
}

export function setSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_KEY, String(enabled))
}

/**
 * Play a subtle two-tone chime when AI operations complete.
 * Uses Web Audio API — no audio files needed.
 */
export function playAiCompleteSound() {
  if (!isSoundEnabled()) return

  try {
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // Two-tone ascending chime (C5 → E5)
    const frequencies = [523.25, 659.25]
    const duration = 0.12
    const gap = 0.08

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'sine'
      osc.frequency.value = freq

      const start = now + i * (duration + gap)
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    })
  } catch {
    // Silently fail — sound is non-critical
  }
}
