import { useEffect, useRef, useState } from 'react';

// All from freesound.org (CC BY 4.0, or CC0 for the bite and glass), credited in CreditsModal and the README.
const TRACK = '/audio/456797__nikosardas__jazz_music_loop.mp3';
// Mix levels at full master volume.
const MUSIC_LEVEL = 0.35;
const EFFECTS = {
  plateBreak: { src: '/audio/381264__edwar64896__plate-5_1.mp3', level: 0.6 },
  pageTurn: { src: '/audio/63318__flag2__page-turn-please-turn-over-pto-paper_turn_over.wav', level: 0.7 },
  bite: { src: '/audio/353067__jofae__bite-cartoon-style.mp3', level: 0.8 },
  gameOver: { src: '/audio/536763__egomassive__glass.mp3', level: 0.7 },
};
export type Effect = keyof typeof EFFECTS;
const MUTE_KEY = 'grubblio:muted';
const VOLUME_KEY = 'grubblio:volume';

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable — the setting just won't be remembered.
  }
}

function loadVolume() {
  const v = Number(load(VOLUME_KEY) ?? 1);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
}

/**
 * Loops the background music at `rate`× speed (pitch is preserved) and plays
 * sound effects; one mute switch and master volume cover both. Browsers only
 * allow audio after a user gesture, so the music starts on the first click or
 * key press, and pauses while the tab is hidden.
 */
export function useSound(rate: number) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const effectsRef = useRef<Record<Effect, HTMLAudioElement> | null>(null);
  const [muted, setMuted] = useState(() => load(MUTE_KEY) === '1');
  const [volume, setVolumeState] = useState(loadVolume);

  useEffect(() => {
    const audio = new Audio(TRACK);
    audio.loop = true;
    audioRef.current = audio;
    effectsRef.current = Object.fromEntries(
      Object.entries(EFFECTS).map(([name, { src }]) => [name, new Audio(src)]),
    ) as Record<Effect, HTMLAudioElement>;
    return () => {
      audio.pause();
      audioRef.current = null;
      effectsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current!;
    if (muted) {
      audio.pause();
      return;
    }
    const start = () => {
      if (!document.hidden) audio.play().catch(() => {});
    };
    const onVisibility = () => (document.hidden ? audio.pause() : start());
    start();
    window.addEventListener('pointerdown', start);
    window.addEventListener('keydown', start);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [muted]);

  useEffect(() => {
    audioRef.current!.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    audioRef.current!.volume = MUSIC_LEVEL * volume;
    for (const [name, el] of Object.entries(effectsRef.current!)) {
      el.volume = EFFECTS[name as Effect].level * volume;
    }
  }, [volume]);

  const setMute = (next: boolean) => {
    setMuted(next);
    save(MUTE_KEY, next ? '1' : '0');
  };

  const toggle = () => setMute(!muted);

  /** Sets the master volume (0–1). Turning it up while muted unmutes. */
  const setVolume = (v: number) => {
    setVolumeState(v);
    save(VOLUME_KEY, String(v));
    if (muted && v > 0) setMute(false);
  };

  const play = (effect: Effect) => {
    const el = effectsRef.current?.[effect];
    if (muted || !el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  };

  return { muted, toggle, volume, setVolume, play };
}
