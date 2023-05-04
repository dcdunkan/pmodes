import {
  getUnicodeSimpleCategory,
  isAlphaDigitOrUnderscore,
  isHashtagLetter,
  isWordCharacter,
  UnicodeSimpleCategory,
} from "./utilities.ts";

type Positions = [number, number][];

/** Find positions of valid mentions in a given text. */
export function findMentions(text: string) {
  const result: Positions = [];
  let position = 0;
  const begin = 0, end = text.length;

  while (position < end) {
    // check the rest of the text for '@'
    const atSymbol = text.substring(position).indexOf("@");
    if (atSymbol == -1) break; // no more possible mentions found.
    position += atSymbol;

    // if the previous char is a blocking character:
    if (position != begin && isWordCharacter(text.charCodeAt(position - 1))) {
      position++;
      continue;
    }
    const mentionBegin = ++position; // starts without the '@'
    while (position != end && isAlphaDigitOrUnderscore(text[position])) {
      position++; // incr. if the character is okay
    }
    const mentionEnd = position;
    const size = mentionEnd - mentionBegin;
    if (size < 2 || size > 32) continue;
    // if (isWordCharacter(text.charCodeAt(position))) continue;
    result.push([mentionBegin - 1, mentionEnd]);
  }

  return result;
}

/** Find positions of valid bot commands in a given text. */
export function findBotCommands(text: string) {
  const result: Positions = [];
  let position = 0;
  const begin = 0, end = text.length;

  while (position < end) {
    // check the rest of the text for possible commands.
    const slashSymbol = text.substring(position).indexOf("/");
    if (slashSymbol == -1) break; // no possible commands.
    position += slashSymbol;

    // check if the prev character is okay
    if (position != begin) {
      const prev = text[position - 1];
      if (
        isWordCharacter(prev.charCodeAt(0)) ||
        prev === "/" || prev === "<" || prev === ">" // apparently these too?
      ) {
        position++;
        continue;
      }
    }

    const commandBegin = ++position; // except the "/"
    while (position != end && isAlphaDigitOrUnderscore(text[position])) {
      position++; // increment if the current char is okay.
    }
    let commandEnd = position;
    const commandSize = commandEnd - commandBegin;
    if (commandSize < 1 || commandSize > 64) continue;

    let hasMention = false;
    const commandEndBackup = commandEnd;

    // check for the bot mention part of the command
    if (position != end && text[position] === "@") {
      const mentionBegin = ++position; // except the "@"
      while (position != end && isAlphaDigitOrUnderscore(text[position])) {
        position++; // increment if the current char is oky.
      }
      const mentionEnd = position;
      const mentionSize = mentionEnd - mentionBegin;
      if (mentionSize >= 3 && mentionSize <= 32) {
        commandEnd = position;
        hasMention = true;
      }
    }

    // is the next character okay??
    if (position != end) {
      const next = text[position];
      if (next === "/" || next === "<" || next === ">") {
        if (!hasMention) continue;
        commandEnd = commandEndBackup;
      }
    }

    result.push([commandBegin - 1, commandEnd]);
  }

  return result;
}

export function findHashtags(text: string) {
  const result: Positions = [];
  let position = 0;
  const begin = 0, end = text.length;

  while (position < end) {
    const hashSymbol = text.substring(position).indexOf("#");
    if (hashSymbol == -1) break;
    position += hashSymbol;

    if (position != begin) {
      const prev = text.charCodeAt(position - 1);
      if (isHashtagLetter(prev)) {
        position++;
        continue;
      }
    }

    const hashtagBegin = ++position;
    let hashtagSize = 0, hashtagEnd = 0;
    let wasLetter = false;

    while (position != end) {
      const category = getUnicodeSimpleCategory(text.charCodeAt(position));
      if (!isHashtagLetter(text.charCodeAt(position))) break;
      position++;
      if (hashtagSize == 255) hashtagEnd = position;
      if (hashtagSize != 256) {
        wasLetter ||= category == UnicodeSimpleCategory.Letter;
        hashtagSize++;
      }
    }

    if (!hashtagEnd) hashtagEnd = position;
    if (hashtagSize < 1) continue;
    if (text[position] === "#") continue;
    if (!wasLetter) continue;
    result.push([hashtagBegin - 1, hashtagEnd]);
  }

  return result;
}
