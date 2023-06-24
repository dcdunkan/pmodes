import { unreachable } from "https://deno.land/std@0.191.0/testing/asserts.ts";
import { unicodeToLower } from "./unicode.ts";

export function isUTF8CharacterFirstCodeUnit(c: number) {
  return (c & 0xC0) != 0x80;
}

export function utf8Length(str: Uint8Array) {
  let result = 0;
  for (const c of str) {
    result += isUTF8CharacterFirstCodeUnit(c) ? 1 : 0;
  }
  return result;
}

export function prevUtf8Unsafe(data: Uint8Array, pos: number) {
  while (!isUTF8CharacterFirstCodeUnit(data[--pos])) {
    // pass
  }
  return pos;
}

export function nextUtf8Unsafe(data: Uint8Array, pos: number): { code: number; pos: number } {
  let code = 0;
  const a = data[pos];
  if ((a & 0x80) == 0) {
    code = a;
    return { pos: pos + 1, code };
  } else if ((a & 0x20) == 0) {
    code = ((a & 0x1f) << 6) | (data[pos + 1] & 0x3f);
    return { pos: pos + 2, code };
  } else if ((a & 0x10) == 0) {
    code = ((a & 0x0f) << 12) | ((data[pos + 1] & 0x3f) << 6) | (data[pos + 2] & 0x3f);
    return { pos: pos + 3, code };
  } else if ((a & 0x08) == 0) {
    code = ((a & 0x07) << 18) | ((data[pos + 1] & 0x3f) << 12) | ((data[pos + 2] & 0x3f) << 6) | (data[pos + 3] & 0x3f);
    return { pos: pos + 4, code };
  }
  unreachable();
}

export function appendUTF8CharacterUnsafe(text: number[], pos: number, code: number): number;
export function appendUTF8CharacterUnsafe(text: Uint8Array, pos: number, code: number): number;
export function appendUTF8CharacterUnsafe(text: number[] | Uint8Array, pos: number, code: number): number {
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

export function utf8ToLower(str: Uint8Array) {
  const result: number[] = [];
  let position = 0;
  const end = str.length;
  while (position != end) {
    const { pos, code } = nextUtf8Unsafe(str, position);
    position = pos;
    appendUTF8CharacterUnsafe(result, result.length, unicodeToLower(code));
  }
  return new Uint8Array(result);
}

export function utf8Truncate(str: Uint8Array, length: number) {
  if (str.length > length) {
    for (let i = 0; i < str.length; i++) {
      if (isUTF8CharacterFirstCodeUnit(str[i])) {
        if (length === 0) return str.subarray(0, i);
        else length--;
      }
    }
  }
  return str;
}

export function utf8Substr(str: Uint8Array, offset: number) {
  if (offset === 0) return str;
  const offsetPos = utf8Truncate(str, offset).length;
  return str.subarray(offsetPos);
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

    if (ENSURE((a & 0x40) != 0) == false) return false;

    const b = data[pos++];
    if (ENSURE((b & 0xc0) == 0x80) == false) return false;
    if ((a & 0x20) == 0) {
      if (ENSURE((a & 0x1e) > 0) == false) return false;
      continue;
    }

    const c = data[pos++];
    if (ENSURE((c & 0xc0) == 0x80) == false) return false;
    if ((a & 0x10) == 0) {
      const x = ((a & 0x0f) << 6) | (b & 0x20);
      if (ENSURE(x != 0 && x != 0x360) == false) return false; // surrogates
      continue;
    }

    const d = data[pos++];
    if (ENSURE((d & 0xc0) == 0x80) == false) return false;
    if ((a & 0x08) == 0) {
      const t = ((a & 0x07) << 6) | (b & 0x30);
      if (ENSURE(0 < t && t < 0x110) == false) return false; // end of unicode
      continue;
    }

    return false;
  } while (true);
}
