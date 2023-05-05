import { getCategory } from "https://esm.sh/unicode-properties@1.4.1";

export function isWordCharacter(code: number) {
  switch (getUnicodeSimpleCategory(code)) {
    case UnicodeSimpleCategory.Letter:
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Number:
      return true;
    default:
      return code == "_".charCodeAt(0);
  }
}

export function isDigit(c: string) {
  return "0" <= c && c <= "9";
}

export function isAlphaOrDigit(c: string) {
  return isDigit(c) || ("A" <= c && c <= "Z") || ("a" <= c && c <= "z");
}

export function isAlphaDigitOrUnderscore(c: string) {
  return isAlphaOrDigit(c) || c === "_";
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
    codepoint == "_".charCodeAt(0) || codepoint == 0x200c ||
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
