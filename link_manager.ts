import { CustomEmojiId } from "./custom_emoji_id.ts";
import { HttpUrlProtocol, parseURL } from "./http_url.ts";
import { UserId } from "./user_id.ts";
import { CHECK, isAlphaOrDigit } from "./utilities.ts";

export class LinkManager {
  static getLinkUserId(url: string): UserId {
    url = url.toLowerCase();

    const linkScheme = "tg:";
    if (!url.startsWith(linkScheme)) {
      return new UserId();
    }

    url = url.substring(linkScheme.length);
    if (url.startsWith("//")) {
      url = url.substring(2);
    }

    const host = "user";
    if (
      !url.startsWith(host) ||
      (url.length > host.length && !["/", "?", "#"].includes(url[host.length]))
    ) {
      return new UserId();
    }

    url = url.substring(host.length);
    if (url.startsWith("/")) {
      url = url.substring(1);
    }
    if (!url.startsWith("?")) {
      return new UserId();
    }
    url = url.substring(1);
    const hashPos = url.indexOf("#");
    url = url.substring(0, hashPos == -1 ? undefined : hashPos);

    for (const parameter of url.split("&")) {
      const [key, value] = parameter.split("=", 2);
      if (key === "id") {
        try {
          const rUserId = BigInt(value);
          return new UserId(rUserId);
        } catch (_) {
          return new UserId();
        }
      }
    }

    return new UserId();
  }

  static getLinkCustomEmojiId(url: string) {
    url = url.toLowerCase();

    const linkScheme = "tg:";
    if (!url.startsWith(linkScheme)) {
      throw new Error("Custom emoji URL must have scheme tg");
    }
    url = url.substring(linkScheme.length);
    if (url.startsWith("//")) {
      url = url.substring(2);
    }

    const host = "emoji";
    if (!url.startsWith(host) || (url.length > host.length && !["/", "?", "#"].includes(url[host.length]))) {
      throw new Error(`Custom emoji URL must have host "${host}"`);
    }
    url = url.substring(host.length);
    if (url.startsWith("/")) {
      url = url.substring(1);
    }
    if (!url.startsWith("?")) {
      throw new Error("Custom emoji URL must have an emoji identifier");
    }
    url = url.substring(1);
    const hashPos = url.indexOf("#");
    url = url.substring(0, hashPos == -1 ? undefined : hashPos);

    for (const parameter of url.split("&")) {
      const [key, value] = parameter.split("=", 2);
      if (key === "id") {
        const rDocumentId = BigInt(value);
        return new CustomEmojiId(rDocumentId);
      }
    }

    throw new Error("Custom emoji URL must have an emoji identifier");
  }

  static getCheckedLink(link: string, httpOnly = false, httpsOnly = false): string {
    try {
      return this.checkLinkImpl(link, httpOnly, httpsOnly);
    } catch (_error) {
      // console.error(error);
      return "";
    }
  }

  static checkLinkImpl(link: string, httpOnly = false, httpsOnly = false): string {
    let isTg = false;
    let isTon = false;
    if (link.toLowerCase().startsWith("tg:")) {
      link = link.substring(3);
      isTg = true;
    } else if (link.toLowerCase().startsWith("ton:")) {
      link = link.substring(4);
      isTon = true;
    }
    if ((isTg || isTon) && link.startsWith("//")) {
      link = link.substring(2);
    }

    const httpUrl = parseURL(link);

    if (httpsOnly && (httpUrl.protocol != HttpUrlProtocol.Https || isTg || isTon)) {
      throw new Error("Only HTTP links are allowed");
    }
    if (isTg || isTon) {
      if (httpOnly) {
        throw new Error("Only HTTP links are allowed");
      }
      if (
        link.toLowerCase().startsWith("http://") || httpUrl.protocol == HttpUrlProtocol.Https ||
        httpUrl.userinfo.length != 0 || httpUrl.specifiedPort != 0 || httpUrl.isIpv6
      ) {
        throw new Error(`Wrong ${isTg ? "tg" : "ton"} URL`);
      }

      let query = httpUrl.query;
      CHECK(query[0] === "/");
      if (query.length > 1 && query[1] === "?") {
        query = query.substring(1);
      }
      for (const c of httpUrl.host) {
        if (!isAlphaOrDigit(c) && c !== "-" && c !== "_") {
          throw new Error("Unallowed characters in URL host");
        }
      }
      return (isTg ? "tg" : "ton") + "://" + httpUrl.host + query;
    }

    if (httpUrl.host.indexOf(".") == -1 && !httpUrl.isIpv6) {
      throw new Error("Wrong HTTP URL");
    }
    return httpUrl.getUrl();
  }
}
