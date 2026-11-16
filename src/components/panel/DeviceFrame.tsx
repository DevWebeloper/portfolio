"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/data/site";
import styles from "./DeviceFrame.module.css";

/**
 * Static device showcase: browser + overlapping auto-scrolling phone for client
 * sites, or interactive screenshot window + thumbnails for desktop apps.
 */
export default function DeviceFrame({ card }: { card: Card }) {
  const [active, setActive] = useState(0);

  if (card.kind === "site") {
    const desktop = card.cover?.replace("/thumbs/", "/");
    return (
      <figure className={styles.figure}>
        <div className={styles.stage}>
          <div className={styles.browser}>
            <div className={styles.titlebar}>
              <div className={styles.dots} aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div className={styles.address}>{card.linkLabel}</div>
            </div>
            <div className={styles.browserView}>
              {desktop && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={desktop}
                  alt={`${card.name}, desktop home page`}
                  className={styles.desktopShot}
                  draggable={false}
                />
              )}
            </div>
          </div>

          {card.device[0] && (
            <div className={styles.phone}>
              <PhoneScreen src={card.device[0]} alt={`${card.name} on a phone`} />
              <span className={styles.island} aria-hidden="true" />
            </div>
          )}
        </div>
        <figcaption className={styles.caption}>
          The desktop and mobile layouts of the site.
        </figcaption>
      </figure>
    );
  }

  const n = card.device.length;
  if (n === 0) return null;
  const current = active < n ? active : 0;

  return (
    <div className={styles.appShowcase}>
      <div className={styles.window}>
        <div className={styles.titlebar}>
          <div className={styles.dots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span className={styles.windowTitle}>{card.name}</span>
        </div>
        <div className={styles.windowView}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={card.device[current]}
            alt={`${card.name} screenshot ${current + 1} of ${n}`}
            className={styles.shot}
            draggable={false}
          />
        </div>
      </div>

      {n > 1 && (
        <div className={styles.thumbs}>
          {card.device.map((src, i) => (
            <button
              key={src}
              type="button"
              className={styles.thumb}
              aria-label={`Show screenshot ${i + 1}`}
              aria-pressed={i === current}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`${card.name} screenshot ${i + 1} of ${n}`}
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full sweep top to bottom, as the old CSS animation took. */
const SWEEP_MS = 38000;
/** Rest at each end, and before the first sweep so the hero is seen first. */
const HOLD_MS = 1200;
/** Quiet time after the visitor's last scroll or touch before it drives again. */
const RESUME_MS = 2500;

const easeInOut = (t: number) =>
  t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

/**
 * The phone's screen: a real scroll box that pans itself slowly up and down,
 * and hands over to the visitor while they hover, focus, wheel or touch it.
 */
function PhoneScreen({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let hovered = false;
    let focused = false;
    let lastTouch = -Infinity; // last wheel/touch time
    let dir = 1; // 1 down, -1 up
    let leg: { from: number; to: number; start: number; ms: number } | null = null;
    let holdUntil = performance.now() + HOLD_MS;
    let raf = 0;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return;
      if (hovered || focused || now - lastTouch < RESUME_MS) {
        leg = null; // pick up from wherever the visitor left it
        holdUntil = Math.max(holdUntil, now + 400);
        return;
      }
      if (now < holdUntil) return;
      if (!leg) {
        const from = el.scrollTop;
        if (dir > 0 && from >= max - 1) dir = -1;
        else if (dir < 0 && from <= 1) dir = 1;
        const to = dir > 0 ? max : 0;
        const ms = Math.max(3000, (SWEEP_MS * Math.abs(to - from)) / max);
        leg = { from, to, start: now, ms };
      }
      const t = Math.min(1, (now - leg.start) / leg.ms);
      el.scrollTop = leg.from + (leg.to - leg.from) * easeInOut(t);
      if (t >= 1) {
        leg = null;
        dir = -dir;
        holdUntil = now + HOLD_MS;
      }
    };
    raf = requestAnimationFrame(tick);

    const enter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovered = true;
    };
    const leave = () => (hovered = false);
    const touched = () => (lastTouch = performance.now());
    const onFocus = () => (focused = true);
    const onBlur = () => (focused = false);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    el.addEventListener("wheel", touched, { passive: true });
    el.addEventListener("touchstart", touched, { passive: true });
    el.addEventListener("touchmove", touched, { passive: true });
    el.addEventListener("focus", onFocus);
    el.addEventListener("blur", onBlur);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
      el.removeEventListener("wheel", touched);
      el.removeEventListener("touchstart", touched);
      el.removeEventListener("touchmove", touched);
      el.removeEventListener("focus", onFocus);
      el.removeEventListener("blur", onBlur);
    };
  }, [src]);

  return (
    <div
      ref={ref}
      className={styles.screen}
      tabIndex={0}
      role="region"
      aria-label={`${alt}, scrollable`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={styles.capture} draggable={false} />
    </div>
  );
}
