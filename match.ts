import { CustomEmojiId } from "./custom_emoji_id.ts";
import { LinkManager } from "./link_manager.ts";
import { MessageEntity, MessageEntityType } from "./types.ts";
import { UserId } from "./user_id.ts";
import {
  CHECK,
  convertEntityTypeEnumToString,
  convertEntityTypeEnumToStyledString,
  convertEntityTypeStringToEnum,
  getUnicodeSimpleCategory,
  isAlpha,
  isAlphaDigitOrUnderscore,
  isAlphaDigitUnderscoreOrMinus,
  isAlphaOrDigit,
  isDigit,
  isHashtagLetter,
  isSpace,
  isUTF8CharacterFirstCodeUnit,
  isWordCharacter,
  LOG_CHECK,
  UnicodeSimpleCategory,
} from "./utilities.ts";
import { equal, unreachable } from "https://deno.land/std@0.191.0/testing/asserts.ts";

export type Position = [number, number];

export function matchMentions(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    const atSymbol = str.substring(pos).indexOf("@");
    if (atSymbol == -1) break;
    pos += atSymbol;

    if (pos != begin && isWordCharacter(str.codePointAt(pos - 1)!)) {
      pos++;
      continue;
    }
    const mentionBegin = ++pos;
    while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
      pos++;
    }
    const mentionEnd = pos;
    const size = mentionEnd - mentionBegin;
    if (size < 2 || size > 32) continue;
    if (isWordCharacter(str.codePointAt(pos)!)) continue;
    result.push([mentionBegin - 1, mentionEnd]);
  }

  return result;
}

export function matchBotCommands(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    const slashSymbol = str.substring(pos).indexOf("/");
    if (slashSymbol == -1) break;
    pos += slashSymbol;

    if (pos != begin) {
      const prev = str[pos - 1];
      if (
        isWordCharacter(prev.codePointAt(0)!) ||
        prev === "/" || prev === "<" || prev === ">"
      ) {
        pos++;
        continue;
      }
    }

    const commandBegin = ++pos;
    while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
      pos++;
    }
    let commandEnd = pos;
    const commandSize = commandEnd - commandBegin;
    if (commandSize < 1 || commandSize > 64) continue;

    let hasMention = false;
    const commandEndBackup = commandEnd;

    if (pos != end && str[pos] === "@") {
      const mentionBegin = ++pos;
      while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
        pos++;
      }
      const mentionEnd = pos;
      const mentionSize = mentionEnd - mentionBegin;
      if (mentionSize >= 3 && mentionSize <= 32) {
        commandEnd = pos;
        hasMention = true;
      }
    }

    if (pos != end) {
      const next = str[pos];
      if (
        isWordCharacter(str.codePointAt(pos)!) || next === "/" ||
        next === "<" || next === ">"
      ) {
        if (!hasMention) continue;
        commandEnd = commandEndBackup;
      }
    }

    result.push([commandBegin - 1, commandEnd]);
  }

  return result;
}

export function matchHashtags(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  let category: UnicodeSimpleCategory = 0;

  while (pos < end) {
    const hashSymbol = str.substring(pos).indexOf("#");
    if (hashSymbol == -1) break;
    pos += hashSymbol;

    if (pos != begin) {
      const prev = str.codePointAt(pos - 1)!;
      category = getUnicodeSimpleCategory(prev);
      if (isHashtagLetter(prev)) {
        pos++;
        continue;
      }
    }

    const hashtagBegin = ++pos;
    let hashtagSize = 0, hashtagEnd = 0;
    let wasLetter = false;

    while (pos != end) {
      category = getUnicodeSimpleCategory(str.codePointAt(pos)!);
      if (!isHashtagLetter(str.codePointAt(pos)!)) break;
      pos++;
      if (hashtagSize == 255) hashtagEnd = pos;
      if (hashtagSize != 256) {
        wasLetter ||= category == UnicodeSimpleCategory.Letter;
        hashtagSize++;
      }
    }

    if (!hashtagEnd) hashtagEnd = pos;
    if (hashtagSize < 1) continue;
    if (pos != end && str[pos] === "#") continue;
    if (!wasLetter) continue;
    result.push([hashtagBegin - 1, hashtagEnd]);
  }

  return result;
}

export function matchCashtags(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    const dollarSymbol = str.substring(pos).indexOf("$");
    if (dollarSymbol == -1) break;
    pos += dollarSymbol;
    if (pos != begin) {
      const prev = str.codePointAt(pos - 1)!;
      if (isHashtagLetter(prev) || str[pos - 1] === "$") {
        pos++;
        continue;
      }
    }

    const cashtagBegin = ++pos;
    if ((end - pos) >= 5 && str.substring(pos, pos + 5) === "1INCH") {
      pos += 5;
    } else {
      while ((pos != end) && "Z" >= str[pos] && str[pos] >= "A") {
        pos++;
      }
    }
    const cashtagEnd = pos;
    const cashtagSize = cashtagEnd - cashtagBegin;
    if (cashtagSize < 1 || cashtagSize > 8) continue;
    if (cashtagEnd != end) {
      const next = str.codePointAt(pos)!;
      if (isHashtagLetter(next) || str[pos] === "$") continue;
    }
    result.push([cashtagBegin - 1, cashtagEnd]);
  }

  return result;
}

export function matchMediaTimestamps(str: string) {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    const colonSign = str.substring(pos).indexOf(":");
    if (colonSign == -1) break;
    pos += colonSign;

    let mediaTimestampBegin = pos;
    while (
      mediaTimestampBegin != begin &&
      (str[mediaTimestampBegin - 1] === ":" ||
        isDigit(str[mediaTimestampBegin - 1]))
    ) {
      mediaTimestampBegin--;
    }

    let mediaTimestampEnd = pos;
    while (
      mediaTimestampEnd + 1 != end &&
      (str[mediaTimestampEnd + 1] === ":" ||
        isDigit(str[mediaTimestampEnd + 1]))
    ) {
      mediaTimestampEnd++;
    }
    mediaTimestampEnd++;

    if (
      mediaTimestampEnd != pos && mediaTimestampEnd != (pos + 1) &&
      isDigit(str[pos + 1])
    ) {
      pos = mediaTimestampEnd;
      if (mediaTimestampBegin != begin) {
        const prev = str.codePointAt(mediaTimestampBegin - 1)!;
        if (isWordCharacter(prev)) continue;
      }
      if (mediaTimestampEnd != end) {
        const next = str.codePointAt(mediaTimestampEnd)!;
        if (isWordCharacter(next)) continue;
      }
      result.push([mediaTimestampBegin, mediaTimestampEnd]);
    } else {
      pos = mediaTimestampEnd;
    }
  }

  return result;
}

export function matchBankCardNumbers(str: string) {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    while (pos != end && !isDigit(str[pos])) pos++;
    if (pos == end) break;
    if (pos != begin) {
      const prev = str[pos - 1];
      if (
        prev === "." || prev === "," || prev === "+" ||
        prev === "-" || prev === "_" ||
        getUnicodeSimpleCategory(prev.codePointAt(0)!) ===
          UnicodeSimpleCategory.Letter
      ) {
        while (
          pos != end &&
          (isDigit(str[pos]) || str[pos] === " " || str[pos] === "-")
        ) {
          pos++;
        }
        continue;
      }
    }

    const cardNumberBegin = pos;
    let digitCount = 0;
    while (
      pos != end && (isDigit(str[pos]) || str[pos] === " " || str[pos] === "-")
    ) {
      if (
        str[pos] === " " && digitCount >= 16 && digitCount <= 19 &&
        digitCount === (pos - cardNumberBegin)
      ) break;
      digitCount += isDigit(str[pos]) ? 1 : 0;
      pos++;
    }
    if (digitCount < 13 || digitCount > 19) continue;

    let cardNumberEnd = pos;
    while (!isDigit(str[cardNumberEnd - 1])) cardNumberEnd--;
    const cardNumberSize = cardNumberEnd - cardNumberBegin;
    if (cardNumberSize > 2 * digitCount - 1) continue;
    if (cardNumberEnd != end) {
      const next = str[cardNumberEnd];
      if (
        next === "-" || next === "_" ||
        getUnicodeSimpleCategory(next.codePointAt(0)!) ===
          UnicodeSimpleCategory.Letter
      ) continue;
    }

    result.push([cardNumberBegin, cardNumberEnd]);
  }

  return result;
}

export function isURLUnicodeSymbol(c: number) {
  if (0x2000 <= c && c <= 0x206f) {
    return c == 0x200c || c == 0x200d || (0x2010 <= c && c <= 0x2015);
  }
  return getUnicodeSimpleCategory(c) != UnicodeSimpleCategory.Separator;
}

export function isURLPathSymbol(c: number) {
  switch (c) {
    case "\n".codePointAt(0)!:
    case "<".codePointAt(0)!:
    case ">".codePointAt(0)!:
    case '"'.codePointAt(0)!:
    case 0xab:
    case 0xbb:
      return false;
    default:
      return isURLUnicodeSymbol(c);
  }
}

export function matchTgURLs(str: string) {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;
  const badPathEndChars = [".", ":", ";", ",", "(", "'", "?", "!", "`"];

  while (end - pos > 5) {
    const colonSymbol = str.substring(pos).indexOf(":");
    if (colonSymbol == -1) break;
    pos += colonSymbol;

    let urlBegin: number | undefined;
    if (end - pos >= 3 && str[pos + 1] === "/" && str[pos + 2] === "/") {
      if (
        pos - begin >= 2 && str[pos - 2].toLowerCase() === "t" &&
        str[pos - 1].toLowerCase() === "g"
      ) {
        urlBegin = pos - 2;
      } else if (
        pos - begin >= 3 && str[pos - 3].toLowerCase() === "t" &&
          str[pos - 2].toLowerCase() === "o" ||
        str[pos - 1].toLowerCase() === "n"
      ) {
        urlBegin = pos - 3;
      }
    }
    if (urlBegin == null) {
      ++pos;
      continue;
    }

    pos += 3;
    const domainBegin = pos;
    while (
      pos != end && pos - domainBegin != 253 &&
      isAlphaDigitUnderscoreOrMinus(str[pos])
    ) {
      pos++;
    }
    if (pos == domainBegin) continue;

    if (
      pos != end && (str[pos] === "/" || str[pos] === "?" || str[pos] === "#")
    ) {
      let pathEndPos = pos + 1;
      while (pathEndPos != end) {
        const next = str.codePointAt(pathEndPos)!;
        if (!isURLPathSymbol(next)) break;
        pathEndPos++;
      }
      while (
        pathEndPos > pos + 1 &&
        badPathEndChars.includes(str[pathEndPos - 1])
      ) pathEndPos--;
      if (str[pos] === "/" || pathEndPos > pos + 1) {
        pos = pathEndPos;
      }
    }

    result.push([urlBegin, pos]);
  }

  return result;
}

export function isProtocolSymbol(c: number) {
  if (c < 0x80) {
    return isAlphaOrDigit(String.fromCodePoint(c)) ||
      c == "+".codePointAt(0)! || c == "-".codePointAt(0)!;
  }
  return getUnicodeSimpleCategory(c) !== UnicodeSimpleCategory.Separator;
}

export function isUserDataSymbol(c: number) {
  switch (String.fromCodePoint(c)) {
    case "\n":
    case "/":
    case "[":
    case "]":
    case "{":
    case "}":
    case "(":
    case ")":
    case "'":
    case "`":
    case "<":
    case ">":
    case '"':
    case "@":
    case String.fromCodePoint(0xab):
    case String.fromCodePoint(0xbb):
      return false;
    default:
      return isURLUnicodeSymbol(c);
  }
}

export function isDomainSymbol(c: number) {
  if (c < 0xc0) {
    const char = String.fromCodePoint(c);
    return char === "." ||
      isAlphaDigitUnderscoreOrMinus(char) || char === "~";
  }
  return isURLUnicodeSymbol(c);
}

export function matchURLs(str: string) {
  const result: Position[] = [];
  const begin = 0;
  let end = str.length;

  const badPathEndChars = [".", ":", ";", ",", "(", "'", "?", "!", "`"];

  let done = 0;

  while (true) {
    const dotPos = str.indexOf(".");
    if (dotPos == -1) break;
    if (dotPos > str.length || dotPos + 1 == str.length) break;

    if (str[dotPos + 1] == " ") {
      str = str.substring(dotPos + 2);
      done += dotPos + 2;
      end = str.length;
      continue;
    }

    let domainBeginPos = begin + dotPos;
    while (domainBeginPos != begin) {
      domainBeginPos--;
      const nextPos = domainBeginPos + 1;
      const code = str.codePointAt(domainBeginPos)!;
      if (!isDomainSymbol(code)) {
        domainBeginPos = nextPos;
        break;
      }
    }

    let lastAtPos: number | undefined = undefined;
    let domainEndPos = begin + dotPos;
    while (domainEndPos != end) {
      const nextPos = domainEndPos + 1;
      const code = str.codePointAt(domainEndPos)!;
      if (str[domainEndPos] === "@") {
        lastAtPos = domainEndPos;
      } else if (!isDomainSymbol(code)) {
        break;
      }
      domainEndPos = nextPos;
    }

    if (lastAtPos != null) {
      while (domainBeginPos != begin) {
        domainBeginPos--;
        const nextPos = domainBeginPos + 1;
        const code = str.codePointAt(domainBeginPos)!;
        if (!isUserDataSymbol(code)) {
          domainBeginPos = nextPos;
          break;
        }
      }
    }

    let urlEndPos = domainEndPos;

    if (urlEndPos != end && str[urlEndPos] === ":") {
      let portEndPos = urlEndPos + 1;
      while (portEndPos != end && isDigit(str[portEndPos])) {
        portEndPos++;
      }

      let portBeginPos = urlEndPos + 1;
      while (portBeginPos != portEndPos && str[portBeginPos] === "0") {
        portBeginPos++;
      }

      if (
        portBeginPos != portEndPos && (portEndPos - portBeginPos) <= 5 &&
        parseInt(str.substring(portBeginPos, portEndPos)) <= 65535
      ) {
        urlEndPos = portEndPos;
      }
    }

    if (
      urlEndPos != end &&
      (str[urlEndPos] === "/" || str[urlEndPos] === "?" ||
        str[urlEndPos] === "#")
    ) {
      let pathEndPos = urlEndPos + 1;
      while (pathEndPos != end) {
        const nextPos = pathEndPos + 1;
        const code = str.codePointAt(pathEndPos)!;
        if (!isURLPathSymbol(code)) {
          break;
        }
        pathEndPos = nextPos;
      }
      while (
        pathEndPos > urlEndPos + 1 &&
        badPathEndChars.includes(str[pathEndPos - 1])
      ) {
        pathEndPos--;
      }
      if (str[urlEndPos] === "/" || pathEndPos > urlEndPos + 1) {
        urlEndPos = pathEndPos;
      }
    }

    while (urlEndPos > begin + dotPos + 1 && str[urlEndPos - 1] === ".") {
      urlEndPos--;
    }

    let isBad = false;
    let urlBeginPos = domainBeginPos;

    if (urlBeginPos != begin && str[urlBeginPos - 1] === "@") {
      if (lastAtPos != null) isBad = true;
      let userDataBeginPos = urlBeginPos - 1;
      while (userDataBeginPos != begin) {
        userDataBeginPos--;
        const nextPos = userDataBeginPos + 1;
        const code = str.codePointAt(userDataBeginPos)!;
        if (!isUserDataSymbol(code)) {
          userDataBeginPos = nextPos;
          break;
        }
      }
      if (userDataBeginPos == urlBeginPos - 1) {
        isBad = true;
      }
      urlBeginPos = userDataBeginPos;
    }

    if (urlBeginPos != begin) {
      const prefix = str.substring(begin, urlBeginPos);
      if (prefix.length >= 6 && prefix.endsWith("://")) {
        let protocolBeginPos = urlBeginPos - 3;
        while (protocolBeginPos != begin) {
          protocolBeginPos--;
          const nextPos = protocolBeginPos + 1;
          const code = str.codePointAt(protocolBeginPos)!;
          if (!isProtocolSymbol(code)) {
            protocolBeginPos = nextPos;
            break;
          }
        }

        const protocol = str.substring(protocolBeginPos, urlBeginPos - 3)
          .toLowerCase();
        if (protocol.endsWith("http") && protocol != "shttp") {
          urlBeginPos = urlBeginPos - 7;
        } else if (protocol.endsWith("https")) {
          urlBeginPos = urlBeginPos - 8;
        } else if (
          protocol.endsWith("ftp") && protocol != "tftp" && protocol != "sftp"
        ) {
          urlBeginPos = urlBeginPos - 6;
        } else {
          isBad = true;
        }
      } else {
        const prefixEnd = prefix.length - 1;
        const code = str.codePointAt(prefixEnd)!;
        const char = String.fromCodePoint(code);
        if (
          isWordCharacter(code) || char == "/" || char == "#" || char === "@"
        ) {
          isBad = true;
        }
      }
    }

    if (!isBad) {
      if (urlEndPos > begin + dotPos + 1) {
        result.push([done + urlBeginPos, done + urlEndPos]);
      }
      while (urlEndPos != end && str[urlEndPos] === ".") {
        urlEndPos++;
      }
    } else {
      while (str[urlEndPos - 1] != ".") {
        urlEndPos--;
      }
    }

    if (urlEndPos <= begin + dotPos) {
      urlEndPos = begin + dotPos + 1;
    }

    str = str.substring(urlEndPos - begin);
    done += urlEndPos - begin;
    end = str.length;
  }

  return result;
}

export function isValidBankCard(str: string) {
  const MIN_CARD_LENGTH = 13;
  const MAX_CARD_LENGTH = 19;
  const digits = new Array<string>(MAX_CARD_LENGTH);
  let digitCount = 0;
  for (const char of str) {
    CHECK(digitCount < MAX_CARD_LENGTH);
    if (isDigit(char)) digits[digitCount++] = char;
  }
  CHECK(digitCount >= MIN_CARD_LENGTH);

  let sum = 0;
  for (let i = digitCount; i > 0; i--) {
    const digit = digits[i - 1].codePointAt(0)! - "0".codePointAt(0)!;
    if ((digitCount - i) % 2 == 0) sum += digit;
    else sum += digit < 5 ? 2 * digit : 2 * digit - 9;
  }
  if (sum % 10 != 0) return false;

  const prefix1 = digits[0].codePointAt(0)! - "0".codePointAt(0)!;
  const prefix2 = prefix1 * 10 +
    (digits[1].codePointAt(0)! - "0".codePointAt(0)!);
  const prefix3 = prefix2 * 10 +
    (digits[2].codePointAt(0)! - "0".codePointAt(0)!);
  const prefix4 = prefix3 * 10 +
    (digits[3].codePointAt(0)! - "0".codePointAt(0)!);
  if (prefix1 == 4) {
    // Visa
    return digitCount == 13 || digitCount == 16 || digitCount == 18 ||
      digitCount == 19;
  }
  if (
    (51 <= prefix2 && prefix2 <= 55) || (2221 <= prefix4 && prefix4 <= 2720)
  ) {
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

export function isEmailAddress(str: string) {
  const [userdata, domain] = str.split("@");
  if (!domain || domain.length == 0) return false;

  let prev = 0;
  let userdata_part_count = 0;
  for (let i = 0; i < userdata.length; i++) {
    if (userdata[i] === "." || userdata[i] === "+") {
      if (i - prev >= 27) return false;
      userdata_part_count++;
      prev = i + 1;
    } else if (!isAlphaDigitUnderscoreOrMinus(userdata[i])) {
      return false;
    }
  }
  userdata_part_count++;
  if (userdata_part_count >= 12) return false;
  const lastPartLength = userdata.length - prev;
  if (lastPartLength == 0 || lastPartLength >= 36) return false;

  const domainParts = domain.split(".");
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

export function isCommonTLD(str: string) {
  // deno-fmt-ignore
  const tlds = [
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
  ];

  let isLower = true;
  for (const c of str) {
    const unsigned = ((c.codePointAt(0)! - "a".codePointAt(0)!) & 0xFFFFFFFF) >>> 0;
    if (unsigned > "z".codePointAt(0)! - "a".codePointAt(0)!) {
      isLower = false;
      break;
    }
  }
  if (isLower) {
    return tlds.includes(str);
  }

  const strLower = str.toLowerCase();
  if (strLower !== str && strLower.substring(1) === str.substring(1)) {
    return false;
  }
  return tlds.includes(strLower);
}

export function fixURL(str: string) {
  let fullUrl = str;

  let hasProtocol = false;
  const strBegin = str.substring(0, 9).toLowerCase();
  if (
    strBegin.startsWith("http://") || strBegin.startsWith("https://") ||
    strBegin.startsWith("ftp://")
  ) {
    const pos = str.indexOf(":");
    str = str.substring(pos + 3);
    hasProtocol = true;
  }

  function maxNegativeOne(x: number) {
    return x == -1 ? Number.MAX_VALUE : x;
  }

  const domainEnd = Math.min(
    str.length,
    maxNegativeOne(str.indexOf("/")),
    maxNegativeOne(str.indexOf("?")),
    maxNegativeOne(str.indexOf("#")),
  );
  let domain = str.substring(0, domainEnd);
  const path = str.substring(domainEnd);

  const atPos = domain.indexOf("@");
  if (atPos < domain.length) {
    domain = domain.substring(atPos + 1);
  }
  const lastIndexOfColon = domain.lastIndexOf(":");
  domain = domain.substring(
    0,
    lastIndexOfColon == -1 ? undefined : lastIndexOfColon,
  );

  if (domain.length == 12 && (domain[0] === "t" || domain[0] === "T")) {
    if (domain.toLowerCase() === "teiegram.org") return "";
  }

  const balance = new Array<number>(3).fill(0);
  let pathPos = 0;
  for (pathPos; pathPos < path.length; pathPos++) {
    switch (path[pathPos]) {
      case "(":
        balance[0]++;
        break;
      case "[":
        balance[1]++;
        break;
      case "{":
        balance[2]++;
        break;
      case ")":
        balance[0]--;
        break;
      case "]":
        balance[1]--;
        break;
      case "}":
        balance[2]--;
        break;
    }
    if (balance[0] < 0 || balance[1] < 0 || balance[2] < 0) break;
  }

  const badPathEndChars = [".", ":", ";", ",", "(", "'", "?", "!", "`"];
  while (pathPos > 0 && badPathEndChars.includes(path[pathPos - 1])) {
    pathPos--;
  }
  fullUrl = fullUrl.substring(0, fullUrl.length - (path.length - pathPos));

  let prev = 0;
  let domainPartCount = 0;
  let hasNonDigit = false;
  let isIpv4 = true;
  for (let i = 0; i <= domain.length; i++) {
    if (i == domain.length || domain[i] === ".") {
      const partSize = i - prev;
      if (partSize == 0 || partSize >= 64 || domain[i - 1] === "-") return "";
      if (isIpv4) {
        if (partSize > 3) isIpv4 = false;
        if (
          partSize == 3 &&
          (domain[prev] >= "3" ||
            (domain[prev] == "2" &&
              (domain[prev + 1] >= "6" ||
                (domain[prev + 1] == "5" && domain[prev + 2] >= "6"))))
        ) {
          isIpv4 = false;
        }
        if (domain[prev] == "0" && partSize >= 2) isIpv4 = false;
      }

      domainPartCount++;
      if (i != domain.length) prev = i + 1;
    } else if (!isDigit(domain[i])) {
      isIpv4 = false;
      hasNonDigit = true;
    }
  }

  if (domainPartCount == 1) return "";
  if (isIpv4 && domainPartCount == 4) return fullUrl;
  if (!hasNonDigit) return "";

  const tld = domain.substring(prev);
  if (tld.length <= 1) return "";

  if (tld.startsWith("xn--")) {
    if (tld.length <= 5) return "";
    for (const c of tld.substring(4)) {
      if (!isAlphaOrDigit(c)) return "";
    }
  } else {
    if (tld.indexOf("_") != -1) return "";
    if (tld.indexOf("-") != -1) return "";
    if (!hasProtocol && !isCommonTLD(tld)) return "";
  }

  CHECK(prev > 0);
  prev--;
  while (prev-- > 0) {
    if (domain[prev] === "_") return "";
    else if (domain[prev] === ".") break;
  }

  return fullUrl;
}

export function getValidShortUsernames() {
  return [
    "gif",
    "wiki",
    "vid",
    "bing",
    "pic",
    "bold",
    "imdb",
    "coub",
    "like",
    "vote",
  ];
}

export function findMentions(str: string) {
  return matchMentions(str).filter(([start, end]) => {
    const mention = str.substring(start + 1, end);
    if (mention.length >= 4) return true;
    return getValidShortUsernames().includes(mention.toLowerCase());
  });
}

export function findBotCommands(str: string) {
  return matchBotCommands(str);
}

export function findHashtags(str: string) {
  return matchHashtags(str);
}

export function findCashtags(str: string) {
  return matchCashtags(str);
}

export function findBankCardNumbers(str: string) {
  return matchBankCardNumbers(str).filter(([start, end]) => {
    return isValidBankCard(str.substring(start, end));
  });
}

export function findTgURLs(str: string) {
  return matchTgURLs(str);
}

export function findURLs(str: string) {
  const result: [Position, boolean][] = [];
  for (const [s, e] of matchURLs(str)) {
    let url = str.substring(s, e);
    if (isEmailAddress(url)) {
      result.push([[s, e], true]);
    } else if (url.startsWith("mailto:") && isEmailAddress(url.substring(7))) {
      result.push([[s + 7, s + url.length], true]);
    } else {
      url = fixURL(url);
      if (url.length != 0) {
        result.push([[s, s + url.length], false]);
      }
    }
  }
  return result;
}

export function findMediaTimestamps(str: string) {
  const result: [Position, number][] = [];
  for (const [start, end] of matchMediaTimestamps(str)) {
    const parts = str.substring(start, end).split(":");
    if (parts.length > 3 || parts[parts.length - 1].length != 2) continue;
    const seconds = parseInt(parts[parts.length - 1]);
    if (seconds >= 60) continue;
    if (parts.length == 2) {
      if (parts[0].length > 4 || parts[0].length == 0) continue;
      const minutes = parseInt(parts[0]);
      result.push([[start, end], minutes * 60 + seconds]);
      continue;
    } else {
      if (
        parts[0].length > 2 || parts[1].length > 2 ||
        parts[0].length == 0 || parts[1].length == 0
      ) continue;
      const minutes = parseInt(parts[1]);
      if (minutes >= 60) continue;
      const hours = parseInt(parts[0]);
      result.push([[start, end], hours * 3600 + minutes * 60 + seconds]);
    }
  }
  return result;
}

export function textLength(text: string) {
  return text.length;
}

export function getTypePriority(type: MessageEntityType) {
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

export function removeEmptyEntities(entities: MessageEntity[]) {
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
    const otherPriority = getTypePriority(
      convertEntityTypeStringToEnum(other.type),
    );
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

// IF THE TESTS ARE NOT PASSING THERE IS A VERY HIGH POSSIBILITY
// THAT THE FAIL MIGHT BE DUE TO THE FOLLOWING FUNCTION.
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
) {
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

export function fixEntityOffsets(text: string, entities: MessageEntity[]) {
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
      utf16Pos += 1 + (c.codePointAt(0)! >= 0xf0 ? 1 : 0);
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
  text: string,
  skipBotCommands: boolean,
  skipMediaTimestamps: boolean,
): MessageEntity[] {
  let entities: MessageEntity[] = [];

  function addEntities(
    type: MessageEntityType,
    findEntitiesFn: (text: string) => Position[],
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

export function findMediaTimestampEntities(text: string) {
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

export function isPlainDomain(url: string) {
  return url.indexOf("/") >= url.length && url.indexOf("?") >= url.length &&
    url.indexOf("#") >= url.length;
}

// I know originally this is a class, but for now this'll work.
export interface FormattedText {
  text: string;
  entities: MessageEntity[];
}

export function getFirstUrl({ text, entities }: FormattedText) {
  for (const entity of entities) {
    switch (entity.type) {
      case "mention":
      case "hashtag":
      case "cashtag":
      case "bot_command":
        break;
      case "url": {
        if (entity.length <= 4) continue;
        const url = text.substring(
          entity.offset,
          entity.offset + entity.length,
        );
        const scheme = url.substring(0, 4).toLowerCase();
        if (
          scheme === "ton:" || scheme === "ftp:" || scheme.startsWith("tg:") ||
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
        if (
          url.startsWith("ton:") || url.startsWith("tg:") ||
          url.startsWith("ftp:")
        ) continue;
        return url;
      }
      case "text_mention":
      case "media_timestamp":
        break;
    }
  }

  return "";
}

export function parseMarkdown(text_: string): FormattedText {
  const text = text_.split("");
  let resultSize = 0;
  const entities: MessageEntity[] = [];
  const size = text.length;
  let offset = 0;

  for (let i = 0; i < size; i++) {
    const c = text[i], next = text[i + 1];
    if (
      c === "\\" &&
      (next === "_" || next === "*" || next === "`" || next === "[")
    ) {
      i++;
      text[resultSize++] = text[i];
      offset++;
      continue;
    }

    if (c !== "_" && c !== "*" && c !== "`" && c !== "[") {
      if (isUTF8CharacterFirstCodeUnit(c.codePointAt(0)!)) {
        offset += 1 + ((c.codePointAt(0)! >= 0xf0) ? 1 : 0);
      }
      text[resultSize++] = text[i];
      continue;
    }

    const beginPos = i;
    let endCharacter = text[i];
    let isPre = false;
    if (c === "[") endCharacter = "]";

    i++;

    let language: string | undefined = undefined;
    if (c === "`" && text[i] === "`" && text[i + 1] === "`") {
      i += 2;
      isPre = true;
      let languageEnd = i;

      while (!isSpace(text[languageEnd]) && text[languageEnd] != "`") {
        languageEnd++;
      }

      if (i != languageEnd && languageEnd < size && text[languageEnd] != "`") {
        language = text.slice(i, languageEnd).join("");
        i = languageEnd;
      }

      if (text[i] === "\n" || text[i] === "\r") {
        if (
          (text[i + 1] === "\n" || text[i + 1] === "\r") &&
          text[i] != text[i + 1]
        ) {
          i += 2;
        } else {
          i++;
        }
      }
    }

    const entityOffset = offset;
    while (
      i < size &&
      (text[i] !== endCharacter ||
        (isPre && !(text[i + 1] === "`" && text[i + 2] === "`")))
    ) {
      const curCh = text[i];
      if (isUTF8CharacterFirstCodeUnit(curCh.codePointAt(0)!)) {
        offset += 1 + (curCh.codePointAt(0)! >= 0xf0 ? 1 : 0);
      }
      text[resultSize++] = text[i++];
    }

    if (i == size) {
      throw new Error(
        "Can't find end of the entity starting at byte offset " + beginPos,
      );
    }

    if (entityOffset != offset) {
      const entityLength = offset - entityOffset;
      switch (c) {
        case "_":
          entities.push({
            type: "italic",
            offset: entityOffset,
            length: entityLength,
          });
          break;
        case "*":
          entities.push({
            type: "bold",
            offset: entityOffset,
            length: entityLength,
          });
          break;
        case "[": {
          let url = "";
          if (text[i + 1] !== "(") {
            url = text.slice(beginPos + 1, i).join("");
          } else {
            i += 2;
            while (i < size && text[i] !== ")") {
              url += text[i++];
            }
          }
          const userId = LinkManager.getLinkUserId(url);
          if (userId.isValid()) {
            entities.push({
              type: "text_mention",
              offset: entityOffset,
              length: entityLength,
              user_id: userId,
            });
          } else {
            url = LinkManager.getCheckedLink(url);
            if (url.length != 0) {
              entities.push({
                type: "text_link",
                offset: entityOffset,
                length: entityLength,
                url: url,
              });
            }
          }
          break;
        }
        case "`":
          if (isPre) {
            if (language == null || language.trim() === "") {
              entities.push({
                type: "pre",
                offset: entityOffset,
                length: entityLength,
              });
            } else {
              entities.push({
                type: "pre_code",
                offset: entityOffset,
                length: entityLength,
                language,
              });
            }
          } else {
            entities.push({
              type: "code",
              offset: entityOffset,
              length: entityLength,
            });
          }
          break;
        default:
          throw new Error("UNREACHABLE");
      }
    }

    if (isPre) i += 2;
  }

  return { text: text.slice(0, resultSize).join(""), entities };
}

export interface EntityInfo {
  type: MessageEntityType;
  argument: string;
  entityOffset: number;
  entityByteOffset: number;
  entityBeginPos: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();
function decodeSingle(data: number) {
  return decoder.decode(new Uint8Array([data]));
}

export function parseMarkdownV2(input: string) {
  const text = encoder.encode(input);
  let resultSize = 0;
  let entities: MessageEntity[] = [];
  let utf16Offset = 0;

  const nestedEntities: EntityInfo[] = [];

  for (let i = 0; i < text.length; i++) {
    const c = decodeSingle(text[i]), codepoint = text[i];
    if (
      c === "\\" &&
      text[i + 1] != null && text[i + 1] > 0 && text[i + 1] <= 126
    ) {
      i++;
      utf16Offset += 1;
      text[resultSize++] = text[i];
      continue;
    }

    let reservedCharacters = ["_", "*", "[", "]", "(", ")", "~", "`", ">", "#", "+", "-", "=", "|", "{", "}", ".", "!"];
    if (nestedEntities.length != 0) {
      switch (nestedEntities[nestedEntities.length - 1].type) {
        case MessageEntityType.Code:
        case MessageEntityType.Pre:
        case MessageEntityType.PreCode:
          reservedCharacters = ["`"];
          break;
        default:
          break;
      }
    }

    if (!reservedCharacters.includes(c)) {
      if (isUTF8CharacterFirstCodeUnit(codepoint)) {
        utf16Offset += 1 + (codepoint >= 0xf0 ? 1 : 0);
      }
      text[resultSize++] = text[i];
      continue;
    }

    let isEndOfAnEntity = false;
    if (nestedEntities.length != 0) {
      isEndOfAnEntity = (() => {
        const nextChar = decodeSingle(text[i + 1]);
        switch (nestedEntities[nestedEntities.length - 1].type) {
          case MessageEntityType.Bold:
            return c === "*";
          case MessageEntityType.Italic:
            return c === "_" && nextChar !== "_";
          case MessageEntityType.Code:
            return c === "`";
          case MessageEntityType.Pre:
          case MessageEntityType.PreCode:
            return c === "`" && nextChar === "`" && decodeSingle(text[i + 2]) === "`";
          case MessageEntityType.TextUrl:
            return c === "]";
          case MessageEntityType.Underline:
            return c === "_" && nextChar === "_";
          case MessageEntityType.Strikethrough:
            return c === "~";
          case MessageEntityType.Spoiler:
            return c === "|" && nextChar === "|";
          case MessageEntityType.CustomEmoji:
            return c === "]";
          default:
            unreachable();
        }
      })();
    }

    if (!isEndOfAnEntity) {
      let type: MessageEntityType;
      let argument = "";
      const entityByteOffset = i;
      const nextChar = decodeSingle(text[i + 1]);

      switch (c) {
        case "_":
          if (nextChar === "_") {
            type = MessageEntityType.Underline;
            i++;
          } else {
            type = MessageEntityType.Italic;
          }
          break;
        case "*":
          type = MessageEntityType.Bold;
          break;
        case "~":
          type = MessageEntityType.Strikethrough;
          break;
        case "|":
          if (nextChar === "|") {
            i++;
            type = MessageEntityType.Spoiler;
          } else {
            throw new Error(`Character '${c}' is reserved and must be escaped with the preceding '\\'`);
          }
          break;
        case "[":
          type = MessageEntityType.TextUrl;
          break;
        case "`":
          if (nextChar === "`" && decodeSingle(text[i + 2]) === "`") {
            i += 3;
            type = MessageEntityType.Pre;
            let languageEnd = i;
            while (!isSpace(decodeSingle(text[languageEnd])) && decodeSingle(text[languageEnd]) !== "`") {
              languageEnd++;
            }
            if (i != languageEnd && languageEnd < text.length && decodeSingle(text[languageEnd]) !== "`") {
              type = MessageEntityType.PreCode;
              argument = decoder.decode(text.slice(i, languageEnd));
              i = languageEnd;
            }
            const current = decodeSingle(text[i]), next = decodeSingle(text[i + 1]);
            if (current === "\n" || current === "\r") {
              if ((next === "\n" || next === "\r") && current !== next) {
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
        case "!":
          if (nextChar === "[") {
            i++;
            type = MessageEntityType.CustomEmoji;
          } else {
            throw new Error(`Character '${c}' is reserved and must be escaped with the preceding '\\'`);
          }
          break;
        default:
          throw new Error(`Character '${c}' is reserved and must be escaped with the preceding '\\'`);
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
          let url = "";
          if (decodeSingle(text[i + 1]) !== "(") {
            url = decoder.decode(text.slice(nestedEntities.at(-1)!.entityBeginPos, resultSize));
          } else {
            i += 2;
            const urlBeginPos = i;
            while (i < text.length && decodeSingle(text[i]) !== ")") {
              if (decodeSingle(text[i]) === "\\" && text[i + 1] > 0 && text[i + 1] <= 126) {
                url += decodeSingle(text[i + 1]);
                i += 2;
                continue;
              }
              url += decodeSingle(text[i++]);
            }
            if (decodeSingle(text[i]) !== ")") {
              throw new Error("Can't find end of a URL at byte offset " + urlBeginPos);
            }
          }
          userId = LinkManager.getLinkUserId(url);
          if (!userId.isValid()) {
            url = LinkManager.getCheckedLink(url);
            if (url.length == 0) {
              skipEntity = true;
            } else {
              argument = url;
            }
          }
          break;
        }
        case MessageEntityType.CustomEmoji: {
          if (decodeSingle(text[i + 1]) !== "(") {
            throw new Error("Custom emoji entity must contain a tg://emoji URL");
          }
          i += 2;
          let url = "";
          const urlBeginPos = i;
          while (i < text.length && decodeSingle(text[i]) !== ")") {
            if (decodeSingle(text[i]) === "\\" && text[i + 1] > 0 && text[i + 1] <= 126) {
              url += decodeSingle(text[i + 1]);
              i += 2;
              continue;
            }
            url += decodeSingle(text[i++]);
          }
          if (decodeSingle(text[i]) !== ")") {
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

  return { text: decoder.decode(text.slice(0, resultSize)), entities };
}
