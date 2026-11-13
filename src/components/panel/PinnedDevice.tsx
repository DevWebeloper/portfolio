"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Card } from "@/data/site";
import DeviceFrame from "./DeviceFrame";
import styles from "./PinnedDevice.module.css";

/**
 * A tall section of the panel's own scroll with a sticky stage. While the stage is
 * pinned, progress 0 → 1 is written to `--p` on the section and CSS does the rest:
 * the capture inside the phone moves, the screenshots in the window cross-fade and
 * the side notes fade in. The pin only exists on wide screens without reduced motion
 * (see the media query in the CSS); elsewhere `--p` is simply unused.
 */
export default function PinnedDevice({ card, scrollRef }: { card: Card; scrollRef: RefObject<HTMLElement | null> }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!scroller || !section || !stage) return;

    let frame = 0;
    let last = -1;
    const update = () => {
      frame = 0;
      const travel = section.offsetHeight - stage.offsetHeight;
      const passed = scroller.getBoundingClientRect().top - section.getBoundingClientRect().top;
      const p = travel > 0 ? Math.min(1, Math.max(0, passed / travel)) : 0;
      const rounded = Math.round(p * 10000) / 10000;
      if (rounded === last) return;
      last = rounded;
      section.style.setProperty("--p", String(rounded));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    scroller.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(scroller);
    ro.observe(section);
    return () => {
      scroller.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scrollRef]);

  const hasDevice = card.device.length > 0;

  return (
    <section ref={sectionRef} className={styles.section} data-kind={card.kind} data-device={hasDevice || undefined}>
      <div ref={stageRef} className={styles.stage}>
        <div className={`${styles.note} ${styles.left}`}>
          <p className={styles.label}>{card.role}</p>
          <p className={styles.summary}>{card.summary}</p>
        </div>

        {hasDevice && (
          <div className={styles.device}>
            <DeviceFrame card={card} />
          </div>
        )}

        <div className={`${styles.note} ${styles.right}`}>
          <p className={styles.label}>Stack</p>
          <ul className={styles.stack}>
            {card.stack.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          {card.meta && <p className={styles.extra}>{card.meta}</p>}
          <a href={card.url} target="_blank" rel="noopener noreferrer" className={styles.link}>
            {card.linkLabel} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
