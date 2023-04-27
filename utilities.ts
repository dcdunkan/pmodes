import { getUnicodeSimpleCategory, UnicodeSimpleCategory } from "./unicode.ts";

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

export function isAlphaOrDigit(c: string) {
  return ("0" <= c && c <= "9") || ("A" <= c && c <= "Z") ||
    ("a" <= c && c <= "z");
}

export function isAlphaDigitOrUnderscore(c: string) {
  return isAlphaOrDigit(c) || c === "_";
}

export function isHashtagLetter(c: number) {
  const category = getUnicodeSimpleCategory(c);
  if (
    c == "_".charCodeAt(0) || c == 0x200c || c == 0xb7 ||
    (0xd80 <= c && c <= 0xdff)
  ) {
    return true;
  }
  switch (category) {
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Letter:
      return true;
    default:
      return false;
  }
}
