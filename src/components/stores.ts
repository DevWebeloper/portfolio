"use client";

import { useSyncExternalStore } from "react";

/* ---------- URL hash ---------- */

const hashListeners = new Set<() => void>();
let hashBound = false;
/** True while the open project's history entry sits on top of a carousel entry we can go back to. */
let openWasPushed = false;

function emitHash() {
  hashListeners.forEach((l) => l());
}

function subscribeHash(listener: () => void) {
  hashListeners.add(listener);
  if (!hashBound) {
    hashBound = true;
    window.addEventListener("hashchange", () => {
      // A hash typed in the address bar or reached with back/forward is its own entry.
      openWasPushed = window.location.hash.length > 1;
      emitHash();
    });
  }
  return () => {
    hashListeners.delete(listener);
  };
}

const readHash = () => decodeURIComponent(window.location.hash.slice(1));

export function useHash(): string {
  return useSyncExternalStore(subscribeHash, readHash, () => "");
}

const bareUrl = () => window.location.pathname + window.location.search;

/** Open a project: pushes `#id` so browser back returns to the carousel. */
export function pushHash(id: string) {
  window.history.pushState(window.history.state, "", `#${id}`);
  openWasPushed = true;
  emitHash();
}

/** Switch project without adding history (prev / next). */
export function replaceHash(id: string) {
  window.history.replaceState(window.history.state, "", `#${id}`);
  emitHash();
}

/** Close the open project. */
export function clearHash() {
  if (openWasPushed) {
    openWasPushed = false;
    window.history.back();
    return;
  }
  window.history.replaceState(window.history.state, "", bareUrl());
  emitHash();
}

/**
 * Page loaded directly at `#id`: slip a bare carousel entry underneath so that
 * browser back (or close) lands on the carousel instead of leaving the site.
 */
export function anchorDirectHash() {
  const hash = window.location.hash;
  if (hash.length < 2 || openWasPushed) return;
  const state = window.history.state;
  window.history.replaceState(state, "", bareUrl());
  window.history.pushState(state, "", hash);
  openWasPushed = true;
}

/* ---------- Media queries ---------- */

/** `null` until hydrated, so nothing media-dependent renders on the server. */
export function useMedia(query: string): boolean | null {
  return useSyncExternalStore(
    (listener) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", listener);
      return () => mql.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => null,
  );
}
