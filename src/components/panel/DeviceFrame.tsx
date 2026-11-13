import type { CSSProperties } from "react";
import type { Card } from "@/data/site";
import styles from "./DeviceFrame.module.css";

/**
 * Phone (client sites) or desktop window (apps), drawn in CSS. Motion comes from
 * the `--p` custom property set by PinnedDevice on an ancestor.
 */
export default function DeviceFrame({ card }: { card: Card }) {
  if (card.kind === "site") {
    return (
      <div className={styles.phone}>
        <div className={styles.screen}>
          {/* Two counter-moving transforms: the track moves down by p × screen
              height, the capture up by p × its own height, so at p = 1 the
              capture's bottom sits on the screen's bottom. No measuring needed. */}
          <div className={styles.track}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={card.device[0]} alt={`${card.name} on a phone`} className={styles.capture} draggable={false} />
          </div>
        </div>
        <span className={styles.island} aria-hidden="true" />
      </div>
    );
  }

  const n = card.device.length;
  return (
    <div className={styles.window}>
      <div className={styles.titlebar} aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className={styles.view}>
        {card.device.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${card.name} screenshot ${i + 1} of ${n}`}
            className={styles.shot}
            style={{ "--at": i === 0 ? -1 : i / n } as CSSProperties}
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
