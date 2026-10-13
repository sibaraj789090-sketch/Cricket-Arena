/**
 * Cricket Arena — Audio Manager
 * Handles Hindi-style festive background music and game sound effects.
 * Includes automatic audio asset loading with procedural Indian folk synthesizer fallback.
 */

// Storage keys for persisting sound preferences
const BGM_STORAGE_KEY = 'cricket_arena_ludo_bgm';
const SFX_STORAGE_KEY = 'cricket_arena_ludo_sfx';
const MASTER_SOUND_KEY = 'cricket_arena_ludo_master_sound';

class LudoAudioManager {
  private bgmAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private synthLoopTimer: number | null = null;
  private synthMasterGain: GainNode | null = null;
  private isUsingSynthFallback = false;
  private isBgmPlaying = false;
  private hasUserInteracted = false;
  private listenersAttached = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.attachAutoplayUnlocker();
    }
  }

  /**
   * Unlock Web Audio & HTML5 Audio after first user touch/click
   */
  private attachAutoplayUnlocker() {
    if (this.listenersAttached || typeof window === 'undefined') return;
    this.listenersAttached = true;

    const unlock = () => {
      this.hasUserInteracted = true;
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (this.isBgmEnabled() && !this.isBgmPlaying) {
        this.startBgm();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
  }

  public isMasterSoundEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(MASTER_SOUND_KEY);
    return val !== 'false';
  }

  public setMasterSoundEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(MASTER_SOUND_KEY, enabled ? 'true' : 'false');
    this.setBgmEnabled(enabled);
    this.setSfxEnabled(enabled);
  }

  public isBgmEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    if (!this.isMasterSoundEnabled()) return false;
    const val = localStorage.getItem(BGM_STORAGE_KEY);
    return val !== 'false'; // Enabled by default
  }

  public setBgmEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(BGM_STORAGE_KEY, enabled ? 'true' : 'false');
    if (enabled) {
      this.startBgm();
    } else {
      this.pauseBgm();
    }
  }

  public isSfxEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    if (!this.isMasterSoundEnabled()) return false;
    const val = localStorage.getItem(SFX_STORAGE_KEY);
    return val !== 'false'; // Enabled by default
  }

  public setSfxEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(SFX_STORAGE_KEY, enabled ? 'true' : 'false');
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    return this.audioCtx;
  }

  /**
   * Starts background music without restarting if already playing.
   */
  public startBgm() {
    if (!this.isBgmEnabled() || this.isBgmPlaying) return;

    // First try loading royalty-free audio file from public assets
    if (!this.bgmAudio) {
      try {
        const audio = new Audio('/audio/hindi_ludo_bgm.mp3');
        audio.loop = true;
        audio.volume = 0.22; // Comfortable low background volume

        audio.addEventListener('error', () => {
          // File missing or unplayable -> fall back to procedural Indian synthesizer
          this.isUsingSynthFallback = true;
          this.startSynthHindiBgm();
        });

        audio.addEventListener('canplaythrough', () => {
          this.isUsingSynthFallback = false;
        });

        this.bgmAudio = audio;
      } catch (err) {
        this.isUsingSynthFallback = true;
      }
    }

    if (!this.isUsingSynthFallback && this.bgmAudio) {
      this.bgmAudio
        .play()
        .then(() => {
          this.isBgmPlaying = true;
        })
        .catch(() => {
          // Browser prevented autoplay or file was missing -> switch to synth
          this.isUsingSynthFallback = true;
          this.startSynthHindiBgm();
        });
    } else {
      this.startSynthHindiBgm();
    }
  }

  public pauseBgm() {
    this.isBgmPlaying = false;
    if (this.bgmAudio) {
      try {
        this.bgmAudio.pause();
      } catch (e) {}
    }
    this.stopSynthHindiBgm();
  }

  /**
   * Procedural Indian Festive / Folk Background Music Synthesizer (Raag Bilawal / Folk scale)
   * Runs in Web Audio API with zero external dependencies and zero network lag.
   */
  private startSynthHindiBgm() {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.stopSynthHindiBgm();
    this.isBgmPlaying = true;

    // Master gain for BGM
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.18, ctx.currentTime); // Low background level
    masterGain.connect(ctx.destination);
    this.synthMasterGain = masterGain;

    // Indian folk melody notes (frequencies in Hz: C4, D4, E4, G4, A4, C5, D5, E5)
    // Upbeat folk pattern (Teental / Keherwa rhythm feel)
    const melodyPattern = [
      { f: 523.25, d: 0.25 }, // C5
      { f: 440.0, d: 0.25 },  // A4
      { f: 392.0, d: 0.25 },  // G4
      { f: 329.63, d: 0.25 }, // E4
      { f: 392.0, d: 0.5 },   // G4
      { f: 440.0, d: 0.5 },   // A4
      { f: 523.25, d: 0.25 }, // C5
      { f: 587.33, d: 0.25 }, // D5
      { f: 523.25, d: 0.5 },  // C5
      { f: 440.0, d: 0.25 },  // A4
      { f: 392.0, d: 0.25 },  // G4
      { f: 329.63, d: 0.5 },  // E4
      { f: 293.66, d: 0.5 },  // D4
      { f: 261.63, d: 0.75 }, // C4
      { f: 329.63, d: 0.25 }, // E4
      { f: 392.0, d: 0.5 },   // G4
      { f: 440.0, d: 0.5 },   // A4
      { f: 523.25, d: 1.0 },  // C5
    ];

    // Tanpura continuous drone (C3 = 130.81Hz, G3 = 196.0Hz)
    const droneOsc1 = ctx.createOscillator();
    const droneOsc2 = ctx.createOscillator();
    const droneGain = ctx.createGain();
    droneOsc1.type = 'sawtooth';
    droneOsc2.type = 'triangle';
    droneOsc1.frequency.setValueAtTime(130.81, ctx.currentTime);
    droneOsc2.frequency.setValueAtTime(196.0, ctx.currentTime);
    droneGain.gain.setValueAtTime(0.04, ctx.currentTime);

    // Soft lowpass filter to make tanpura warm and gentle
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    droneOsc1.connect(filter);
    droneOsc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(masterGain);

    droneOsc1.start();
    droneOsc2.start();

    let noteIdx = 0;
    let stepCount = 0;

    const playNextStep = () => {
      if (!this.isBgmPlaying || !this.synthMasterGain) {
        try {
          droneOsc1.stop();
          droneOsc2.stop();
        } catch (e) {}
        return;
      }

      const note = melodyPattern[noteIdx];
      noteIdx = (noteIdx + 1) % melodyPattern.length;
      stepCount++;

      const now = ctx.currentTime;

      // 1. Sitar/Flute-like plucked melody note
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, now);
      // Slight pitch bend characteristic of Indian meend/gamak
      if (stepCount % 3 === 0) {
        osc.frequency.linearRampToValueAtTime(note.f * 1.05, now + 0.05);
        osc.frequency.linearRampToValueAtTime(note.f, now + 0.12);
      }

      noteGain.gain.setValueAtTime(0.09, now);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + note.d);

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start(now);
      osc.stop(now + note.d);

      // 2. Dholak / Tabla rhythmic pulse on beat 1 and beat 3
      if (stepCount % 2 === 0) {
        // Deep bass dholak thump
        const drumOsc = ctx.createOscillator();
        const drumGain = ctx.createGain();
        drumOsc.type = 'sine';
        drumOsc.frequency.setValueAtTime(110, now);
        drumOsc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
        drumGain.gain.setValueAtTime(0.12, now);
        drumGain.gain.linearRampToValueAtTime(0.001, now + 0.15);
        drumOsc.connect(drumGain);
        drumGain.connect(masterGain);
        drumOsc.start(now);
        drumOsc.stop(now + 0.15);
      } else {
        // Crisp high tabla snap
        const snapOsc = ctx.createOscillator();
        const snapGain = ctx.createGain();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(360, now);
        snapOsc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
        snapGain.gain.setValueAtTime(0.06, now);
        snapGain.gain.linearRampToValueAtTime(0.001, now + 0.08);
        snapOsc.connect(snapGain);
        snapGain.connect(masterGain);
        snapOsc.start(now);
        snapOsc.stop(now + 0.08);
      }

      // Schedule next note
      const delayMs = note.d * 1000;
      this.synthLoopTimer = window.setTimeout(playNextStep, delayMs);
    };

    playNextStep();
  }

  private stopSynthHindiBgm() {
    if (this.synthLoopTimer) {
      clearTimeout(this.synthLoopTimer);
      this.synthLoopTimer = null;
    }
    if (this.synthMasterGain) {
      try {
        this.synthMasterGain.disconnect();
      } catch (e) {}
      this.synthMasterGain = null;
    }
  }

  /**
   * Sound effects synthesizer (dice roll, token move, capture, six, win, chat)
   */
  public playSfx(type: 'dice' | 'move' | 'capture' | 'win' | 'six' | 'chat') {
    if (!this.isSfxEnabled()) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      const now = ctx.currentTime;

      if (type === 'dice') {
        // Multi-click rattling 3D dice roll sound
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(280 + i * 40, now + i * 0.04);
          osc.frequency.exponentialRampToValueAtTime(120, now + (i + 1) * 0.04);
          gain.gain.setValueAtTime(0.2, now + i * 0.04);
          gain.gain.linearRampToValueAtTime(0.01, now + (i + 1) * 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.04);
          osc.stop(now + (i + 1) * 0.04);
        }
      } else if (type === 'move') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'capture') {
        // Dramatic strike and score transfer sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(820, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.28);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.28);
      } else if (type === 'six') {
        // Cheerful three-tone fanfare
        [523.25, 659.25, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.25, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0.01, now + (idx + 1) * 0.08);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + (idx + 1) * 0.08);
        });
      } else if (type === 'win') {
        // Festive celebratory Indian shehnai-style victory melody
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.3, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(0.01, now + (idx + 1) * 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + (idx + 1) * 0.12);
        });
      } else if (type === 'chat') {
        // Subtle, cheerful two-tone quick-chat message pop
        [659.25, 880].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          gain.gain.setValueAtTime(0.18, now + idx * 0.06);
          gain.gain.linearRampToValueAtTime(0.001, now + (idx + 1) * 0.06);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + (idx + 1) * 0.06);
        });
      }
    } catch (e) {}
  }
}

// Global audio singleton
export const ludoAudio = new LudoAudioManager();
