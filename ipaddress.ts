import { isDigit } from "./utilities.ts";

export class IPAddress {
  #isValid = false;
  #isIpv6 = false;

  constructor() {}

  initIpv6Port(ipv6: string, port: number) {
    this.#isValid = false;

    if (port <= 0 || port >= (1 << 16)) {
      throw new Error("Invalid [IPv6 address port=" + port + "]");
    }
    if (ipv6.length > 2 && ipv6[0] === "[" && ipv6.at(-1) === "]") {
      ipv6 = ipv6.substring(1, ipv6.length - 1);
    }
    if (parseIpv6(ipv6) == null) {
      throw new Error("Invalid IPv6 address " + ipv6);
    }
    this.#isIpv6 = true;
    this.#isValid = true;
    return true;
  }

  isIpv6() {
    return this.#isValid && this.#isIpv6;
  }
}

const HEX = /^[\da-f]+$/i;

function exec(regex: RegExp, input: string) {
  return regex.exec(input);
}

// a clean clone from core-js --- i'll do anything to make this finally work lol
export function parseIpv6(input: string) {
  const address = [0, 0, 0, 0, 0, 0, 0, 0];
  let pieceIndex = 0;
  let compress = null;
  let pointer = 0;
  let value, length, numbersSeen, ipv4Piece, number, swaps, swap;

  if (input[pointer] == ":") {
    if (input[1] !== ":") return;
    pointer += 2;
    pieceIndex++;
    compress = pieceIndex;
  }
  while (input[pointer]) {
    if (pieceIndex == 8) return;
    if (input[pointer] == ":") {
      if (compress !== null) return;
      pointer++;
      pieceIndex++;
      compress = pieceIndex;
      continue;
    }
    value = length = 0;
    while (length < 4 && exec(HEX, input[pointer])) {
      value = value * 16 + parseInt(input[pointer], 16);
      pointer++;
      length++;
    }
    if (input[pointer] == ".") {
      if (length == 0) return;
      pointer -= length;
      if (pieceIndex > 6) return;
      numbersSeen = 0;
      while (input[pointer]) {
        ipv4Piece = null;
        if (numbersSeen > 0) {
          if (input[pointer] == "." && numbersSeen < 4) pointer++;
          else return;
        }
        if (!isDigit(input[pointer])) return;
        while (isDigit(input[pointer])) {
          number = parseInt(input[pointer], 10);
          if (ipv4Piece === null) ipv4Piece = number;
          else if (ipv4Piece == 0) return;
          else ipv4Piece = ipv4Piece * 10 + number;
          if (ipv4Piece > 255) return;
          pointer++;
        }
        address[pieceIndex] = address[pieceIndex] * 256 + (ipv4Piece || 0);
        numbersSeen++;
        if (numbersSeen == 2 || numbersSeen == 4) pieceIndex++;
      }
      if (numbersSeen != 4) return;
      break;
    } else if (input[pointer] == ":") {
      pointer++;
      if (!input[pointer]) return;
    } else if (input[pointer]) return;
    address[pieceIndex++] = value;
  }
  if (compress !== null) {
    swaps = pieceIndex - compress;
    pieceIndex = 7;
    while (pieceIndex != 0 && swaps > 0) {
      swap = address[pieceIndex];
      address[pieceIndex--] = address[compress + swaps - 1];
      address[compress + --swaps] = swap;
    }
  } else if (pieceIndex != 8) return;
  return address;
}
