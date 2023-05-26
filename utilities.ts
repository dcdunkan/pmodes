import { getCategory } from "./vendor/esm.sh/unicode-properties@1.4.1.js";

export function isWordCharacter(code: number) {
  switch (getUnicodeSimpleCategory(code)) {
    case UnicodeSimpleCategory.Letter:
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Number:
      return true;
    default:
      return code == "_".codePointAt(0);
  }
}

export function isAlpha(c: string) {
  return ("A" <= c && c <= "Z") || ("a" <= c && c <= "z");
}

export function isDigit(c: string) {
  return "0" <= c && c <= "9";
}

export function isAlphaOrDigit(c: string) {
  return isAlpha(c) || isDigit(c);
}

export function isAlphaDigitOrUnderscore(c: string) {
  return isAlphaOrDigit(c) || c === "_";
}

export function isAlphaDigitUnderscoreOrMinus(c: string) {
  return isAlphaOrDigit(c) || c === "_" || c === "-";
}

export enum UnicodeSimpleCategory {
  Unknown,
  Letter,
  DecimalNumber,
  Number,
  Separator,
}

export function getUnicodeSimpleCategory(
  codepoint: number,
): UnicodeSimpleCategory {
  const category = getCategory(codepoint);
  if (category === "Nd") return UnicodeSimpleCategory.DecimalNumber;
  if (category[0] === "L") return UnicodeSimpleCategory.Letter;
  if (category[0] === "N") return UnicodeSimpleCategory.Number;
  if (category[0] === "Z") return UnicodeSimpleCategory.Separator;
  return UnicodeSimpleCategory.Unknown;
}

export function isHashtagLetter(codepoint: number): boolean {
  if (
    codepoint == "_".codePointAt(0) || codepoint == 0x200c ||
    codepoint == 0xb7 || (0xd80 <= codepoint && codepoint <= 0xdff)
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
