import {
  getUnicodeSimpleCategory,
  isAlpha,
  isAlphaDigitOrUnderscore,
  isAlphaDigitUnderscoreOrMinus,
  isAlphaOrDigit,
  isDigit,
  isHashtagLetter,
  isWordCharacter,
  UnicodeSimpleCategory,
} from "./utilities.ts";

export type Position = [number, number];

export function matchMentions(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    // check the rest of the str for '@'
    const atSymbol = str.substring(pos).indexOf("@");
    if (atSymbol == -1) break; // no more possible mentions found.
    pos += atSymbol;

    // if the previous char is a blocking character:
    if (pos != begin && isWordCharacter(str.charCodeAt(pos - 1))) {
      pos++;
      continue;
    }
    const mentionBegin = ++pos; // starts without the '@'
    while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
      pos++; // incr. if the character is okay
    }
    const mentionEnd = pos;
    const size = mentionEnd - mentionBegin;
    if (size < 2 || size > 32) continue;
    // if (isWordCharacter(str.charCodeAt(pos))) continue;
    result.push([mentionBegin - 1, mentionEnd]);
  }

  return result;
}

export function matchBotCommands(str: string): Position[] {
  const result: Position[] = [];
  const begin = 0, end = str.length;
  let pos = begin;

  while (pos < end) {
    // check the rest of the str for possible commands.
    const slashSymbol = str.substring(pos).indexOf("/");
    if (slashSymbol == -1) break; // no possible commands.
    pos += slashSymbol;

    // check if the prev character is okay
    if (pos != begin) {
      const prev = str[pos - 1];
      if (
        isWordCharacter(prev.charCodeAt(0)) ||
        prev === "/" || prev === "<" || prev === ">" // apparently these too?
      ) {
        pos++;
        continue;
      }
    }

    const commandBegin = ++pos; // except the "/"
    while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
      pos++; // increment if the current char is okay.
    }
    let commandEnd = pos;
    const commandSize = commandEnd - commandBegin;
    if (commandSize < 1 || commandSize > 64) continue;

    let hasMention = false;
    const commandEndBackup = commandEnd;

    // check for the bot mention part of the command
    if (pos != end && str[pos] === "@") {
      const mentionBegin = ++pos; // except the "@"
      while (pos != end && isAlphaDigitOrUnderscore(str[pos])) {
        pos++; // increment if the current char is oky.
      }
      const mentionEnd = pos;
      const mentionSize = mentionEnd - mentionBegin;
      if (mentionSize >= 3 && mentionSize <= 32) {
        commandEnd = pos;
        hasMention = true;
      }
    }

    // is the next character okay??
    if (pos != end) {
      const next = str[pos];
      if (next === "/" || next === "<" || next === ">") {
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
      const prev = str.charCodeAt(pos - 1);
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
      category = getUnicodeSimpleCategory(str.charCodeAt(pos));
      if (!isHashtagLetter(str.charCodeAt(pos))) break;
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
      const prev = str.charCodeAt(pos - 1);
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
      const next = str.charCodeAt(pos);
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
        const prev = str.charCodeAt(mediaTimestampBegin - 1);
        if (isWordCharacter(prev)) continue;
      }
      if (mediaTimestampEnd != end) {
        const next = str.charCodeAt(mediaTimestampEnd);
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
        getUnicodeSimpleCategory(prev.charCodeAt(0)) ===
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
        getUnicodeSimpleCategory(next.charCodeAt(0)) ===
          UnicodeSimpleCategory.Letter
      ) continue;
    }

    result.push([cardNumberBegin, cardNumberEnd]);
  }

  return result;
}

export function isURLUnicodeSymbol(c: number) {
  if (0x2000 <= c && c <= 0x206f) { // General Punctuation
    // Zero Width Non-Joiner/Joiner and various dashes
    return c == 0x200c || c == 0x200d || (0x2010 <= c && c <= 0x2015);
  }
  return getUnicodeSimpleCategory(c) != UnicodeSimpleCategory.Separator;
}

export function isURLPathSymbol(c: number) {
  switch (c) {
    case "\n".charCodeAt(0):
    case "<".charCodeAt(0):
    case ">".charCodeAt(0):
    case '"'.charCodeAt(0):
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
        const next = str.charCodeAt(pathEndPos);
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

function isDomainSymbol(c: number) {
  if (c >= 0xc0) return isURLUnicodeSymbol(c);
  const char = String.fromCharCode(c);
  return char === "." || char === "~" || isAlphaDigitUnderscoreOrMinus(char);
}

console.log(isDomainSymbol(1052));

export function matchURLs(str: string) {
  const result: Position[] = [];
  const begin = 0;
  let end = str.length;

  function isProtocolSymbol(c: number) {
    if (c < 0x80) {
      return isAlphaOrDigit(String.fromCharCode(c)) ||
        c == "+".charCodeAt(0) || c == "-".charCodeAt(0);
    }
    return getUnicodeSimpleCategory(c) !== UnicodeSimpleCategory.Separator;
  }

  function isUserDataSymbol(c: number) {
    switch (String.fromCharCode(c)) {
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
      case String.fromCharCode(0xab):
      case String.fromCharCode(0xbb):
        return false;
      default:
        return isURLUnicodeSymbol(c);
    }
  }

  function isDomainSymbol(c: number) {
    if (c >= 0xc0) return isURLUnicodeSymbol(c);
    const char = String.fromCharCode(c);
    return char === "." || char === "~" || isAlphaDigitUnderscoreOrMinus(char);
  }

  const badPathEndChars = [".", ":", ";", ",", "(", "'", "?", "!", "`"];

  let done = 0;

  while (true) {
    console.log({ str });
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
      const code = str.charCodeAt(domainBeginPos);
      if (!isDomainSymbol(code)) {
        domainBeginPos = nextPos;
        break;
      }
    }

    let lastAtPos: number | undefined = undefined;
    let domainEndPos = begin + dotPos;
    while (domainEndPos != end) {
      const nextPos = domainEndPos + 1;
      const code = str.charCodeAt(domainEndPos);
      console.log(code, str[domainEndPos]);
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
        const code = str.charCodeAt(domainBeginPos);
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
        const code = str.charCodeAt(pathEndPos);
        if (!isURLPathSymbol(code)) break;
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
        const code = str.charCodeAt(userDataBeginPos);
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
          const code = str.charCodeAt(protocolBeginPos);
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
        // const prefixBack = prefixEnd - 1;
        const code = str.charCodeAt(prefixEnd);
        const char = String.fromCharCode(code);
        if (
          isWordCharacter(code) || char == "/" || char == "#" || char === "@"
        ) {
          isBad = true;
        }
      }
    }

    if (!isBad) {
      if (urlEndPos > begin + dotPos + 1) {
        console.log({ url: str.substring(done + urlBeginPos, done + urlEndPos) });
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
    end = urlEndPos;
  }

  return result;
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

/** Find poss of valid mentions in a given str. */
export function findMentions(str: string) {
  return matchMentions(str).filter(([start, end]) => {
    const mention = str.substring(start + 1, end);
    if (mention.length >= 4) return true;
    return getValidShortUsernames().includes(mention.toLowerCase());
  });
}

/** Find poss of valid bot commands in a given str. */
export function findBotCommands(str: string) {
  return matchBotCommands(str);
}

export function findHashtags(str: string) {
  return matchHashtags(str);
}

export function findCashtags(str: string) {
  return matchCashtags(str);
}

export function CHECK(condition: boolean) {
  if (!condition) {
    console.trace("check failed");
  }
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
    const digit = digits[i - 1].charCodeAt(0) - "0".charCodeAt(0);
    if ((digitCount - i) % 2 == 0) sum += digit;
    else sum += digit < 5 ? 2 * digit : 2 * digit - 9;
  }
  if (sum % 10 != 0) return false;

  const prefix1 = digits[0].charCodeAt(0) - "0".charCodeAt(0);
  const prefix2 = prefix1 * 10 + (digits[1].charCodeAt(0) - "0".charCodeAt(0));
  const prefix3 = prefix2 * 10 + (digits[2].charCodeAt(0) - "0".charCodeAt(0));
  const prefix4 = prefix3 * 10 + (digits[3].charCodeAt(0) - "0".charCodeAt(0));
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

export function findBankCardNumbers(str: string) {
  return matchBankCardNumbers(str).filter(([start, end]) => {
    return isValidBankCard(str.substring(start, end));
  });
}

export function findTgURLs(str: string) {
  return matchTgURLs(str);
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
  return [
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
  ].includes(str.toLowerCase());
}

export function fixURL(str: string) {
  let fullUrl = str;

  let hasProtocol = false;
  const strBegin = str.substring(0, 8).toLowerCase();
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
  fullUrl = fullUrl.substring(
    0,
    path.length - pathPos > 0 ? path.length - pathPos : undefined,
  );

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
