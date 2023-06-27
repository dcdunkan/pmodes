import { areTypedArraysEqual, CODEPOINTS, encode } from "./encode.ts";
import { type MessageEntity, MessageEntityType } from "./types.ts";
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
