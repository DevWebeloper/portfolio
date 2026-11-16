"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { CARDS, type Card } from "@/data/site";
import { sheetRect } from "@/components/sheet";
import AboutBody from "./AboutBody";
import DeviceFrame from "./DeviceFrame";
import styles from "./ProjectPanel.module.css";

const subscribeResize = (l: () => void) => {
  window.addEventListener("resize", l);
  return () => window.removeEventListener("resize", l);
};
const readSize = () => `${window.innerWidth}x${window.innerHeight}`;

const pad = (n: number) => String(n).padStart(2, "0");

export default function ProjectPanel({
  card,
  index,
  onClose,
  onPrev,
  onNext,
}: {
  card: Card;
  index: number;
  total: number;
  onClose(): void;
  onPrev(): void;
  onNext(): void;
}) {
  const size = useSyncExternalStore(subscribeResize, readSize, () => "1280x800");
  const [vw, vh] = size.split("x").map(Number);
  const r = sheetRect(vw, vh);
  const sheetRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const next = CARDS[(index + 1) % CARDS.length];
  // The card the panel opened on; after Previous / Next the content enters at once.
  const [firstId] = useState(card.id);

  const projects = CARDS.filter((c) => c.kind !== "about");
  const pIndex = projects.findIndex((c) => c.id === card.id);

  // Focus in on open; hand focus back to where it was (if it still exists) on close.
  // Layout effect: read activeElement before the browser's focus fixup blurs the
  // skip-list button that Experience makes `inert` in this same commit.
  // Kept in a ref so a Strict Mode re-run (focus already inside) doesn't lose it.
  const backRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const prev = document.activeElement;
    if (prev instanceof HTMLElement && prev !== document.body && !sheet?.contains(prev)) {
      backRef.current = prev;
    }
    scrollRef.current?.focus({ preventScroll: true });
    return () => {
      requestAnimationFrame(() => {
        const back = backRef.current;
        // Still inside the panel (Strict Mode re-mount) or gone: leave focus alone.
        if (!back?.isConnected || back.closest("[inert]") || sheet?.isConnected) return;
        back.focus({ preventScroll: true });
      });
    };
  }, []);

  // The panel stays mounted across Prev / Next: start each project at the top.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = 0;
    // Stepped from the "Next" block at the bottom: don't leave focus off-screen.
    if (scroller.contains(document.activeElement) && document.activeElement !== scroller) {
      scroller.focus({ preventScroll: true });
    }
  }, [card.id]);

  return (
    <div className={styles.layer}>
      <button type="button" className={styles.backdrop} aria-label="Close project" tabIndex={-1} onClick={onClose} />
      <section
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className={styles.sheet}
        data-stepped={card.id !== firstId || undefined}
        style={{ left: r.x, top: r.y, width: r.w, height: r.h, borderRadius: r.radius }}
      >
        <header className={styles.bar}>
          {card.kind === "about" ? (
            <p className={styles.count} aria-label="About me">
              About
            </p>
          ) : (
            <p className={styles.count} aria-label={`Project ${pIndex + 1} of ${projects.length}`}>
              {pad(pIndex + 1)} / {pad(projects.length)}
            </p>
          )}
          <nav className={styles.actions} aria-label="Project controls">
            <button type="button" onClick={onPrev}>
              Previous
            </button>
            <button type="button" onClick={onNext}>
              Next
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </nav>
        </header>

        <div ref={scrollRef} className={styles.scroll} tabIndex={-1}>
          {/* Keyed so Previous / Next replays the content entrance. */}
          <div key={card.id} className={styles.content}>
            {card.kind === "about" ? (
              <AboutBody />
            ) : (
              <div className={styles.body}>
                <header className={styles.intro}>
                  <p className={styles.eyebrow}>{card.kind === "site" ? "Client website" : "Open-source app"}</p>
                  <h2 className={styles.name}>{card.name}</h2>
                  <p className={styles.summary}>{card.summary}</p>
                  <div className={styles.ctaRow}>
                    <a href={card.url} target="_blank" rel="noopener noreferrer" className={styles.primary}>
                      Visit {card.linkLabel} <span aria-hidden="true">↗</span>
                    </a>
                    {card.meta && <span className={styles.metaPill}>{card.meta}</span>}
                  </div>
                </header>
  
                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>Role</dt>
                    <dd>{card.role}</dd>
                  </div>
                  {card.years && (
                    <div className={styles.fact}>
                      <dt>Years</dt>
                      <dd>{card.years}</dd>
                    </div>
                  )}
                  {card.stack.length > 0 && (
                    <div className={styles.fact}>
                      <dt>Stack</dt>
                      <dd>
                        <ul className={styles.chips}>
                          {card.stack.map((tech) => (
                            <li key={tech}>{tech}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
  
                <div className={styles.showcase}>
                  <DeviceFrame key={card.id} card={card} />
                </div>
              </div>
            )}
  
            <div className={styles.after}>
              <button type="button" className={styles.next} onClick={onNext}>
                <span className={styles.nextLabel}>Next</span>
                <span className={styles.nextName}>
                  {next.name} <span aria-hidden="true">→</span>
                </span>
              </button>
              <button type="button" className={styles.close} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
