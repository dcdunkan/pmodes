import { type MessageEntity, MessageEntityType } from "./types.ts";
import { getUnicodeSimpleCategory, UnicodeSimpleCategory } from "./unicode.ts";

// deno-fmt-ignore
export const CODEPOINTS = {
  "\t": 9, "\r": 13, "\0": 0, "\v": 11, "\n": 10, "<": 60, ">": 62, '"': 34,
  " ": 32, "@": 64, "/": 47, "#": 35, ".": 46, ",": 44, "+": 43, "-": 45, "_": 95,
  "$": 36, ":": 58, "0": 48, "9": 57, "A": 65, "Z": 90, "a": 97, "g": 103, "o": 111,
  "n": 110, "t": 116, "z": 122, "?": 63, "[": 91, "]": 93, "{": 123, "}": 125,
  "(": 40, ")": 41, "`": 96, "'": 39, "~": 126, "T": 84, "2": 50, "3": 51, "5": 53,
  "6": 54,
};

export function CHECK(condition: boolean) {
  if (!condition) {
    console.trace("check failed");
  }
}

export function LOG_CHECK(condition: boolean, ...message: unknown[]) {
  if (!condition) {
    console.trace("Check failed: ", ...message);
  }
}

export function isWordCharacter(code: number) {
  switch (getUnicodeSimpleCategory(code)) {
    case UnicodeSimpleCategory.Letter:
    case UnicodeSimpleCategory.DecimalNumber:
    case UnicodeSimpleCategory.Number:
      return true;
    default:
      return code == CODEPOINTS["_"];
  }
}

export function toLower(codepoint: number): number;
export function toLower(data: Uint8Array): Uint8Array;
export function toLower(c: number | Uint8Array): Uint8Array | number {
  return typeof c === "number"
    ? (CODEPOINTS["A"] <= c && c <= CODEPOINTS["Z"]) ? c - CODEPOINTS["A"] + CODEPOINTS["a"] : c
    : new Uint8Array(c.map((code) => toLower(code)));
}

export function split(s: Uint8Array, delimiter: number = CODEPOINTS[" "]): Uint8Array[] {
  const delimiterPos = s.indexOf(delimiter);
  if (delimiterPos == -1) {
    return [s];
  } else {
    return [s.subarray(0, delimiterPos), s.subarray(delimiterPos + 1)];
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
    result.push(s.subarray(0, delimiterPos));
    s = s.subarray(delimiterPos + 1);
  }
  result.push(s);
  return result;
}

export function areTypedArraysEqual(a: Uint8Array, b: Uint8Array) {
  return a.byteLength === b.byteLength && !a.some((val, i) => val !== b[i]);
}

export function beginsWith(str: Uint8Array, prefix: Uint8Array) {
  return prefix.length <= str.length &&
    areTypedArraysEqual(str.subarray(0, prefix.length), prefix);
}

export function endsWith(str: Uint8Array, suffix: Uint8Array) {
  return suffix.length <= str.length &&
    areTypedArraysEqual(str.subarray(str.length - suffix.length), suffix);
}

export function isSpace(char: string): boolean;
export function isSpace(codepoint: number): boolean;
export function isSpace(c: string | number): boolean {
  return typeof c === "string"
    ? (c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\0" || c === "\v")
    : (c == CODEPOINTS[" "] || c == CODEPOINTS["\t"] || c == CODEPOINTS["\r"] || c == CODEPOINTS["\n"] ||
      c == CODEPOINTS["\0"] || c == CODEPOINTS["\v"]);
}

export function isAlpha(char: string): boolean;
export function isAlpha(codepoint: number): boolean;
export function isAlpha(c: string | number): boolean {
  return typeof c === "string"
    ? ("A" <= c && c <= "Z") || ("a" <= c && c <= "z")
    : (CODEPOINTS["A"] <= c && c <= CODEPOINTS["Z"]) || (CODEPOINTS["a"] <= c && c <= CODEPOINTS["z"]);
}

export function isDigit(char: string): boolean;
export function isDigit(codepoint: number): boolean;
export function isDigit(c: string | number): boolean {
  return typeof c === "string" ? ("0" <= c && c <= "9") : (CODEPOINTS["0"] <= c && c <= CODEPOINTS["9"]);
}

export function isAlphaOrDigit(char: string): boolean;
export function isAlphaOrDigit(codepoint: number): boolean;
export function isAlphaOrDigit(c: string | number): boolean {
  return typeof c === "string" ? isAlpha(c) || isDigit(c) : isAlpha(c) || isDigit(c);
}

export function isAlphaDigitOrUnderscore(char: string): boolean;
export function isAlphaDigitOrUnderscore(codepoint: number): boolean;
export function isAlphaDigitOrUnderscore(c: string | number): boolean {
  return typeof c === "string" ? isAlphaOrDigit(c) || c === "_" : isAlphaOrDigit(c) || c == CODEPOINTS["_"];
}

export function isAlphaDigitUnderscoreOrMinus(char: string): boolean;
export function isAlphaDigitUnderscoreOrMinus(codepoint: number): boolean;
export function isAlphaDigitUnderscoreOrMinus(c: string | number): boolean {
  return typeof c === "string"
    ? isAlphaOrDigit(c) || c === "_" || c === "-"
    : isAlphaOrDigit(c) || c == CODEPOINTS["_"] || c == CODEPOINTS["-"];
}

export function isHexDigit(c: string) {
  if (isDigit(c)) return true;
  const code = String.fromCodePoint(c.codePointAt(0)! | 0x20);
  return "a" <= code && code <= "f";
}

export function hexToInt(c: string) {
  let codepoint = c.codePointAt(0)!;
  if (isDigit(c)) return codepoint - "0".codePointAt(0)!;
  codepoint |= 0x20;
  c = String.fromCodePoint(codepoint);
  if ("a" <= c && c <= "f") {
    return codepoint - "a".codePointAt(0)! + 10;
  }
  return 16;
}

export function isHashtagLetter(codepoint: number): boolean {
  if (
    codepoint == CODEPOINTS["_"] || codepoint == 0x200c ||
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

export function convertEntityTypeStringToEnum(
  type: MessageEntity["type"],
): MessageEntityType {
  switch (type) {
    case "mention":
      return MessageEntityType.Mention;
    case "hashtag":
      return MessageEntityType.Hashtag;
    case "cashtag":
      return MessageEntityType.Cashtag;
    case "bot_command":
      return MessageEntityType.BotCommand;
    case "url":
      return MessageEntityType.Url;
    case "email":
      return MessageEntityType.EmailAddress;
    case "phone_number":
      return MessageEntityType.PhoneNumber;
    case "bold":
      return MessageEntityType.Bold;
    case "italic":
      return MessageEntityType.Italic;
    case "underline":
      return MessageEntityType.Underline;
    case "strikethrough":
      return MessageEntityType.Strikethrough;
    case "spoiler":
      return MessageEntityType.Spoiler;
    case "code":
      return MessageEntityType.Code;
    case "custom_emoji":
      return MessageEntityType.CustomEmoji;
    case "pre":
      return MessageEntityType.Pre;
    case "text_link":
      return MessageEntityType.TextUrl;
    case "text_mention":
      return MessageEntityType.MentionName;
    case "pre_code":
      return MessageEntityType.PreCode;
    case "block_quote":
      return MessageEntityType.Blockquote;
    case "bank_card_number":
      return MessageEntityType.BankCardNumber;
    case "media_timestamp":
      return MessageEntityType.MediaTimestamp;
    default:
      return MessageEntityType.Size;
      // throw new Error("UNREACHEABLE");
  }
}

export function convertEntityTypeEnumToString(
  type: MessageEntityType,
): MessageEntity["type"] {
  switch (type) {
    case MessageEntityType.Mention:
      return "mention";
    case MessageEntityType.Hashtag:
      return "hashtag";
    case MessageEntityType.BotCommand:
      return "bot_command";
    case MessageEntityType.Url:
      return "url";
    case MessageEntityType.EmailAddress:
      return "email";
    case MessageEntityType.Bold:
      return "bold";
    case MessageEntityType.Italic:
      return "italic";
    case MessageEntityType.Code:
      return "code";
    case MessageEntityType.Pre:
      return "pre";
    case MessageEntityType.PreCode:
      return "pre_code";
    case MessageEntityType.TextUrl:
      return "text_link";
    case MessageEntityType.MentionName:
      return "text_mention";
    case MessageEntityType.Cashtag:
      return "cashtag";
    case MessageEntityType.PhoneNumber:
      return "phone_number";
    case MessageEntityType.Underline:
      return "underline";
    case MessageEntityType.Strikethrough:
      return "strikethrough";
    case MessageEntityType.Blockquote:
      return "block_quote";
    case MessageEntityType.BankCardNumber:
      return "bank_card_number";
    case MessageEntityType.MediaTimestamp:
      return "media_timestamp";
    case MessageEntityType.Spoiler:
      return "spoiler";
    case MessageEntityType.CustomEmoji:
      return "custom_emoji";
    default:
      throw new Error("UNREACHABLE");
  }
}

export function convertEntityTypeEnumToStyledString(
  type: MessageEntityType,
): string {
  switch (type) {
    case MessageEntityType.Mention:
      return "Mention";
    case MessageEntityType.Hashtag:
      return "Hashtag";
    case MessageEntityType.BotCommand:
      return "BotCommand";
    case MessageEntityType.Url:
      return "URL";
    case MessageEntityType.EmailAddress:
      return "Email";
    case MessageEntityType.Bold:
      return "Bold";
    case MessageEntityType.Italic:
      return "Italic";
    case MessageEntityType.Code:
      return "Code";
    case MessageEntityType.Pre:
      return "Pre";
    case MessageEntityType.PreCode:
      return "PreCode";
    case MessageEntityType.TextUrl:
      return "TextLink";
    case MessageEntityType.MentionName:
      return "TextMention";
    case MessageEntityType.Cashtag:
      return "Cashtag";
    case MessageEntityType.PhoneNumber:
      return "PhoneNumber";
    case MessageEntityType.Underline:
      return "Underline";
    case MessageEntityType.Strikethrough:
      return "Strikethrough";
    case MessageEntityType.Blockquote:
      return "Blockquote";
    case MessageEntityType.BankCardNumber:
      return "BankCardNumber";
    case MessageEntityType.MediaTimestamp:
      return "MediaTimestamp";
    case MessageEntityType.Spoiler:
      return "Spoiler";
    case MessageEntityType.CustomEmoji:
      return "CustomEmoji";
    default:
      throw new Error("UNREACHABLE");
  }
}
