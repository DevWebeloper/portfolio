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
const CLOSE_OUT_MS = 260; // matches the panel's exit animation in Experience.module.css

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

  // Closing plays in two beats: the sheet's content leaves (CLOSE_OUT_MS), then
  // the engine shrinks the blank card back onto the wall. Until then the panel
  // stays mounted with the last card and the engine still sees it as open.
  const [lastOpen, setLastOpen] = useState(open);
  const [closing, setClosing] = useState<typeof open>(null);
  if (open !== lastOpen) {
    setClosing(!open && lastOpen && mode === "gl" && !reduced ? lastOpen : null);
    setLastOpen(open);
  }
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setClosing(null), CLOSE_OUT_MS);
    return () => clearTimeout(t);
  }, [closing]);
  const shown = open ?? closing;
  const shownIndex = shown ? CARDS.indexOf(shown) : -1;

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
          openId={shown?.id ?? null}
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

      {shown && (
        <div
          className={styles.panelLayer}
          data-anim={mode === "gl" && !reduced && !direct ? "grow" : "fade"}
          data-mode={mode}
          data-closing={!open || undefined}
          inert={!open}
        >
          <ProjectPanel
            card={shown}
            index={shownIndex}
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
