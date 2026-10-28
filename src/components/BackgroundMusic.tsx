"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Music, VolumeX } from "lucide-react";

const VIDEO_ID = "5_5eTTFxFTY";
// Volume follows cursor distance to the button: MAX_VOLUME far away, MIN_VOLUME on top of it.
const MIN_VOLUME = 5;
const MAX_VOLUME = 100;
const FALLOFF_RADIUS = 600; // px

interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onAutoplayBlocked?: () => void;
      };
    }
  ) => YTPlayer;
  PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeApi(): Promise<YTNamespace> {
  return new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve(window.YT);
      return;
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT as YTNamespace);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(tag);
    }
  });
}

export const BackgroundMusic: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wantPlayRef = useRef(true);
  const volumeRef = useRef(30);
  const [playing, setPlaying] = useState(false);

  const start = useCallback(() => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    p.unMute();
    p.setVolume(volumeRef.current);
    p.playVideo();
  }, []);

  // Quieter as the cursor approaches the button, louder as it moves away.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const btn = buttonRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const dist = Math.hypot(
        e.clientX - (r.left + r.width / 2),
        e.clientY - (r.top + r.height / 2)
      );
      const t = Math.max(0, 1 - dist / FALLOFF_RADIUS);
      const vol = Math.round(MAX_VOLUME - (MAX_VOLUME - MIN_VOLUME) * t);
      if (vol === volumeRef.current) return;
      volumeRef.current = vol;
      if (readyRef.current) playerRef.current?.setVolume(vol);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Browsers block unmuted autoplay until a user gesture; retry on each one
    // until playback actually starts (the first may land before the player is ready).
    const onGesture = () => {
      if (wantPlayRef.current) start();
    };
    const events = ["pointerdown", "keydown", "touchend"] as const;
    const remove = () =>
      events.forEach((ev) => window.removeEventListener(ev, onGesture));
    events.forEach((ev) => window.addEventListener(ev, onGesture));

    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: VIDEO_ID,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          playsinline: 1,
          loop: 1,
          playlist: VIDEO_ID,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            if (wantPlayRef.current) start();
          },
          onStateChange: (e) => {
            setPlaying(e.data === YT.PlayerState.PLAYING);
            if (e.data === YT.PlayerState.PLAYING) remove();
            if (e.data === YT.PlayerState.ENDED) {
              playerRef.current?.seekTo(0, true);
              playerRef.current?.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      remove();
      playerRef.current?.destroy();
      playerRef.current = null;
      readyRef.current = false;
    };
  }, [start]);

  const toggle = () => {
    const p = playerRef.current;
    if (!p || !readyRef.current) return;
    if (playing) {
      wantPlayRef.current = false;
      p.pauseVideo();
    } else {
      wantPlayRef.current = true;
      start();
    }
  };

  return (
    <>
      {/* Off-screen player: audio only */}
      <div
        aria-hidden
        className="fixed -left-[9999px] top-0 w-[200px] h-[200px] pointer-events-none overflow-hidden"
      >
        <div ref={mountRef} />
      </div>

      <button
        ref={buttonRef}
        onClick={toggle}
        data-cursor="MUSIC"
        title={playing ? "Pause background music" : "Play background music"}
        aria-label={playing ? "Pause background music" : "Play background music"}
        aria-pressed={playing}
        className={`fixed bottom-4 right-4 z-50 p-2.5 border backdrop-blur-md transition-all ${
          playing
            ? "bg-rose-600/25 border-rose-500 text-rose-300"
            : "bg-white/5 border-white/15 text-zinc-400 hover:text-white"
        }`}
      >
        {playing ? (
          <Music className="w-4 h-4 animate-pulse" />
        ) : (
          <VolumeX className="w-4 h-4" />
        )}
      </button>
    </>
  );
};
