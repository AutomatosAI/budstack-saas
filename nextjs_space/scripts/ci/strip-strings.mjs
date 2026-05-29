/**
 * Blanks string-literal, template-text, and comment characters from JS/TS
 * source so downstream lint gates can scan *code only* (avoiding false
 * positives from tokens that appear inside string literals or comments).
 *
 * Code inside template-literal `${...}` interpolations is preserved as code,
 * because it is real evaluated code (e.g. `${error.message}` is a genuine leak).
 *
 * Blanked characters become spaces; newlines are kept so line/column numbers
 * in the returned string match the original source.
 *
 * This is a lint helper, not a full parser — regex literals are treated as
 * code, so a regex containing unbalanced braces inside a `${}` interpolation
 * could mis-track interpolation nesting. That pattern does not occur in this
 * codebase's API responses, and the gate is advisory CI tooling.
 */
export function blankNonCode(src) {
  const out = src.split("");
  const n = src.length;
  // Context stack. Each frame: { type: 'code'|'sq'|'dq'|'tmpl', brace?: number }
  // 'code' frames track brace depth so a `}` closing a `${...}` interpolation
  // can be distinguished from a `}` that closes a nested block/object.
  const stack = [{ type: "code", brace: 0 }];

  const blank = (idx) => {
    const ch = out[idx];
    if (ch !== "\n" && ch !== "\r" && ch !== "\t") out[idx] = " ";
  };

  let i = 0;
  while (i < n) {
    const top = stack[stack.length - 1];
    const c = src[i];
    const c2 = src[i + 1];

    if (top.type === "code") {
      if (c === "/" && c2 === "/") {
        while (i < n && src[i] !== "\n") blank(i++);
        continue;
      }
      if (c === "/" && c2 === "*") {
        blank(i++);
        blank(i++);
        while (i < n && !(src[i] === "*" && src[i + 1] === "/")) blank(i++);
        if (i < n) {
          blank(i++);
          blank(i++);
        }
        continue;
      }
      if (c === "'") {
        stack.push({ type: "sq" });
        blank(i++);
        continue;
      }
      if (c === '"') {
        stack.push({ type: "dq" });
        blank(i++);
        continue;
      }
      if (c === "`") {
        stack.push({ type: "tmpl" });
        blank(i++);
        continue;
      }
      if (c === "{") {
        top.brace++;
        i++;
        continue;
      }
      if (c === "}") {
        if (top.brace === 0 && stack.length > 1) {
          // Closes a `${...}` interpolation — return to the template frame.
          stack.pop();
          i++;
          continue;
        }
        if (top.brace > 0) top.brace--;
        i++;
        continue;
      }
      i++;
      continue;
    }

    if (top.type === "sq" || top.type === "dq") {
      const quote = top.type === "sq" ? "'" : '"';
      if (c === "\\") {
        blank(i++);
        if (i < n) blank(i++);
        continue;
      }
      if (c === quote) {
        blank(i++);
        stack.pop();
        continue;
      }
      if (c === "\n") {
        // Unterminated string — recover by returning to code.
        stack.pop();
        i++;
        continue;
      }
      blank(i++);
      continue;
    }

    // template literal text
    if (c === "\\") {
      blank(i++);
      if (i < n) blank(i++);
      continue;
    }
    if (c === "`") {
      blank(i++);
      stack.pop();
      continue;
    }
    if (c === "$" && c2 === "{") {
      // Enter interpolation: keep `${` as code so identifiers inside survive.
      i += 2;
      stack.push({ type: "code", brace: 0 });
      continue;
    }
    blank(i++);
  }

  return out.join("");
}

/**
 * Returns the 1-based { line, col } for a character offset in `src`.
 */
export function offsetToLineCol(src, offset) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < src.length; i++) {
    if (src[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

/**
 * Walks from the index of an opening `(` to its matching `)` in already
 * string-blanked code. Returns the index of the matching `)`, or -1.
 */
export function matchParen(blanked, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < blanked.length; i++) {
    const c = blanked[i];
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
