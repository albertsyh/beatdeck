/* One owner for the handout naming, shared by check-layout, make-dist and
   publish. src/deck.jsx repeats the same rule inline (it cannot import
   tools/), so change both together. */
export const handoutThemes = (config) =>
  config.theme?.print ? [config.theme.print] : (config.theme?.options || ["light"]);
export const pdfFile = (config, lang, theme) => `${config.name}-${lang}-${theme}.pdf`;
