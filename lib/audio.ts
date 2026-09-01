// Lightweight sound engine using the Web Audio API — synthesised SFX plus a
// simple ambient BGM pad, so there are no audio asset files to ship. Respects a
// global mute flag persisted in localStorage.

import {
  getBrowserStorage,
  readStoredValue,
  writeMigratedStorageValue,
} from "./storage";

type Sfx =
  | "click"
  | "buy"
  | "sell"
  | "build"
  | "hire"
  | "turn"
  | "good"
  | "bad"
  | "win";

let ctx: AudioContext | null = null;
let muted = false;
let bgmGain: GainNode | null = null;
let bgmTimer: ReturnType<typeof setInterval> | null = null;
export const AUDIO_MUTE_KEY = "dragon-mountain-city-muted";
export const LEGACY_AUDIO_MUTE_KEYS = ["uc-muted"] as const;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function readMutePreference(storage: Storage): boolean {
  const stored = readStoredValue(
    storage,
    AUDIO_MUTE_KEY,
    LEGACY_AUDIO_MUTE_KEYS,
  );
  if (stored) {
    writeMigratedStorageValue(
      storage,
      AUDIO_MUTE_KEY,
      LEGACY_AUDIO_MUTE_KEYS,
      stored.value,
    );
  }
  return stored?.value === "1";
}

export function initAudio(): void {
  const storage = getBrowserStorage();
  if (!storage) return;
  muted = readMutePreference(storage);
  ensureCtx();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  const storage = getBrowserStorage();
  if (storage) {
    writeMigratedStorageValue(
      storage,
      AUDIO_MUTE_KEY,
      LEGACY_AUDIO_MUTE_KEYS,
      value ? "1" : "0",
    );
  }
  if (value) stopBgm();
}

function tone(freq: number, durMs: number, type: OscillatorType, gain: number, delay = 0): void {
  const c = ensureCtx();
  if (!c || muted) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = c.currentTime + delay;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gain, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(start);
  osc.stop(start + durMs / 1000 + 0.02);
}

export function playSfx(name: Sfx): void {
  if (muted) return;
  switch (name) {
    case "click":
      tone(420, 60, "triangle", 0.05);
      break;
    case "buy":
      tone(523, 90, "sine", 0.08);
      tone(784, 110, "sine", 0.06, 0.06);
      break;
    case "sell":
      tone(659, 90, "sine", 0.08);
      tone(440, 110, "sine", 0.06, 0.06);
      break;
    case "build":
      tone(300, 80, "square", 0.05);
      tone(360, 120, "square", 0.05, 0.07);
      break;
    case "hire":
      tone(587, 90, "triangle", 0.07);
      tone(880, 130, "triangle", 0.06, 0.08);
      break;
    case "turn":
      tone(392, 100, "sine", 0.06);
      tone(523, 120, "sine", 0.05, 0.08);
      break;
    case "good":
      [523, 659, 784].forEach((f, i) => tone(f, 140, "sine", 0.07, i * 0.07));
      break;
    case "bad":
      [392, 311].forEach((f, i) => tone(f, 180, "sawtooth", 0.06, i * 0.08));
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 200, "triangle", 0.08, i * 0.1));
      break;
  }
}

// Simple BGM: a slow arpeggio whose mood (major/minor) follows the game state.
export function startBgm(mood: "bright" | "tense" | "neutral"): void {
  const c = ensureCtx();
  if (!c || muted) return;
  stopBgm();
  bgmGain = c.createGain();
  bgmGain.gain.value = 0.03;
  bgmGain.connect(c.destination);

  const scales: Record<typeof mood, number[]> = {
    bright: [261.6, 329.6, 392.0, 523.3],
    neutral: [261.6, 311.1, 392.0, 466.2],
    tense: [220.0, 261.6, 311.1, 415.3],
  };
  const notes = scales[mood];
  let i = 0;
  const step = () => {
    if (!bgmGain || muted) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.value = notes[i % notes.length];
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.5, c.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.6);
    osc.connect(g).connect(bgmGain);
    osc.start();
    osc.stop(c.currentTime + 0.65);
    i++;
  };
  bgmTimer = setInterval(step, 650);
}

export function stopBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain) {
    bgmGain.disconnect();
    bgmGain = null;
  }
}
