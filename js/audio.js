// Mochi Pal — Web Audio API Synthesizer & Telegram Haptics
class MochiAudio {
  constructor() {
    this.ctx = null;
    this.soundEnabled = true;
    this.hapticsEnabled = true;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  haptic(type = 'light') {
    if (!this.hapticsEnabled) return;
    const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
    if (!tg || !tg.HapticFeedback) return;
    try {
      if (type === 'success' || type === 'warning' || type === 'error') {
        tg.HapticFeedback.notificationOccurred(type);
      } else {
        tg.HapticFeedback.impactOccurred(type);
      }
    } catch (e) {}
  }

  playTone(fStart, fEnd, dur = 0.1, type = 'sine', vol = 0.22, delay = 0) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(fStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, fEnd), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.01);
    } catch (e) {}
  }

  playGiggle() {
    this.haptic('light');
    this.playTone(520, 780, 0.08, 'sine', 0.22, 0);
    this.playTone(640, 940, 0.09, 'sine', 0.22, 0.085);
    this.playTone(720, 1080, 0.11, 'sine', 0.18, 0.17);
  }

  playPurr() {
    this.haptic('light');
    this.playTone(380, 560, 0.12, 'triangle', 0.16, 0);
  }

  playChew() {
    this.haptic('light');
    this.playTone(260, 140, 0.07, 'triangle', 0.26, 0);
    this.playTone(320, 180, 0.07, 'triangle', 0.24, 0.12);
    this.playTone(460, 680, 0.11, 'sine', 0.2, 0.24);
  }

  playFullBelly() {
    this.haptic('warning');
    this.playTone(220, 140, 0.18, 'sawtooth', 0.18, 0);
  }

  playBubble() {
    this.playTone(420 + Math.random() * 280, 880 + Math.random() * 320, 0.06, 'sine', 0.14, 0);
  }

  playShower() {
    this.haptic('medium');
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const dur = 0.45;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.sin((i / bufSize) * Math.PI);
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.18;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    } catch (e) {}
    this.playTone(580, 960, 0.18, 'sine', 0.18, 0.22);
  }

  playSleepToggle(isSleeping) {
    this.haptic('light');
    if (isSleeping) {
      this.playTone(520, 340, 0.18, 'sine', 0.18, 0);
      this.playTone(380, 260, 0.24, 'sine', 0.15, 0.16);
    } else {
      this.playTone(340, 560, 0.15, 'sine', 0.2, 0);
      this.playTone(520, 780, 0.18, 'sine', 0.22, 0.13);
    }
  }

  playBounce() {
    this.haptic('light');
    this.playTone(190, 390, 0.08, 'sine', 0.22, 0);
  }

  playCoin() {
    this.haptic('medium');
    this.playTone(660, 1120, 0.11, 'triangle', 0.24, 0);
    this.playTone(880, 1420, 0.14, 'sine', 0.22, 0.07);
  }

  playCrystal() {
    this.haptic('success');
    this.playTone(784, 1568, 0.14, 'sine', 0.25, 0);
    this.playTone(1046, 2093, 0.2, 'triangle', 0.24, 0.09);
  }

  playLevelUp() {
    this.haptic('success');
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.playTone(n, n * 1.04, 0.16, 'triangle', 0.26, idx * 0.09);
    });
  }

  playClick() {
    this.haptic('light');
    this.playTone(460, 620, 0.045, 'sine', 0.15, 0);
  }
}

export const sfx = new MochiAudio();
