const STORAGE_KEY = "quiz-and-chill-muted";
const MUSIC_VOLUME_KEY = "quiz-and-chill-music-volume";
const MUSIC_MUTED_KEY = "quiz-and-chill-music-muted";
const MUSIC_BASE_GAIN = 0.28;
const MUSIC_TRACK_URL = "/audio/morning-atrium.mp3";

class ChillAudio {
  constructor() {
    this.context = null;
    this.muted = localStorage.getItem(STORAGE_KEY) === "true";
    this.musicMuted = localStorage.getItem(MUSIC_MUTED_KEY) === "true";
    const storedMusicVolume = localStorage.getItem(MUSIC_VOLUME_KEY);
    const savedMusicVolume = storedMusicVolume === null ? Number.NaN : Number(storedMusicVolume);
    this.musicVolume = Number.isFinite(savedMusicVolume) ? Math.max(0, Math.min(1, savedMusicVolume)) : 0.6;
    this.musicTrack = new Audio(MUSIC_TRACK_URL);
    this.musicTrack.loop = true;
    this.musicTrack.preload = "auto";
    this.musicTrack.volume = 0;
    this.musicFadeFrame = null;
    this.sceneLevel = 1;
  }

  async unlock() {
    if (this.muted) return;
    try {
      this.context ??= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === "suspended") await this.context.resume();
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
