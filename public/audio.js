const STORAGE_KEY = "quiz-and-chill-muted";
const MUSIC_VOLUME_KEY = "quiz-and-chill-music-volume";
const MUSIC_MUTED_KEY = "quiz-and-chill-music-muted";
const MUSIC_BASE_GAIN = 0.18;
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
    effectsGain.gain.value = 0.86;
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    delay.delayTime.value = 0.065;
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 4800;
    feedback.gain.value = 0.02;
    wet.gain.value = 0.018;
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
      const progress = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      const nextVolume = from + (safeTarget - from) * progress;
      this.musicTrack.volume = Math.max(0, Math.min(1, nextVolume));
      if (progress < 1) this.musicFadeFrame = requestAnimationFrame(step);
      else {
        this.musicFadeFrame = null;
        onComplete?.();
      }
    };
    this.musicFadeFrame = requestAnimationFrame(step);
  }

  resonantMallet(frequency, duration = 0.28, volume = 0.045, brightness = 5200, offset = 0) {
    if (this.muted || !this.context || this.context.state !== "running") return;
    this.ensureEffectsBus();
    const start = this.context.currentTime + offset;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = brightness;
    filter.Q.value = 0.42;
    filter.connect(this.effectsBus);
    const partials = [
      { ratio: 1, level: 1, decay: 1, detune: 0 },
      { ratio: 2.01, level: 0.1, decay: 0.44, detune: 0 },
      { ratio: 3.97, level: 0.018, decay: 0.22, detune: 0 },
    ];
    for (const partial of partials) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const partialDuration = duration * partial.decay;
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * partial.ratio;
      oscillator.detune.value = partial.detune;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume * partial.level, start + 0.009);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + partialDuration);
      oscillator.connect(gain).connect(filter);
      oscillator.start(start);
      oscillator.stop(start + partialDuration + 0.02);
    }
  }

  softArpeggio(frequencies, step = 0.085, duration = 0.46, volume = 0.036, brightness = 6800, offset = 0) {
    frequencies.forEach((frequency, index) => {
      const taper = 1 - index * 0.08;
      this.resonantMallet(frequency, duration, volume * taper, brightness + index * 350, offset + index * step);
    });
  }

  select() {
    this.resonantMallet(261.63, 0.17, 0.044, 4800);
  }

  correct() {
    this.resonantMallet(220, 0.28, 0.018, 5200);
    this.softArpeggio([440, 554.37, 659.25, 880], 0.078, 0.42, 0.043, 6800);
  }

  incorrect() {
    this.resonantMallet(220, 0.38, 0.047, 4200);
    this.resonantMallet(277.18, 0.34, 0.029, 4700);
  }

  transition() {
    this.softArpeggio([261.63, 392, 523.25, 659.25], 0.092, 0.48, 0.034, 6500);
  }

  tick(countdown = 2, offset = 0) {
    const step = Math.max(1, Math.min(3, Number(countdown) || 2));
    const frequency = step === 3 ? 220 : step === 2 ? 246.94 : 293.66;
    const duration = step === 3 ? 0.18 : step === 2 ? 0.21 : 0.25;
    const volume = step === 3 ? 0.03 : step === 2 ? 0.034 : 0.041;
    this.resonantMallet(frequency, duration, volume, step === 1 ? 5200 : 4600, offset);
  }

  finalQuestion() {
    this.softArpeggio([146.83, 220, 293.66, 440], 0.115, 0.58, 0.042, 5400);
  }

  rankUp() {
    this.resonantMallet(392, 0.3, 0.041, 6200);
    this.resonantMallet(587.33, 0.34, 0.03, 7000);
  }

  createRoom() {
    this.resonantMallet(293.66, 0.24, 0.035, 5400);
    this.resonantMallet(440, 0.28, 0.024, 6200);
  }

  lobbyStart() {
    this.resonantMallet(220, 0.3, 0.036, 5200);
    this.resonantMallet(329.63, 0.34, 0.027, 5900);
  }

  start(offset = 0) {
    this.resonantMallet(196, 0.48, 0.028, 5000, offset);
    this.softArpeggio([261.63, 392, 523.25], 0.085, 0.58, 0.046, 6500, offset);
  }
}

export const chillAudio = new ChillAudio();

