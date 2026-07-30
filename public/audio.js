const STORAGE_KEY = "quiz-and-chill-muted";
const MUSIC_VOLUME_KEY = "quiz-and-chill-music-volume";
const MUSIC_MUTED_KEY = "quiz-and-chill-music-muted";
const MUSIC_BASE_GAIN = 0.12;

class ChillAudio {
  constructor() {
    this.context = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === "true";
    this.musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "true";
    const storedMusicVolume = localStorage.getItem(MUSIC_VOLUME_KEY);
    const savedMusicVolume = storedMusicVolume === null ? Number.NaN : Number(storedMusicVolume);
    this.musicVolume = Number.isFinite(savedMusicVolume) ? Math.max(0, Math.min(1, savedMusicVolume)) : 0.6;
    this.musicGain = null;
    this.scheduler = null;
    this.transportStartTime = 0;
    this.transportStep = 0;
    this.sceneLevel = 1;
  }

  async unlock() {
    if (this.muted) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") await this.context.resume();
      this.startMusic();
    } catch {
      this.context = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(STORAGE_KEY, String(muted));
    if (muted) this.stopMusic();
    else this.unlock();
  }

  startMusic() {
    if (this.muted || this.musicMuted || !this.context || this.context.state !== "running" || this.scheduler) return;
    const now = this.context.currentTime;
    this.musicGain = this.context.createGain();
    this.musicGain.gain.setValueAtTime(0.0001, now);
    this.musicGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.musicTarget()), now + 1.6);
    this.musicGain.connect(this.context.destination);
    this.transportStartTime = now + 0.1;
    this.transportStep = 0;
    this.scheduleMusic();
    this.scheduler = window.setInterval(() => this.scheduleMusic(), 100);
  }

  stopMusic() {
    if (!this.musicGain || !this.context) return;
    window.clearInterval(this.scheduler);
    this.scheduler = null;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(Math.max(this.musicGain.gain.value, 0.0001), now);
    this.musicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    const oldGain = this.musicGain;
    this.musicGain = null;
    window.setTimeout(() => {
      try { oldGain.disconnect(); } catch {}
    }, 1000);
  }

  setScene(scene) {
    this.sceneLevel = scene === "reveal" ? 0.42 : scene === "transition" ? 0.55 : scene === "loading" ? 0.7 : 1;
    if (!this.musicGain || !this.context) return;
    const now = this.context.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(this.musicTarget(), now, 0.28);
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
    if (!this.musicGain || !this.context) return;
    this.musicGain.gain.setTargetAtTime(this.musicTarget(), this.context.currentTime, 0.08);
  }

  setMusicMuted(muted) {
    this.musicMuted = muted;
    localStorage.setItem(MUSIC_MUTED_KEY, String(muted));
    if (muted) this.stopMusic();
    else this.startMusic();
  }

  musicTarget() {
    return MUSIC_BASE_GAIN * this.musicVolume * this.sceneLevel;
  }

  scheduleMusic() {
    if (!this.context || !this.musicGain) return;
    const eighth = 60 / 105 / 2;
    while (this.transportStartTime + this.transportStep * eighth < this.context.currentTime + 0.45) {
      const eventTime = this.transportStartTime + this.transportStep * eighth;
      this.scheduleStep(this.transportStep % 16, eventTime, eighth, this.transportStep);
      this.transportStep += 1;
    }
  }

  scheduleStep(step, time, duration, absoluteStep) {
    // Original two-chord D-Dorian vamp: Dm6 (D F A B) and G9 (G B D F A).
    const chords = [
      [50, 53, 57, 59],
      [55, 59, 62, 65, 69],
    ];
    // Original D-Dorian phrase. Every offset and duration is derived from the shared 105 BPM grid.
    const melodyEvents = [
      { step: 0, note: 62, length: 0.72, accent: 1.05 },
      { step: 2, offset: 0.5, note: 65, length: 0.4, accent: 0.9 },
      { step: 4, note: 62, length: 1.12, accent: 1 },
      { step: 5, offset: 0.5, note: 65, length: 0.36, accent: 0.92 },
      { step: 7, note: 62, length: 0.62, accent: 1.08 },
      { step: 8, offset: 0.5, note: 69, length: 0.48, accent: 0.95 },
      { step: 10, note: 62, length: 3.4, accent: 1.12 },
      { step: 14, offset: 0.5, note: 67, length: 0.38, accent: 0.92 },
      { step: 16, note: 65, length: 0.96, accent: 1.04 },
      { step: 17, offset: 0.5, note: 62, length: 0.36, accent: 0.88 },
      { step: 20, note: 60, length: 0.58, accent: 0.94 },
      { step: 22, note: 62, length: 1.45, accent: 1.1, ending: true },
    ];
    const chordIndex = Math.floor(step / 8);
    const compStep = step % 8;
    if ([0, 3, 6].includes(compStep)) {
      const compVolume = compStep === 0 ? 0.021 : 0.016;
      const compLength = compStep === 0 ? 1.7 : 1.15;
      chords[chordIndex].forEach((midi, voiceIndex) => {
        this.musicVoice(
          this.midi(midi),
          time + voiceIndex * 0.008,
          duration * compLength,
          compVolume,
        );
      });
    }
    if (step % 4 === 0) {
      const root = chords[chordIndex][0] - 12;
      this.musicVoice(this.midi(root), time, duration * 2.5, 0.052, "triangle");
      this.softKick(time);
    }
    if (step % 2 === 1) this.softTick(time, step % 4 === 3 ? 0.014 : 0.009);
    const phraseStep = absoluteStep % 24;
    const melodyEvent = melodyEvents.find(event => event.step === phraseStep);
    if (melodyEvent) {
      const melodyTime = time + (melodyEvent.offset ?? 0) * duration;
      const melodyLength = duration * melodyEvent.length;
      const melodyVolume = 0.017 * melodyEvent.accent;
      const isSecondRepetitionEnding = melodyEvent.ending && Math.floor(absoluteStep / 24) % 2 === 1;
      if (isSecondRepetitionEnding) {
        this.musicVoice(this.midi(50), melodyTime, melodyLength, 0.014, "triangle");
        this.musicVoice(this.midi(74), melodyTime, melodyLength, 0.014, "triangle");
      } else {
        this.musicVoice(this.midi(melodyEvent.note), melodyTime, melodyLength, melodyVolume, "triangle");
      }
    }
  }

  musicVoice(frequency, time, duration, volume, type = "sine") {
    if (!this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1450, time);
    filter.Q.setValueAtTime(0.7, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(filter).connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.04);
  }

  softTick(time, volume) {
    if (!this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(1850, time);
    oscillator.frequency.exponentialRampToValueAtTime(720, time + 0.045);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.08);
  }

  softKick(time) {
    if (!this.musicGain) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(92, time);
    oscillator.frequency.exponentialRampToValueAtTime(54, time + 0.11);
    gain.gain.setValueAtTime(0.028, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    oscillator.connect(gain).connect(this.musicGain);
    oscillator.start(time);
    oscillator.stop(time + 0.2);
  }

  midi(note) {
    return 440 * (2 ** ((note - 69) / 12));
  }

  tone(frequency, offset = 0, duration = 0.16, volume = 0.035, type = "sine") {
    if (this.muted || !this.context || this.context.state !== "running") return;
    const start = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  select() {
    this.tone(392, 0, 0.11, 0.025, "sine");
    this.tone(523.25, 0.045, 0.13, 0.018, "sine");
  }

  correct() {
    this.tone(261.63, 0, 0.34, 0.035);
    this.tone(329.63, 0.08, 0.38, 0.03);
    this.tone(392, 0.16, 0.46, 0.028);
  }

  incorrect() {
    this.tone(293.66, 0, 0.3, 0.025, "triangle");
    this.tone(246.94, 0.12, 0.38, 0.022, "sine");
  }

  transition() {
    this.tone(196, 0, 0.55, 0.022);
    this.tone(261.63, 0.13, 0.62, 0.025);
    this.tone(329.63, 0.28, 0.72, 0.022);
  }

  start() {
    this.tone(220, 0, 0.28, 0.025);
    this.tone(293.66, 0.1, 0.38, 0.025);
  }
}

export const chillAudio = new ChillAudio();
