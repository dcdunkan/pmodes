import {
  getUnicodeSimpleCategory,
  isAlphaDigitOrUnderscore,
  isHashtagLetter,
  isWordCharacter,
  UnicodeSimpleCategory,
} from "./utilities.ts";

type Position = [number, number];

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
