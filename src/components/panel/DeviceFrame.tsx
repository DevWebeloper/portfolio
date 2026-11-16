"use client";

import { useState } from "react";
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
              <div className={styles.screen}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.device[0]}
                  alt={`${card.name} on a phone`}
                  className={styles.capture}
                  draggable={false}
                />
              </div>
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
