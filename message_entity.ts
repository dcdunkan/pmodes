import { CustomEmojiId } from "./custom_emoji_id.ts";
import { areTypedArraysEqual } from "./encode.ts";
import { UserId } from "./user_id.ts";
import { UNREACHABLE } from "./utilities.ts";

export function getTypePriority(type: MessageEntityType): number {
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

export enum MessageEntityType {
  Mention,
  Hashtag,
  BotCommand,
  Url,
  EmailAddress,
  Bold,
  Italic,
  Code,
  Pre,
  PreCode,
  TextUrl,
  MentionName,
  Cashtag,
  PhoneNumber,
  Underline,
  Strikethrough,
  BlockQuote,
  BankCardNumber,
  MediaTimestamp,
  Spoiler,
  CustomEmoji,
  Size,
}

export class MessageEntityError extends Error {
  override name = "MessageEntityError";
  constructor(message: string) {
    super(message);
  }
}

export class MessageEntity {
  type: MessageEntityType = MessageEntityType.Size;
  offset = -1;
  length = -1;
  mediaTimestamp = -1;
  argument = new Uint8Array();
  userId = new UserId();
  customEmojiId = new CustomEmojiId();

  constructor(
    type: MessageEntityType,
    offset: number,
    length: number,
    argument?: Uint8Array | UserId | number | CustomEmojiId,
  ) {
    this.type = type;
    this.offset = offset;
    this.length = length;
    if (type === MessageEntityType.Code && argument != null && argument instanceof Uint8Array) {
      this.argument = argument;
    } else if (type === MessageEntityType.TextUrl || type === MessageEntityType.PreCode) {
      if (!(argument instanceof Uint8Array) || argument.length === 0) {
        throw new MessageEntityError(
          `Entity type is ${messageEntityTypeString(type)} but argument is either empty or not Uint8Array`,
        );
      }
      this.argument = argument;
    } else if (type === MessageEntityType.MentionName) {
      if (!(argument instanceof UserId) || !argument.isValid()) {
        throw new MessageEntityError("Entity type is MentionName but argument is either not valid or not UserId");
      }
      this.userId = argument;
    } else if (type === MessageEntityType.MediaTimestamp) {
      if (typeof argument !== "number") {
        throw new MessageEntityError("Entity type is MediaTimestamp but argument isn't a number");
      }
      this.mediaTimestamp = argument;
    } else if (type === MessageEntityType.CustomEmoji) {
      if (!(argument instanceof CustomEmojiId) || !argument.isValid()) {
        throw new MessageEntityError(
          "Entity type is CustomEmoji but argument is either not valid or not CustomEmojiId",
        );
      }
      this.customEmojiId = argument;
    }
  }

  equal(other: MessageEntity) {
    return this.offset === other.offset && this.length === other.length && this.type === other.type &&
      this.mediaTimestamp === other.mediaTimestamp && areTypedArraysEqual(this.argument, other.argument) &&
      this.userId.id === other.userId.id && this.customEmojiId.id === other.customEmojiId.id;
  }

  isBefore(other: MessageEntity) {
    if (this.offset !== other.offset) {
      return this.offset < other.offset;
    }
    if (this.length !== other.length) {
      return this.length < other.length;
    }
    const priority = getTypePriority(this.type);
    const otherPriority = getTypePriority(other.type);
    return priority < otherPriority;
  }
}

export function messageEntityTypeString(messageEntityType: MessageEntityType) {
  switch (messageEntityType) {
    case MessageEntityType.Mention:
      return "Mention";
    case MessageEntityType.Hashtag:
      return "Hashtag";
    case MessageEntityType.BotCommand:
      return "BotCommand";
    case MessageEntityType.Url:
      return "Url";
    case MessageEntityType.EmailAddress:
      return "EmailAddress";
    case MessageEntityType.Bold:
      return "Bold";
    case MessageEntityType.Italic:
      return "Italic";
    case MessageEntityType.Underline:
      return "Underline";
    case MessageEntityType.Strikethrough:
      return "Strikethrough";
    case MessageEntityType.BlockQuote:
      return "BlockQuote";
    case MessageEntityType.Code:
      return "Code";
    case MessageEntityType.Pre:
      return "Pre";
    case MessageEntityType.PreCode:
      return "PreCode";
    case MessageEntityType.TextUrl:
      return "TextUrl";
    case MessageEntityType.MentionName:
      return "MentionName";
    case MessageEntityType.Cashtag:
      return "Cashtag";
    case MessageEntityType.PhoneNumber:
      return "PhoneNumber";
    case MessageEntityType.BankCardNumber:
      return "BankCardNumber";
    case MessageEntityType.MediaTimestamp:
      return "MediaTimestamp";
    case MessageEntityType.Spoiler:
      return "Spoiler";
    case MessageEntityType.CustomEmoji:
      return "CustomEmoji";
    default:
      UNREACHABLE();
  }
}
