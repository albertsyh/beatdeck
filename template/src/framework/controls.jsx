/**
 * Language + theme: the preferences, the switches in the chrome, the
 * keyboard shortcuts (L / T), and the hooks slides read copy through.
 *
 *   const deck = createDeckControls({ ns: "my-deck", strings, themes: ["light","dark"],
 *                                     defaultTheme: "light", useFlow });
 *   const { useStrings, Label, LangTheme, MENU_TEXT, lang, theme } = deck;
 *
 * Both render trees — the deck and the print sheet — subscribe to the same
 * store, so the PDF exports in whatever language is on screen.
 *
 * Strings modules must carry a `ui` block (see strings/en.js) and a
 * `labels` map keyed by slide id for the chrome and the contents menu.
 */
import { useEffect } from "react";
import { definePref } from "./prefs.js";

const ThemeIcon = ({ mode }) => (
  <svg className="ctl-i" viewBox="0 0 24 24" aria-hidden="true" focusable="false"
       fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {mode === "light" ? (
      <>
        <circle cx="12" cy="12" r="4" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <line key={a} x1="12" y1="2.6" x2="12" y2="5.2" transform={`rotate(${a} 12 12)`} />
        ))}
      </>
    ) : (
      <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
    )}
  </svg>
);

export function createDeckControls({ ns, strings, themes = ["light", "dark"], defaultTheme = "light", useFlow = () => false }) {
  const { LANGS, LANG_ORDER, DEFAULT_LANG } = strings;

  const lang = definePref({ ns, name: "lang", values: LANG_ORDER, fallback: DEFAULT_LANG, attr: "lang" });
  const theme = definePref({ ns, name: "theme", values: themes, fallback: defaultTheme, attr: "data-theme" });

  const useStrings = () => LANGS[lang.use()];
  const multiLang = LANG_ORDER.length > 1;
  const multiTheme = themes.length > 1;

  /* Presentational, mounted TWICE at most (chrome + a landing slide), which
     is why the key handling lives in LangTheme below and not here. */
  function Switches({ part, className, compact }) {
    const code = lang.use();
    const mode = theme.use();
    const t = LANGS[code];
    const nextTheme = themes[(themes.indexOf(mode) + 1) % themes.length];
    const ui = t.ui || {};

    if (compact) {
      return (
        <span className={className}>
          {part !== "theme" && multiLang && (
            /* every name stacked in one grid cell so the button keeps the
               width of the widest name in every language */
            <button type="button" className="ctl ctl--solo ctl--swap"
              aria-label={`${ui.langGroup || "Language"}: ${ui.langFull?.[code] || code}`}
              onClick={(e) => { e.stopPropagation(); lang.cycle(); }}>
              {LANG_ORDER.map((c) => (
                <span key={c} lang={c} className={"ctl-swap" + (c === code ? " is-on" : "")}>
                  {ui.langNames?.[c] || c}
                </span>
              ))}
            </button>
          )}
          {part !== "lang" && multiTheme && (
            <button type="button" className="ctl ctl--icon ctl--solo"
              aria-label={ui.themeFull?.[nextTheme] || nextTheme}
              onClick={(e) => { e.stopPropagation(); theme.cycle(); }}>
              <ThemeIcon mode={nextTheme} />
            </button>
          )}
        </span>
      );
    }

    return (
      <span className={className}>
        {part !== "theme" && multiLang && (
          <span className="ctl-group" role="group" aria-label={ui.langGroup || "Language"}>
            {LANG_ORDER.map((c) => (
              <button key={c} type="button" className="ctl" lang={c}
                aria-pressed={c === code}
                aria-label={ui.langFull?.[c] || c}
                onClick={(e) => { e.stopPropagation(); lang.set(c); }}>
                {ui.langNames?.[c] || c}
              </button>
            ))}
          </span>
        )}
        {part !== "lang" && multiTheme && (
          <span className="ctl-group" role="group" aria-label={ui.themeGroup || "Theme"}>
            {themes.map((m) => (
              <button key={m} type="button" className="ctl ctl--icon"
                aria-pressed={m === mode}
                aria-label={ui.themeFull?.[m] || m}
                onClick={(e) => { e.stopPropagation(); theme.set(m); }}>
                <ThemeIcon mode={m} />
                {part === "theme" && <span className="ctl-t">{ui.themeNames?.[m] || m}</span>}
              </button>
            ))}
          </span>
        )}
      </span>
    );
  }

  /* The controls in the chrome. Mounted ONCE by mountDeck, so the two
     effects have exactly one owner. */
  function LangTheme() {
    const t = LANGS[lang.use()];
    useEffect(() => { if (t.meta?.title) document.title = t.meta.title; }, [t]);
    useEffect(() => {
      const onKey = (e) => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        if (k === "l" && multiLang) { lang.cycle(); e.preventDefault(); }
        else if (k === "t" && multiTheme) { theme.cycle(); e.preventDefault(); }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }, []);
    if (!multiLang && !multiTheme) return null;
    return <Switches className="switches" compact={useFlow()} />;
  }

  /* A chrome label that follows the language. */
  const Label = ({ id }) => {
    const t = useStrings();
    const s = t.labels?.[id];
    if (s === undefined) throw new Error(`labels.${id} is missing from strings (${lang.get()})`);
    return s;
  };

  const MENU_DEFAULTS = { title: "Contents", hint: "M or Esc to close", openLabel: "Contents", closeLabel: "Close contents" };
  const MenuText = ({ k }) => {
    const m = useStrings().ui?.menu || {};
    return m[k] ?? MENU_DEFAULTS[k];
  };
  const MENU_TEXT = {
    title: <MenuText k="title" />,
    hint: <MenuText k="hint" />,
    openLabel: <MenuText k="openLabel" />,
    closeLabel: <MenuText k="closeLabel" />
  };

  return { lang, theme, useStrings, Switches, LangTheme, Label, MENU_TEXT };
}
