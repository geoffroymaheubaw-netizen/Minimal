// Web Audio API minimal tactile synthesizer for dumbphone feedback

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playMinimalClick(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.04);
  } catch (e) {
    // AudioContext blocked or not supported
  }
}

export function playZenChime(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(528, ctx.currentTime); // Solfeggio frequency 528Hz (Transformation/Clarity)
    osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.09, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);
  } catch (e) {
    // blocked
  }
}

export function triggerHaptic(enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  } catch (e) {
    // ignore
  }
}

export function triggerFocusCompleteHaptic(enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Pattern: buzz, pause, buzz, pause, long celebratory buzz
      navigator.vibrate([200, 100, 200, 100, 450]);
    }
  } catch (e) {
    // ignore
  }
}

/**
 * Plays a resonant, rich completion gong/chime sequence using Web Audio API
 */
export function playFocusCompleteAlarm(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Harmonic chord: A4 (440Hz), C#5 (554.37Hz), E5 (659.25Hz), A5 (880Hz)
    const notes = [
      { freq: 440, delay: 0, duration: 2.2, volume: 0.12 },
      { freq: 554.37, delay: 0.16, duration: 2.2, volume: 0.14 },
      { freq: 659.25, delay: 0.32, duration: 2.4, volume: 0.15 },
      { freq: 880, delay: 0.48, duration: 2.8, volume: 0.16 },
    ];

    notes.forEach(({ freq, delay, duration, volume }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      // Gentle bell strike attack
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + delay + 0.04);
      // Natural long reverberant decay
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    });
  } catch (e) {
    // audio context suspended or blocked
  }
}

/**
 * Calming, warm evening chime for bedtime disconnect reminder
 */
export function playBedtimeChime(enabled = true): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Soothing restorative harmony: 432Hz (warm natural A), 324Hz (E4), 216Hz (A3)
    const tones = [
      { freq: 432, delay: 0, duration: 2.5, volume: 0.11 },
      { freq: 324, delay: 0.25, duration: 2.2, volume: 0.09 },
      { freq: 216, delay: 0.5, duration: 2.8, volume: 0.12 },
    ];

    tones.forEach(({ freq, delay, duration, volume }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + duration);
    });
  } catch (e) {
    // audio context blocked
  }
}

export function triggerBedtimeHaptic(enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      // Gentle rhythmic pulses: pulse, pause, pulse
      navigator.vibrate([250, 150, 250]);
    }
  } catch (e) {
    // ignore
  }
}
