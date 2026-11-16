"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { CARDS, PERSON } from "@/data/site";
import Chrome from "@/components/Chrome";
import CarouselCanvas from "@/components/carousel/CarouselCanvas";
import FallbackRow from "@/components/carousel/FallbackRow";
import ProjectPanel from "@/components/panel/ProjectPanel";
import { anchorDirectHash, clearHash, pushHash, replaceHash, useHash, useMedia } from "@/components/stores";
import styles from "./Experience.module.css";

// The hash the page was loaded with (client only); null on the server and while hydrating.
const LOAD_HASH = typeof window === "undefined" ? "" : window.location.hash;
const noSubscribe = () => () => {};

export default function Experience() {
  const hash = useHash();
  const openIndex = CARDS.findIndex((c) => c.id === hash);
  const open = openIndex >= 0 ? CARDS[openIndex] : null;

  // No splash gate any more: the wall opens resting on the About card, so a
  // visitor sees who this is and the work without a click.
  const entered = true;
  // Opened straight at a card (#gtai): no grow-from-card animation on first paint.
  // "init" lasts until we know whether the page loaded with a card hash; the hash
  // store reads "" while hydrating, so this can't be decided in a state initializer.
  const [phase, setPhase] = useState<"init" | "direct" | "normal">("init");
  if (phase === "init" && open) setPhase("direct");
  if (phase === "direct" && !open) setPhase("normal");
  const loadHash = useSyncExternalStore(noSubscribe, () => LOAD_HASH, () => null);
  if (phase === "init" && loadHash !== null && !CARDS.some((c) => `#${c.id}` === loadHash)) setPhase("normal");
  const direct = phase !== "normal";

  const wide = useMedia("(min-width: 768px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)") ?? false;
  const [glFailed, setGlFailed] = useState(false);
  const mode = wide === null ? null : wide && !glFailed ? "gl" : "row";

  const onFail = useCallback(() => setGlFailed(true), []);
  const openCard = useCallback((id: string) => pushHash(id), []);

  useEffect(() => {
    if (CARDS.some((c) => `#${c.id}` === window.location.hash)) anchorDirectHash();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        e.preventDefault();
        clearHash();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const step = (d: number) => replaceHash(CARDS[(openIndex + d + CARDS.length) % CARDS.length].id);

  return (
    <main className={styles.root}>
      {mode === "gl" && (
        <CarouselCanvas
          cards={CARDS}
          entered={entered}
          openId={open?.id ?? null}
          reducedMotion={reduced}
          onOpen={openCard}
          onFail={onFail}
        />
      )}
      {/* No visible h1 on the wall itself; this names the page for screen readers and search. */}
      <h1 className="sr-only">{`${PERSON.name}, ${PERSON.role}`}</h1>

      {/* display: contents keeps these wrappers out of layout; they only make the
          background inert while a panel (aria-modal) is open. */}
      <div style={{ display: "contents" }} inert={!!open}>
        {mode === "row" && entered && <FallbackRow cards={CARDS} onOpen={openCard} />}
      </div>

      {mode === "gl" && entered && (
        <nav className={styles.skipList} aria-label="Projects" inert={!!open}>
          {CARDS.map((c) => (
            <button key={c.id} type="button" onClick={() => openCard(c.id)}>
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <div style={{ display: "contents" }} inert={!!open}>
        <Chrome visible={entered} />
      </div>

      {open && (
        <div
          className={styles.panelLayer}
          data-anim={mode === "gl" && !reduced && !direct ? "grow" : "fade"}
          data-mode={mode}
        >
          <ProjectPanel
            card={open}
            index={openIndex}
            total={CARDS.length}
            onClose={clearHash}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
          />
        </div>
      )}
    </main>
  );
}
