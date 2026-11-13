"use client";

import { useEffect, useRef } from "react";
import { PERSON } from "@/data/site";
import styles from "./Intro.module.css";

export default function Intro({
  visible,
  instant,
  onEnter,
}: {
  visible: boolean;
  /** Hide without the exit animation (page opened straight at a project). */
  instant: boolean;
  onEnter(): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !visible) return;
    enterRef.current?.focus({ preventScroll: true });

    let touchY: number | null = null;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY > 8 || Math.abs(e.deltaX) > 8) onEnter();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchY = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY;
      if (touchY !== null && y !== undefined && touchY - y > 40) {
        touchY = null;
        onEnter();
      }
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, [visible, onEnter]);

  return (
    <div ref={ref} className={styles.intro} data-visible={visible} data-instant={instant} inert={!visible}>
      <h1 className={styles.name}>
        {PERSON.name.split(" ").map((word) => (
          <span key={word}>{word}</span>
        ))}
      </h1>
      <div className={styles.foot}>
        <p className={styles.role}>{PERSON.role}</p>
        <p className={styles.headline}>{PERSON.headline}</p>
        <button ref={enterRef} type="button" className={styles.enter} onClick={onEnter}>
          Enter
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
