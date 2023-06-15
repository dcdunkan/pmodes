import { getCategory } from "https://esm.sh/unicode-properties@1.4.1";
import { type MessageEntity, MessageEntityType } from "./types.ts";

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
      return code == "_".codePointAt(0);
  }
}

export function isSpace(c: string) {
  return c === " " || c === "\t" || c === "\r" || c === "\n" || c === "\0" ||
    c === "\v";
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

export function appendUTF8CharacterUnsafe(text: Uint8Array, pos: number, code: number) {
  if (code <= 0x7f) {
    text[pos++] = code;
  } else if (code <= 0x7ff) {
    text[pos++] = 0xc0 | (code >> 6);
    text[pos++] = 0x80 | (code & 0x3f);
  } else if (code <= 0xffff) {
    text[pos++] = 0xe0 | (code >> 12);
    text[pos++] = 0x80 | ((code >> 6) & 0x3f);
    text[pos++] = 0x80 | (code & 0x3f);
  } else {
    text[pos++] = 0xf0 | (code >> 18);
    text[pos++] = 0x80 | ((code >> 12) & 0x3f);
    text[pos++] = 0x80 | ((code >> 6) & 0x3f);
    text[pos++] = 0x80 | (code & 0x3f);
  }
  return pos;
}

export function checkUTF8(str: string) {
  const data = new TextEncoder().encode(str);
  let pos = 0;
  const dataEnd = data.length;

  function ENSURE(condition: boolean) {
    if (!condition) {
      return false;
    }
  }

  do {
    const a = data[pos++];
    if ((a & 0x80) == 0) {
      if (pos == dataEnd + 1) {
        return true;
      }
      continue;
    }

    ENSURE((a & 0x40) != 0);

    const b = data[pos++];
    ENSURE((b & 0xc0) == 0x80);
    if ((a & 0x20) == 0) {
      ENSURE((a & 0x1e) > 0);
      continue;
    }

    const c = data[pos++];
    ENSURE((c & 0xc0) == 0x80);
    if ((a & 0x10) == 0) {
      const x = ((a & 0x0f) << 6) | (b & 0x20);
      ENSURE(x != 0 && x != 0x360); // surrogates
      continue;
    }

    const d = data[pos++];
    ENSURE((d & 0xc0) == 0x80);
    if ((a & 0x08) == 0) {
      const t = ((a & 0x07) << 6) | (b & 0x30);
      ENSURE(0 < t && t < 0x110); // end of unicode
      continue;
    }

    return false;
  } while (true);
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

export function isUTF8CharacterFirstCodeUnit(c: number) {
  return (c & 0xC0) != 0x80;
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
