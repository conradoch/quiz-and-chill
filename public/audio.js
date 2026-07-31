const STORAGE_KEY = "quiz-and-chill-muted";
const MUSIC_VOLUME_KEY = "quiz-and-chill-music-volume";
const MUSIC_MUTED_KEY = "quiz-and-chill-music-muted";
const MUSIC_BASE_GAIN = 0.28;
const MUSIC_TRACK_URL = "/audio/points-on-the-board.mp3";

class ChillAudio {
  constructor() {
    this.context = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === "true";
    this.musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "true";
    const storedMusicVolume = localStorage.getItem(MUSIC_VOLUME_KEY);
    const savedMusicVolume = storedMusicVolume === null ? Number.NaN : Number(storedMusicVolume);
    // Existing visitors keep their saved preference; only first-time users get
    // the new, enabled-by-default 50% music level.
    this.musicVolume = Number.isFinite(savedMusicVolume) ? Math.max(0, Math.min(1, savedMusicVolume)) : 0.5;
    this.musicTrack = new Audio(MUSIC_TRACK_URL);
    this.musicTrack.id = "background-music";
    this.musicTrack.hidden = true;
    this.musicTrack.setAttribute("aria-hidden", "true");
    document.body.append(this.musicTrack);
    this.musicTrack.loop = true;
    this.musicTrack.preload = "auto";
    this.musicTrack.volume = 0;
    this.musicFadeFrame = null;
    this.sceneLevel = 1;
    this.effectsBus = null;
    this.effectsDelay = null;
  }

  async unlock() {
    if (this.muted) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") await this.context.resume();
      this.ensureEffectsBus();
      await this.startMusic();
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

  async startMusic() {
    if (this.muted || this.musicMuted || !this.context || this.context.state !== "running") return;
    try {
      if (this.musicTrack.paused) {
        this.musicTrack.volume = 0;
        await this.musicTrack.play();
      }
      this.fadeMusicTo(this.musicTarget(), 1600);
    } catch {
      // Autoplay can still be denied by the browser; game audio remains optional.
    }
  }

  stopMusic() {
    if (this.musicTrack.paused) return;
    this.fadeMusicTo(0, 800, () => this.musicTrack.pause());
  }

  setScene(scene) {
    this.sceneLevel = scene === "reveal" ? 0.42 : scene === "transition" ? 0.55 : scene === "loading" ? 0.7 : 1;
    if (!this.musicTrack.paused) this.fadeMusicTo(this.musicTarget(), 350);
  }

  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, Number(volume) || 0));
    localStorage.setItem(MUSIC_VOLUME_KEY, String(this.musicVolume));
    if (!this.musicTrack.paused) this.fadeMusicTo(this.musicTarget(), 100);
  }

  setMusicMuted(muted) {
    this.musicMuted = muted;
    localStorage.setItem(MUSIC_MUTED_KEY, String(muted));
    if (muted) this.stopMusic();
    else this.unlock();
  }

  musicTarget() {
    return MUSIC_BASE_GAIN * this.musicVolume * this.sceneLevel;
  }

  ensureEffectsBus() {
    if (!this.context || this.effectsBus) return;
    const effectsGain = this.context.createGain();
    const compressor = this.context.createDynamicsCompressor();
    const delay = this.context.createDelay(0.25);
    const delayFilter = this.context.createBiquadFilter();
    const feedback = this.context.createGain();
    const wet = this.context.createGain();
    effectsGain.gain.value = 0.78;
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    delay.delayTime.value = 0.105;
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 4800;
    feedback.gain.value = 0.13;
    wet.gain.value = 0.16;
    effectsGain.connect(compressor).connect(this.context.destination);
    effectsGain.connect(delay).connect(delayFilter).connect(wet).connect(compressor);
    delayFilter.connect(feedback).connect(delay);
    this.effectsBus = effectsGain;
    this.effectsDelay = delay;
  }

  fadeMusicTo(target, durationMs, onComplete) {
    if (this.musicFadeFrame) cancelAnimationFrame(this.musicFadeFrame);
    const from = this.musicTrack.volume;
    const safeTarget = Math.max(0, Math.min(1, target));
    const startedAt = performance.now();
    const step = now => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      this.musicTrack.volume = from + (safeTarget - from) * progress;
      if (progress < 1) this.musicFadeFrame = requestAnimationFrame(step);
      else {
        this.musicFadeFrame = null;
        onComplete?.();
      }
    };
    this.musicFadeFrame = requestAnimationFrame(step);
  }

  tone(frequency, offset = 0, duration = 0.22, volume = 0.05, type = "sine", options = {}) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    this.ensureEffectsBus();
    const start = this.context.currentTime + offset;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const filter = this.context.createBiquadFilter();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (options.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(options.endFrequency, start + duration);
    oscillator.detune.value = options.detune ?? 0;
    filter.type = "lowpass";
    filter.frequency.value = options.brightness ?? 6800;
    filter.Q.value = 0.5;
    const attack = options.attack ?? 0.009;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + attack);
    gain.gain.setValueAtTime(volume, start + Math.max(attack, duration * 0.38));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(this.effectsBus);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  // A quiet octave partial adds definition without the brittle square-wave
  // edge associated with retro chiptune effects.
  roundedNote(frequency, offset, duration, volume, options = {}) {
    this.tone(frequency, offset, duration, volume, "triangle", options);
    this.tone(frequency * 2, offset + 0.006, duration * 0.78, volume * 0.24, "sine", {
      brightness: Math.min(9800, (options.brightness ?? 7200) + 1200),
      attack: 0.006,
      detune: options.harmonicDetune ?? 3,
    });
  }

  select() {
    this.roundedNote(523.25, 0, 0.19, 0.062, { endFrequency: 659.25, brightness: 7600 });
    this.tone(987.77, 0.055, 0.2, 0.028, "sine", { endFrequency: 1046.5, brightness: 9400 });
  }

  correct() {
    this.roundedNote(523.25, 0, 0.34, 0.064, { brightness: 7400 });
    this.roundedNote(659.25, 0.075, 0.39, 0.059, { brightness: 7800 });
    this.roundedNote(783.99, 0.155, 0.45, 0.054, { brightness: 8300 });
    this.tone(1046.5, 0.245, 0.56, 0.04, "sine", { brightness: 9600, attack: 0.007 });
  }

  incorrect() {
    this.roundedNote(392, 0, 0.34, 0.052, { endFrequency: 349.23, brightness: 6000 });
    this.roundedNote(293.66, 0.105, 0.42, 0.047, { brightness: 5600 });
    this.tone(440, 0.255, 0.34, 0.032, "sine", { brightness: 7200 });
  }

  transition() {
    this.roundedNote(261.63, 0, 0.42, 0.052, { brightness: 6200 });
    this.roundedNote(392, 0.1, 0.46, 0.05, { brightness: 7000 });
    this.roundedNote(523.25, 0.21, 0.52, 0.047, { brightness: 7900 });
    this.tone(659.25, 0.34, 0.62, 0.039, "sine", { brightness: 9200 });
  }

  tick(urgent = false) {
    this.tone(urgent ? 783.99 : 587.33, 0, 0.12, urgent ? 0.045 : 0.029, "sine", { brightness: 8600, attack: 0.006 });
  }

  finalQuestion() {
    this.roundedNote(196, 0, 0.56, 0.054, { brightness: 5200 });
    this.roundedNote(293.66, 0.13, 0.62, 0.051, { brightness: 6200 });
    this.roundedNote(440, 0.29, 0.7, 0.046, { brightness: 7400 });
    this.tone(587.33, 0.47, 0.72, 0.037, "sine", { brightness: 9000 });
  }

  rankUp() {
    this.roundedNote(523.25, 0, 0.22, 0.043, { brightness: 7600 });
    this.tone(659.25, 0.075, 0.27, 0.037, "sine", { brightness: 9000 });
  }

  start() {
    this.roundedNote(261.63, 0, 0.34, 0.051, { brightness: 6200 });
    this.roundedNote(392, 0.095, 0.4, 0.048, { brightness: 7200 });
    this.tone(523.25, 0.21, 0.5, 0.039, "sine", { brightness: 9000 });
  }
}

export const chillAudio = new ChillAudio();
