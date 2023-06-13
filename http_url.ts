import { CHECK, isAlphaOrDigit, isHexDigit, isSpace } from "./utilities.ts";
import { IPAddress } from "./ipaddress.ts";

export enum HttpUrlProtocol {
  Http,
  Https,
}

export class HttpUrl {
  protocol: HttpUrlProtocol = HttpUrlProtocol.Http;
  userinfo: string;
  host: string;
  isIpv6 = false;
  specifiedPort = 0;
  port = 0;
  query: string;

  constructor(
    protocol: HttpUrlProtocol,
    userinfo: string,
    host: string,
    isIpv6: boolean,
    specifiedPort: number,
    port: number,
    query: string,
  ) {
    this.protocol = protocol;
    this.userinfo = userinfo;
    this.host = host;
    this.isIpv6 = isIpv6;
    this.specifiedPort = specifiedPort;
    this.port = port;
    this.query = query;
  }

  getUrl() {
    let result = "";
    switch (this.protocol) {
      case HttpUrlProtocol.Http:
        result += "http://";
        break;
      case HttpUrlProtocol.Https:
        result += "https://";
        break;
      default:
        throw new Error("UNREACHABLE");
    }
    if (this.userinfo != null && this.userinfo.trim() != "") {
      result += this.userinfo;
      result += "@";
    }
    result += this.host;
    if (this.specifiedPort > 0) {
      result += ":";
      result += this.specifiedPort.toString();
    }
    result += this.query;
    return result;
  }
}

function firstIndexOf(str: string, toFind: string[]) {
  for (const char of toFind) {
    const index = str.indexOf(char);
    if (index != -1) return index;
  }
}

export function parseURL(
  url: string,
  defaultProtocol: HttpUrlProtocol = HttpUrlProtocol.Http,
) {
  let pos = firstIndexOf(url, [":", "/", "?", "#", "@", "[", "]"]);
  const protocolStr = url.substring(0, pos).toLowerCase();
  pos ??= 0;

  let protocol: HttpUrlProtocol;
  if (url.substring(pos, pos + 3) === "://") {
    pos += 3;
    if (protocolStr === "http") {
      protocol = HttpUrlProtocol.Http;
    } else if (protocolStr === "https") {
      protocol = HttpUrlProtocol.Https;
    } else {
      throw new Error("Unsupported URL protocol");
    }
  } else {
    protocol = defaultProtocol;
  }

  const fi1 = firstIndexOf(url.substring(pos), ["/", "?", "#"]);
  const userinfoHostPort = url.substring(pos, fi1 != null ? pos + fi1 : fi1);
  const toAdd = fi1 || (url.length - pos);
  pos += toAdd;

  let port = 0;
  let colon = pos - 1;
  while (colon > (pos - toAdd) && url[colon] != ":" && url[colon] != "]" && url[colon] != "@") {
    colon--;
  }
  let userinfoHost = "";

  if (colon > 0 && url[colon] === ":") {
    let portSlice = url.substring(colon + 1, pos);
    while (portSlice.length > 1 && portSlice[0] === "0") {
      portSlice = portSlice.substring(1);
    }
    const rPort = parseInt(portSlice);
    if (!rPort || isNaN(rPort) || rPort === 0) port = -1;
    else port = rPort;

    userinfoHost = url.substring(pos - toAdd, colon);
  } else {
    userinfoHost = userinfoHostPort;
  }
  if (port < 0 || port > 65535) {
    throw new Error("Wrong port number specified in the URL");
  }

  const atPos = userinfoHost.indexOf("@");
  const userinfo = atPos == -1 ? "" : userinfoHost.substring(0, atPos);
  const host = userinfoHost.substring(atPos + 1);

  let isIpv6 = false;
  if (host.length != 0 && host[0] === "[" && host.at(-1) === "]") {
    const ipAddress = new IPAddress();
    try {
      ipAddress.initIpv6Port(host, 1);
    } catch (error) {
      console.error(error);
      throw new Error("Wrong IPv6 address specified in the URL");
    }
    CHECK(ipAddress.isIpv6());
    isIpv6 = true;
  }
  if (host.length == 0) {
    throw new Error("URL host is empty");
  }
  if (host === ".") {
    throw new Error("Host is invalid");
  }

  const specifiedPort = port;
  if (port == 0) {
    if (protocol == HttpUrlProtocol.Http) {
      port = 80;
    } else {
      CHECK(protocol == HttpUrlProtocol.Https);
      port = 443;
    }
  }

  let query = url.substring(pos);

  while (query.length != 0 && isSpace(query.at(-1)!)) {
    query = query.substring(0, query.length - 1);
  }
  if (query.length == 0) query = "/";
  let queryStr = "";
  if (query[0] != "/") {
    queryStr = "/";
  }
  for (const char of query) {
    if (char.codePointAt(0)! <= 0x20) {
      queryStr += "%";
      queryStr += "0123456789ABCDEF"[Math.floor(char.codePointAt(0)! / 16)];
      queryStr += "0123456789ABCDEF"[char.codePointAt(0)! % 16];
    } else {
      queryStr += char;
    }
  }

  function checkURLPart(part: string, name: string, allowColon: boolean) {
    for (let i = 0; i < part.length; i++) {
      let c = part[i];
      if (
        isAlphaOrDigit(c) || c === "." || c === "-" || c === "_" || c === "!" || c === "$" ||
        c === "," || c === "~" || c === "*" || c === "'" || c === "(" || c === ")" || c === ";" ||
        c === "&" || c === "+" || c === "=" || (allowColon && c === ":")
      ) {
        // symbols allowed by RFC 7230 and RFC 3986
        continue;
      }
      if (c === "%") {
        c = part[++i];
        if (isHexDigit(c)) {
          c = part[++i];
          if (isHexDigit(c)) {
            continue;
          }
        }
        throw new Error("Wrong percent-encoded symbol in URL " + name);
      }
      const uc = c.codePointAt(0)!;
      if (uc >= 128) continue;
      throw new Error("Disallowed character in URL " + name);
    }
    return true;
  }

  const hostStr = host.toLowerCase();
  if (isIpv6) {
    for (let i = 1; i + 1 < hostStr.length; i++) {
      const c = hostStr[i];
      if (c === ":" || ("0" <= c && c <= "9") || ("a" <= c && c <= "f") || c == ".") {
        continue;
      }
      throw new Error("Wrong IPv6 URL host");
    }
  } else {
    checkURLPart(hostStr, "host", false);
    checkURLPart(userinfo, "userinfo", true);
  }

  return new HttpUrl(protocol, userinfo, hostStr, isIpv6, specifiedPort, port, queryStr);
}
