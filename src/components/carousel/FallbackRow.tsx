"use client";

import { useEffect, useRef } from "react";
import type { Card } from "@/data/site";
import styles from "./FallbackRow.module.css";

const hide = (img: HTMLImageElement) => {
  img.style.visibility = "hidden";
};

/** Flat scroll-snap row: phones, and desktops without WebGL. */
export default function FallbackRow({ cards, onOpen }: { cards: Card[]; onOpen(id: string): void }) {
  const rowRef = useRef<HTMLUListElement>(null);

  // A vertical mouse wheel scrolls the row sideways.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      row.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 16 : 1) });
    };
    row.addEventListener("wheel", onWheel, { passive: false });
    return () => row.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className={styles.wrap}>
      <ul ref={rowRef} className={styles.row} aria-label="Projects">
        {cards.map((card) => (
          <li key={card.id} className={styles.item}>
            <button type="button" className={styles.card} onClick={() => onOpen(card.id)}>
              <span className={styles.typo} aria-hidden="true">
                {card.short}
              </span>
              {card.cover && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.cover}
                  alt=""
                  className={styles.img}
                  draggable={false}
                  // onError can fire before hydration; re-check once the node is attached.
                  ref={(img) => {
                    if (img && img.complete && img.naturalWidth === 0) hide(img);
                  }}
                  onError={(e) => hide(e.currentTarget)}
                />
              )}
              <span className={styles.label}>
                <span className={styles.short}>{card.short}</span>
                <span className={styles.role}>{card.role}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
