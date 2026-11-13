"use client";

import { useCallback, useEffect, useState } from "react";
import { CARDS } from "@/data/site";
import Chrome from "@/components/Chrome";
import Intro from "@/components/Intro";
import CarouselCanvas from "@/components/carousel/CarouselCanvas";
import FallbackRow from "@/components/carousel/FallbackRow";
import ProjectPanel from "@/components/panel/ProjectPanel";
import { anchorDirectHash, clearHash, pushHash, replaceHash, useHash, useMedia } from "@/components/stores";
import styles from "./Experience.module.css";

export default function Experience() {
  const hash = useHash();
  const openIndex = CARDS.findIndex((c) => c.id === hash);
  const open = openIndex >= 0 ? CARDS[openIndex] : null;

  const [entered, setEntered] = useState(false);
  // Opened straight at a project (#gtai): skip the intro without animating it.
  const [direct, setDirect] = useState(false);
  if (open && !entered) {
    setEntered(true);
    setDirect(true);
  }
  if (!open && direct) setDirect(false);

  const wide = useMedia("(min-width: 768px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)") ?? false;
  const [glFailed, setGlFailed] = useState(false);
  const mode = wide === null ? null : wide && !glFailed ? "gl" : "row";

  const enter = useCallback(() => setEntered(true), []);
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
      } else if (e.key === "Enter" && !entered) {
        setEntered(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, entered]);

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
      {mode === "row" && entered && <FallbackRow cards={CARDS} onOpen={openCard} />}

      {mode === "gl" && entered && (
        <nav className={styles.skipList} aria-label="Projects" inert={!!open}>
          {CARDS.map((c) => (
            <button key={c.id} type="button" onClick={() => openCard(c.id)}>
              {c.name}
            </button>
          ))}
        </nav>
      )}

      <Chrome visible={entered} />
      <Intro visible={!entered} instant={direct} onEnter={enter} />

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
