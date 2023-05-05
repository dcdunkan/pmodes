import {
  getUnicodeSimpleCategory,
  isAlphaDigitOrUnderscore,
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
