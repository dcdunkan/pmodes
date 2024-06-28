import { CustomEmojiId } from "./custom_emoji_id.ts";
import { assert, assertEquals, assertStrictEquals, hexStringToBytes } from "./deps_test.ts";
import { CODEPOINTS, decode, encode, mergeTypedArrays } from "./encode.ts";
import {
    findBankCardNumbers,
    findBotCommands,
    findCashtags,
    findHashtags,
    findMediaTimestamps,
    findMentions,
    findTgUrls,
    findUrls,
    fixFormattedText,
    isEmailAddress,
    parseHtml,
    parseMarkdownV2,
    sortEntities,
} from "./match.ts";
import { MessageEntity, MessageEntityType } from "./message_entity.ts";
import { random } from "./random.ts";
import { UserId } from "./user_id.ts";
import { utf8utf16Length, utf8utf16Substr } from "./utf8.ts";
import { isSpace } from "./utilities.ts";

function checkFn(fn: (text: Uint8Array) => [number, number][]) {
    return (text: string, expected: string[]) => {
        const encoded = encode(text);
        const result = fn(encoded);
        const actual = result.map(([s, e]) => decode(encoded.slice(s, e)));
        assertEquals(actual, expected);
    };
}

Deno.test("mentions", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findMentions);
            fn(text, expected);
        });
    };
    await check("@mention", ["@mention"]);
    await check("@mention ", ["@mention"]);
    await check(" @mention", ["@mention"]);
    await check(" @mention ", ["@mention"]);
    await check("@abc @xyz @abc @xyz @xxx@yyy @ttt", []);
    await check(
        "@abcde @xyzxy @abcde @xyzxy @xxxxx@yyyyy @ttttt",
        ["@abcde", "@xyzxy", "@abcde", "@xyzxy", "@xxxxx", "@ttttt"],
    );
    await check("no@mention", []);
    await check("@n", []);
    await check("@abcdefghijklmnopqrstuvwxyz123456", ["@abcdefghijklmnopqrstuvwxyz123456"]);
    await check("@abcdefghijklmnopqrstuvwxyz1234567", []);
    await check("нет@mention", []);
    await check(
        "@ya @gif @wiki @vid @bing @pic @bold @imdb @ImDb @coub @like @vote @giff @cap ya cap @y @yar @bingg @bin",
        ["@gif", "@wiki", "@vid", "@bing", "@pic", "@bold", "@imdb", "@ImDb", "@coub", "@like", "@vote", "@giff", "@bingg"],
    );
});

Deno.test("bot commands", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findBotCommands);
            fn(text, expected);
        });
    };
    // 1..64@3..32
    await check("/abc", ["/abc"]);
    await check(" /abc", ["/abc"]);
    await check("/abc ", ["/abc"]);
    await check(" /abc ", ["/abc"]);
    await check("/a@abc", ["/a@abc"]);
    await check("/a@b", []);
    await check("/@bfdsa", []);
    await check("/test/", []);
});

Deno.test("hashtags", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findHashtags);
            fn(text, expected);
        });
    };

    await check("", []);
    await check("#", []);
    await check("##", []);
    await check("###", []);
    await check("#a", ["#a"]);
    await check(" #a", ["#a"]);
    await check("#a ", ["#a"]);
    await check(" #я ", ["#я"]);
    await check(" я#a ", []);
    await check(" #a# ", []);
    await check(" #123 ", []);
    await check(" #123a ", ["#123a"]);
    await check(" #a123 ", ["#a123"]);
    await check(" #123a# ", []);
    await check(" #" + "1".repeat(300), []);
    await check(" #" + "1".repeat(256), []);
    await check(" #" + "1".repeat(256) + "a ", []);
    await check(" #" + "1".repeat(255) + "a", ["#" + "1".repeat(255) + "a"]);
    await check(" #" + "1".repeat(255) + "Я", ["#" + "1".repeat(255) + "Я"]);
    await check(" #" + "1".repeat(255) + "a" + "b".repeat(255) + "# ", []);
    await check("#a#b #c #d", ["#c", "#d"]);
    await check("#test", ["#test"]);
    await check("#te·st", ["#te·st"]);
    await check(
        "\u{0001F604}\u{0001F604}\u{0001F604}\u{0001F604} \u{0001F604}\u{0001F604}\u{0001F604}#" +
            "1".repeat(200) +
            "ООО" + "2".repeat(200),
        ["#" + "1".repeat(200) + "ООО" + "2".repeat(53)],
    );
    await check("#a\u2122", ["#a"]);
    await check("#a൹", ["#a"]);
    await check("#aඁං෴ก฿", ["#aඁං෴ก"]);
});

Deno.test("cashtags", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findCashtags);
            fn(text, expected);
        });
    };

    await check("", []);
    await check("$", []);
    await check("$$", []);
    await check("$$$", []);
    await check("$a", []);
    await check(" $a", []);
    await check("$a ", []);
    await check(" $я ", []);
    await check("$ab", []);
    await check("$abc", []);
    await check("$", []);
    await check("$A", ["$A"]);
    await check("$AB", ["$AB"]);
    await check("$ABС", []);
    await check("$АBC", []);
    await check("$АВС", []);
    await check("$ABC", ["$ABC"]);
    await check("$ABCD", ["$ABCD"]);
    await check("$ABCDE", ["$ABCDE"]);
    await check("$ABCDEF", ["$ABCDEF"]);
    await check("$ABCDEFG", ["$ABCDEFG"]);
    await check("$ABCDEFGH", ["$ABCDEFGH"]);
    await check("$ABCDEFGHJ", []);
    await check("$ABCDEFGH1", []);
    await check(" $XYZ", ["$XYZ"]);
    await check("$XYZ ", ["$XYZ"]);
    await check(" $XYZ ", ["$XYZ"]);
    await check(" $$XYZ ", []);
    await check(" $XYZ$ ", []);
    await check(" $ABC1 ", []);
    await check(" $1ABC ", []);
    await check(" 1$ABC ", []);
    await check(" А$ABC ", []);
    await check("$ABC$DEF $GHI $KLM", ["$GHI", "$KLM"]);
    await check("$TEST", ["$TEST"]);
    await check("$1INC", []);
    await check("$1INCH", ["$1INCH"]);
    await check("...$1INCH...", ["$1INCH"]);
    await check("$1inch", []);
    await check("$1INCHA", []);
    await check("$1INCHА", []);
    await check("$ABC\u2122", ["$ABC"]);
    await check("\u2122$ABC", ["$ABC"]);
    await check("\u2122$ABC\u2122", ["$ABC"]);
    await check("$ABC൹", ["$ABC"]);
    await check("$ABCඁ", []);
    await check("$ABCං", []);
    await check("$ABC෴", []);
    await check("$ABCก", []);
    await check("$ABC฿", ["$ABC"]);
});

Deno.test("media timestamps", async (t) => {
    let count = 0;
    const check = async (text: string, expected: [string, number][]) => {
        await t.step(`${count++}`, () => {
            const encoded = encode(text);
            const result = findMediaTimestamps(encoded);
            const actual = result.map(([[s, e], t]) => [decode(encoded.slice(s, e)), t]);
            assertEquals(actual, expected);
        });
    };

    await check("", []);
    await check(":", []);
    await check(":1", []);
    await check("a:1", []);
    await check("01", []);
    await check("01:", []);
    await check("01::", []);
    await check("01::", []);
    await check("a1:1a", []);
    await check("a1::01a", []);
    await check("2001:db8::8a2e:f70:13a4", []);
    await check("0:00", [["0:00", 0]]);
    await check("+0:00", [["0:00", 0]]);
    await check("0:00+", [["0:00", 0]]);
    await check("a0:00", []);
    await check("0:00a", []);
    await check("б0:00", []);
    await check("0:00б", []);
    await check("_0:00", []);
    await check("0:00_", []);
    await check("00:00:00:00", []);
    await check("1:1:01 1:1:1", [["1:1:01", 3661]]);
    await check(
        "0:0:00 00:00 000:00 0000:00 00000:00 00:00:00 000:00:00 00:000:00 00:00:000",
        [["0:0:00", 0], ["00:00", 0], ["000:00", 0], ["0000:00", 0], ["00:00:00", 0]],
    );
    await check("00:0:00 0:00:00 00::00 :00:00 00:00: 00:00:0 00:00:", [["00:0:00", 0], ["0:00:00", 0]]);
    await check("1:1:59 1:1:-1 1:1:60", [["1:1:59", 3719]]);
    await check("1:59:00 1:-1:00 1:60:00", [["1:59:00", 7140], ["1:00", 60]]);
    await check("59:59 60:00", [["59:59", 3599], ["60:00", 3600]]);
    await check("9999:59 99:59:59 99:60:59", [["9999:59", 599999], ["99:59:59", 360000 - 1]]);
    await check("2001:db8::8a2e:f70:13a4", []);
});

Deno.test("bank card numbers", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findBankCardNumbers);
            fn(text, expected);
        });
    };

    await check("", []);
    await check("123456789015", []);
    await check("1234567890120", []);
    await check("1234567890121", []);
    await check("1234567890122", []);
    await check("1234567890123", []);
    await check("1234567890124", []);
    await check("1234567890125", []);
    await check("1234567890126", []);
    await check("1234567890127", []);
    await check("1234567890128", ["1234567890128"]);
    await check("1234567890129", []);
    await check("12345678901500", ["12345678901500"]);
    await check("123456789012800", ["123456789012800"]);
    await check("1234567890151800", ["1234567890151800"]);
    await check("12345678901280000", ["12345678901280000"]);
    await check("123456789015009100", ["123456789015009100"]);
    await check("1234567890128000000", ["1234567890128000000"]);
    await check("12345678901500910000", []);
    await check(" - - - - 1 - -- 2 - - -- 34 - - - 56- - 7890150000  - - - -", []);
    await check(" - - - - 1 - -- 234 - - 56- - 7890150000  - - - -", ["1 - -- 234 - - 56- - 7890150000"]);
    await check("4916-3385-0608-2832; 5280 9342 8317 1080 ;345936346788903", [
        "4916-3385-0608-2832",
        "5280 9342 8317 1080",
        "345936346788903",
    ]);
    await check(
        "4556728228023269, 4916141675244747020, 49161416752447470, 4556728228023269",
        ["4556728228023269", "4916141675244747020", "4556728228023269"],
    );
    await check("a1234567890128", []);
    await check("1234567890128a", []);
    await check("1234567890128а", []);
    await check("а1234567890128", []);
    await check("1234567890128_", []);
    await check("_1234567890128", []);
    await check("1234567890128/", ["1234567890128"]);
    await check('"1234567890128', ["1234567890128"]);
    await check("+1234567890128", []);
});

Deno.test("tg urls", async (t) => {
    let count = 0;
    const check = async (text: string, expected: string[]) => {
        await t.step((count++).toString(), () => {
            const fn = checkFn(findTgUrls);
            fn(text, expected);
        });
    };

    await check("", []);
    await check("tg://", []);
    await check("tg://a", ["tg://a"]);
    await check("a", []);
    await check("stg://a", ["tg://a"]);
    await check(
        "asd  asdas das ton:asd tg:test ton://resolve tg://resolve TON://_-RESOLVE_- TG://-_RESOLVE-_",
        ["ton://resolve", "tg://resolve", "TON://_-RESOLVE_-", "TG://-_RESOLVE-_"],
    );
    await check("tg:test/", []);
    await check("tg:/test/", []);
    await check("tg://test/", ["tg://test/"]);
    await check("tg://test/?", ["tg://test/"]);
    await check("tg://test/#", ["tg://test/#"]);
    await check("tg://test?", ["tg://test"]);
    await check("tg://test#", ["tg://test"]);
    await check("tg://test/―asd―?asd=asd&asdas=―#――――", ["tg://test/―asd―?asd=asd&asdas=―#――――"]);
    await check("tg://test/?asd", ["tg://test/?asd"]);
    await check("tg://test/?.:;,('?!`.:;,('?!`", ["tg://test/"]);
    await check("tg://test/#asdf", ["tg://test/#asdf"]);
    await check("tg://test?asdf", ["tg://test?asdf"]);
    await check("tg://test#asdf", ["tg://test#asdf"]);
    await check("tg://test?as‖df", ["tg://test?as"]);
    await check("tg://test?sa<df", ["tg://test?sa"]);
    await check("tg://test?as>df", ["tg://test?as"]);
    await check('tg://test?as"df', ["tg://test?as"]);
    await check("tg://test?as«df", ["tg://test?as"]);
    await check("tg://test?as»df", ["tg://test?as"]);
    await check("tg://test?as(df", ["tg://test?as(df"]);
    await check("tg://test?as)df", ["tg://test?as)df"]);
    await check("tg://test?as[df", ["tg://test?as[df"]);
    await check("tg://test?as]df", ["tg://test?as]df"]);
    await check("tg://test?as{df", ["tg://test?as{df"]);
    await check("tg://test?as'df", ["tg://test?as'df"]);
    await check("tg://test?as}df", ["tg://test?as}df"]);
    await check("tg://test?as$df", ["tg://test?as$df"]);
    await check("tg://test?as%df", ["tg://test?as%df"]);
    await check("tg://%30/sccct", []);
    await check("tg://test:asd@google.com:80", ["tg://test"]);
    await check("tg://google.com", ["tg://google"]);
    await check("tg://google/.com", ["tg://google/.com"]);
    await check("tg://127.0.0.1", ["tg://127"]);
    await check("tg://б.а.н.а.на", []);
});

Deno.test("email address", async (t) => {
    let count = 0;
    const check = async (text: string, expected: boolean) => {
        await t.step(`${count++}`, () => {
            const result = encode(text);
            const actual = isEmailAddress(result);
            return assertEquals(actual, expected);
        });
    };

    await check("telegram.org", false);
    await check("security@telegram.org", true);
    await check("security.telegram.org", false);
    await check("", false);
    await check("@", false);
    await check("A@a.a.a.ab", true);
    await check("A@a.ab", true);
    await check("Test@aa.aa.aa.aa", true);
    await check("Test@test.abd", true);
    await check("a@a.a.a.ab", true);
    await check("test@test.abd", true);
    await check("test@test.com", true);
    await check("test.abd", false);
    await check("a.ab", false);
    await check("a.bc@d.ef", true);

    const badUserdatas = [
        "",
        "a.a.a.a.a.a.a.a.a.a.a.a",
        "+.+.+.+.+.+",
        "*.a.a",
        "a.*.a",
        "a.a.*",
        "a.a.",
        "a.a.abcdefghijklmnopqrstuvwxyz0123456789",
        "a.abcdefghijklmnopqrstuvwxyz0.a",
        "abcdefghijklmnopqrstuvwxyz0.a.a",
    ];
    const goodUserdatas = [
        "a.a.a.a.a.a.a.a.a.a.a",
        "a+a+a+a+a+a+a+a+a+a+a",
        "+.+.+.+.+._",
        "aozAQZ0-5-9_+-aozAQZ0-5-9_.aozAQZ0-5-9_.-._.+-",
        "a.a.a",
        "a.a.abcdefghijklmnopqrstuvwxyz012345678",
        "a.abcdefghijklmnopqrstuvwxyz.a",
        "a..a",
        "abcdefghijklmnopqrstuvwxyz.a.a",
        ".a.a",
    ];
    const badDomains = [
        "",
        ".",
        "abc",
        "localhost",
        "a.a.a.a.a.a.a.ab",
        ".......",
        "a.a.a.a.a.a+ab",
        "a+a.a.a.a.a.ab",
        "a.a.a.a.a.a.a",
        "a.a.a.a.a.a.abcdefghi",
        "a.a.a.a.a.a.ab0yz",
        "a.a.a.a.a.a.ab9yz",
        "a.a.a.a.a.a.ab-yz",
        "a.a.a.a.a.a.ab_yz",
        "a.a.a.a.a.a.ab*yz",
        ".ab",
        ".a.ab",
        "a..ab",
        "a.a.a..a.ab",
        ".a.a.a.a.ab",
        "abcdefghijklmnopqrstuvwxyz01234.ab",
        "ab0cd.abd.aA*sd.0.9.0-9.ABOYZ",
        "ab*cd.abd.aAasd.0.9.0-9.ABOYZ",
        "ab0cd.abd.aAasd.0.9.0*9.ABOYZ",
        "*b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0c*.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.0-*.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.*-9.ABOYZ",
        "-b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0c-.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.-.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.--9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.0--.ABOYZ",
        "_b0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0c_.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd._.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9._-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.0-_.ABOYZ",
        "-.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.-.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9.-.ABOYZ",
        "_.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "ab0cd.ab_d._.0.9.0-9.ABOYZ",
        "ab0cd.ab_d.aA-sd.0.9._.ABOYZ",
    ];
    const goodDomains = [
        "a.a.a.a.a.a.ab",
        "a.a.a.a.a.a.abcdef",
        "a.a.a.a.a.a.aboyz",
        "a.a.a.a.a.a.ABOYZ",
        "a.a.a.a.a.a.AbOyZ",
        "abcdefghijklmnopqrstuvwxyz0123.ab",
        "ab0cd.ab_d.aA-sd.0.9.0-9.ABOYZ",
        "A.Z.aA-sd.a.z.0-9.ABOYZ",
    ];

    for (const userdata of badUserdatas) {
        for (const domain of badDomains) {
            await check(userdata + "@" + domain, false);
            await check(userdata + domain, false);
        }
        for (const domain of goodDomains) {
            await check(userdata + "@" + domain, false);
            await check(userdata + domain, false);
        }
    }
    for (const userdata of goodUserdatas) {
        for (const domain of badDomains) {
            await check(userdata + "@" + domain, false);
            await check(userdata + domain, false);
        }
        for (const domain of goodDomains) {
            await check(userdata + "@" + domain, true);
            await check(userdata + domain, false);
        }
    }
});

Deno.test("url", async (t) => {
    let count = 0;
    const check = async (
        str: string,
        expectedUrls: string[],
        expectedEmailAddresses: string[] = [],
    ) => {
        await t.step(`${count++}`, () => {
            const encoded = encode(str);
            const results = findUrls(encoded);
            const actualUrls: string[] = [];
            const actualEmailAddress: string[] = [];
            for (const [[start, end], email] of results) {
                if (!email) actualUrls.push(decode(encoded.slice(start, end)));
                else actualEmailAddress.push(decode(encoded.slice(start, end)));
            }
            assertEquals(actualUrls, expectedUrls);
            assertEquals(actualEmailAddress, expectedEmailAddresses);
        });
    };

    await check("telegram.org", ["telegram.org"]);
    await check("(telegram.org)", ["telegram.org"]);
    await check("\ntelegram.org)", ["telegram.org"]);
    await check(" telegram.org)", ["telegram.org"]);
    await check(".telegram.org)", []);
    await check("()telegram.org/?q=()", ["telegram.org/?q=()"]);
    await check('"telegram.org"', ["telegram.org"]);
    await check(" telegram. org. www. com... telegram.org... ...google.com...", ["telegram.org"]);
    await check(" telegram.org ", ["telegram.org"]);
    await check(
        "Такой сайт: http://www.google.com или такой telegram.org ",
        ["http://www.google.com", "telegram.org"],
    );
    await check(" telegram.org. ", ["telegram.org"]);
    await check("http://google,.com", []);
    await check("http://telegram.org/?asd=123#123.", ["http://telegram.org/?asd=123#123"]);
    await check("[http://google.com](test)", ["http://google.com"]);
    await check("", []);
    await check(".", []);

    await check("http://@google.com", []);
    await check("http://@goog.com", []); // TODO: server fix
    await check("http://@@google.com", []);
    await check("http://a@google.com", ["http://a@google.com"]);
    await check("http://test@google.com", ["http://test@google.com"]);
    await check("google.com:᪉᪉᪉᪉᪉", ["google.com"]);
    await check("https://telegram.org", ["https://telegram.org"]);
    await check("http://telegram.org", ["http://telegram.org"]);
    await check("ftp://telegram.org", ["ftp://telegram.org"]);
    await check("ftps://telegram.org", []);
    await check("sftp://telegram.org", []);
    await check("hTtPs://telegram.org", ["hTtPs://telegram.org"]);
    await check("HTTP://telegram.org", ["HTTP://telegram.org"]);
    await check("аHTTP://telegram.org", ["HTTP://telegram.org"]);
    await check("sHTTP://telegram.org", []);
    await check("://telegram.org", []);
    await check("google.com:᪀᪀", ["google.com"]);
    await check(
        "http://" +
            "abcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkab" +
            "cdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcd" +
            "efghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdef" +
            "ghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefgh" +
            "ijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghij" +
            "kabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijka" +
            "bcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabc" +
            "defghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijkabcdefghijk.com",
        [],
    );
    await check("http://  .com", []);
    await check("    .com", []);
    await check("URL: .com", []);
    await check(".com", []);
    await check("http://  .", []);
    await check("http://.", []);
    await check("http://.com", []);
    await check("http://  .", []);
    await check(",ahttp://google.com", ["http://google.com"]);
    await check(".ahttp://google.com", []);
    await check("http://1.0", []);
    await check("http://a.0", []);
    await check("http://a.a", []);
    await check("google.com:1#ab c", ["google.com:1#ab"]);
    await check("google.com:1#", ["google.com:1"]);
    await check("google.com:1#1", ["google.com:1#1"]);
    await check("google.com:00000001/abs", ["google.com:00000001/abs"]);
    await check("google.com:000000065535/abs", ["google.com:000000065535/abs"]);
    await check("google.com:000000065536/abs", ["google.com"]);
    await check("google.com:000000080/abs", ["google.com:000000080/abs"]);
    await check("google.com:0000000/abs", ["google.com"]);
    await check("google.com:0/abs", ["google.com"]);
    await check("google.com:/abs", ["google.com"]);
    await check("google.com:65535", ["google.com:65535"]);
    await check("google.com:65536", ["google.com"]);
    await check("google.com:99999", ["google.com"]);
    await check("google.com:100000", ["google.com"]);
    await check("127.001", []);
    await check("127.0.0.1", ["127.0.0.1"]);
    await check("127.0.0.01", []);
    await check("127.0.0.256", []);
    await check("127.0.0.300", []);
    await check("127.0.0.1000", []);
    await check("127.0.0.260", []);
    await check("1.0", []);
    await check("www.🤙.tk", ["www.🤙.tk"]);
    await check("a.ab", []);
    await check("test.abd", []);
    await check("ТеСт.Москва", []);
    await check("ТеСт.МоСкВΑ", []);
    await check("ТеСт.МоСкВа", ["ТеСт.МоСкВа"]);
    await check("ТеСт.МоСкВач", []);
    await check("http://ÀТеСт.МоСкВач", ["http://ÀТеСт.МоСкВач"]);
    await check("ÀÁ.com. ÀÁ.com.", ["ÀÁ.com", "ÀÁ.com"]);
    await check("ÀÁ.com,ÀÁ.com.", ["ÀÁ.com", "ÀÁ.com"]);
    await check("teiegram.org/test", []);
    await check("TeiegraM.org/test", []);
    await check("http://test.google.com/?q=abc()}[]def", ["http://test.google.com/?q=abc()"]);
    await check("http://test.google.com/?q=abc([{)]}def", ["http://test.google.com/?q=abc([{)]}def"]);
    await check("http://test.google.com/?q=abc(){}]def", ["http://test.google.com/?q=abc(){}"]);
    await check("http://test.google.com/?q=abc){}[]def", ["http://test.google.com/?q=abc"]);
    await check("http://test.google.com/?q=abc(){}[]def", ["http://test.google.com/?q=abc(){}[]def"]);
    await check("http://test-.google.com", []);
    await check("http://test_.google.com", ["http://test_.google.com"]);
    await check("http://google_.com", []);
    await check("http://google._com_", []);
    await check("http://[2001:4860:0:2001::68]/", []); // TODO
    await check("tg://resolve", []);
    await check("test.abd", []);
    await check("/.b/..a    @.....@/. a.ba", ["a.ba"]);
    await check("bbbbbbbbbbbbbb.@.@", []);
    await check("http://google.com/", ["http://google.com/"]);
    await check("http://google.com?", ["http://google.com"]);
    await check("http://google.com#", ["http://google.com"]);
    await check("http://google.com##", ["http://google.com##"]);
    await check("http://google.com/?", ["http://google.com/"]);
    await check("https://www.google.com/ab,", ["https://www.google.com/ab"]);
    await check("@.", []);
    await check(
        'a.b.google.com dfsknnfs gsdfgsg http://códuia.de/ dffdg," 12)(cpia.de/())(" http://гришка.рф/ sdufhdf ' +
            "http://xn--80afpi2a3c.xn--p1ai/ I have a good time.Thanks, guys!\n\n(hdfughidufhgdis) go#ogle.com гришка.рф " +
            "hsighsdf gi почта.рф\n\n✪df.ws/123      " +
            "xn--80afpi2a3c.xn--p1ai\n\nhttp://foo.com/blah_blah\nhttp://foo.com/blah_blah/\n(Something like " +
            "http://foo.com/blah_blah)\nhttp://foo.com/blah_blah_(wikipedi8989a_Вася)\n(Something like " +
            "http://foo.com/blah_blah_(Стакан_007))\nhttp://foo.com/blah_blah.\nhttp://foo.com/blah_blah/.\n<http://foo.com/" +
            "blah_blah>\n<http://fo@@@@@@@@@^%#*@^&@$#*@#%^*&!^#o.com/blah_blah/>\nhttp://foo.com/blah_blah,\nhttp://" +
            "www.example.com/wpstyle/?p=364.\nhttp://✪df.ws/123\nrdar://1234\nrdar:/1234\nhttp://" +
            "userid:password@example.com:8080\nhttp://userid@example.com\nhttp://userid@example.com:8080\nhttp://" +
            "userid:password@example.com\nhttp://example.com:8080 " +
            "x-yojimbo-item://6303E4C1-xxxx-45A6-AB9D-3A908F59AE0E\nmessage://" +
            "%3c330e7f8409726r6a4ba78dkf1fd71420c1bf6ff@mail.gmail.com%3e\nhttp://➡️.ws/䨹\nwww.➡️.ws/" +
            "䨹\n<tag>http://example.com</tag>\nJust a www.example.com " +
            "link.\n\n➡️.ws/" +
            "䨹\n\nabcdefghijklmnopqrstuvwxyz0123456789qwe_sdfsdf.aweawe-sdfs.com\nwww.🤙.tk:1\ngoogle.com:" +
            "᪉᪉᪉᪉\ngoogle." +
            "com:᪀᪀\nhttp://  .com\n    .com\n" +
            ".com\n\ngoogle.com?qwe\ngoogle.com#qwe\ngoogle.com/?\ngoogle.com/#\ngoogle.com?\ngoogle.com#\n",
        [
            "a.b.google.com",
            "http://códuia.de/",
            "cpia.de/()",
            "http://гришка.рф/",
            "http://xn--80afpi2a3c.xn--p1ai/",
            "гришка.рф",
            "почта.рф",
            "✪df.ws/123",
            "xn--80afpi2a3c.xn--p1ai",
            "http://foo.com/blah_blah",
            "http://foo.com/blah_blah/",
            "http://foo.com/blah_blah",
            "http://foo.com/blah_blah_(wikipedi8989a_Вася)",
            "http://foo.com/blah_blah_(Стакан_007)",
            "http://foo.com/blah_blah",
            "http://foo.com/blah_blah/",
            "http://foo.com/blah_blah",
            "http://foo.com/blah_blah",
            "http://www.example.com/wpstyle/?p=364",
            "http://✪df.ws/123",
            "http://userid:password@example.com:8080",
            "http://userid@example.com",
            "http://userid@example.com:8080",
            "http://userid:password@example.com",
            "http://example.com:8080",
            "http://➡️.ws/䨹",
            "www.➡️.ws/䨹",
            "http://example.com",
            "www.example.com",
            "➡️.ws/䨹",
            "abcdefghijklmnopqrstuvwxyz0123456789qwe_sdfsdf.aweawe-sdfs.com",
            "www.🤙.tk:1",
            "google.com",
            "google.com",
            "google.com?qwe",
            "google.com#qwe",
            "google.com/",
            "google.com/#",
            "google.com",
            "google.com",
        ],
    );
    await check("https://t.…", []);
    await check("('http://telegram.org/a-b/?br=ie&lang=en',)", ["http://telegram.org/a-b/?br=ie&lang=en"]);
    await check("https://ai.telegram.org/bot%20bot/test-...", ["https://ai.telegram.org/bot%20bot/test-"]);
    await check("a.bc@c.com", [], ["a.bc@c.com"]);
    await check("https://a.bc@c.com", ["https://a.bc@c.com"]);
    await check("https://a.de[bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de/bc@c.com", ["https://a.de/bc@c.com"]);
    await check("https://a.de]bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de{bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de}bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de(bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de)bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.debc@c.com", ["https://a.debc@c.com"]);
    await check("https://a.de'bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.de`bc@c.com", ["https://a.de"], ["bc@c.com"]);
    await check("https://a.bcde.fg@c.com", ["https://a.bcde.fg@c.com"]);
    await check("https://a:h.bcde.fg@c.com", ["https://a:h.bcde.fg@c.com"]);
    await check("https://abc@c.com", ["https://abc@c.com"]);
    await check("https://de[bc@c.com", [], ["bc@c.com"]);
    await check("https://de/bc@c.com", []);
    await check("https://de]bc@c.com", [], ["bc@c.com"]);
    await check("https://de{bc@c.com", [], ["bc@c.com"]);
    await check("https://de}bc@c.com", [], ["bc@c.com"]);
    await check("https://de(bc@c.com", [], ["bc@c.com"]);
    await check("https://de)bc@c.com", [], ["bc@c.com"]);
    await check("https://de\\bc@c.com", ["https://de\\bc@c.com"]);
    await check("https://de'bc@c.com", [], ["bc@c.com"]);
    await check("https://de`bc@c.com", [], ["bc@c.com"]);
    await check("https://bc:defg@c.com", ["https://bc:defg@c.com"]);
    await check("https://a:hbc:defg@c.com", ["https://a:hbc:defg@c.com"]);
    await check("https://a.bc@test.com:cd.com", ["https://a.bc@test.com", "cd.com"]);
    await check("telegram.Org", []);
    await check("telegram.ORG", ["telegram.ORG"]);
    await check("a.b.c.com.a.b.c", []);
    await check("File '/usr/views.py'", []); // TODO server fix
    await check("@views.py'", []); // TODO server fix
    await check("#views.py'", []); // TODO server fix
    await check("/views.py'", []); // TODO server fix
    await check(".views.py", []);
    await check("'views.py'", ["views.py"]);
    await check("bug.http://test.com/test/+#", []); // TODO {"http://test.com/test/+#"}
    await check("//AB.C.D.E.F.GH//", []);
    await check("<http://www.ics.uci.edu/pub/ietf/uri/historical.html#WARNING>", [
        "http://www.ics.uci.edu/pub/ietf/uri/historical.html#WARNING",
    ]);
    await check("Look :test@example.com", [":test@example.com"], []); // TODO {}, {"test@example.com"}
    await check("Look mailto:test@example.com", [], ["test@example.com"]);
    await check("http://test.com#a", ["http://test.com#a"]);
    await check("http://test.com#", ["http://test.com"]);
    await check("http://test.com?#", ["http://test.com?#"]);
    await check("http://test.com/?#", ["http://test.com/?#"]);
    await check("https://t.me/abcdef…", ["https://t.me/abcdef"]);
    await check("https://t.me…", ["https://t.me"]);
    await check("https://t.m…", []);
    await check("https://t.…", []);
    await check("https://t…", []);
    await check("👉http://ab.com/cdefgh-1IJ", ["http://ab.com/cdefgh-1IJ"]);
    await check("...👉http://ab.com/cdefgh-1IJ", []); // TODO
    await check(".?", []);
    await check("http://test―‑@―google―.―com―/―–―‐―/―/―/―?―‑―#―――", ["http://test―‑@―google―.―com―/―–―‐―/―/―/―?―‑―#―――"]);
    await check("http://google.com/‖", ["http://google.com/"]);
    await check("a@b@c.com", [], []);
    await check("abc@c.com@d.com", []);
    await check("a@b.com:c@1", [], ["a@b.com"]);
    await check("test@test.software", [], ["test@test.software"]);
    await check("a:b?@gmail.com", []);
    await check("a?:b@gmail.com", []);
    await check("a#:b@gmail.com", []);
    await check("a:b#@gmail.com", []);
    await check("a!:b@gmail.com", ["a!:b@gmail.com"]);
    await check("a:b!@gmail.com", ["a:b!@gmail.com"]);
    await check("http://test_.com", []);
    await check("test_.com", []);
    await check("_test.com", []);
    await check("_.test.com", ["_.test.com"]);
});

function clone<T>(instance: T): T {
    if (Array.isArray(instance)) {
        // @ts-ignore let's ignore until i fix it properly
        return instance.map((i) => clone(i));
    } else {
        const prototype = Object.getPrototypeOf(instance);
        return Object.assign(Object.create(prototype), instance);
    }
}

Deno.test("fix formatted text", { ignore: false }, async (t) => {
    let count = 0;
    const check = async (
        str: string,
        entities: MessageEntity[],
        expectedStr: string,
        expectedEntities: MessageEntity[],
        allowEmpty = true,
        skipNewEntities = false,
        skipBotCommands = false,
        skipTrim = true,
    ) => {
        await t.step((count++).toString(), () => {
            const {
                entities: $entities,
                ok,
                text,
            } = fixFormattedText(encode(str), entities, allowEmpty, skipNewEntities, skipBotCommands, true, skipTrim);
            assert(ok);
            assertEquals(text, encode(expectedStr));
            assertEquals($entities, expectedEntities);
        });
    };
    const checkError = async (
        str: string,
        entities: MessageEntity[],
        allowEmpty: boolean,
        skipNewEntities: boolean,
        skipBotCommands: boolean,
        skipTrim: boolean,
    ) => {
        await t.step((count++).toString(), () => {
            try {
                fixFormattedText(
                    encode(str),
                    entities,
                    allowEmpty,
                    skipNewEntities,
                    skipBotCommands,
                    true,
                    skipTrim,
                );
                assert(false);
            } catch (error) {
                assert(error instanceof Error);
            }
        });
    };

    const str_: number[] = [];
    const fixedStr_: number[] = [];
    for (let i = 0; i <= 32; i++) {
        str_.push(i);
        if (i !== 13) {
            if (i !== 10) {
                fixedStr_.push(CODEPOINTS[" "]);
            } else {
                fixedStr_.push(str_.at(-1)!);
            }
        }
    }

    let str = decode(Uint8Array.from(str_));

    await check(str, [], "", [], true, true, true, true);
    await check(str, [], "", [], true, true, false, true);
    await check(str, [], "", [], true, false, true, true);
    await check(str, [], "", [], true, false, false, true);
    await check(str, [], "", [], true, false, false, false);
    await checkError(str, [], false, false, false, false);
    await checkError(str, [], false, false, false, true);

    await check("  aba\n ", [], "  aba\n ", [], true, true, true, true);
    await check("  aba\n ", [], "aba", [], true, true, true, false);
    await check("  \n ", [], "", [], true, true, true, true);
    await check("  \n ", [], "", [], true, true, true, false);
    await checkError("  \n ", [], false, true, true, false);

    str = str + "a  \r\n  ";
    const fixedStr = decode(mergeTypedArrays(Uint8Array.from(fixedStr_), encode("a  \n  ")));

    for (let i = 33; i <= 35; i++) {
        const entities: MessageEntity[] = [];
        entities.push(new MessageEntity(MessageEntityType.Pre, 0, i));

        const fixedEntities = entities;
        fixedEntities.at(-1)!.length = i - 1;
        await check(str, entities, fixedStr, fixedEntities, true, false, false, true);

        const expectedStr = encode(fixedStr).slice(0, 33);
        fixedEntities.at(-1)!.length = i === 33 ? 32 : 33;
        await check(str, entities, decode(expectedStr), fixedEntities, false, false, false, false);
    }

    for (let i = 33; i <= 35; i++) {
        const entities: MessageEntity[] = [];
        entities.push(new MessageEntity(MessageEntityType.Bold, 0, i));

        const fixedEntities: MessageEntity[] = [];
        if (i !== 33) {
            fixedEntities.push(new MessageEntity(MessageEntityType.Bold, 32, i - 33));
        }
        await check(str, clone(entities), fixedStr, fixedEntities, true, false, false, true);

        if (i !== 33) {
            fixedEntities.at(-1)!.offset = 0;
            fixedEntities.at(-1)!.length = 1;
        }
        const expectedStr = "a";
        await check(str, clone(entities), expectedStr, fixedEntities, false, false, false, false);
    }

    const str2 = encode("👉 👉  ");
    for (let i = 0; i < 10; i++) {
        const entities: MessageEntity[] = [];
        entities.push(new MessageEntity(MessageEntityType.Bold, i, 1));
        if (i !== 2 && i !== 5 && i !== 6) {
            await checkError(decode(str2), entities, true, true, true, true);
            await checkError(decode(str2), entities, false, false, false, false);
        } else {
            await check(decode(str2), entities, decode(str2), [], true, true, true, true);
            await check(decode(str2), entities, decode(str2.slice(0, str2.length - 2)), [], false, false, false, false);
        }
    }

    const str3 = encode("  /test @abaca #ORD $ABC  telegram.org ");
    for (const skip_trim of [false, true]) {
        const shift = skip_trim ? 2 : 0;
        // Reminder: td::string::substr takes start and length as parameters, not start and end.
        // Always add (+ start) to the 2nd argument they use, inside of .slice
        const expected_str = skip_trim ? str3 : str3.slice(2, str3.length - 3 + 2);

        for (const skip_new_entities of [false, true]) {
            for (const skip_bot_commands of [false, true]) {
                const entities: MessageEntity[] = [];
                if (!skip_new_entities) {
                    if (!skip_bot_commands) {
                        entities.push(new MessageEntity(MessageEntityType.BotCommand, shift, 5));
                    }
                    entities.push(new MessageEntity(MessageEntityType.Mention, shift + 6, 6));
                    entities.push(new MessageEntity(MessageEntityType.Hashtag, shift + 13, 4));
                    entities.push(new MessageEntity(MessageEntityType.Cashtag, shift + 18, 4));
                    entities.push(new MessageEntity(MessageEntityType.Url, shift + 24, 12));
                }

                await check(
                    decode(str3),
                    [],
                    decode(expected_str),
                    entities,
                    true,
                    skip_new_entities,
                    skip_bot_commands,
                    skip_trim,
                );
                await check(
                    decode(str3),
                    [],
                    decode(expected_str),
                    entities,
                    false,
                    skip_new_entities,
                    skip_bot_commands,
                    skip_trim,
                );
            }
        }
    }

    const str4 = encode("aba \r\n caba ");
    const user_id = new UserId(1n);
    for (let length = 1; length <= 3; length++) {
        for (let offset = 0; (offset + length) <= str4.length; offset++) {
            for (
                const type of [
                    MessageEntityType.Bold,
                    MessageEntityType.Url,
                    MessageEntityType.TextUrl,
                    MessageEntityType.MentionName,
                ]
            ) {
                for (const skip_trim of [false, true]) {
                    const fixedStr = encode(skip_trim ? "aba \n caba " : "aba \n caba");
                    let fixed_length = offset <= 4 && offset + length >= 5 ? length - 1 : length;
                    let fixed_offset = offset >= 5 ? offset - 1 : offset;
                    if (fixed_offset >= fixedStr.length) {
                        fixed_length = 0;
                    }
                    while ((fixed_offset + fixed_length) > fixedStr.length) {
                        fixed_length--;
                    }
                    if (type == MessageEntityType.Bold || type == MessageEntityType.Url) {
                        while (
                            fixed_length > 0 &&
                            (fixedStr[fixed_offset] === CODEPOINTS[" "] || fixedStr[fixed_offset] == CODEPOINTS["\n"])
                        ) {
                            fixed_offset++;
                            fixed_length--;
                        }
                    }

                    const entities: MessageEntity[] = [];
                    entities.push(new MessageEntity(type, offset, length));
                    if (type === MessageEntityType.TextUrl) {
                        entities.at(-1)!.argument = encode("t.me");
                    } else if (type === MessageEntityType.MentionName) {
                        entities.at(-1)!.userId = user_id;
                    }
                    const fixed_entities: MessageEntity[] = [];
                    if (fixed_length > 0) {
                        for (let i = 0; i < length; i++) {
                            if (
                                !isSpace(str4[offset + i]) || type == MessageEntityType.TextUrl ||
                                type === MessageEntityType.MentionName
                            ) {
                                fixed_entities.push(new MessageEntity(type, fixed_offset, fixed_length));
                                if (type == MessageEntityType.TextUrl) {
                                    fixed_entities.at(-1)!.argument = encode("t.me");
                                } else if (type == MessageEntityType.MentionName) {
                                    fixed_entities.at(-1)!.userId = user_id;
                                }
                                break;
                            }
                        }
                    }
                    await check(decode(str4), entities, decode(fixedStr), fixed_entities, true, false, false, skip_trim);
                }
            }
        }
    }

    const str5 = encode("aba caba");
    for (let length = -10; length <= 10; length++) {
        for (let offset = -10; offset <= 10; offset++) {
            const entities: MessageEntity[] = [];
            entities.push(new MessageEntity(MessageEntityType.Bold, offset, length));

            if (length < 0 || offset < 0 || (length > 0 && (length + offset) > str5.length)) {
                await checkError(decode(str5), clone(entities), true, false, false, false);
                await checkError(decode(str5), clone(entities), false, false, false, true);
                continue;
            }

            const fixedEntities: MessageEntity[] = [];
            if (length > 0) {
                if (offset === 3) {
                    if (length >= 2) {
                        fixedEntities.push(new MessageEntity(MessageEntityType.Bold, offset + 1, length - 1));
                    }
                } else {
                    fixedEntities.push(new MessageEntity(MessageEntityType.Bold, offset, length));
                }
            }
            await check(decode(str5), clone(entities), decode(str5), fixedEntities, true, false, false, false);
            await check(decode(str5), clone(entities), decode(str5), fixedEntities, false, false, false, true);
        }
    }

    const str6 = encode("abadcaba");
    for (let length = 1; length <= 7; length++) {
        for (let offset = 0; offset <= 8 - length; offset++) {
            for (let length2 = 1; length2 <= 7; length2++) {
                for (let offset2 = 0; offset2 <= 8 - length2; offset2++) {
                    if (offset != offset2) {
                        const entities: MessageEntity[] = [];
                        entities.push(new MessageEntity(MessageEntityType.TextUrl, offset, length, encode("t.me")));
                        entities.push(new MessageEntity(MessageEntityType.TextUrl, offset2, length2, encode("t.me")));
                        entities.push(new MessageEntity(MessageEntityType.TextUrl, offset2 + length2, 1));
                        let fixedEntities = clone(entities);
                        fixedEntities.pop();
                        fixedEntities = sortEntities(fixedEntities);
                        if (fixedEntities[0].offset + fixedEntities[0].length > fixedEntities[1].offset) {
                            fixedEntities.pop();
                        }
                        await check(decode(str6), entities, decode(str6), fixedEntities, false, false, false, false);
                    }
                }
            }
        }
    }

    for (const text of [" \n ➡️ ➡️ ➡️ ➡️  \n ", "\n\n\nab cd ef gh        "]) {
        const str = encode(text);
        const entities: MessageEntity[] = [];
        const fixedEntities: MessageEntity[] = [];

        const length = utf8utf16Length(str);
        for (let i = 0; i < 10; i++) {
            if (((i + 1) * 3) + 2 <= length) {
                entities.push(new MessageEntity(MessageEntityType.Bold, (i + 1) * 3, 2));
            }
            if ((i + 2) * 3 <= length) {
                entities.push(new MessageEntity(MessageEntityType.Italic, ((i + 1) * 3) + 2, 1));
            }

            if (i < 4) {
                fixedEntities.push(new MessageEntity(MessageEntityType.Bold, i * 3, 2));
            }
        }

        await check(decode(str), entities, decode(utf8utf16Substr(str, 3, 11)), fixedEntities, false, false, false, false);
    }

    for (const text of ["\t", "\r", "\n", "\t ", "\r ", "\n "]) {
        for (const type of [MessageEntityType.Bold, MessageEntityType.TextUrl]) {
            const entity = MessageEntity.of(type, 0, 1, encode("http://telegram.org/"));
            await check(text, [entity], "", [], true, false, false, true);
        }
    }

    await check(
        "\r ",
        [MessageEntity.of(MessageEntityType.Bold, 0, 2), MessageEntity.of(MessageEntityType.Underline, 0, 1)],
        "",
        [],
        true,
        false,
        false,
        true,
    );
    await check(
        "a \r",
        [MessageEntity.of(MessageEntityType.Bold, 0, 3), MessageEntity.of(MessageEntityType.Underline, 2, 1)],
        "a ",
        [MessageEntity.of(MessageEntityType.Bold, 0, 2)],
        true,
        false,
        false,
        true,
    );
    await check(
        "a \r ",
        [MessageEntity.of(MessageEntityType.Bold, 0, 4), MessageEntity.of(MessageEntityType.Underline, 2, 1)],
        "a  ",
        [MessageEntity.of(MessageEntityType.Bold, 0, 2)],
        true,
        false,
        false,
        true,
    );
    await check(
        "a \r b",
        [MessageEntity.of(MessageEntityType.Bold, 0, 5), MessageEntity.of(MessageEntityType.Underline, 2, 1)],
        "a  b",
        [MessageEntity.of(MessageEntityType.Bold, 0, 2), MessageEntity.of(MessageEntityType.Bold, 3, 1)],
        true,
        false,
        false,
        true,
    );

    await check(
        "a\rbc\r",
        [
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 0, 2),
            MessageEntity.of(MessageEntityType.Italic, 3, 2),
            MessageEntity.of(MessageEntityType.Bold, 3, 1),
        ],
        "abc",
        [
            MessageEntity.of(MessageEntityType.Bold, 0, 1),
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 2, 1),
            MessageEntity.of(MessageEntityType.Italic, 2, 1),
        ],
    );
    await check(
        "a ",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Bold, 0, 1)],
        "a",
        [MessageEntity.of(MessageEntityType.Bold, 0, 1), MessageEntity.of(MessageEntityType.Italic, 0, 1)],
        false,
        false,
        false,
        false,
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 1, 1), MessageEntity.of(MessageEntityType.Italic, 0, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 1, 1), MessageEntity.of(MessageEntityType.Italic, 1, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 1, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Italic, 1, 2)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 3)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Italic, 2, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 3)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 1), MessageEntity.of(MessageEntityType.Italic, 2, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 1), MessageEntity.of(MessageEntityType.Italic, 2, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Bold, 1, 2)],
        "abc",
        [
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 1, 2),
            MessageEntity.of(MessageEntityType.Italic, 1, 1),
        ],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Bold, 2, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 2), MessageEntity.of(MessageEntityType.Bold, 2, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 1), MessageEntity.of(MessageEntityType.Bold, 2, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Italic, 0, 1), MessageEntity.of(MessageEntityType.Bold, 2, 1)],
    );
    await check("@tests @tests", [MessageEntity.of(MessageEntityType.Italic, 0, 13)], "@tests @tests", [
        MessageEntity.of(MessageEntityType.Mention, 0, 6),
        MessageEntity.of(MessageEntityType.Italic, 0, 6),
        MessageEntity.of(MessageEntityType.Mention, 7, 6),
        MessageEntity.of(MessageEntityType.Italic, 7, 6),
    ]);

    // __a~b~__
    await check(
        "ab",
        [MessageEntity.of(MessageEntityType.Underline, 0, 2), MessageEntity.of(MessageEntityType.Strikethrough, 1, 1)],
        "ab",
        [
            MessageEntity.of(MessageEntityType.Underline, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
        ],
    );
    await check(
        "ab",
        [
            MessageEntity.of(MessageEntityType.Underline, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
        ],
        "ab",
        [
            MessageEntity.of(MessageEntityType.Underline, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
        ],
    );
    await check(
        "ab",
        [MessageEntity.of(MessageEntityType.Strikethrough, 0, 2), MessageEntity.of(MessageEntityType.Underline, 1, 1)],
        "ab",
        [
            MessageEntity.of(MessageEntityType.Strikethrough, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
        ],
    );
    await check(
        "ab",
        [
            MessageEntity.of(MessageEntityType.Strikethrough, 0, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
        ],
        "ab",
        [
            MessageEntity.of(MessageEntityType.Strikethrough, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 1, 1),
        ],
    );

    // __||a||b__
    await check(
        "ab",
        [MessageEntity.of(MessageEntityType.Underline, 0, 2), MessageEntity.of(MessageEntityType.Spoiler, 0, 1)],
        "ab",
        [MessageEntity.of(MessageEntityType.Underline, 0, 2), MessageEntity.of(MessageEntityType.Spoiler, 0, 1)],
    );
    await check(
        "ab",
        [
            MessageEntity.of(MessageEntityType.Underline, 0, 1),
            MessageEntity.of(MessageEntityType.Underline, 1, 1),
            MessageEntity.of(MessageEntityType.Spoiler, 0, 1),
        ],
        "ab",
        [MessageEntity.of(MessageEntityType.Underline, 0, 2), MessageEntity.of(MessageEntityType.Spoiler, 0, 1)],
    );

    // _*a*_\r_*b*_
    await check(
        "a\rb",
        [
            MessageEntity.of(MessageEntityType.Bold, 0, 1),
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 2, 1),
            MessageEntity.of(MessageEntityType.Italic, 2, 1),
        ],
        "ab",
        [MessageEntity.of(MessageEntityType.Bold, 0, 2), MessageEntity.of(MessageEntityType.Italic, 0, 2)],
    );
    await check(
        "a\nb",
        [
            MessageEntity.of(MessageEntityType.Bold, 0, 1),
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 2, 1),
            MessageEntity.of(MessageEntityType.Italic, 2, 1),
        ],
        "a\nb",
        [
            MessageEntity.of(MessageEntityType.Bold, 0, 1),
            MessageEntity.of(MessageEntityType.Italic, 0, 1),
            MessageEntity.of(MessageEntityType.Bold, 2, 1),
            MessageEntity.of(MessageEntityType.Italic, 2, 1),
        ],
    );

    // ||`a`||
    await check(
        "a",
        [MessageEntity.of(MessageEntityType.Pre, 0, 1), MessageEntity.of(MessageEntityType.Spoiler, 0, 1)],
        "a",
        [MessageEntity.of(MessageEntityType.Pre, 0, 1)],
    );
    await check(
        "a",
        [MessageEntity.of(MessageEntityType.Spoiler, 0, 1), MessageEntity.of(MessageEntityType.Pre, 0, 1)],
        "a",
        [MessageEntity.of(MessageEntityType.Pre, 0, 1)],
    );

    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 0, 3), MessageEntity.of(MessageEntityType.Strikethrough, 1, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 0, 3)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 1, 1), MessageEntity.of(MessageEntityType.Strikethrough, 0, 3)],
        "abc",
        [
            MessageEntity.of(MessageEntityType.Strikethrough, 0, 1),
            MessageEntity.of(MessageEntityType.Pre, 1, 1),
            MessageEntity.of(MessageEntityType.Strikethrough, 2, 1),
        ],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 1, 1), MessageEntity.of(MessageEntityType.Strikethrough, 1, 2)],
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 1, 1), MessageEntity.of(MessageEntityType.Strikethrough, 2, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 1, 1), MessageEntity.of(MessageEntityType.Strikethrough, 0, 2)],
        "abc",
        [MessageEntity.of(MessageEntityType.Strikethrough, 0, 1), MessageEntity.of(MessageEntityType.Pre, 1, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.Pre, 0, 3), MessageEntity.of(MessageEntityType.BlockQuote, 1, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.BlockQuote, 1, 1)],
    );
    await check(
        "abc",
        [MessageEntity.of(MessageEntityType.BlockQuote, 0, 3), MessageEntity.of(MessageEntityType.Pre, 1, 1)],
        "abc",
        [MessageEntity.of(MessageEntityType.BlockQuote, 0, 3), MessageEntity.of(MessageEntityType.Pre, 1, 1)],
    );

    await check("example.com", [], "example.com", [MessageEntity.of(MessageEntityType.Url, 0, 11)]);
    await check("example.com", [MessageEntity.of(MessageEntityType.Pre, 0, 3)], "example.com", [
        MessageEntity.of(MessageEntityType.Pre, 0, 3),
    ]);
    await check("example.com", [MessageEntity.of(MessageEntityType.BlockQuote, 0, 3)], "example.com", [
        MessageEntity.of(MessageEntityType.BlockQuote, 0, 3),
    ]);
    await check("example.com", [MessageEntity.of(MessageEntityType.BlockQuote, 0, 11)], "example.com", [
        MessageEntity.of(MessageEntityType.BlockQuote, 0, 11),
        MessageEntity.of(MessageEntityType.Url, 0, 11),
    ]);
    await check("example.com", [MessageEntity.of(MessageEntityType.Italic, 0, 11)], "example.com", [
        MessageEntity.of(MessageEntityType.Url, 0, 11),
        MessageEntity.of(MessageEntityType.Italic, 0, 11),
    ]);
    await check("example.com", [MessageEntity.of(MessageEntityType.Italic, 0, 3)], "example.com", [
        MessageEntity.of(MessageEntityType.Url, 0, 11),
        MessageEntity.of(MessageEntityType.Italic, 0, 3),
    ]);
    await check("example.com a", [MessageEntity.of(MessageEntityType.Italic, 0, 13)], "example.com a", [
        MessageEntity.of(MessageEntityType.Url, 0, 11),
        MessageEntity.of(MessageEntityType.Italic, 0, 11),
        MessageEntity.of(MessageEntityType.Italic, 12, 1),
    ]);
    await check("a example.com", [MessageEntity.of(MessageEntityType.Italic, 0, 13)], "a example.com", [
        MessageEntity.of(MessageEntityType.Italic, 0, 2),
        MessageEntity.of(MessageEntityType.Url, 2, 11),
        MessageEntity.of(MessageEntityType.Italic, 2, 11),
    ]);

    await t.step("100000 steps", () => {
        for (let test_n = 0; test_n < 100000; test_n++) {
            let str: Uint8Array;
            const isUrl = random.fastBool();
            let urlOffset = 0;
            let urlEnd = 0;

            if (isUrl) {
                str = encode(("a".repeat(random.fast(1, 5))) + (":example.com:") + ("a".repeat(random.fast(1, 5))));
                urlOffset = str.indexOf(CODEPOINTS["e"]);
                urlEnd = urlOffset + 11;
            } else {
                str = encode("a".repeat(random.fast(1, 20)));
            }

            const n = random.fast(1, 20);
            let entities: MessageEntity[] = [];
            for (let j = 0; j < n; j++) {
                const type = random.fast(4, 16);
                const offset = random.fast(0, str.length - 1);
                let maxLength = str.length - offset;
                if ((test_n & 1) != 0 && maxLength > 4) {
                    maxLength = 4;
                }
                const length = random.fast(0, maxLength);
                entities.push(MessageEntity.of(type, offset, length));
            }

            const getTypeMask = (length: number, entities: MessageEntity[]) => {
                const result: number[] = new Array(length).fill(0);
                for (const entity of entities) {
                    for (let pos = 0; pos < entity.length; pos++) {
                        result[entity.offset + pos] |= 1 << entity.type;
                    }
                }
                return result;
            };
            const oldTypeMask = getTypeMask(str.length, clone(entities));
            const fixed = fixFormattedText(str, entities, false, false, true, true, false);
            assert(fixed.ok);
            str = fixed.text;
            entities = fixed.entities;
            const newTypeMask = getTypeMask(str.length, clone(entities));
            const splittableMask = (1 << 5) | (1 << 6) | (1 << 14) | (1 << 15);
            const preMask = (1 << 7) | (1 << 8) | (1 << 9);
            for (let pos = 0; pos < str.length; pos++) {
                if ((newTypeMask[pos] & preMask) != 0) {
                    assertEquals(0, newTypeMask[pos] & splittableMask);
                } else {
                    // console.log({
                    //   oldTypeMask,
                    //   newTypeMask,
                    //   l: oldTypeMask[pos],
                    //   r: newTypeMask[pos],
                    //   ll: oldTypeMask[pos] & splittableMask,
                    //   rr: newTypeMask[pos] & splittableMask,
                    // });
                    // TODO: fix the only failing test!
                    assertEquals(oldTypeMask[pos] & splittableMask, newTypeMask[pos] & splittableMask);
                }
            }
            let keepUrl = isUrl;
            const urlEntity = MessageEntity.of(MessageEntityType.Url, urlOffset, urlEnd - urlOffset);
            for (const entity of entities) {
                if (entity.equal(urlEntity)) {
                    continue;
                }
                const offset = entity.offset;
                const end = offset + entity.length;
                if (keepUrl && ((1 << entity.type) & splittableMask) === 0 && !(end <= urlOffset || urlEnd <= offset)) {
                    keepUrl = entity.type === MessageEntityType.BlockQuote && offset <= urlOffset && urlEnd <= end;
                }
            }
            assertEquals(keepUrl, entities.filter((e) => e.equal(urlEntity)).length === 1);
            for (let i = 0; i < entities.length; i++) {
                const typeMask = 1 << entities[i].type;
                for (let j = i + 1; j < entities.length; j++) {
                    assert(
                        entities[j].offset > entities[i].offset ||
                            (entities[j].offset === entities[i].offset && entities[j].length <= entities[i].length),
                    );

                    assert(
                        entities[j].offset >= entities[i].offset + entities[i].length ||
                            entities[j].offset + entities[j].length <= entities[i].offset + entities[i].length,
                    );

                    if (entities[j].offset < entities[i].offset + entities[i].length) { // if nested
                        // types are different
                        assert(entities[j].type != entities[i].type);

                        // pre can't contain other entities
                        assert((typeMask & preMask) == 0);

                        if ((typeMask & splittableMask) == 0 && entities[i].type != MessageEntityType.BlockQuote) {
                            // continuous entities can contain only splittable entities
                            assert(((1 << entities[j].type) & splittableMask) != 0);
                        }
                    }
                }
            }
        }
    });

    await check(
        decode(
            hexStringToBytes(
                "\xe2\x80\x8f\xe2\x80\x8f  \xe2\x80\x8e\xe2\x80\x8e\xe2\x80\x8e\xe2\x80\x8c \xe2\x80\x8f\xe2\x80\x8e " +
                    "\xe2\x80\x8f",
            ),
        ),
        [],
        decode(
            hexStringToBytes(
                "\xe2\x80\x8c\xe2\x80\x8f  \xe2\x80\x8c\xe2\x80\x8c\xe2\x80\x8e\xe2\x80\x8c \xe2\x80\x8c\xe2\x80\x8e " +
                    "\xe2\x80\x8f",
            ),
        ),
        [],
    );
});

Deno.test("parse html", async (t) => {
    let count = 0;
    const check = async (text: string, result: string, entities?: MessageEntity[]) => {
        await t.step(`${count++}`, () => {
            const str = encode(text);
            if (entities == null) {
                try {
                    parseHtml(str);
                } catch (err) {
                    assert(err instanceof Error);
                    assertStrictEquals(err.message, result);
                }
            } else {
                const parsed = parseHtml(str);
                assertStrictEquals(decode(parsed.text), result);
                assertEquals(parsed.entities, entities);
            }
        });
    };

    const INVALID_SURROGATE_PAIR_ERROR_MESSAGE =
        "Text contains invalid Unicode characters after decoding HTML entities, check for unmatched surrogate code units";

    await check("&#57311;", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
    await check("&#xDFDF;", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
    await check("&#xDFDF", INVALID_SURROGATE_PAIR_ERROR_MESSAGE);
    await check("🏟 🏟&lt;<abacaba", "Unclosed start tag at byte offset 13");
    await check("🏟 🏟&lt;<abac aba>", 'Unsupported start tag "abac" at byte offset 13');
    await check("🏟 🏟&lt;<abac>", 'Unsupported start tag "abac" at byte offset 13');
    await check("🏟 🏟&lt;<i   =aba>", 'Empty attribute name in the tag "i" at byte offset 13');
    await check(
        "🏟 🏟&lt;<i    aba>",
        'Expected equal sign in declaration of an attribute of the tag "i" at byte offset 13',
    );
    await check("🏟 🏟&lt;<i    aba  =  ", 'Unclosed start tag "i" at byte offset 13');
    await check("🏟 🏟&lt;<i    aba  =  190azAz-.,", "Unexpected end of name token at byte offset 27");
    await check('🏟 🏟&lt;<i    aba  =  "&lt;&gt;&quot;>', "Unclosed start tag at byte offset 13");
    await check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;>", "Unclosed start tag at byte offset 13");
    await check("🏟 🏟&lt;</", "Unexpected end tag at byte offset 13");
    await check("🏟 🏟&lt;<b></b></", "Unexpected end tag at byte offset 20");
    await check("🏟 🏟&lt;<i>a</i   ", "Unclosed end tag at byte offset 17");
    await check("🏟 🏟&lt;<i>a</em   >", 'Unmatched end tag at byte offset 17, expected "</i>", found "</em>"');

    await check("", "", []);
    await check("➡️ ➡️", "➡️ ➡️", []);
    await check("&ge;&lt;&gt;&amp;&quot;&laquo;&raquo;&#12345678;", '&ge;<>&"&laquo;&raquo;&#12345678;', []);
    await check("&Or;", "&Or;", []);
    await check("➡️ ➡️<i>➡️ ➡️</i>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Italic, 5, 5)]);
    await check("➡️ ➡️<em>➡️ ➡️</em>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Italic, 5, 5)]);
    await check("➡️ ➡️<b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Bold, 5, 5)]);
    await check("➡️ ➡️<strong>➡️ ➡️</strong>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Bold, 5, 5)]);
    await check("➡️ ➡️<u>➡️ ➡️</u>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Underline, 5, 5)]);
    await check("➡️ ➡️<ins>➡️ ➡️</ins>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Underline, 5, 5)]);
    await check("➡️ ➡️<s>➡️ ➡️</s>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Strikethrough, 5, 5)]);
    await check("➡️ ➡️<strike>➡️ ➡️</strike>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Strikethrough, 5, 5)]);
    await check("➡️ ➡️<del>➡️ ➡️</del>", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Strikethrough, 5, 5)]);
    await check("➡️ ➡️<i>➡️ ➡️</i><b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️➡️ ➡️", [
        new MessageEntity(MessageEntityType.Italic, 5, 5),
        new MessageEntity(MessageEntityType.Bold, 10, 5),
    ]);
    await check("🏟 🏟<i>🏟 &lt🏟</i>", "🏟 🏟🏟 <🏟", [new MessageEntity(MessageEntityType.Italic, 5, 6)]);
    await check("🏟 🏟<i>🏟 &gt;<b aba   =   caba>&lt🏟</b></i>", "🏟 🏟🏟 ><🏟", [
        new MessageEntity(MessageEntityType.Italic, 5, 7),
        new MessageEntity(MessageEntityType.Bold, 9, 3),
    ]);
    await check("🏟 🏟&lt;<i    aba  =  190azAz-.   >a</i>", "🏟 🏟<a", [new MessageEntity(MessageEntityType.Italic, 6, 1)]);
    await check("🏟 🏟&lt;<i    aba  =  190azAz-.>a</i>", "🏟 🏟<a", [new MessageEntity(MessageEntityType.Italic, 6, 1)]);
    await check('🏟 🏟&lt;<i    aba  =  "&lt;&gt;&quot;">a</i>', "🏟 🏟<a", [
        new MessageEntity(MessageEntityType.Italic, 6, 1),
    ]);
    await check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;'>a</i>", "🏟 🏟<a", [
        new MessageEntity(MessageEntityType.Italic, 6, 1),
    ]);
    await check("🏟 🏟&lt;<i    aba  =  '&lt;&gt;&quot;'>a</>", "🏟 🏟<a", [
        new MessageEntity(MessageEntityType.Italic, 6, 1),
    ]);
    await check("🏟 🏟&lt;<i>🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [new MessageEntity(MessageEntityType.Italic, 6, 6)]);
    await check("🏟 🏟&lt;<i>a</    >", "🏟 🏟<a", [new MessageEntity(MessageEntityType.Italic, 6, 1)]);
    await check("🏟 🏟&lt;<i>a</i   >", "🏟 🏟<a", [new MessageEntity(MessageEntityType.Italic, 6, 1)]);
    await check("🏟 🏟&lt;<b></b>", "🏟 🏟<", []);
    await check("<i>\t</i>", "\t", [new MessageEntity(MessageEntityType.Italic, 0, 1)]);
    await check("<i>\r</i>", "\r", [new MessageEntity(MessageEntityType.Italic, 0, 1)]);
    await check("<i>\n</i>", "\n", [new MessageEntity(MessageEntityType.Italic, 0, 1)]);
    await check('➡️ ➡️<span class = "tg-spoiler">➡️ ➡️</span><b>➡️ ➡️</b>', "➡️ ➡️➡️ ➡️➡️ ➡️", [
        new MessageEntity(MessageEntityType.Spoiler, 5, 5),
        new MessageEntity(MessageEntityType.Bold, 10, 5),
    ]);
    await check('🏟 🏟<span class="tg-spoiler">🏟 &lt🏟</span>', "🏟 🏟🏟 <🏟", [
        new MessageEntity(MessageEntityType.Spoiler, 5, 6),
    ]);
    await check('🏟 🏟<span class="tg-spoiler">🏟 &gt;<b aba   =   caba>&lt🏟</b></span>', "🏟 🏟🏟 ><🏟", [
        new MessageEntity(MessageEntityType.Spoiler, 5, 7),
        new MessageEntity(MessageEntityType.Bold, 9, 3),
    ]);
    await check("➡️ ➡️<tg-spoiler>➡️ ➡️</tg-spoiler><b>➡️ ➡️</b>", "➡️ ➡️➡️ ➡️➡️ ➡️", [
        new MessageEntity(MessageEntityType.Spoiler, 5, 5),
        new MessageEntity(MessageEntityType.Bold, 10, 5),
    ]);
    await check("🏟 🏟<tg-spoiler>🏟 &lt🏟</tg-spoiler>", "🏟 🏟🏟 <🏟", [new MessageEntity(MessageEntityType.Spoiler, 5, 6)]);
    await check("🏟 🏟<tg-spoiler>🏟 &gt;<b aba   =   caba>&lt🏟</b></tg-spoiler>", "🏟 🏟🏟 ><🏟", [
        new MessageEntity(MessageEntityType.Spoiler, 5, 7),
        new MessageEntity(MessageEntityType.Bold, 9, 3),
    ]);
    await check("<a href=telegram.org>\t</a>", "\t", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("<a href=telegram.org>\r</a>", "\r", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("<a href=telegram.org>\n</a>", "\n", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("<code><i><b> </b></i></code><i><b><code> </code></b></i>", "  ", [
        new MessageEntity(MessageEntityType.Code, 0, 1),
        new MessageEntity(MessageEntityType.Bold, 0, 1),
        new MessageEntity(MessageEntityType.Italic, 0, 1),
        new MessageEntity(MessageEntityType.Code, 1, 1),
        new MessageEntity(MessageEntityType.Bold, 1, 1),
        new MessageEntity(MessageEntityType.Italic, 1, 1),
    ]);
    await check("<i><b> </b> <code> </code></i>", "   ", [
        new MessageEntity(MessageEntityType.Italic, 0, 3),
        new MessageEntity(MessageEntityType.Bold, 0, 1),
        new MessageEntity(MessageEntityType.Code, 2, 1),
    ]);
    await check("<a href=telegram.org> </a>", " ", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check('<a href  ="telegram.org"   > </a>', " ", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("<a   href=  'telegram.org'   > </a>", " ", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("<a   href=  'telegram.org?&lt;'   > </a>", " ", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/?<")),
    ]);
    await check("<a> </a>", " ", []);
    await check("<a>telegram.org </a>", "telegram.org ", []);
    await check("<a>telegram.org</a>", "telegram.org", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("http://telegram.org/")),
    ]);
    await check("<a>https://telegram.org/asdsa?asdasdwe#12e3we</a>", "https://telegram.org/asdsa?asdasdwe#12e3we", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 42, encode("https://telegram.org/asdsa?asdasdwe#12e3we")),
    ]);
    await check("🏟 🏟&lt;<pre  >🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [new MessageEntity(MessageEntityType.Pre, 6, 6)]);
    await check("🏟 🏟&lt;<code >🏟 🏟&lt;</>", "🏟 🏟<🏟 🏟<", [new MessageEntity(MessageEntityType.Code, 6, 6)]);
    await check("🏟 🏟&lt;<pre><code>🏟 🏟&lt;</code></>", "🏟 🏟<🏟 🏟<", [
        new MessageEntity(MessageEntityType.Pre, 6, 6),
        new MessageEntity(MessageEntityType.Code, 6, 6),
    ]);
    await check('🏟 🏟&lt;<pre><code class="language-">🏟 🏟&lt;</code></>', "🏟 🏟<🏟 🏟<", [
        new MessageEntity(MessageEntityType.Pre, 6, 6),
        new MessageEntity(MessageEntityType.Code, 6, 6),
    ]);
    await check('🏟 🏟&lt;<pre><code class="language-fift">🏟 🏟&lt;</></>', "🏟 🏟<🏟 🏟<", [
        new MessageEntity(MessageEntityType.PreCode, 6, 6, encode("fift")),
    ]);
    await check('🏟 🏟&lt;<code class="language-fift"><pre>🏟 🏟&lt;</></>', "🏟 🏟<🏟 🏟<", [
        new MessageEntity(MessageEntityType.PreCode, 6, 6, encode("fift")),
    ]);
    await check('🏟 🏟&lt;<pre><code class="language-fift">🏟 🏟&lt;</> </>', "🏟 🏟<🏟 🏟< ", [
        new MessageEntity(MessageEntityType.Pre, 6, 7),
        new MessageEntity(MessageEntityType.Code, 6, 6),
    ]);
    await check('🏟 🏟&lt;<pre> <code class="language-fift">🏟 🏟&lt;</></>', "🏟 🏟< 🏟 🏟<", [
        new MessageEntity(MessageEntityType.Pre, 6, 7),
        new MessageEntity(MessageEntityType.Code, 7, 6),
    ]);
    await check('➡️ ➡️<tg-emoji emoji-id = "12345">➡️ ➡️</tg-emoji><b>➡️ ➡️</b>', "➡️ ➡️➡️ ➡️➡️ ➡️", [
        new MessageEntity(MessageEntityType.CustomEmoji, 5, 5, new CustomEmojiId(12345n)),
        new MessageEntity(MessageEntityType.Bold, 10, 5),
    ]);
    await check('🏟 🏟<tg-emoji emoji-id="54321">🏟 &lt🏟</tg-emoji>', "🏟 🏟🏟 <🏟", [
        new MessageEntity(MessageEntityType.CustomEmoji, 5, 6, new CustomEmojiId(54321n)),
    ]);
    await check('🏟 🏟<b aba   =   caba><tg-emoji emoji-id="1">🏟</tg-emoji>1</b>', "🏟 🏟🏟1", [
        new MessageEntity(MessageEntityType.Bold, 5, 3),
        new MessageEntity(MessageEntityType.CustomEmoji, 5, 2, new CustomEmojiId(1n)),
    ]);
});

Deno.test("parse markdown v2", async (t) => {
    let count = 0;
    const check = async (text: string, result: string, entities?: MessageEntity[]) => {
        await t.step(`${count++}`, () => {
            const str = encode(text);
            if (entities == null) {
                try {
                    parseMarkdownV2(str);
                } catch (err) {
                    assert(err instanceof Error);
                    assertStrictEquals(err.message, result);
                }
            } else {
                const parsed = parseMarkdownV2(str);
                assertStrictEquals(decode(parsed.text), result);
                assertEquals(parsed.entities, entities);
            }
        });
    };

    const reservedCharacters = encode("]()>#+-=|{}.!");
    const beginCharacters = encode("_*[~`");

    for (let codepoint = 1; codepoint < 126; codepoint++) {
        if (beginCharacters.includes(codepoint)) {
            continue;
        }
        const text = decode(Uint8Array.of(codepoint));
        if (!reservedCharacters.includes(codepoint)) {
            await check(text, text, []);
        } else {
            await check(text, `Character '${text}' is reserved and must be escaped with the preceding '\\'`);
            const escapedText = "\\" + text;
            await check(escapedText, text, []);
        }
    }

    await check("🏟 🏟_abacaba", "Can't find end of Italic entity at byte offset 9");
    await check("🏟 🏟_abac * asd ", "Can't find end of Bold entity at byte offset 15");
    await check("🏟 🏟_abac * asd _", "Can't find end of Italic entity at byte offset 21");
    await check("🏟 🏟`", "Can't find end of Code entity at byte offset 9");
    await check("🏟 🏟```", "Can't find end of Pre entity at byte offset 9");
    await check("🏟 🏟```a", "Can't find end of Pre entity at byte offset 9");
    await check("🏟 🏟```a ", "Can't find end of PreCode entity at byte offset 9");
    await check("🏟 🏟__🏟 🏟_", "Can't find end of Italic entity at byte offset 20");
    await check("🏟 🏟_🏟 🏟__", "Can't find end of Underline entity at byte offset 19");
    await check("🏟 🏟```🏟 🏟`", "Can't find end of Code entity at byte offset 21");
    await check("🏟 🏟```🏟 🏟_", "Can't find end of PreCode entity at byte offset 9");
    await check("🏟 🏟```🏟 🏟\\`", "Can't find end of PreCode entity at byte offset 9");
    await check("[telegram\\.org](asd\\)", "Can't find end of a URL at byte offset 16");
    await check("[telegram\\.org](", "Can't find end of a URL at byte offset 16");
    await check("[telegram\\.org](asd", "Can't find end of a URL at byte offset 16");
    await check("🏟 🏟__🏟 _🏟___", "Can't find end of Italic entity at byte offset 23");
    await check("🏟 🏟__", "Can't find end of Underline entity at byte offset 9");
    await check("🏟 🏟||test\\|", "Can't find end of Spoiler entity at byte offset 9");
    await check("🏟 🏟!", "Character '!' is reserved and must be escaped with the preceding '\\'");
    await check("🏟 🏟![", "Can't find end of CustomEmoji entity at byte offset 9");
    await check("🏟 🏟![👍", "Can't find end of CustomEmoji entity at byte offset 9");
    await check("🏟 🏟![👍]", "Custom emoji entity must contain a tg://emoji URL");
    await check("🏟 🏟![👍](tg://emoji?id=1234", "Can't find end of a custom emoji URL at byte offset 17");
    await check("🏟 🏟![👍](t://emoji?id=1234)", "Custom emoji URL must have scheme tg");
    await check("🏟 🏟![👍](tg:emojis?id=1234)", 'Custom emoji URL must have host "emoji"');
    await check("🏟 🏟![👍](tg://emoji#test)", "Custom emoji URL must have an emoji identifier");
    await check("🏟 🏟![👍](tg://emoji?test=1#&id=25)", "Custom emoji URL must have an emoji identifier");
    await check("🏟 🏟![👍](tg://emoji?test=1231&id=025)", "Invalid custom emoji identifier specified");

    await check("", "", []);
    await check("\\\\", "\\", []);
    await check("\\\\\\", "\\\\", []);
    await check("\\\\\\\\\\_\\*\\`", "\\\\_*`", []);
    await check("➡️ ➡️", "➡️ ➡️", []);
    await check("🏟 🏟``", "🏟 🏟", []);
    await check("🏟 🏟_abac \\* asd _", "🏟 🏟abac * asd ", [new MessageEntity(MessageEntityType.Italic, 5, 11)]);
    await check("🏟 \\.🏟_🏟\\. 🏟_", "🏟 .🏟🏟. 🏟", [new MessageEntity(MessageEntityType.Italic, 6, 6)]);
    await check("\\\\\\a\\b\\c\\d\\e\\f\\1\\2\\3\\4\\➡️\\", "\\abcdef1234\\➡️\\", []);
    await check("➡️ ➡️_➡️ ➡️_", "➡️ ➡️➡️ ➡️", [new MessageEntity(MessageEntityType.Italic, 5, 5)]);
    await check("➡️ ➡️_➡️ ➡️_*➡️ ➡️*", "➡️ ➡️➡️ ➡️➡️ ➡️", [
        new MessageEntity(MessageEntityType.Italic, 5, 5),
        new MessageEntity(MessageEntityType.Bold, 10, 5),
    ]);
    await check("🏟 🏟_🏟 \\.🏟_", "🏟 🏟🏟 .🏟", [new MessageEntity(MessageEntityType.Italic, 5, 6)]);
    await check("🏟 🏟_🏟 *🏟*_", "🏟 🏟🏟 🏟", [
        new MessageEntity(MessageEntityType.Italic, 5, 5),
        new MessageEntity(MessageEntityType.Bold, 8, 2),
    ]);
    await check("🏟 🏟_🏟 __🏟___", "🏟 🏟🏟 🏟", [
        new MessageEntity(MessageEntityType.Italic, 5, 5),
        new MessageEntity(MessageEntityType.Underline, 8, 2),
    ]);
    await check("🏟 🏟__🏟 _🏟_ __", "🏟 🏟🏟 🏟 ", [
        new MessageEntity(MessageEntityType.Underline, 5, 6),
        new MessageEntity(MessageEntityType.Italic, 8, 2),
    ]);
    await check("🏟 🏟__🏟 _🏟_\\___", "🏟 🏟🏟 🏟_", [
        new MessageEntity(MessageEntityType.Underline, 5, 6),
        new MessageEntity(MessageEntityType.Italic, 8, 2),
    ]);
    await check("🏟 🏟`🏟 🏟```", "🏟 🏟🏟 🏟", [new MessageEntity(MessageEntityType.Code, 5, 5)]);
    await check("🏟 🏟```🏟 🏟```", "🏟 🏟 🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 3, encode("🏟"))]);
    await check("🏟 🏟```🏟\n🏟```", "🏟 🏟🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 2, encode("🏟"))]);
    await check("🏟 🏟```🏟\r🏟```", "🏟 🏟🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 2, encode("🏟"))]);
    await check("🏟 🏟```🏟\n\r🏟```", "🏟 🏟🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 2, encode("🏟"))]);
    await check("🏟 🏟```🏟\r\n🏟```", "🏟 🏟🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 2, encode("🏟"))]);
    await check("🏟 🏟```🏟\n\n🏟```", "🏟 🏟\n🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 3, encode("🏟"))]);
    await check("🏟 🏟```🏟\r\r🏟```", "🏟 🏟\r🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 3, encode("🏟"))]);
    await check("🏟 🏟```🏟 \\\\\\`🏟```", "🏟 🏟 \\`🏟", [new MessageEntity(MessageEntityType.PreCode, 5, 5, encode("🏟"))]);
    await check("🏟 🏟**", "🏟 🏟", []);
    await check("||test||", "test", [new MessageEntity(MessageEntityType.Spoiler, 0, 4)]);
    await check("🏟 🏟``", "🏟 🏟", []);
    await check("🏟 🏟``````", "🏟 🏟", []);
    await check("🏟 🏟____", "🏟 🏟", []);
    await check("`_* *_`__*` `*__", "_* *_ ", [
        new MessageEntity(MessageEntityType.Code, 0, 5),
        new MessageEntity(MessageEntityType.Code, 5, 1),
        new MessageEntity(MessageEntityType.Bold, 5, 1),
        new MessageEntity(MessageEntityType.Underline, 5, 1),
    ]);
    await check("_* * ` `_", "   ", [
        new MessageEntity(MessageEntityType.Italic, 0, 3),
        new MessageEntity(MessageEntityType.Bold, 0, 1),
        new MessageEntity(MessageEntityType.Code, 2, 1),
    ]);
    await check("[](telegram.org)", "", []);
    await check("[ ](telegram.org)", " ", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 1, encode("http://telegram.org/")),
    ]);
    await check("[ ](as)", " ", []);
    await check("[telegram\\.org]", "telegram.org", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("http://telegram.org/")),
    ]);
    await check("[telegram\\.org]a", "telegram.orga", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("http://telegram.org/")),
    ]);
    await check("[telegram\\.org](telegram.dog)", "telegram.org", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("http://telegram.dog/")),
    ]);
    await check("[telegram\\.org](https://telegram.dog?)", "telegram.org", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("https://telegram.dog/?")),
    ]);
    await check("[telegram\\.org](https://telegram.dog?\\\\\\()", "telegram.org", [
        new MessageEntity(MessageEntityType.TextUrl, 0, 12, encode("https://telegram.dog/?\\(")),
    ]);
    await check("[telegram\\.org]()", "telegram.org", []);
    await check("[telegram\\.org](asdasd)", "telegram.org", []);
    await check("[telegram\\.org](tg:user?id=123456)", "telegram.org", [
        new MessageEntity(MessageEntityType.MentionName, 0, 12, new UserId(123456n)),
    ]);
    await check("🏟 🏟![👍](TG://EMoJI/?test=1231&id=25#id=32)a", "🏟 🏟👍a", [
        new MessageEntity(MessageEntityType.CustomEmoji, 5, 2, new CustomEmojiId(25n)),
    ]);
});
