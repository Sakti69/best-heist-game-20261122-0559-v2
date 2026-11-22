// Meridian Vault: all sound is synthesized with WebAudio — no audio files, no network.
// A soft blip for loot, a metallic clink for the coin, a rising siren while the alarm is up,
// a low sting for being caught, a short arpeggio for the win.
export function createAudio() {
  let context = null;
  let muted = false;
  let siren = null;

  function ensure() {
    if (!context) {
      try {
        const AC = window.AudioContext ?? window.webkitAudioContext;
        context = new AC();
      } catch {
        context = null;
      }
    }
    if (context && context.state === 'suspended') void context.resume();
    return context;
  }

  function tone(freq, dur, type, gain, when = 0, slideTo = null) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, gain, freq) {
    const ac = ensure();
    if (!ac || muted) return;
    const t0 = ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const g = ac.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(ac.destination);
    src.start(t0);
  }

  return {
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      if (muted) this.stopSiren();
      return muted;
    },
    get muted() {
      return muted;
    },
    loot() {
      tone(660, 0.12, 'sine', 0.16);
      tone(990, 0.18, 'sine', 0.14, 0.08);
    },
    coin() {
      noiseBurst(0.07, 0.2, 5200);
      tone(2093, 0.09, 'triangle', 0.1, 0.02);
    },
    alarm() {
      tone(220, 0.5, 'sawtooth', 0.12, 0, 440);
      tone(440, 0.5, 'sawtooth', 0.1, 0.5, 220);
    },
    caught() {
      tone(196, 0.7, 'sawtooth', 0.16, 0, 65);
    },
    floorClear() {
      tone(523, 0.14, 'triangle', 0.14);
      tone(659, 0.14, 'triangle', 0.14, 0.12);
      tone(784, 0.22, 'triangle', 0.14, 0.24);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, i * 0.13));
    },
    emp() {
      tone(1200, 0.35, 'sawtooth', 0.12, 0, 120);
      noiseBurst(0.2, 0.12, 3000);
    },
    smoke() {
      noiseBurst(0.5, 0.16, 800);
    },
    laser() {
      tone(1800, 0.12, 'square', 0.1, 0, 900);
    },
    safe() {
      tone(440, 0.08, 'triangle', 0.14);
      tone(587, 0.08, 'triangle', 0.14, 0.07);
      tone(880, 0.2, 'triangle', 0.14, 0.14);
    },
    keycard() {
      tone(740, 0.1, 'sine', 0.14);
      tone(1108, 0.16, 'sine', 0.12, 0.09);
    },
    buy() {
      tone(990, 0.1, 'triangle', 0.12);
      tone(1320, 0.14, 'triangle', 0.1, 0.08);
    },
    startSiren() {
      const ac = ensure();
      if (!ac || muted || siren) return;
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 620;
      const lfo = ac.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.9;
      const lfoGain = ac.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      const g = ac.createGain();
      g.gain.value = 0.045;
      osc.connect(g);
      g.connect(ac.destination);
      osc.start();
      lfo.start();
      siren = { osc, lfo, g };
    },
    stopSiren() {
      if (!siren) return;
      try {
        siren.osc.stop();
        siren.lfo.stop();
      } catch {
        // Already stopped.
      }
      siren = null;
    },
  };
}
