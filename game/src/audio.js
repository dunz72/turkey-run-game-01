// Sound, synthesized live with WebAudio: no audio files, no network. Every effect is a
// short oscillator or noise burst, so the game stays a handful of static files. The audio
// context is made on the first user gesture (browsers block sound before one); a muted game
// stays muted, and M toggles it.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
    } catch {
      return false;
    }
    return true;
  }

  /** One oscillator note, sliding from `from` to `to` over `seconds`. */
  function tone(from, to, seconds, type, volume, when = 0) {
    if (!ensure() || muted) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  /** A burst of filtered noise, for thuds and rustles. */
  function noise(seconds, volume, frequency) {
    if (!ensure() || muted) return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    /** M is the mute key: flip it and report the new state. */
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** Wake the context from a gesture so later sounds play. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
    },
    click() {
      tone(660, 660, 0.06, 'sine', 0.25);
    },
    jump() {
      tone(300, 620, 0.14, 'sine', 0.3);
    },
    gobble() {
      // Two honks, the second lower: the turkey announcing itself.
      tone(520, 340, 0.09, 'sawtooth', 0.16);
      tone(420, 260, 0.11, 'sawtooth', 0.16, 0.1);
    },
    pickup() {
      tone(880, 880, 0.07, 'sine', 0.3);
      tone(1320, 1320, 0.09, 'sine', 0.3, 0.07);
    },
    pumpkin() {
      tone(523, 523, 0.09, 'triangle', 0.35);
      tone(659, 659, 0.09, 'triangle', 0.35, 0.09);
      tone(784, 784, 0.14, 'triangle', 0.35, 0.18);
    },
    feather() {
      tone(1046, 1568, 0.22, 'sine', 0.3);
    },
    hide() {
      noise(0.18, 0.25, 900);
    },
    popOut() {
      tone(500, 900, 0.12, 'square', 0.18);
    },
    knife() {
      tone(1800, 700, 0.16, 'sawtooth', 0.12);
    },
    hit() {
      noise(0.22, 0.5, 420);
      tone(160, 60, 0.25, 'square', 0.3);
    },
    alarm() {
      tone(980, 980, 0.08, 'square', 0.14);
      tone(980, 980, 0.08, 'square', 0.14, 0.14);
    },
    caught() {
      tone(392, 392, 0.22, 'sawtooth', 0.25);
      tone(311, 311, 0.22, 'sawtooth', 0.25, 0.22);
      tone(233, 175, 0.5, 'sawtooth', 0.25, 0.44);
    },
    escaped() {
      tone(523, 523, 0.12, 'triangle', 0.35);
      tone(659, 659, 0.12, 'triangle', 0.35, 0.12);
      tone(784, 784, 0.12, 'triangle', 0.35, 0.24);
      tone(1046, 1046, 0.3, 'triangle', 0.35, 0.36);
    },
  };
}
