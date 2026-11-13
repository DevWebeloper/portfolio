"use client";

import { useEffect, useRef } from "react";
import type { Card } from "@/data/site";
import type { Engine } from "./engine";
import styles from "./CarouselCanvas.module.css";

interface Props {
  cards: Card[];
  entered: boolean;
  openId: string | null;
  reducedMotion: boolean;
  onOpen(id: string): void;
  onFail(): void;
}

/** Full-screen WebGL wall of cards. Calls `onFail` if WebGL can't start or is lost. */
export default function CarouselCanvas(props: Props) {
  const { entered, openId, reducedMotion } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let engine: Engine | null = null;

    import("./engine")
      .then(({ createEngine }) => {
        if (cancelled) return;
        const p = propsRef.current;
        engine = createEngine(host, {
          cards: p.cards,
          onOpen: (id) => propsRef.current.onOpen(id),
          onFail: () => propsRef.current.onFail(),
        });
        if (!engine) {
          p.onFail();
          return;
        }
        engine.setReduced(p.reducedMotion);
        engine.setOpen(p.openId);
        engine.setEntered(p.entered);
        engineRef.current = engine;
      })
      .catch(() => {
        if (!cancelled) propsRef.current.onFail();
      });

    return () => {
      cancelled = true;
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setReduced(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    engineRef.current?.setOpen(openId);
  }, [openId]);

  useEffect(() => {
    engineRef.current?.setEntered(entered);
  }, [entered]);

  return <div ref={hostRef} className={styles.host} data-entered={entered} aria-hidden="true" />;
}
