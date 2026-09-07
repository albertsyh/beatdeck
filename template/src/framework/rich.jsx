/**
 * The tiny markup the strings modules are written in.
 *
 * Copy lives as plain strings (see strings/) so the font subsetter and the
 * shape checker can walk it. But slide copy still needs a few inline roles, so
 * strings carry four markers and this file turns them into elements:
 *
 *     **bold**   -> <b>          emphasis inside a sentence
 *     _italic_   -> <em>         a stressed word
 *     [[slot]]   -> <span class="slot">   a placeholder the speaker fills in
 *     \n         -> <br>         a hard line break
 *
 * Deliberately not Markdown: four markers, no nesting, no parser. If a slide
 * ever needs more than this, it wants a component, not more syntax.
 */
import { Fragment } from "react";

/* One pass, longest marker first so ** is never read as two _ delimiters. */
const TOKEN = /\*\*([\s\S]+?)\*\*|\[\[([\s\S]+?)\]\]|_([^_\n]+?)_|\n/g;

export function rich(str) {
  if (str == null) return null;
  const s = String(str);
  const out = [];
  let last = 0;
  let m;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(s)) !== null) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const key = "r" + m.index;
    if (m[1] !== undefined) out.push(<b key={key}>{m[1]}</b>);
    else if (m[2] !== undefined) out.push(<span className="slot" key={key}>{m[2]}</span>);
    else if (m[3] !== undefined) out.push(<em key={key}>{m[3]}</em>);
    else out.push(<br key={key} />);
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out.length === 1 ? out[0] : <Fragment>{out}</Fragment>;
}
