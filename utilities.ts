import { areTypedArraysEqual, CODEPOINTS, encode } from "./encode.ts";
import { getUnicodeSimpleCategory, UnicodeSimpleCategory } from "./unicode.ts";

export function CHECK(condition: boolean) {
  if (!condition) console.trace("check failed");
}

export function LOG_CHECK(condition: boolean, ...messages: unknown[]) {
  if (!condition) console.trace("Check failed: ", ...messages);
}

export function UNREACHABLE(): never {
  throw new Error("UNREACHABLE");
}

export function isWordCharacter(code: number) {
  switch (getUnicodeSimpleCategory(code)) {
    case UnicodeSimpleCategory.Letter:
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Number:
      return true;
    default:
      return code === CODEPOINTS["_"];
  }
}

export function tolowerBeginsWith(str: Uint8Array, prefix: string | Uint8Array): boolean {
  prefix = typeof prefix === "string" ? encode(prefix) : prefix;
  if (prefix.length > str.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (toLower(str[i]) !== prefix[i]) {
      return false;
    }
  }
  return true;
}

export function toLower(codepoint: number): number;
export function toLower(data: Uint8Array): Uint8Array;
export function toLower(c: number | Uint8Array): Uint8Array | number {
  return typeof c === "number"
    ? (CODEPOINTS["A"] <= c && c <= CODEPOINTS["Z"]) ? c - CODEPOINTS["A"] + CODEPOINTS["a"] : c
    : Uint8Array.from(c.map((code) => toLower(code)));
}

export function split(s: Uint8Array, delimiter: number = CODEPOINTS[" "]): Uint8Array[] {
  const delimiterPos = s.indexOf(delimiter);
  if (delimiterPos === -1) {
    return [s];
  } else {
    return [s.slice(0, delimiterPos), s.slice(delimiterPos + 1)];
  }
}

export function fullSplit(
  s: Uint8Array,
  delimiter = CODEPOINTS[" "],
  maxParts = Number.MAX_SAFE_INTEGER,
): Uint8Array[] {
  const result: Uint8Array[] = [];
  if (s.length === 0) {
    return result;
  }
  while (result.length + 1 < maxParts) {
    const delimiterPos = s.indexOf(delimiter);
    if (delimiterPos === -1) break;
    result.push(s.slice(0, delimiterPos));
    s = s.slice(delimiterPos + 1);
  }
  result.push(s);
  return result;
}

export function beginsWith(str: Uint8Array, prefix: string | Uint8Array): boolean {
  prefix = typeof prefix === "string" ? encode(prefix) : prefix;
  return prefix.length <= str.length && areTypedArraysEqual(str.slice(0, prefix.length), prefix);
}

export function endsWith(str: Uint8Array, suffix: string | Uint8Array): boolean {
  suffix = typeof suffix === "string" ? encode(suffix) : suffix;
  return suffix.length <= str.length && areTypedArraysEqual(str.slice(str.length - suffix.length), suffix);
}

export function isSpace(codepoint: number): boolean {
  return (codepoint === CODEPOINTS[" "] || codepoint === CODEPOINTS["\t"] || codepoint === CODEPOINTS["\r"] ||
    codepoint === CODEPOINTS["\n"] || codepoint === CODEPOINTS["\0"] || codepoint === CODEPOINTS["\v"]);
}

export function isAlpha(codepoint: number): boolean {
  return (CODEPOINTS["A"] <= codepoint && codepoint <= CODEPOINTS["Z"]) ||
    (CODEPOINTS["a"] <= codepoint && codepoint <= CODEPOINTS["z"]);
}

export function isAlpha2(codepoint: number): boolean {
  codepoint |= 0x20;
  return CODEPOINTS["a"] <= codepoint && codepoint <= CODEPOINTS["z"];
}

export function isAlNum(codepoint: number): boolean {
  return isAlpha2(codepoint) || isDigit(codepoint);
}

export function isDigit(codepoint: number): boolean {
  return CODEPOINTS["0"] <= codepoint && codepoint <= CODEPOINTS["9"];
}

export function isAlphaOrDigit(codepoint: number): boolean {
  return isAlpha(codepoint) || isDigit(codepoint);
}

export function isAlphaDigitOrUnderscore(codepoint: number): boolean {
  return isAlphaOrDigit(codepoint) || codepoint === CODEPOINTS["_"];
}

export function isAlphaDigitUnderscoreOrMinus(codepoint: number): boolean {
  return isAlphaOrDigit(codepoint) || codepoint === CODEPOINTS["_"] || codepoint === CODEPOINTS["-"];
}

export function isHexDigit(codepoint: number) {
  if (isDigit(codepoint)) return true;
  codepoint |= 0x20;
  return CODEPOINTS["a"] <= codepoint && codepoint <= CODEPOINTS["f"];
}

export function hexToInt(codepoint: number) {
  if (isDigit(codepoint)) return codepoint - CODEPOINTS["0"];
  codepoint |= 0x20;
  if (CODEPOINTS["a"] <= codepoint && codepoint <= CODEPOINTS["f"]) {
    return codepoint - CODEPOINTS["a"] + 10;
  }
  return 16;
}

export function isHashtagLetter(codepoint: number): boolean {
  if (
    codepoint === CODEPOINTS["_"] || codepoint === 0x200c ||
    codepoint === 0xb7 || (0xd80 <= codepoint && codepoint <= 0xdff)
  ) {
    return true;
  }
  switch (getUnicodeSimpleCategory(codepoint)) {
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Letter:
      return true;
    default:
      return false;
  }
}
