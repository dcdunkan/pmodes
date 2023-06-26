import { CustomEmojiId } from "./custom_emoji_id.ts";
import { LinkManager } from "./link_manager.ts";
import { MessageEntity, MessageEntityType } from "./types.ts";
import { UserId } from "./user_id.ts";
import {
  areTypedArraysEqual,
  beginsWith,
  CHECK,
  CODEPOINTS,
  convertEntityTypeEnumToString,
  convertEntityTypeEnumToStyledString,
  convertEntityTypeStringToEnum,
  endsWith,
  fullSplit,
  hexToInt,
  isAlNum,
  isAlpha,
  isAlphaDigitOrUnderscore,
  isAlphaDigitUnderscoreOrMinus,
  isAlphaOrDigit,
  isDigit,
  isHashtagLetter,
  isHexDigit,
  isSpace,
  isWordCharacter,
  LOG_CHECK,
  split,
  toLower,
} from "./utilities.ts";
import {
  appendUTF8CharacterUnsafe,
  checkUTF8,
  isUTF8CharacterFirstCodeUnit,
  nextUtf8Unsafe,
  prevUtf8Unsafe,
  utf8Length,
  utf8Substr,
  utf8ToLower,
  utf8utf16Length,
  utf8utf16Substr,
} from "./utf8.ts";
import { getUnicodeSimpleCategory, UnicodeSimpleCategory } from "./unicode.ts";
import { equal, unreachable } from "https://deno.land/std@0.191.0/testing/asserts.ts";
import { decode, encode, toInteger } from "./encode.ts";

export type Position = [number, number];

export function matchMentions(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  while (true) {
    const atSymbol = str.slice(position).indexOf(CODEPOINTS["@"]);
    if (atSymbol == -1) break;
    position += atSymbol;

    if (position != begin) {
      const prevPos = prevUtf8Unsafe(str, position);
      const { code: prev } = nextUtf8Unsafe(str, prevPos);

      if (isWordCharacter(prev)) {
        position++;
        continue;
      }
    }
    const mentionBegin = ++position;
    while (position != end && isAlphaDigitOrUnderscore(str[position])) {
      position++;
    }
    const mentionEnd = position;
    const mentionSize = mentionEnd - mentionBegin;
    if (mentionSize < 2 || mentionSize > 32) {
      continue;
    }
    let next = 0;
    if (position != end) {
      const { code } = nextUtf8Unsafe(str, position);
      next = code;
    }
    if (isWordCharacter(next)) {
      continue;
    }
    result.push([mentionBegin - 1, mentionEnd]);
  }

  return result;
}

export function matchBotCommands(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  while (true) {
    const slashSymbol = str.slice(position).indexOf(CODEPOINTS["/"]);
    if (slashSymbol == -1) break;
    position += slashSymbol;

    if (position != begin) {
      const prevPos = prevUtf8Unsafe(str, position);
      const { code: prev } = nextUtf8Unsafe(str, prevPos);

      if (
        isWordCharacter(prev) || prev === CODEPOINTS["/"] ||
        prev === CODEPOINTS["<"] || prev === CODEPOINTS[">"]
      ) {
        position++;
        continue;
      }
    }

    const commandBegin = ++position;
    while (position != end && isAlphaDigitOrUnderscore(str[position])) {
      position++;
    }
    let commandEnd = position;
    const commandSize = commandEnd - commandBegin;
    if (commandSize < 1 || commandSize > 64) continue;

    if (position != end && str[position] === CODEPOINTS["@"]) {
      const mentionBegin = ++position;
      while (position != end && isAlphaDigitOrUnderscore(str[position])) {
        position++;
      }
      const mentionEnd = position;
      const mentionSize = mentionEnd - mentionBegin;
      if (mentionSize < 3 || mentionSize > 32) {
        continue;
      }
      commandEnd = position;
    }

    let next = 0;
    if (position != end) {
      const { code } = nextUtf8Unsafe(str, position);
      next = code;
    }
    if (
      isWordCharacter(next) || next === CODEPOINTS["/"] ||
      next === CODEPOINTS["<"] || next === CODEPOINTS[">"]
    ) {
      continue;
    }

    result.push([commandBegin - 1, commandEnd]);
  }

  return result;
}

export function matchHashtags(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  let category: UnicodeSimpleCategory = 0;

  while (true) {
    const hashSymbol = str.slice(position).indexOf(CODEPOINTS["#"]);
    if (hashSymbol == -1) break;
    position += hashSymbol;

    if (position != begin) {
      const prevPos = prevUtf8Unsafe(str, position);
      const { code: prev } = nextUtf8Unsafe(str, prevPos);
      category = getUnicodeSimpleCategory(prev);
      if (isHashtagLetter(prev)) {
        position++;
        continue;
      }
    }

    const hashtagBegin = ++position;
    let hashtagSize = 0, hashtagEnd: number | undefined = undefined;
    let wasLetter = false;

    while (position != end) {
      const { code, pos } = nextUtf8Unsafe(str, position);
      category = getUnicodeSimpleCategory(code);
      if (!isHashtagLetter(code)) break;
      position = pos;

      if (hashtagSize == 255) hashtagEnd = position;
      if (hashtagSize != 256) {
        wasLetter ||= category == UnicodeSimpleCategory.Letter;
        hashtagSize++;
      }
    }

    if (hashtagEnd == null) hashtagEnd = position;
    if (hashtagSize < 1) continue;
    if (position != end && str[position] == CODEPOINTS["#"]) continue;
    if (!wasLetter) continue;
    result.push([hashtagBegin - 1, hashtagEnd]);
  }

  return result;
}

export function matchCashtags(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  while (true) {
    const dollarSymbol = str.slice(position).indexOf(CODEPOINTS["$"]);
    if (dollarSymbol == -1) break;
    position += dollarSymbol;

    if (position != begin) {
      const prevPosition = prevUtf8Unsafe(str, position);
      const { code: prev } = nextUtf8Unsafe(str, prevPosition);

      if (isHashtagLetter(prev) || prev === CODEPOINTS["$"]) {
        position++;
        continue;
      }
    }

    const cashtagBegin = ++position;
    if ((end - position) >= 5 && areTypedArraysEqual(str.slice(position, position + 5), encode("1INCH"))) {
      position += 5;
    } else {
      while (position != end && CODEPOINTS["Z"] >= str[position] && str[position] >= CODEPOINTS["A"]) {
        position++;
      }
    }
    const cashtagEnd = position;
    const cashtagSize = cashtagEnd - cashtagBegin;
    if (cashtagSize < 1 || cashtagSize > 8) {
      continue;
    }

    if (cashtagEnd != end) {
      const { code } = nextUtf8Unsafe(str, position);
      if (isHashtagLetter(code) || code === CODEPOINTS["$"]) {
        continue;
      }
    }
    result.push([cashtagBegin - 1, cashtagEnd]);
  }

  return result;
}

export function matchMediaTimestamps(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  while (true) {
    const colonSign = str.slice(position).indexOf(CODEPOINTS[":"]);
    if (colonSign == -1) break;
    position += colonSign;

    let mediaTimestampBegin = position;
    while (
      mediaTimestampBegin != begin &&
      (str[mediaTimestampBegin - 1] == CODEPOINTS[":"] || isDigit(str[mediaTimestampBegin - 1]))
    ) {
      mediaTimestampBegin--;
    }
    let mediaTimestampEnd = position;
    while (
      mediaTimestampEnd + 1 != end &&
      (str[mediaTimestampEnd + 1] == CODEPOINTS[":"] || isDigit(str[mediaTimestampEnd + 1]))
    ) {
      mediaTimestampEnd++;
    }
    mediaTimestampEnd++;

    if (mediaTimestampEnd != position && mediaTimestampEnd != (position + 1) && isDigit(str[position + 1])) {
      position = mediaTimestampEnd;

      if (mediaTimestampBegin != begin) {
        const prevPosition = prevUtf8Unsafe(str, mediaTimestampBegin);
        const { code: prev } = nextUtf8Unsafe(str, prevPosition);

        if (isWordCharacter(prev)) {
          continue;
        }
      }
      if (mediaTimestampEnd != end) {
        const { code: next } = nextUtf8Unsafe(str, mediaTimestampEnd);

        if (isWordCharacter(next)) {
          continue;
        }
      }
      result.push([mediaTimestampBegin, mediaTimestampEnd]);
    } else {
      position = mediaTimestampEnd;
    }
  }

  return result;
}

export function matchBankCardNumbers(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  while (true) {
    while (position != end && !isDigit(str[position])) {
      position++;
    }
    if (position == end) {
      break;
    }
    if (position != begin) {
      const prevPosition = prevUtf8Unsafe(str, position);
      const { code: prev } = nextUtf8Unsafe(str, prevPosition);

      if (
        prev == CODEPOINTS["."] || prev == CODEPOINTS[","] || prev == CODEPOINTS["+"] ||
        prev == CODEPOINTS["-"] || prev == CODEPOINTS["_"] ||
        getUnicodeSimpleCategory(prev) == UnicodeSimpleCategory.Letter
      ) {
        while (
          position != end &&
          (isDigit(str[position]) || str[position] == CODEPOINTS[" "] || str[position] == CODEPOINTS["-"])
        ) {
          position++;
        }
        continue;
      }
    }

    const cardNumberBegin = position;
    let digitCount = 0;
    while (
      position != end &&
      (isDigit(str[position]) || str[position] == CODEPOINTS[" "] || str[position] == CODEPOINTS["-"])
    ) {
      if (
        str[position] == CODEPOINTS[" "] && digitCount >= 16 && digitCount <= 19 &&
        digitCount == (position - cardNumberBegin)
      ) break;
      digitCount += isDigit(str[position]) ? 1 : 0;
      position++;
    }
    if (digitCount < 13 || digitCount > 19) {
      continue;
    }

    let cardNumberEnd = position;
    while (!isDigit(str[cardNumberEnd - 1])) {
      cardNumberEnd--;
    }
    const cardNumberSize = cardNumberEnd - cardNumberBegin;
    if (cardNumberSize > 2 * digitCount - 1) {
      continue;
    }
    if (cardNumberEnd != end) {
      const { code: next } = nextUtf8Unsafe(str, cardNumberEnd);
      if (
        next == CODEPOINTS["-"] || next == CODEPOINTS["_"] ||
        getUnicodeSimpleCategory(next) == UnicodeSimpleCategory.Letter
      ) continue;
    }

    result.push([cardNumberBegin, cardNumberEnd]);
  }

  return result;
}

export function isURLUnicodeSymbol(codepoint: number): boolean {
  return 0x2000 <= codepoint && codepoint <= 0x206f
    ? codepoint == 0x200c || codepoint == 0x200d || (0x2010 <= codepoint && codepoint <= 0x2015)
    : getUnicodeSimpleCategory(codepoint) != UnicodeSimpleCategory.Separator;
}

export function isURLPathSymbol(codepoint: number): boolean {
  switch (codepoint) {
    case CODEPOINTS["\n"]:
    case CODEPOINTS["<"]:
    case CODEPOINTS[">"]:
    case CODEPOINTS['"']:
    case 0xab: // «
    case 0xbb: // »
      return false;
    default:
      return isURLUnicodeSymbol(codepoint);
  }
}

const BAD_PATH_END_CHARACTERS = encode(".:;,('?!`");

export function matchTgURLs(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let position = begin;

  const badPathEndChars = BAD_PATH_END_CHARACTERS;

  while (end - position > 5) {
    const colonSymbol = str.slice(position).indexOf(CODEPOINTS[":"]);
    if (colonSymbol == -1) break;
    position += colonSymbol;

    let urlBegin: number | undefined = undefined;
    if (end - position >= 3 && str[position + 1] == CODEPOINTS["/"] && str[position + 2] == CODEPOINTS["/"]) {
      if (
        position - begin >= 2 && toLower(str[position - 2]) == CODEPOINTS["t"] &&
        toLower(str[position - 1]) == CODEPOINTS["g"]
      ) {
        urlBegin = position - 2;
      } else if (
        position - begin >= 3 && toLower(str[position - 3]) === CODEPOINTS["t"] &&
          toLower(str[position - 2]) === CODEPOINTS["o"] || toLower(str[position - 1]) === CODEPOINTS["n"]
      ) {
        urlBegin = position - 3;
      }
    }
    if (urlBegin == null) {
      ++position;
      continue;
    }

    position += 3;
    const domainBegin = position;
    while (position != end && position - domainBegin != 253 && isAlphaDigitUnderscoreOrMinus(str[position])) {
      position++;
    }
    if (position == domainBegin) {
      continue;
    }

    if (
      position != end &&
      (str[position] == CODEPOINTS["/"] || str[position] == CODEPOINTS["?"] || str[position] == CODEPOINTS["#"])
    ) {
      let pathEndPos = position + 1;
      while (pathEndPos != end) {
        const { code, pos: nextPosition } = nextUtf8Unsafe(str, pathEndPos);
        if (!isURLPathSymbol(code)) {
          break;
        }
        pathEndPos = nextPosition;
      }
      while (
        pathEndPos > position + 1 &&
        badPathEndChars.includes(str[pathEndPos - 1])
      ) pathEndPos--;
      if (str[position] == CODEPOINTS["/"] || pathEndPos > position + 1) {
        position = pathEndPos;
      }
    }

    result.push([urlBegin, position]);
  }

  return result;
}

export function isProtocolSymbol(codepoint: number): boolean {
  return codepoint < 0x80
    ? isAlphaOrDigit(codepoint) || codepoint == CODEPOINTS["+"] || codepoint == CODEPOINTS["-"]
    : getUnicodeSimpleCategory(codepoint) != UnicodeSimpleCategory.Separator;
}

export function isUserDataSymbol(codepoint: number): boolean {
  switch (codepoint) {
    case CODEPOINTS["\n"]:
    case CODEPOINTS["/"]:
    case CODEPOINTS["["]:
    case CODEPOINTS["]"]:
    case CODEPOINTS["{"]:
    case CODEPOINTS["}"]:
    case CODEPOINTS["("]:
    case CODEPOINTS[")"]:
    case CODEPOINTS["'"]:
    case CODEPOINTS["`"]:
    case CODEPOINTS["<"]:
    case CODEPOINTS[">"]:
    case CODEPOINTS['"']:
    case CODEPOINTS["@"]:
    case 0xab: // «
    case 0xbb: // »
      return false;
    default:
      return isURLUnicodeSymbol(codepoint);
  }
}

export function isDomainSymbol(codepoint: number): boolean {
  return codepoint < 0xc0
    ? codepoint == CODEPOINTS["."] || isAlphaDigitUnderscoreOrMinus(codepoint) || codepoint == CODEPOINTS["~"]
    : isURLUnicodeSymbol(codepoint);
}

export function matchURLs(str: Uint8Array): Position[] {
  const result: Position[] = [];
  const begin = 0;
  let end = str.length;

  const badPathEndChars = BAD_PATH_END_CHARACTERS;

  let done = 0;

  while (true) {
    const dotPos = str.indexOf(CODEPOINTS["."]);
    if (dotPos === -1) break;
    if (dotPos > str.length || dotPos + 1 === str.length) break;

    if (str[dotPos + 1] === CODEPOINTS[" "]) {
      str = str.slice(dotPos + 2);
      done += dotPos + 2;
      end = str.length;
      continue;
    }

    let domainBeginPos = begin + dotPos;
    while (domainBeginPos !== begin) {
      domainBeginPos = prevUtf8Unsafe(str, domainBeginPos);
      const { code, pos: nextPosition } = nextUtf8Unsafe(str, domainBeginPos);
      if (!isDomainSymbol(code)) {
        domainBeginPos = nextPosition;
        break;
      }
    }

    let lastAtPos: number | undefined = undefined;
    let domainEndPos = begin + dotPos;
    while (domainEndPos !== end) {
      const { code, pos: nextPosition } = nextUtf8Unsafe(str, domainEndPos);
      if (code === CODEPOINTS["@"]) {
        lastAtPos = domainEndPos;
      } else if (!isDomainSymbol(code)) {
        break;
      }
      domainEndPos = nextPosition;
    }

    if (lastAtPos != null) {
      while (domainBeginPos !== begin) {
        domainBeginPos = prevUtf8Unsafe(str, domainBeginPos);
        const { code, pos: nextPosition } = nextUtf8Unsafe(str, domainBeginPos);
        if (!isUserDataSymbol(code)) {
          domainBeginPos = nextPosition;
          break;
        }
      }
    }

    let urlEndPos = domainEndPos;
    if (urlEndPos !== end && str[urlEndPos] === CODEPOINTS[":"]) {
      let portEndPos = urlEndPos + 1;
      while (portEndPos !== end && isDigit(str[portEndPos])) {
        portEndPos++;
      }

      let portBeginPos = urlEndPos + 1;
      while (portBeginPos !== portEndPos && str[portBeginPos] === CODEPOINTS["0"]) {
        portBeginPos++;
      }

      if (
        portBeginPos !== portEndPos && (portEndPos - portBeginPos) <= 5 &&
        toInteger(str.slice(portBeginPos, portEndPos)) <= 65535
      ) {
        urlEndPos = portEndPos;
      }
    }

    if (
      urlEndPos !== end &&
      (str[urlEndPos] === CODEPOINTS["/"] || str[urlEndPos] === CODEPOINTS["?"] || str[urlEndPos] === CODEPOINTS["#"])
    ) {
      let pathEndPos = urlEndPos + 1;
      while (pathEndPos !== end) {
        const { code, pos: nextPosition } = nextUtf8Unsafe(str, pathEndPos);
        if (!isURLPathSymbol(code)) {
          break;
        }
        pathEndPos = nextPosition;
      }
      while (
        pathEndPos > urlEndPos + 1 &&
        badPathEndChars.includes(str[pathEndPos - 1])
      ) {
        pathEndPos--;
      }
      if (str[urlEndPos] === CODEPOINTS["/"] || pathEndPos > urlEndPos + 1) {
        urlEndPos = pathEndPos;
      }
    }
    while (urlEndPos > begin + dotPos + 1 && str[urlEndPos - 1] === CODEPOINTS["."]) {
      urlEndPos--;
    }

    let isBad = false;
    let urlBeginPos = domainBeginPos;
    if (urlBeginPos !== begin && str[urlBeginPos - 1] === CODEPOINTS["@"]) {
      if (lastAtPos != null) {
        isBad = true;
      }
      let userDataBeginPos = urlBeginPos - 1;
      while (userDataBeginPos !== begin) {
        userDataBeginPos = prevUtf8Unsafe(str, userDataBeginPos);
        const { code, pos: nextPosition } = nextUtf8Unsafe(str, userDataBeginPos);
        if (!isUserDataSymbol(code)) {
          userDataBeginPos = nextPosition;
          break;
        }
      }
      if (userDataBeginPos === urlBeginPos - 1) {
        isBad = true;
      }
      urlBeginPos = userDataBeginPos;
    }

    if (urlBeginPos !== begin) {
      const prefix = str.slice(begin, urlBeginPos);
      if (prefix.length >= 6 && endsWith(prefix, encode("://"))) {
        let protocolBeginPos = urlBeginPos - 3;
        while (protocolBeginPos !== begin) {
          protocolBeginPos = prevUtf8Unsafe(str, protocolBeginPos);
          const { code, pos: nextPosition } = nextUtf8Unsafe(str, protocolBeginPos);
          if (!isProtocolSymbol(code)) {
            protocolBeginPos = nextPosition;
            break;
          }
        }
        const protocol = toLower(str.slice(protocolBeginPos, urlBeginPos - 3));
        if (endsWith(protocol, encode("http")) && !areTypedArraysEqual(protocol, encode("shttp"))) {
          urlBeginPos = urlBeginPos - 7;
        } else if (endsWith(protocol, encode("https"))) {
          urlBeginPos = urlBeginPos - 8;
        } else if (
          endsWith(protocol, encode("ftp")) && !areTypedArraysEqual(protocol, encode("tftp")) &&
          !areTypedArraysEqual(protocol, encode("sftp"))
        ) {
          urlBeginPos = urlBeginPos - 6;
        } else {
          isBad = true;
        }
      } else {
        const prefixEnd = prefix.length - 1;
        const prefixBack = prevUtf8Unsafe(str, prefixEnd);
        const { pos } = nextUtf8Unsafe(str, prefixBack);
        const code = prefix[pos];
        if (isWordCharacter(code) || code === CODEPOINTS["/"] || code === CODEPOINTS["#"] || code === CODEPOINTS["@"]) {
          isBad = true;
        }
      }
    }

    if (!isBad) {
      if (urlEndPos > begin + dotPos + 1) {
        result.push([done + urlBeginPos, done + urlEndPos]);
      }
      while (urlEndPos !== end && str[urlEndPos] === CODEPOINTS["."]) {
        urlEndPos++;
      }
    } else {
      while (str[urlEndPos - 1] !== CODEPOINTS["."]) {
        urlEndPos--;
      }
    }

    if (urlEndPos <= begin + dotPos) {
      urlEndPos = begin + dotPos + 1;
    }

    str = str.slice(urlEndPos - begin);
    done += urlEndPos - begin;
    end = str.length;
  }

  return result;
}

export function isValidBankCard(str: Uint8Array): boolean {
  const MIN_CARD_LENGTH = 13;
  const MAX_CARD_LENGTH = 19;
  const digits = new Array<number>(MAX_CARD_LENGTH);
  let digitCount = 0;
  for (const char of str) {
    if (isDigit(char)) {
      CHECK(digitCount < MAX_CARD_LENGTH);
      digits[digitCount++] = char;
    }
  }
  CHECK(digitCount >= MIN_CARD_LENGTH);

  let sum = 0;
  for (let i = digitCount; i > 0; i--) {
    const digit = digits[i - 1] - CODEPOINTS["0"];
    if ((digitCount - i) % 2 == 0) sum += digit;
    else sum += digit < 5 ? 2 * digit : 2 * digit - 9;
  }
  if (sum % 10 != 0) return false;

  const prefix1 = digits[0] - CODEPOINTS["0"];
  const prefix2 = prefix1 * 10 + (digits[1] - CODEPOINTS["0"]);
  const prefix3 = prefix2 * 10 + (digits[2] - CODEPOINTS["0"]);
  const prefix4 = prefix3 * 10 + (digits[3] - CODEPOINTS["0"]);
  if (prefix1 == 4) {
    // Visa
    return digitCount == 13 || digitCount == 16 || digitCount == 18 || digitCount == 19;
  }
  if ((51 <= prefix2 && prefix2 <= 55) || (2221 <= prefix4 && prefix4 <= 2720)) {
    // mastercard
    return digitCount == 16;
  }
  if (prefix2 == 34 || prefix2 == 37) {
    // American Express
    return digitCount == 15;
  }
  if (prefix2 == 62 || prefix2 == 81) {
    // UnionPay
    return digitCount >= 16;
  }
  if (2200 <= prefix4 && prefix4 <= 2204) {
    // MIR
    return digitCount == 16;
  }
  return true;
}

export function isEmailAddress(str: Uint8Array): boolean {
  const [userdata, domain] = split(str, CODEPOINTS["@"]);
  if (!domain || domain.length == 0) return false;

  let prev = 0;
  let userdataPartCount = 0;
  for (let i = 0; i < userdata.length; i++) {
    if (userdata[i] === CODEPOINTS["."] || userdata[i] === CODEPOINTS["+"]) {
      if (i - prev >= 27) {
        return false;
      }
      userdataPartCount++;
      prev = i + 1;
    } else if (!isAlphaDigitUnderscoreOrMinus(userdata[i])) {
      return false;
    }
  }
  userdataPartCount++;
  if (userdataPartCount >= 12) {
    return false;
  }
  const lastPartLength = userdata.length - prev;
  if (lastPartLength == 0 || lastPartLength >= 36) {
    return false;
  }

  const domainParts = fullSplit(domain, CODEPOINTS["."]);
  if (domainParts.length <= 1 || domainParts.length > 7) return false;
  if (
    domainParts[domainParts.length - 1].length <= 1 ||
    domainParts[domainParts.length - 1].length >= 9
  ) {
    return false;
  }
  for (const c of domainParts[domainParts.length - 1]) {
    if (!isAlpha(c)) return false;
  }
  domainParts.pop();
  for (const part of domainParts) {
    if (part.length == 0 || part.length >= 31) return false;
    for (const c of part) {
      if (!isAlphaDigitUnderscoreOrMinus(c)) return false;
    }
    if (!isAlphaOrDigit(part[0])) return false;
    if (!isAlphaOrDigit(part[part.length - 1])) return false;
  }

  return true;
}

// deno-fmt-ignore
export const COMMON_TLDS = [
    "aaa", "aarp", "abarth", "abb", "abbott", "abbvie", "abc", "able", "abogado", "abudhabi", "ac", "academy",
    "accenture", "accountant", "accountants", "aco", "active", "actor", "ad", "adac", "ads", "adult", "ae", "aeg",
    "aero", "aetna", "af", "afamilycompany", "afl", "africa", "ag", "agakhan", "agency", "ai", "aig", "aigo",
    "airbus", "airforce", "airtel", "akdn", "al", "alfaromeo", "alibaba", "alipay", "allfinanz", "allstate", "ally",
    "alsace", "alstom", "am", "americanexpress", "americanfamily", "amex", "amfam", "amica", "amsterdam",
    "analytics", "android", "anquan", "anz", "ao", "aol", "apartments", "app", "apple", "aq", "aquarelle", "ar",
    "arab", "aramco", "archi", "army", "arpa", "art", "arte", "as", "asda", "asia", "associates", "at", "athleta",
    "attorney", "au", "auction", "audi", "audible", "audio", "auspost", "author", "auto", "autos", "avianca", "aw",
    "aws", "ax", "axa", "az", "azure", "ba", "baby", "baidu", "banamex", "bananarepublic", "band", "bank", "bar",
    "barcelona", "barclaycard", "barclays", "barefoot", "bargains", "baseball", "basketball", "bauhaus", "bayern",
    "bb", "bbc", "bbt", "bbva", "bcg", "bcn", "bd", "be", "beats", "beauty", "beer", "bentley", "berlin", "best",
    "bestbuy", "bet", "bf", "bg", "bh", "bharti", "bi", "bible", "bid", "bike", "bing", "bingo", "bio", "biz", "bj",
    "black", "blackfriday", "blanco", "blockbuster", "blog", "bloomberg", "blue", "bm", "bms", "bmw", "bn", "bnl",
    "bnpparibas", "bo", "boats", "boehringer", "bofa", "bom", "bond", "boo", "book", "booking", "boots", "bosch",
    "bostik", "boston", "bot", "boutique", "box", "br", "bradesco", "bridgestone", "broadway", "broker", "brother",
    "brussels", "bs", "bt", "budapest", "bugatti", "build", "builders", "business", "buy", "buzz", "bv", "bw", "by",
    "bz", "bzh", "ca", "cab", "cafe", "cal", "call", "calvinklein", "cam", "camera", "camp", "cancerresearch",
    "canon", "capetown", "capital", "capitalone", "car", "caravan", "cards", "care", "career", "careers", "cars",
    "cartier", "casa", "case", "caseih", "cash", "casino", "cat", "catering", "catholic", "cba", "cbn", "cbre",
    "cbs", "cc", "cd", "ceb", "center", "ceo", "cern", "cf", "cfa", "cfd", "cg", "ch", "chanel", "channel", "chase",
    "chat", "cheap", "chintai", "christmas", "chrome", "chrysler", "church", "ci", "cipriani", "circle", "cisco",
    "citadel", "citi", "citic", "city", "cityeats", "ck", "cl", "claims", "cleaning", "click", "clinic", "clinique",
    "clothing", "cloud", "club", "clubmed", "cm", "cn", "co", "coach", "codes", "coffee", "college", "cologne",
    "com", "comcast", "commbank", "community", "company", "compare", "computer", "comsec", "condos", "construction",
    "consulting", "contact", "contractors", "cooking", "cookingchannel", "cool", "coop", "corsica", "country",
    "coupon", "coupons", "courses", "cr", "credit", "creditcard", "creditunion", "cricket", "crown", "crs", "cruise",
    "cruises", "csc", "cu", "cuisinella", "cv", "cw", "cx", "cy", "cymru", "cyou", "cz", "dabur", "dad", "dance",
    "data", "date", "dating", "datsun", "day", "dclk", "dds", "de", "deal", "dealer", "deals", "degree", "delivery",
    "dell", "deloitte", "delta", "democrat", "dental", "dentist", "desi", "design", "dev", "dhl", "diamonds", "diet",
    "digital", "direct", "directory", "discount", "discover", "dish", "diy", "dj", "dk", "dm", "dnp", "do", "docs",
    "doctor", "dodge", "dog", "doha", "domains", "dot", "download", "drive", "dtv", "dubai", "duck", "dunlop",
    "duns", "dupont", "durban", "dvag", "dvr", "dz", "earth", "eat", "ec", "eco", "edeka", "edu", "education", "ee",
    "eg", "email", "emerck", "energy", "engineer", "engineering", "enterprises", "epost", "epson", "equipment", "er",
    "ericsson", "erni", "es", "esq", "estate", "esurance", "et", "etisalat", "eu", "eurovision", "eus", "events",
    "everbank", "exchange", "expert", "exposed", "express", "extraspace", "fage", "fail", "fairwinds", "faith",
    "family", "fan", "fans", "farm", "farmers", "fashion", "fast", "fedex", "feedback", "ferrari", "ferrero", "fi",
    "fiat", "fidelity", "fido", "film", "final", "finance", "financial", "fire", "firestone", "firmdale", "fish",
    "fishing", "fit", "fitness", "fj", "fk", "flickr", "flights", "flir", "florist", "flowers", "fly", "fm", "fo",
    "foo", "food", "foodnetwork", "football", "ford", "forex", "forsale", "forum", "foundation", "fox", "fr", "free",
    "fresenius", "frl", "frogans", "frontdoor", "frontier", "ftr", "fujitsu", "fujixerox", "fun", "fund",
    "furniture", "futbol", "fyi", "ga", "gal", "gallery", "gallo", "gallup", "game", "games", "gap", "garden", "gb",
    "gbiz", "gd", "gdn", "ge", "gea", "gent", "genting", "george", "gf", "gg", "ggee", "gh", "gi", "gift", "gifts",
    "gives", "giving", "gl", "glade", "glass", "gle", "global", "globo", "gm", "gmail", "gmbh", "gmo", "gmx", "gn",
    "godaddy", "gold", "goldpoint", "golf", "goo", "goodhands", "goodyear", "goog", "google", "gop", "got", "gov",
    "gp", "gq", "gr", "grainger", "graphics", "gratis", "green", "gripe", "grocery", "group", "gs", "gt", "gu",
    "guardian", "gucci", "guge", "guide", "guitars", "guru", "gw", "gy", "hair", "hamburg", "hangout", "haus", "hbo",
    "hdfc", "hdfcbank", "health", "healthcare", "help", "helsinki", "here", "hermes", "hgtv", "hiphop", "hisamitsu",
    "hitachi", "hiv", "hk", "hkt", "hm", "hn", "hockey", "holdings", "holiday", "homedepot", "homegoods", "homes",
    "homesense", "honda", "honeywell", "horse", "hospital", "host", "hosting", "hot", "hoteles", "hotels", "hotmail",
    "house", "how", "hr", "hsbc", "ht", "hu", "hughes", "hyatt", "hyundai", "ibm", "icbc", "ice", "icu", "id", "ie",
    "ieee", "ifm", "ikano", "il", "im", "imamat", "imdb", "immo", "immobilien", "in", "industries", "infiniti",
    "info", "ing", "ink", "institute", "insurance", "insure", "int", "intel", "international", "intuit",
    "investments", "io", "ipiranga", "iq", "ir", "irish", "is", "iselect", "ismaili", "ist", "istanbul", "it",
    "itau", "itv", "iveco", "iwc", "jaguar", "java", "jcb", "jcp", "je", "jeep", "jetzt", "jewelry", "jio", "jlc",
    "jll", "jm", "jmp", "jnj", "jo", "jobs", "joburg", "jot", "joy", "jp", "jpmorgan", "jprs", "juegos", "juniper",
    "kaufen", "kddi", "ke", "kerryhotels", "kerrylogistics", "kerryproperties", "kfh", "kg", "kh", "ki", "kia",
    "kim", "kinder", "kindle", "kitchen", "kiwi", "km", "kn", "koeln", "komatsu", "kosher", "kp", "kpmg", "kpn",
    "kr", "krd", "kred", "kuokgroup", "kw", "ky", "kyoto", "kz", "la", "lacaixa", "ladbrokes", "lamborghini",
    "lamer", "lancaster", "lancia", "lancome", "land", "landrover", "lanxess", "lasalle", "lat", "latino", "latrobe",
    "law", "lawyer", "lb", "lc", "lds", "lease", "leclerc", "lefrak", "legal", "lego", "lexus", "lgbt", "li",
    "liaison", "lidl", "life", "lifeinsurance", "lifestyle", "lighting", "like", "lilly", "limited", "limo",
    "lincoln", "linde", "link", "lipsy", "live", "living", "lixil", "lk", "loan", "loans", "locker", "locus", "loft",
    "lol", "london", "lotte", "lotto", "love", "lpl", "lplfinancial", "lr", "ls", "lt", "ltd", "ltda", "lu",
    "lundbeck", "lupin", "luxe", "luxury", "lv", "ly", "ma", "macys", "madrid", "maif", "maison", "makeup", "man",
    "management", "mango", "map", "market", "marketing", "markets", "marriott", "marshalls", "maserati", "mattel",
    "mba", "mc", "mckinsey", "md", "me", "med", "media", "meet", "melbourne", "meme", "memorial", "men", "menu",
    "meo", "merckmsd", "metlife", "mg", "mh", "miami", "microsoft", "mil", "mini", "mint", "mit", "mitsubishi", "mk",
    "ml", "mlb", "mls", "mm", "mma", "mn", "mo", "mobi", "mobile", "mobily", "moda", "moe", "moi", "mom", "monash",
    "money", "monster", "mopar", "mormon", "mortgage", "moscow", "moto", "motorcycles", "mov", "movie", "movistar",
    "mp", "mq", "mr", "ms", "msd", "mt", "mtn", "mtr", "mu", "museum", "mutual", "mv", "mw", "mx", "my", "mz", "na",
    "nab", "nadex", "nagoya", "name", "nationwide", "natura", "navy", "nba", "nc", "ne", "nec", "net", "netbank",
    "netflix", "network", "neustar", "new", "newholland", "news", "next", "nextdirect", "nexus", "nf", "nfl", "ng",
    "ngo", "nhk", "ni", "nico", "nike", "nikon", "ninja", "nissan", "nissay", "nl", "no", "nokia",
    "northwesternmutual", "norton", "now", "nowruz", "nowtv", "np", "nr", "nra", "nrw", "ntt", "nu", "nyc", "nz",
    "obi", "observer", "off", "office", "okinawa", "olayan", "olayangroup", "oldnavy", "ollo", "om", "omega", "one",
    "ong", "onion", "onl", "online", "onyourside", "ooo", "open", "oracle", "orange", "org", "organic", "origins",
    "osaka", "otsuka", "ott", "ovh", "pa", "page", "panasonic", "panerai", "paris", "pars", "partners", "parts",
    "party", "passagens", "pay", "pccw", "pe", "pet", "pf", "pfizer", "pg", "ph", "pharmacy", "phd", "philips",
    "phone", "photo", "photography", "photos", "physio", "piaget", "pics", "pictet", "pictures", "pid", "pin",
    "ping", "pink", "pioneer", "pizza", "pk", "pl", "place", "play", "playstation", "plumbing", "plus", "pm", "pn",
    "pnc", "pohl", "poker", "politie", "porn", "post", "pr", "pramerica", "praxi", "press", "prime", "pro", "prod",
    "productions", "prof", "progressive", "promo", "properties", "property", "protection", "pru", "prudential", "ps",
    "pt", "pub", "pw", "pwc", "py", "qa", "qpon", "quebec", "quest", "qvc", "racing", "radio", "raid", "re", "read",
    "realestate", "realtor", "realty", "recipes", "red", "redstone", "redumbrella", "rehab", "reise", "reisen",
    "reit", "reliance", "ren", "rent", "rentals", "repair", "report", "republican", "rest", "restaurant", "review",
    "reviews", "rexroth", "rich", "richardli", "ricoh", "rightathome", "ril", "rio", "rip", "rmit", "ro", "rocher",
    "rocks", "rodeo", "rogers", "room", "rs", "rsvp", "ru", "rugby", "ruhr", "run", "rw", "rwe", "ryukyu", "sa",
    "saarland", "safe", "safety", "sakura", "sale", "salon", "samsclub", "samsung", "sandvik", "sandvikcoromant",
    "sanofi", "sap", "sapo", "sarl", "sas", "save", "saxo", "sb", "sbi", "sbs", "sc", "sca", "scb", "schaeffler",
    "schmidt", "scholarships", "school", "schule", "schwarz", "science", "scjohnson", "scor", "scot", "sd", "se",
    "search", "seat", "secure", "security", "seek", "select", "sener", "services", "ses", "seven", "sew", "sex",
    "sexy", "sfr", "sg", "sh", "shangrila", "sharp", "shaw", "shell", "shia", "shiksha", "shoes", "shop", "shopping",
    "shouji", "show", "showtime", "shriram", "si", "silk", "sina", "singles", "site", "sj", "sk", "ski", "skin",
    "sky", "skype", "sl", "sling", "sm", "smart", "smile", "sn", "sncf", "so", "soccer", "social", "softbank",
    "software", "sohu", "solar", "solutions", "song", "sony", "soy", "space", "spiegel", "sport", "spot",
    "spreadbetting", "sr", "srl", "srt", "st", "stada", "staples", "star", "starhub", "statebank", "statefarm",
    "statoil", "stc", "stcgroup", "stockholm", "storage", "store", "stream", "studio", "study", "style", "su",
    "sucks", "supplies", "supply", "support", "surf", "surgery", "suzuki", "sv", "swatch", "swiftcover", "swiss",
    "sx", "sy", "sydney", "symantec", "systems", "sz", "tab", "taipei", "talk", "taobao", "target", "tatamotors",
    "tatar", "tattoo", "tax", "taxi", "tc", "tci", "td", "tdk", "team", "tech", "technology", "tel", "telecity",
    "telefonica", "temasek", "tennis", "teva", "tf", "tg", "th", "thd", "theater", "theatre", "tiaa", "tickets",
    "tienda", "tiffany", "tips", "tires", "tirol", "tj", "tjmaxx", "tjx", "tk", "tkmaxx", "tl", "tm", "tmall", "tn",
    "to", "today", "tokyo", "tools", "top", "toray", "toshiba", "total", "tours", "town", "toyota", "toys", "tr",
    "trade", "trading", "training", "travel", "travelchannel", "travelers", "travelersinsurance", "trust", "trv",
    "tt", "tube", "tui", "tunes", "tushu", "tv", "tvs", "tw", "tz", "ua", "ubank", "ubs", "uconnect", "ug", "uk",
    "unicom", "university", "uno", "uol", "ups", "us", "uy", "uz", "va", "vacations", "vana", "vanguard", "vc", "ve",
    "vegas", "ventures", "verisign", "versicherung", "vet", "vg", "vi", "viajes", "video", "vig", "viking", "villas",
    "vin", "vip", "virgin", "visa", "vision", "vista", "vistaprint", "viva", "vivo", "vlaanderen", "vn", "vodka",
    "volkswagen", "volvo", "vote", "voting", "voto", "voyage", "vu", "vuelos", "wales", "walmart", "walter", "wang",
    "wanggou", "warman", "watch", "watches", "weather", "weatherchannel", "webcam", "weber", "website", "wed",
    "wedding", "weibo", "weir", "wf", "whoswho", "wien", "wiki", "williamhill", "win", "windows", "wine", "winners",
    "wme", "wolterskluwer", "woodside", "work", "works", "world", "wow", "ws", "wtc", "wtf", "xbox", "xerox",
    "xfinity", "xihuan", "xin", "कॉम", "セール", "佛山", "ಭಾರತ", "慈善", "集团", "在线", "한국", "ଭାରତ", "大众汽车",
    "点看", "คอม", "ভাৰত", "ভারত", "八卦", "موقع", "বাংলা", "公益", "公司", "香格里拉", "网站", "移动", "我爱你",
    "москва", "қаз", "католик", "онлайн", "сайт", "联通", "срб", "бг", "бел", "קום", "时尚", "微博", "淡马锡",
    "ファッション", "орг", "नेट", "ストア", "삼성", "சிங்கப்பூர்", "商标", "商店", "商城", "дети", "мкд", "ею",
    "ポイント", "新闻", "工行", "家電", "كوم", "中文网", "中信", "中国", "中國", "娱乐", "谷歌", "భారత్", "ලංකා",
    "電訊盈科", "购物", "クラウド", "ભારત", "通販", "भारतम्", "भारत", "भारोत", "网店", "संगठन", "餐厅", "网络", "ком",
    "укр", "香港", "诺基亚", "食品", "飞利浦", "台湾", "台灣", "手表", "手机", "мон", "الجزائر", "عمان", "ارامكو",
    "ایران", "العليان", "اتصالات", "امارات", "بازار", "پاکستان", "الاردن", "موبايلي", "بارت", "بھارت", "المغرب",
    "ابوظبي", "السعودية", "ڀارت", "كاثوليك", "سودان", "همراه", "عراق", "مليسيا", "澳門", "닷컴", "政府", "شبكة",
    "بيتك", "عرب", "გე", "机构", "组织机构", "健康", "ไทย", "سورية", "招聘", "рус", "рф", "珠宝", "تونس", "大拿",
    "みんな", "グーグル", "ελ", "世界", "書籍", "ഭാരതം", "ਭਾਰਤ", "网址", "닷넷", "コム", "天主教", "游戏",
    "vermögensberater", "vermögensberatung", "企业", "信息", "嘉里大酒店", "嘉里", "مصر", "قطر", "广东", "இலங்கை",
    "இந்தியா", "հայ", "新加坡", "فلسطين", "政务", "xperia", "xxx", "xyz", "yachts", "yahoo", "yamaxun", "yandex",
    "ye", "yodobashi", "yoga", "yokohama", "you", "youtube", "yt", "yun", "za", "zappos", "zara", "zero", "zip",
    "zippo", "zm", "zone", "zuerich", "zw",
].map((x) => encode(x));

export function isCommonTLD(str: Uint8Array): boolean {
  let isLower = true;
  for (const c of str) {
    const unsigned = ((c - CODEPOINTS["a"]) & 0xFFFFFFFF) >>> 0;
    if (unsigned > CODEPOINTS["z"] - CODEPOINTS["a"]) {
      isLower = false;
      break;
    }
  }
  if (isLower) {
    return COMMON_TLDS.some((tld) => areTypedArraysEqual(tld, str));
  }

  const strLower = utf8ToLower(str);
  if (!areTypedArraysEqual(strLower, str) && areTypedArraysEqual(utf8Substr(strLower, 1), utf8Substr(str, 1))) {
    return false;
  }
  return COMMON_TLDS.some((tld) => areTypedArraysEqual(tld, strLower));
}

export function fixURL(str: Uint8Array): Uint8Array {
  let fullUrl = str;

  let hasProtocol = false;
  const strBegin = toLower(str.slice(0, 9));
  if (
    beginsWith(strBegin, encode("http://")) || beginsWith(strBegin, encode("https://")) ||
    beginsWith(strBegin, encode("ftp://"))
  ) {
    const pos = str.indexOf(CODEPOINTS[":"]);
    str = str.slice(pos + 3);
    hasProtocol = true;
  }

  function maxNegativeOne(x: number, max: number) {
    return x === -1 ? max : x;
  }

  const domainEnd = Math.min(
    str.length,
    maxNegativeOne(str.indexOf(CODEPOINTS["/"]), str.length),
    maxNegativeOne(str.indexOf(CODEPOINTS["?"]), str.length),
    maxNegativeOne(str.indexOf(CODEPOINTS["#"]), str.length),
  );
  let domain = str.slice(0, domainEnd);
  const path = str.slice(domainEnd);

  const atPos = domain.indexOf(CODEPOINTS["@"]);
  if (atPos < domain.length) {
    domain = domain.slice(atPos + 1);
  }
  const lastIndexOfColon = domain.lastIndexOf(CODEPOINTS[":"]);
  domain = domain.slice(0, lastIndexOfColon === -1 ? undefined : lastIndexOfColon);

  if (domain.length === 12 && (domain[0] === CODEPOINTS["t"] || domain[0] === CODEPOINTS["T"])) {
    if (areTypedArraysEqual(toLower(domain), encode("teiegram.org"))) return new Uint8Array();
  }

  const balance: [number, number, number] = [0, 0, 0];
  let pathPos = 0;
  for (pathPos; pathPos < path.length; pathPos++) {
    switch (path[pathPos]) {
      case CODEPOINTS["("]:
        balance[0]++;
        break;
      case CODEPOINTS["["]:
        balance[1]++;
        break;
      case CODEPOINTS["{"]:
        balance[2]++;
        break;
      case CODEPOINTS[")"]:
        balance[0]--;
        break;
      case CODEPOINTS["]"]:
        balance[1]--;
        break;
      case CODEPOINTS["}"]:
        balance[2]--;
        break;
    }
    if (balance[0] < 0 || balance[1] < 0 || balance[2] < 0) {
      break;
    }
  }

  const badPathEndChars = BAD_PATH_END_CHARACTERS;
  while (pathPos > 0 && badPathEndChars.includes(path[pathPos - 1])) {
    pathPos--;
  }
  fullUrl = fullUrl.slice(0, fullUrl.length - (path.length - pathPos));

  let prev = 0;
  let domainPartCount = 0;
  let hasNonDigit = false;
  let isIpv4 = true;
  for (let i = 0; i <= domain.length; i++) {
    if (i == domain.length || domain[i] === CODEPOINTS["."]) {
      const partSize = i - prev;
      if (partSize === 0 || partSize >= 64 || domain[i - 1] === CODEPOINTS["-"]) return new Uint8Array();
      if (isIpv4) {
        if (partSize > 3) isIpv4 = false;
        if (
          partSize === 3 &&
          (domain[prev] >= CODEPOINTS["3"] ||
            (domain[prev] === CODEPOINTS["2"] &&
              (domain[prev + 1] >= CODEPOINTS["6"] ||
                (domain[prev + 1] === CODEPOINTS["5"] && domain[prev + 2] >= CODEPOINTS["6"]))))
        ) {
          isIpv4 = false;
        }
        if (domain[prev] === CODEPOINTS["0"] && partSize >= 2) isIpv4 = false;
      }

      domainPartCount++;
      if (i != domain.length) prev = i + 1;
    } else if (!isDigit(domain[i])) {
      isIpv4 = false;
      hasNonDigit = true;
    }
  }

  if (domainPartCount === 1) return new Uint8Array();
  if (isIpv4 && domainPartCount == 4) return fullUrl;
  if (!hasNonDigit) return new Uint8Array();

  const tld = domain.slice(prev);
  if (utf8Length(tld) <= 1) return new Uint8Array();

  if (beginsWith(tld, encode("xn--"))) {
    if (tld.length <= 5) return new Uint8Array();
    for (const c of tld.slice(4)) {
      if (!isAlphaOrDigit(c)) return new Uint8Array();
    }
  } else {
    if (tld.indexOf(CODEPOINTS["_"]) != -1) return new Uint8Array();
    if (tld.indexOf(CODEPOINTS["-"]) != -1) return new Uint8Array();
    if (!hasProtocol && !isCommonTLD(tld)) return new Uint8Array();
  }

  CHECK(prev > 0);
  prev--;
  while (prev-- > 0) {
    if (domain[prev] === CODEPOINTS["_"]) return new Uint8Array();
    else if (domain[prev] === CODEPOINTS["."]) break;
  }

  return fullUrl;
}

const VALID_SHORT_USERNAMES = ["gif", "wiki", "vid", "bing", "pic", "bold", "imdb", "coub", "like", "vote"]
  .map((username) => encode(username));

export function getValidShortUsernames(): Uint8Array[] {
  return VALID_SHORT_USERNAMES;
}

export function findMentions(str: Uint8Array): Position[] {
  return matchMentions(str).filter(([start, end]) => {
    const mention = str.slice(start + 1, end);
    if (mention.length >= 4) {
      return true;
    }
    const loweredMention = toLower(mention);
    return getValidShortUsernames()
      .some((username) => areTypedArraysEqual(loweredMention, username));
  });
}

export function findBotCommands(str: Uint8Array): Position[] {
  return matchBotCommands(str);
}

export function findHashtags(str: Uint8Array): Position[] {
  return matchHashtags(str);
}

export function findCashtags(str: Uint8Array): Position[] {
  return matchCashtags(str);
}

export function findBankCardNumbers(str: Uint8Array): Position[] {
  return matchBankCardNumbers(str).filter(([start, end]) => {
    return isValidBankCard(str.slice(start, end));
  });
}

export function findTgURLs(str: Uint8Array): Position[] {
  return matchTgURLs(str);
}

export function findURLs(str: Uint8Array): [Position, boolean][] {
  const result: [Position, boolean][] = [];
  for (const [start, end] of matchURLs(str)) {
    let url = str.slice(start, end);
    if (isEmailAddress(url)) {
      result.push([[start, end], true]);
    } else if (beginsWith(url, encode("mailto:")) && isEmailAddress(url.slice(7))) {
      result.push([[start + 7, start + url.length], true]);
    } else {
      url = fixURL(url);
      if (url.length != 0) {
        result.push([[start, start + url.length], false]);
      }
    }
  }
  return result;
}

export function findMediaTimestamps(str: Uint8Array): [Position, number][] {
  const result: [Position, number][] = [];
  for (const [start, end] of matchMediaTimestamps(str)) {
    const parts = fullSplit(str.slice(start, end), CODEPOINTS[":"]);
    CHECK(parts.length >= 2);
    if (parts.length > 3 || parts[parts.length - 1].length != 2) {
      continue;
    }
    const seconds = toInteger(parts[parts.length - 1]);
    if (seconds >= 60) {
      continue;
    }
    if (parts.length == 2) {
      if (parts[0].length > 4 || parts[0].length == 0) {
        continue;
      }
      const minutes = toInteger(parts[0]);
      result.push([[start, end], minutes * 60 + seconds]);
      continue;
    } else {
      if (
        parts[0].length > 2 || parts[1].length > 2 ||
        parts[0].length == 0 || parts[1].length == 0
      ) continue;
      const minutes = toInteger(parts[1]);
      if (minutes >= 60) {
        continue;
      }
      const hours = toInteger(parts[0]);
      result.push([[start, end], hours * 3600 + minutes * 60 + seconds]);
    }
  }
  return result;
}

export function textLength(text: Uint8Array): number {
  return utf8utf16Length(text);
}

export function getTypePriority(type: MessageEntityType): number {
  const priorities = [
    50, /* Mention */
    50, /* Hashtag */
    50, /* BotCommand */
    50, /* Url */
    50, /* EmailAddress */
    90, /* Bold */
    91, /* Italic */
    20, /* Code */
    11, /* Pre */
    10, /* PreCode */
    49, /* TextUrl */
    49, /* MentionName */
    50, /* Cashtag */
    50, /* PhoneNumber */
    92, /* Underline */
    93, /* Strikethrough */
    0, /* Blockquote */
    50, /* BankCardNumber */
    50, /* MediaTimestamp */
    94, /* Spoiler */
    99, /* CustomEmoji */
  ];
  return priorities[type];
}

export function removeEmptyEntities(entities: MessageEntity[]): MessageEntity[] {
  return entities.filter((entity) => {
    if (entity.length <= 0) return false;
    switch (entity.type) {
      case "text_link":
        return entity.url.length != 0;
      case "text_mention":
        return entity.user_id.isValid();
      case "custom_emoji":
        return entity.custom_emoji_id.isValid();
      default:
        return true;
    }
  });
}

export function sortEntities(entities: MessageEntity[]) {
  return entities.sort(({ offset, type, length }, other) => {
    if (offset != other.offset) {
      return offset < other.offset ? -1 : 1;
    }
    if (length != other.length) {
      return length > other.length ? -1 : 1;
    }
    const priority = getTypePriority(convertEntityTypeStringToEnum(type));
    const otherPriority = getTypePriority(convertEntityTypeStringToEnum(other.type));
    return priority < otherPriority ? -1 : 1;
  });
}

export function checkIsSorted(entities: MessageEntity[]) {
  LOG_CHECK(equal(entities, sortEntities(entities)), "unsorted", entities);
}

export function checkNonIntersecting(entities: MessageEntity[]) {
  for (let i = 0; i + 1 < entities.length; i++) {
    LOG_CHECK(entities[i].offset + entities[i].length <= entities[i + 1].offset, "intersects:", entities);
  }
}

export function getEntityTypeMask(type: MessageEntityType) {
  return 1 << type;
}

export function getSplittableEntitiesMask() {
  return getEntityTypeMask(MessageEntityType.Bold) |
    getEntityTypeMask(MessageEntityType.Italic) |
    getEntityTypeMask(MessageEntityType.Underline) |
    getEntityTypeMask(MessageEntityType.Strikethrough) |
    getEntityTypeMask(MessageEntityType.Spoiler);
}

export function getBlockquoteEntitesMask() {
  return getEntityTypeMask(MessageEntityType.Blockquote);
}

export function getContinuousEntitiesMask() {
  return getEntityTypeMask(MessageEntityType.Mention) |
    getEntityTypeMask(MessageEntityType.Hashtag) |
    getEntityTypeMask(MessageEntityType.BotCommand) |
    getEntityTypeMask(MessageEntityType.Url) |
    getEntityTypeMask(MessageEntityType.EmailAddress) |
    getEntityTypeMask(MessageEntityType.TextUrl) |
    getEntityTypeMask(MessageEntityType.MentionName) |
    getEntityTypeMask(MessageEntityType.Cashtag) |
    getEntityTypeMask(MessageEntityType.PhoneNumber) |
    getEntityTypeMask(MessageEntityType.BankCardNumber) |
    getEntityTypeMask(MessageEntityType.MediaTimestamp) |
    getEntityTypeMask(MessageEntityType.CustomEmoji);
}

export function getPreEntitiesMask() {
  return getEntityTypeMask(MessageEntityType.Pre) |
    getEntityTypeMask(MessageEntityType.Code) |
    getEntityTypeMask(MessageEntityType.PreCode);
}

export function getUserEntitiesMask() {
  return getSplittableEntitiesMask() |
    getBlockquoteEntitesMask() |
    getEntityTypeMask(MessageEntityType.TextUrl) |
    getEntityTypeMask(MessageEntityType.MentionName) |
    getEntityTypeMask(MessageEntityType.CustomEmoji) |
    getPreEntitiesMask();
}

export function isSplittableEntity(type: MessageEntityType) {
  return (getEntityTypeMask(type) & getSplittableEntitiesMask()) != 0;
}

export function isBlockquoteEntity(type: MessageEntityType) {
  return type == MessageEntityType.Blockquote;
}

export function isContinuousEntity(type: MessageEntityType) {
  return (getEntityTypeMask(type) & getContinuousEntitiesMask()) != 0;
}

export function isPreEntity(type: MessageEntityType) {
  return (getEntityTypeMask(type) & getPreEntitiesMask()) != 0;
}

export function isUserEntity(type: MessageEntityType) {
  return (getEntityTypeMask(type) & getUserEntitiesMask()) != 0;
}

export function isHiddenDataEntity(type: MessageEntityType) {
  return (getEntityTypeMask(type) &
    (getEntityTypeMask(MessageEntityType.TextUrl) |
      getEntityTypeMask(MessageEntityType.MentionName) |
      getPreEntitiesMask())) != 0;
}

export const SPLITTABLE_ENTITY_TYPE_COUNT = 5;

export function getSplittableEntityTypeIndex(type: MessageEntityType) {
  if (type <= MessageEntityType.Bold + 1) { // bold or italic
    return type - MessageEntityType.Bold;
  } else if (type <= MessageEntityType.Underline + 1) { // underline or strikthrough
    return type - MessageEntityType.Underline + 2;
  } else {
    CHECK(type == MessageEntityType.Spoiler);
    return 4;
  }
}

export function areEntitiesValid(entities: MessageEntity[]): boolean {
  if (entities.length == 0) return true;
  checkIsSorted(entities); // has to be?
  const endPos = new Array<number>(SPLITTABLE_ENTITY_TYPE_COUNT).fill(-1);
  const nestedEntitiesStack: MessageEntity[] = [];
  let nestedEntityTypeMask = 0;

  for (const entity of entities) {
    const entityType = convertEntityTypeStringToEnum(entity.type);

    while (
      nestedEntitiesStack.length != 0 &&
      entity.offset >=
        (nestedEntitiesStack[nestedEntitiesStack.length - 1].offset +
          nestedEntitiesStack[nestedEntitiesStack.length - 1].length)
    ) {
      const last = nestedEntitiesStack[nestedEntitiesStack.length - 1];
      nestedEntityTypeMask -= getEntityTypeMask(
        convertEntityTypeStringToEnum(last.type),
      );
      nestedEntitiesStack.pop();
    }

    if (nestedEntitiesStack.length != 0) {
      if (
        entity.offset + entity.length >
          nestedEntitiesStack[nestedEntitiesStack.length - 1].offset +
            nestedEntitiesStack[nestedEntitiesStack.length - 1].length
      ) return false;

      if (
        (nestedEntityTypeMask &
          getEntityTypeMask(convertEntityTypeStringToEnum(entity.type))) != 0
      ) return false;

      const parent = nestedEntitiesStack[nestedEntitiesStack.length - 1];
      const parentType = convertEntityTypeStringToEnum(parent.type);

      if (isPreEntity(parentType)) {
        return false;
      }
      if (
        isPreEntity(entityType) &&
        (nestedEntityTypeMask & ~getBlockquoteEntitesMask()) != 0
      ) return false;

      if (
        (isContinuousEntity(entityType) || isBlockquoteEntity(entityType)) &&
        (nestedEntityTypeMask & getContinuousEntitiesMask()) != 0
      ) return false;

      if ((nestedEntityTypeMask & getSplittableEntitiesMask()) != 0) {
        return false;
      }
    }

    if (isSplittableEntity(entityType)) {
      const index = getSplittableEntityTypeIndex(entityType);
      if (endPos[index] >= entity.offset) return false; // can be merged.
      endPos[index] = entity.offset + entity.length;
    }

    nestedEntitiesStack.push(entity);
    nestedEntityTypeMask += getEntityTypeMask(entityType);
  }

  return true;
}

export function removeIntersectingEntities(
  entities: MessageEntity[],
): MessageEntity[] {
  checkIsSorted(entities);
  let lastEntityEnd = 0;
  let leftEntities = 0;
  for (let i = 0; i < entities.length; i++) {
    CHECK(entities[i].length > 0);
    if (entities[i].offset >= lastEntityEnd) {
      lastEntityEnd = entities[i].offset + entities[i].length;
      if (i != leftEntities) {
        const removed = entities.splice(i, 1);
        entities[leftEntities] = removed[0];
      }
      leftEntities++;
    }
  }
  entities.splice(leftEntities);
  return entities;
}

export function removeEntitiesIntersectingBlockquote(
  entities: MessageEntity[],
  blockquoteEntities: MessageEntity[],
): MessageEntity[] | undefined {
  checkNonIntersecting(entities);
  checkNonIntersecting(blockquoteEntities);
  if (blockquoteEntities.length == 0) return;

  let blockquoteIt = 0;
  let leftEntities = 0;
  for (let i = 0; i < entities.length; i++) {
    while (
      blockquoteIt != blockquoteEntities.length &&
      (convertEntityTypeStringToEnum(blockquoteEntities[blockquoteIt].type) !=
          MessageEntityType.Blockquote ||
        blockquoteEntities[blockquoteIt].offset +
              blockquoteEntities[blockquoteIt].length <= entities[i].offset)
    ) {
      ++blockquoteIt;
    }
    const blockquote = blockquoteEntities[blockquoteIt];
    if (
      blockquoteIt != blockquoteEntities.length &&
      (blockquote.offset + blockquote.length <
          entities[i].offset + entities[i].length ||
        (entities[i].offset < blockquote.offset &&
          blockquote.offset < entities[i].offset + entities[i].length))
    ) {
      continue;
    }
    if (i != leftEntities) {
      const removed = entities.splice(i, 1);
      entities[leftEntities] = removed[0];
    }
    leftEntities++;
  }

  entities.splice(leftEntities);
  return entities;
}

export function fixEntityOffsets(text: Uint8Array, entities: MessageEntity[]): MessageEntity[] | undefined {
  if (entities.length == 0) return;
  entities = sortEntities(entities);
  entities = removeIntersectingEntities(entities);

  const begin = 0, end = text.length;
  let ptr = begin;

  let utf16Pos = 0;
  for (const entity of entities) {
    let cnt = 2;
    const entityBegin = entity.offset;
    const entityEnd = entity.offset - entity.length;

    let pos = (ptr - begin) | 0;
    if (entityBegin == pos) {
      cnt--;
      entity.offset = utf16Pos;
    }

    // let skippedCode = 0;
    while (ptr != end && cnt > 0) {
      const c = text[ptr];
      utf16Pos += 1 + (c >= 0xf0 ? 1 : 0);
      // skippedCode = text.codePointAt(ptr)!;
      ptr++;

      pos = (ptr - begin) | 0;
      if (entityBegin == pos) {
        cnt--;
        entity.offset = utf16Pos;
      } else if (entityEnd == pos) {
        cnt--;
        entity.length = utf16Pos - entity.offset;
      }
    }
    CHECK(cnt == 0);
  }

  return entities;
}

export function findEntities(
  text: Uint8Array,
  skipBotCommands: boolean,
  skipMediaTimestamps: boolean,
): MessageEntity[] {
  let entities: MessageEntity[] = [];

  function addEntities(
    type: MessageEntityType,
    findEntitiesFn: (text: Uint8Array) => Position[],
  ) {
    const newEntities = findEntitiesFn(text);
    for (const entity of newEntities) {
      const offset = entity[0];
      const length = entity[1] - entity[0];
      entities.push({
        type: convertEntityTypeEnumToString(type) as MessageEntity.CommonMessageEntity["type"],
        offset,
        length,
      });
    }
  }

  addEntities(MessageEntityType.Mention, findMentions);
  if (!skipBotCommands) {
    addEntities(MessageEntityType.BotCommand, findBotCommands);
  }
  addEntities(MessageEntityType.Hashtag, findHashtags);
  addEntities(MessageEntityType.Cashtag, findCashtags);
  // TODO: find_phone_numbers.
  addEntities(MessageEntityType.BankCardNumber, findBankCardNumbers);
  addEntities(MessageEntityType.Url, findTgURLs);

  const urls = findURLs(text);
  for (const [url, email] of urls) {
    const type = email ? "email" : "url";
    const offset = url[0];
    const length = url[1] - url[0];
    entities.push({ type, offset, length });
  }
  if (!skipMediaTimestamps) {
    const mediaTimestamps = findMediaTimestamps(text);
    for (const [entity, timestamp] of mediaTimestamps) {
      const offset = entity[0];
      const length = entity[1] - entity[0];
      entities.push({ type: "media_timestamp", offset, length, timestamp });
    }
  }

  const fixedEntities = fixEntityOffsets(text, entities);
  if (fixedEntities != null) entities = fixedEntities;

  return entities;
}

export function findMediaTimestampEntities(text: Uint8Array) {
  let entities: MessageEntity[] = [];

  const mediaTimestamps = findMediaTimestamps(text);
  for (const [entity, timestamp] of mediaTimestamps) {
    const offset = entity[0];
    const length = entity[1] - entity[0];
    entities.push({ type: "media_timestamp", offset, length, timestamp });
  }

  const fixedEntities = fixEntityOffsets(text, entities);
  if (fixedEntities != null) entities = fixedEntities;

  return entities;
}

export function mergeEntities(
  oldEntities: MessageEntity[],
  newEntities: MessageEntity[],
) {
  if (newEntities.length == 0) return oldEntities;
  if (oldEntities.length == 0) return newEntities;

  const result = new Array<MessageEntity>(
    /* oldEntities.length + newEntities.length */
  );

  let newIt = 0;
  const newEnd = newEntities.length;
  for (const oldEntity of oldEntities) {
    while (
      newIt != newEnd &&
      (newEntities[newIt].offset + newEntities[newIt].length) <=
        oldEntity.offset
    ) {
      const removed = newEntities.shift();
      if (removed == null) {
        throw new Error("New entity shouldn't be undefined.");
      }
      result.push(removed);
      ++newIt;
    }
    const oldEntityEnd = oldEntity.offset + oldEntity.length;
    const removed = oldEntities.shift();
    if (removed == null) throw new Error("Old entity shouldn't be undefined.");
    result.push(oldEntity);
    while (newIt != newEnd && newEntities[newIt].offset < oldEntityEnd) {
      ++newIt;
    }
  }
  while (newIt != newEnd) {
    result.push(newEntities[newIt]);
    ++newIt;
  }

  return result;
}

export function isPlainDomain(url: Uint8Array) {
  return url.indexOf(CODEPOINTS["/"]) >= url.length && url.indexOf(CODEPOINTS["?"]) >= url.length &&
    url.indexOf(CODEPOINTS["#"]) >= url.length;
}

// I know originally this is a class, but for now this'll work.
export interface FormattedText {
  text: Uint8Array;
  entities: MessageEntity[];
}

export function getFirstUrl(text: FormattedText) {
  for (const entity of text.entities) {
    switch (entity.type) {
      case "mention":
      case "hashtag":
      case "cashtag":
      case "bot_command":
        break;
      case "url": {
        if (entity.length <= 4) continue;
        const url = utf8utf16Substr(text.text, entity.offset, entity.length);
        const scheme = toLower(url.slice(0, 4));
        if (
          areTypedArraysEqual(scheme, encode("ton:")) ||
          beginsWith(scheme, encode("tg:")) ||
          areTypedArraysEqual(scheme, encode("ftp:")) ||
          isPlainDomain(url)
        ) continue;
        return url;
      }
      case "email":
      case "phone_number":
      case "bold":
      case "italic":
      case "underline":
      case "strikethrough":
      case "spoiler":
      case "code":
      case "pre_code":
      case "block_quote":
      case "bank_card_number":
      case "custom_emoji":
      case "pre":
        break;
      case "text_link": {
        const url = entity.url;
        if (beginsWith(url, "ton:") || beginsWith(url, "tg:") || beginsWith(url, "ftp:")) continue;
        return url;
      }
      case "text_mention":
      case "media_timestamp":
        break;
    }
  }

  return "";
}

export function parseMarkdown(text: Uint8Array): FormattedText {
  let resultSize = 0;
  const entities: MessageEntity[] = [];
  const size = text.length;
  let utf16Offset = 0;

  for (let i = 0; i < size; i++) {
    const c = text[i], codepoint = text[i], next = text[i + 1];
    if (
      c === CODEPOINTS["\\"] &&
      (next === CODEPOINTS["_"] || next === CODEPOINTS["*"] || next === CODEPOINTS["`"] || next === CODEPOINTS["["])
    ) {
      i++;
      text[resultSize++] = text[i];
      utf16Offset++;
      continue;
    }

    if (c !== CODEPOINTS["_"] && c !== CODEPOINTS["*"] && c !== CODEPOINTS["`"] && c !== CODEPOINTS["["]) {
      if (isUTF8CharacterFirstCodeUnit(codepoint)) {
        utf16Offset += 1 + ((codepoint >= 0xf0) ? 1 : 0);
      }
      text[resultSize++] = text[i];
      continue;
    }

    const beginPos = i;
    let endCharacter = text[i];
    let isPre = false;
    if (c === CODEPOINTS["["]) endCharacter = CODEPOINTS["]"];

    i++;

    let language: Uint8Array | undefined = undefined;
    if (c === CODEPOINTS["`"] && text[i] === CODEPOINTS["`"] && text[i + 1] === CODEPOINTS["`"]) {
      i += 2;
      isPre = true;
      let languageEnd = i;

      while (!isSpace(text[languageEnd]) && text[languageEnd] !== CODEPOINTS["`"]) {
        languageEnd++;
      }

      if (i != languageEnd && languageEnd < size && text[languageEnd] !== CODEPOINTS["`"]) {
        language = text.slice(i, languageEnd);
        i = languageEnd;
      }

      const current = text[i], next = text[i + 1];
      if (current === CODEPOINTS["\n"] || current === CODEPOINTS["\r"]) {
        if ((next === CODEPOINTS["\n"] || next === CODEPOINTS["\r"]) && current !== next) {
          i += 2;
        } else {
          i++;
        }
      }
    }

    const entityOffset = utf16Offset;
    while (
      i < size &&
      (text[i] !== endCharacter ||
        (isPre && !(text[i + 1] === CODEPOINTS["`"] && text[i + 2] === CODEPOINTS["`"])))
    ) {
      const curCh = text[i];
      if (isUTF8CharacterFirstCodeUnit(curCh)) {
        utf16Offset += 1 + (curCh >= 0xf0 ? 1 : 0);
      }
      text[resultSize++] = text[i++];
    }

    if (i == size) {
      throw new Error("Can't find end of the entity starting at byte offset " + beginPos);
    }

    if (entityOffset != utf16Offset) {
      const entityLength = utf16Offset - entityOffset;
      switch (c) {
        case CODEPOINTS["_"]:
          entities.push({ type: "italic", offset: entityOffset, length: entityLength });
          break;
        case CODEPOINTS["*"]:
          entities.push({ type: "bold", offset: entityOffset, length: entityLength });
          break;
        case CODEPOINTS["["]: {
          let url = new Uint8Array();
          if (text[i + 1] !== CODEPOINTS["("]) {
            url = text.slice(beginPos + 1, i);
          } else {
            i += 2;
            const url_: number[] = [];
            while (i < size && text[i] !== CODEPOINTS[")"]) {
              url_.push(text[i++]);
            }
            url = Uint8Array.from(url_);
          }
          const userId = LinkManager.getLinkUserId(url);
          if (userId.isValid()) {
            entities.push({ type: "text_mention", offset: entityOffset, length: entityLength, user_id: userId });
          } else {
            url = LinkManager.getCheckedLink(url);
            if (url.length != 0) {
              entities.push({ type: "text_link", offset: entityOffset, length: entityLength, url: url });
            }
          }
          break;
        }
        case CODEPOINTS["`"]:
          if (isPre) {
            if (language == null || language.length === 0) {
              entities.push({ type: "pre", offset: entityOffset, length: entityLength });
            } else {
              entities.push({ type: "pre_code", offset: entityOffset, length: entityLength, language });
            }
          } else {
            entities.push({ type: "code", offset: entityOffset, length: entityLength });
          }
          break;
        default:
          throw new Error("UNREACHABLE");
      }
    }

    if (isPre) {
      i += 2;
    }
  }

  return { text: text.slice(0, resultSize), entities };
}

export interface EntityInfo {
  type: MessageEntityType;
  argument: Uint8Array;
  entityOffset: number;
  entityByteOffset: number;
  entityBeginPos: number;
}

export function parseMarkdownV2(text: Uint8Array): FormattedText {
  let resultSize = 0;
  let entities: MessageEntity[] = [];
  let utf16Offset = 0;

  const nestedEntities: EntityInfo[] = [];

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === CODEPOINTS["\\"] && text[i + 1] != null && text[i + 1] > 0 && text[i + 1] <= 126) {
      i++;
      utf16Offset += 1;
      text[resultSize++] = text[i];
      continue;
    }

    let reservedCharacters = encode("_*[]()~`>#+-=|{}.!");
    if (nestedEntities.length != 0) {
      switch (nestedEntities[nestedEntities.length - 1].type) {
        case MessageEntityType.Code:
        case MessageEntityType.Pre:
        case MessageEntityType.PreCode:
          reservedCharacters = encode("`");
          break;
        default:
          break;
      }
    }

    if (!reservedCharacters.includes(text[i])) {
      if (isUTF8CharacterFirstCodeUnit(c)) {
        utf16Offset += 1 + (c >= 0xf0 ? 1 : 0);
      }
      text[resultSize++] = text[i];
      continue;
    }

    let isEndOfAnEntity = false;
    if (nestedEntities.length !== 0) {
      isEndOfAnEntity = (() => {
        switch (nestedEntities[nestedEntities.length - 1].type) {
          case MessageEntityType.Bold:
            return c === CODEPOINTS["*"];
          case MessageEntityType.Italic:
            return c === CODEPOINTS["_"] && text[i + 1] !== CODEPOINTS["_"];
          case MessageEntityType.Code:
            return c === CODEPOINTS["`"];
          case MessageEntityType.Pre:
          case MessageEntityType.PreCode:
            return c === CODEPOINTS["`"] && text[i + 1] === CODEPOINTS["`"] && text[i + 2] === CODEPOINTS["`"];
          case MessageEntityType.TextUrl:
            return c === CODEPOINTS["]"];
          case MessageEntityType.Underline:
            return c === CODEPOINTS["_"] && text[i + 1] === CODEPOINTS["_"];
          case MessageEntityType.Strikethrough:
            return c === CODEPOINTS["~"];
          case MessageEntityType.Spoiler:
            return c === CODEPOINTS["|"] && text[i + 1] === CODEPOINTS["|"];
          case MessageEntityType.CustomEmoji:
            return c === CODEPOINTS["]"];
          default:
            unreachable();
        }
      })();
    }

    if (!isEndOfAnEntity) {
      let type: MessageEntityType;
      let argument = new Uint8Array();
      const entityByteOffset = i;

      switch (c) {
        case CODEPOINTS["_"]:
          if (text[i + 1] === CODEPOINTS["_"]) {
            type = MessageEntityType.Underline;
            i++;
          } else {
            type = MessageEntityType.Italic;
          }
          break;
        case CODEPOINTS["*"]:
          type = MessageEntityType.Bold;
          break;
        case CODEPOINTS["~"]:
          type = MessageEntityType.Strikethrough;
          break;
        case CODEPOINTS["|"]:
          if (text[i + 1] === CODEPOINTS["|"]) {
            i++;
            type = MessageEntityType.Spoiler;
          } else {
            throw new Error(`Character '${decode(c)}' is reserved and must be escaped with the preceding '\\'`);
          }
          break;
        case CODEPOINTS["["]:
          type = MessageEntityType.TextUrl;
          break;
        case CODEPOINTS["`"]:
          if (text[i + 1] === CODEPOINTS["`"] && text[i + 2] === CODEPOINTS["`"]) {
            i += 3;
            type = MessageEntityType.Pre;
            let languageEnd = i;
            while (text[languageEnd] != null && !isSpace(text[languageEnd]) && text[languageEnd] !== CODEPOINTS["`"]) {
              languageEnd++;
            }
            if (i !== languageEnd && languageEnd < text.length && text[languageEnd] !== CODEPOINTS["`"]) {
              type = MessageEntityType.PreCode;
              argument = text.slice(i, languageEnd);
              i = languageEnd;
            }
            const current = text[i], next = text[i + 1];
            if (current === CODEPOINTS["\n"] || current === CODEPOINTS["\r"]) {
              if ((next === CODEPOINTS["\n"] || next === CODEPOINTS["\r"]) && current !== next) {
                i += 2;
              } else {
                i++;
              }
            }

            i--;
          } else {
            type = MessageEntityType.Code;
          }
          break;
        case CODEPOINTS["!"]:
          if (text[i + 1] === CODEPOINTS["["]) {
            i++;
            type = MessageEntityType.CustomEmoji;
          } else {
            throw new Error(`Character '${decode(c)}' is reserved and must be escaped with the preceding '\\'`);
          }
          break;
        default:
          throw new Error(`Character '${decode(c)}' is reserved and must be escaped with the preceding '\\'`);
      }

      nestedEntities.push({ type, argument, entityOffset: utf16Offset, entityByteOffset, entityBeginPos: resultSize });
    } else {
      let { type, argument } = nestedEntities[nestedEntities.length - 1];
      let userId = new UserId();
      let customEmojiId = new CustomEmojiId();
      let skipEntity = utf16Offset == nestedEntities.at(-1)!.entityOffset;
      switch (type) {
        case MessageEntityType.Bold:
        case MessageEntityType.Italic:
        case MessageEntityType.Code:
        case MessageEntityType.Strikethrough:
          break;
        case MessageEntityType.Underline:
        case MessageEntityType.Spoiler:
          i++;
          break;
        case MessageEntityType.Pre:
        case MessageEntityType.PreCode:
          i += 2;
          break;
        case MessageEntityType.TextUrl: {
          let url: Uint8Array;
          if (text[i + 1] !== CODEPOINTS["("]) {
            url = text.slice(nestedEntities.at(-1)!.entityBeginPos, resultSize);
          } else {
            i += 2;
            const urlBeginPos = i;
            const url_: number[] = [];
            while (i < text.length && text[i] !== CODEPOINTS[")"]) {
              if (text[i] === CODEPOINTS["\\"] && text[i + 1] > 0 && text[i + 1] <= 126) {
                url_.push(text[i + 1]);
                i += 2;
                continue;
              }
              url_.push(text[i++]);
            }
            url = Uint8Array.from(url_);

            if (text[i] !== CODEPOINTS[")"]) {
              throw new Error("Can't find end of a URL at byte offset " + urlBeginPos);
            }
          }
          userId = LinkManager.getLinkUserId(url);
          if (!userId.isValid()) {
            url = LinkManager.getCheckedLink(url);
            if (url.length === 0) {
              skipEntity = true;
            } else {
              argument = url;
            }
          }
          break;
        }
        case MessageEntityType.CustomEmoji: {
          if (text[i + 1] !== CODEPOINTS["("]) {
            throw new Error("Custom emoji entity must contain a tg://emoji URL");
          }
          i += 2;
          const url_: number[] = [];
          const urlBeginPos = i;
          while (i < text.length && text[i] !== CODEPOINTS[")"]) {
            if (text[i] === CODEPOINTS["\\"] && text[i + 1] > 0 && text[i + 1] <= 126) {
              url_.push(text[i + 1]);
              i += 2;
              continue;
            }
            url_.push(text[i++]);
          }
          const url = Uint8Array.from(url_);

          if (text[i] !== CODEPOINTS[")"]) {
            throw new Error("Can't find end of a custom emoji URL at byte offset " + urlBeginPos);
          }
          customEmojiId = LinkManager.getLinkCustomEmojiId(url);
          break;
        }
        default:
          unreachable();
      }

      if (!skipEntity) {
        const entityOffset = nestedEntities.at(-1)!.entityOffset;
        const entityLength = utf16Offset - entityOffset;
        if (userId.isValid()) {
          entities.push({ type: "text_mention", offset: entityOffset, length: entityLength, user_id: userId });
        } else if (customEmojiId.isValid()) {
          entities.push({
            type: "custom_emoji",
            offset: entityOffset,
            length: entityLength,
            custom_emoji_id: customEmojiId,
          });
        } else {
          const entity: MessageEntity = {
            ...(
              type === MessageEntityType.TextUrl
                ? { type: "text_link", url: argument }
                : type === MessageEntityType.PreCode
                ? { type: "pre_code", language: argument }
                : { type: convertEntityTypeEnumToString(type) as MessageEntity.CommonMessageEntity["type"] }
            ),
            offset: entityOffset,
            length: entityLength,
          };
          entities.push(entity);
        }
      }

      nestedEntities.pop();
    }
  }

  if (nestedEntities.length != 0) {
    const last = nestedEntities[nestedEntities.length - 1];
    throw new Error(
      `Can't find end of ${
        convertEntityTypeEnumToStyledString(last.type)
      } entity at byte offset ${last.entityByteOffset}`,
    );
  }

  entities = sortEntities(entities);

  return { text: text.slice(0, resultSize), entities };
}

// deno-lint-ignore no-explicit-any
function isUint8Array(x: any): x is Uint8Array {
  return x.BYTES_PER_ELEMENT === 1 && x.byteLength != null && x.length != null && x.subarray != null &&
    ArrayBuffer.isView(x.buffer);
}

export function decodeHTMLEntity(text: Uint8Array, pos: number) {
  CHECK(text[pos] === CODEPOINTS["&"]);
  let endPos = pos + 1;
  let res = 0;
  if (text[pos + 1] === CODEPOINTS["#"]) {
    endPos++;
    if (text[pos + 2] === CODEPOINTS["x"]) {
      endPos++;
      while (isHexDigit(text[endPos])) {
        res = res * 16 + hexToInt(text[endPos++]);
      }
    } else {
      while (isDigit(text[endPos])) {
        res = res * 10 + text[endPos++] - CODEPOINTS["0"];
      }
    }
    if (res == 0 || res >= 0x10ffff || endPos - pos >= 10) {
      return 0;
    }
  } else {
    while (isAlpha(text[endPos])) {
      endPos++;
    }
    const entity = text.slice(pos + 1, endPos);
    if (areTypedArraysEqual(entity, "lt")) {
      res = CODEPOINTS["<"];
    } else if (areTypedArraysEqual(entity, "gt")) {
      res = CODEPOINTS[">"];
    } else if (areTypedArraysEqual(entity, "amp")) {
      res = CODEPOINTS["&"];
    } else if (areTypedArraysEqual(entity, "quot")) {
      res = CODEPOINTS['"'];
    } else {
      return 0;
    }
  }

  if (text[endPos] === CODEPOINTS[";"]) {
    pos = endPos + 1;
  } else {
    pos = endPos;
  }

  return { res, pos };
}

// deno-fmt-ignore
export const TAG_NAMES = [
  "a",          "b",
  "strong",     "i",
  "em",         "s",
  "strike",     "del",
  "u",          "ins",
  "tg-spoiler", "tg-emoji",
  "span",       "pre",
  "code"
];

export function parseHTML(str: Uint8Array) {
  const strSize = str.length;
  const text = str;
  let resultEnd = 0;
  const resultBegin = resultEnd;

  let entities: MessageEntity[] = [];
  let utf16Offset = 0;
  let needRecheckUtf8 = false;

  interface EntityInfo {
    tagName: Uint8Array;
    argument: Uint8Array;
    entityOffset: number;
    entityBeginPos: number;
  }
  const nestedEntities: EntityInfo[] = [];

  for (let i = 0; i < strSize; i++) {
    const c = text[i];
    if (c != null && c === CODEPOINTS["&"]) {
      const code = decodeHTMLEntity(str, i);
      if (code !== 0) {
        i = code.pos;
        i--;
        utf16Offset += 1 + (code.res > 0xffff ? 1 : 0);
        if (code.res >= 0xd800 && code.res <= 0xdfff) {
          needRecheckUtf8 = true;
        }
        resultEnd = appendUTF8CharacterUnsafe(str, resultEnd, code.res);
        CHECK(resultEnd <= resultBegin + i);
        continue;
      }
    }
    if (c != null && c !== CODEPOINTS["<"]) {
      if (isUTF8CharacterFirstCodeUnit(c)) {
        utf16Offset += 1 + (c >= 0xf0 ? 1 : 0);
      }
      str[resultEnd++] = c;
      continue;
    }

    const beginPos = i++;
    if (text[i] != null && text[i] !== CODEPOINTS["/"]) {
      while (text[i] != null && !isSpace(text[i]) && text[i] != CODEPOINTS[">"]) {
        i++;
      }
      if (text[i] == null || text[i] == 0) {
        throw new Error("Unclosed start tag at byte offset " + beginPos);
      }

      const tagName = toLower(text.slice(beginPos + 1, i));

      if (!TAG_NAMES.some((allowedTag) => areTypedArraysEqual(tagName, allowedTag))) {
        throw new Error('Unsupported start tag "' + decode(tagName) + '" at byte offset ' + beginPos);
      }

      let argument = new Uint8Array();

      while (text[i] != null && text[i] != CODEPOINTS[">"]) {
        while (text[i] != null && text[i] !== 0 && isSpace(text[i])) {
          i++;
        }
        if (text[i] === CODEPOINTS[">"]) {
          break;
        }
        const attributeBeginPos = i;
        while (text[i] != null && !isSpace(text[i]) && text[i] !== CODEPOINTS["="]) {
          i++;
        }
        const attributeName = text.slice(attributeBeginPos, i);
        if (attributeName.length === 0) {
          throw new Error('Empty attribute name in the tag "' + decode(tagName) + '" at byte offset ' + beginPos);
        }
        while (text[i] !== 0 && isSpace(text[i])) {
          i++;
        }
        if (text[i] !== CODEPOINTS["="]) {
          throw new Error(
            'Expected equal sign in declaration of an attribute of the tag "' + decode(tagName) + '" at byte offset ' +
              beginPos,
          );
        }
        i++;
        while (text[i] !== 0 && isSpace(text[i])) {
          i++;
        }
        if (text[i] == null || text[i] === 0) {
          throw new Error('Unclosed start tag "' + decode(tagName) + '" at byte offset ' + beginPos);
        }

        let attributeValue: Uint8Array;
        if (text[i] != null && text[i] !== CODEPOINTS["'"] && text[i] !== CODEPOINTS['"']) {
          const tokenBeginPos = i;
          while (isAlNum(text[i]) || text[i] === CODEPOINTS["."] || text[i] === CODEPOINTS["-"]) {
            i++;
          }
          attributeValue = toLower(text.slice(tokenBeginPos, i));

          if (text[i] != null && !isSpace(text[i]) && text[i] !== CODEPOINTS[">"]) {
            throw new Error("Unexpected end of name token at byte offset " + tokenBeginPos);
          }
        } else {
          const endCharacter = text[i++];
          let attributeEnd = str[i];
          const attributeBegin = attributeEnd;
          while (text[i] !== endCharacter && text[i] !== 0 && text[i] != null) {
            if (text[i] === CODEPOINTS["&"]) {
              const code = decodeHTMLEntity(str, i);
              if (code !== 0) {
                i = code.pos;
                attributeEnd = appendUTF8CharacterUnsafe(str, attributeEnd, code.res);
                continue;
              }
            }
            str[attributeEnd++] = text[i++];
          }
          if (text[i] === endCharacter) {
            i++;
          }
          attributeValue = str.slice(attributeBegin, attributeEnd);
        }
        if (text[i] == null || text[i] === 0) {
          throw new Error("Unclosed start tag at byte offset " + beginPos);
        }

        if (areTypedArraysEqual(tagName, "a") && areTypedArraysEqual(attributeName, "href")) {
          argument = attributeValue;
        } else if (
          areTypedArraysEqual(tagName, "code") && areTypedArraysEqual(attributeName, "class") &&
          beginsWith(attributeValue, "language-")
        ) {
          argument = attributeValue.slice(9);
        } else if (
          areTypedArraysEqual(tagName, "span") && areTypedArraysEqual(attributeName, "class") &&
          beginsWith(attributeValue, "tg-")
        ) {
          argument = attributeValue.slice(3);
        } else if (areTypedArraysEqual(tagName, "tg-emoji") && areTypedArraysEqual(attributeName, "emoji-id")) {
          argument = attributeValue;
        }
      }

      if (areTypedArraysEqual(tagName, "span") && !areTypedArraysEqual(argument, "spoiler")) {
        throw new Error('Tag "span" must have class "tg-spoiler" at byte offset ' + beginPos);
      }

      nestedEntities.push({ tagName, argument, entityOffset: utf16Offset, entityBeginPos: resultEnd - resultBegin });
    } else {
      if (nestedEntities.length === 0) {
        throw new Error("Unexpected end tag at byte offset " + beginPos);
      }

      while (text[i] != null && !isSpace(text[i]) && text[i] !== CODEPOINTS[">"]) {
        i++;
      }
      const endTagName = toLower(text.slice(beginPos + 2, i));
      while (isSpace(text[i]) && text[i] !== 0) {
        i++;
      }
      if (text[i] !== CODEPOINTS[">"]) {
        throw new Error("Unclosed end tag at byte offset " + beginPos);
      }

      const tagName = nestedEntities.at(-1)!.tagName;
      if (endTagName.length !== 0 && !areTypedArraysEqual(endTagName, tagName)) {
        throw new Error(
          "Unmatched end tag at byte offset " + beginPos + ', expected "</' + decode(tagName) + '>", found "</' +
            decode(endTagName) + '>"',
        );
      }

      if (utf16Offset > nestedEntities.at(-1)!.entityOffset) {
        const entityOffset = nestedEntities.at(-1)!.entityOffset;
        const entityLength = utf16Offset - entityOffset;
        if (areTypedArraysEqual(tagName, "i") || areTypedArraysEqual(tagName, "em")) {
          entities.push({ type: "italic", offset: entityOffset, length: entityLength });
        } else if (areTypedArraysEqual(tagName, "b") || areTypedArraysEqual(tagName, "strong")) {
          entities.push({ type: "bold", offset: entityOffset, length: entityLength });
        } else if (
          areTypedArraysEqual(tagName, "s") || areTypedArraysEqual(tagName, "strike") ||
          areTypedArraysEqual(tagName, "del")
        ) {
          entities.push({ type: "strikethrough", offset: entityOffset, length: entityLength });
        } else if (areTypedArraysEqual(tagName, "u") || areTypedArraysEqual(tagName, "ins")) {
          entities.push({ type: "underline", offset: entityOffset, length: entityLength });
        } else if (
          areTypedArraysEqual(tagName, "tg-spoiler") ||
          (areTypedArraysEqual(tagName, "span") && areTypedArraysEqual(nestedEntities.at(-1)!.argument, "spoiler"))
        ) {
          entities.push({ type: "spoiler", offset: entityOffset, length: entityLength });
        } else if (areTypedArraysEqual(tagName, "tg-emoji")) {
          const documentId = toInteger(nestedEntities.at(-1)!.argument);
          const rDocumentId = BigInt(isNaN(documentId) ? 0 : documentId);
          if (rDocumentId === 0n) {
            throw new Error("Invalid custom emoji identifier specified");
          }
          entities.push({
            type: "custom_emoji",
            offset: entityOffset,
            length: entityLength,
            custom_emoji_id: new CustomEmojiId(rDocumentId),
          });
        } else if (areTypedArraysEqual(tagName, "a")) {
          let url = nestedEntities.at(-1)!.argument;
          if (url.length === 0) {
            url = str.slice(nestedEntities.at(-1)!.entityBeginPos, resultEnd);
          }
          const userId = LinkManager.getLinkUserId(url);
          if (userId.isValid()) {
            entities.push({ type: "text_mention", offset: entityOffset, length: entityLength, user_id: userId });
          } else {
            url = LinkManager.getCheckedLink(url);
            if (url.length !== 0) {
              entities.push({ type: "text_link", offset: entityOffset, length: entityLength, url });
            }
          }
        } else if (areTypedArraysEqual(tagName, "pre")) {
          const last = entities[entities.length - 1];
          if (
            entities.length !== 0 && last.type === "code" && last.offset === entityOffset &&
            last.length === entityLength && "argument" in last && last.argument != null &&
            (last.argument as Uint8Array).length !== 0
          ) {
            entities[entities.length - 1].type = "pre_code";
          } else {
            entities.push({ type: "pre", offset: entityOffset, length: entityLength });
          }
        } else if (areTypedArraysEqual(tagName, "code")) {
          const last = entities[entities.length - 1];
          const lastNested = nestedEntities[nestedEntities.length - 1];
          if (
            entities.length !== 0 && last.type === "pre" && last.offset === entityOffset &&
            last.length === entityLength && lastNested.argument.length !== 0
          ) {
            entities[entities.length - 1].type = "pre_code";
            (entities[entities.length - 1] as MessageEntity.PreMessageEntity).language = lastNested.argument;
          } else {
            entities.push({
              type: "code",
              offset: entityOffset,
              length: entityLength,
              // @ts-ignore This is how it is.
              argument: nestedEntities.at(-1)?.argument,
            });
          }
        } else {
          unreachable();
        }
      }

      nestedEntities.pop();
    }
  }
  if (nestedEntities.length !== 0) {
    throw new Error("Can't find end tag corresponding to start tag " + decode(nestedEntities.at(-1)!.tagName));
  }

  for (const entity of entities) {
    if (entity.type === "code" && "argument" in entity && (entity.argument as Uint8Array).length === 0) {
      delete entity.argument;
    }
  }

  entities = sortEntities(entities);

  str = str.subarray(0, resultEnd);
  if (needRecheckUtf8 && !checkUTF8(str)) {
    throw new Error(
      "Text contains invalid Unicode characters after decoding HTML entities, check for unmatched " +
        "surrogate code units",
    );
  }
  return { text: str, entities };
}
