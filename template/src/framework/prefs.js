/**
 * Viewer preferences that outlive a reload — language and theme.
 *
 * Three sources, in precedence order:
 *   1. the query string  (?lang=th&theme=light)  — a link that opens the deck
 *      already in Thai, which is how you hand it to someone
 *   2. localStorage      — so the choice survives a reload mid-talk
 *   3. the fallback      — English, dark
 *
 * The value is mirrored onto <html> as an attribute (lang=, data-theme=) BEFORE
 * React mounts, so the first paint is already correct rather than flashing.
 *
 * Why the query string and not the hash: the hash is the deck's own navigation
 * state (#12.3) and is rewritten on every beat. The query sits beside it and
 * survives those rewrites untouched, so neither has to know about the other.
 *
 * Safe to import at build time: every DOM and storage access is guarded, and
 * localStorage is wrapped because it throws outright in some privacy modes.
 */
import { useSyncExternalStore } from "react";

const hasDOM = typeof document !== "undefined";

function readStore(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function writeStore(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* private mode: the URL still carries it */ }
}

export function definePref({ ns, name, values, fallback, attr }) {
  const key = ns + ":" + name;
  const ok = (v) => v != null && values.includes(v);

  let current = fallback;
  if (hasDOM) {
    const fromQuery = new URLSearchParams(window.location.search).get(name);
    const fromStore = readStore(key);
    current = ok(fromQuery) ? fromQuery : ok(fromStore) ? fromStore : fallback;
  }

  const listeners = new Set();

  /* Keep <html> and the URL in step with the value. The URL is rewritten
     with the CURRENT hash appended, so a beat is never lost by a theme flip. */
  function reflect() {
    if (!hasDOM) return;
    document.documentElement.setAttribute(attr, current);
    try {
      const url = new URLSearchParams(window.location.search);
      url.set(name, current);
      window.history.replaceState(null, "", "?" + url.toString() + window.location.hash);
    } catch {
      /* Some browsers refuse a replaceState that changes the query of a
         file:// URL. The deck still works — the choice is in localStorage
         and on <html> — only the shareable ?lang= link is lost. */
    }
  }

  if (hasDOM) document.documentElement.setAttribute(attr, current);

  return {
    get: () => current,
    set(v) {
      if (!ok(v) || v === current) return;
      current = v;
      writeStore(key, v);
      reflect();
      listeners.forEach((f) => f());
    },
    cycle() {
      this.set(values[(values.indexOf(current) + 1) % values.length]);
    },
    subscribe(f) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    use() {
      return useSyncExternalStore(this.subscribe, () => current, () => fallback);
    }
  };
}
