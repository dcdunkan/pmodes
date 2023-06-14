import { CustomEmojiId } from "./custom_emoji_id.ts";
import type { UserId } from "./user_id.ts";

export declare namespace MessageEntity {
  interface AbstractMessageEntity {
    type: string;
    offset: number;
    length: number;
  }
  export interface CommonMessageEntity extends AbstractMessageEntity {
    type:
      | "mention"
      | "hashtag"
      | "cashtag"
      | "bot_command"
      | "url"
      | "email"
      | "phone_number"
      | "bold"
      | "italic"
      | "underline"
      | "strikethrough"
      | "spoiler"
      | "code"
      // non bot API
      | "pre"
      | "block_quote"
      | "bank_card_number";
  }
  export interface PreMessageEntity extends AbstractMessageEntity {
    type: "pre_code";
    language: string;
  }
  export interface TextLinkMessageEntity extends AbstractMessageEntity {
    type: "text_link";
    url: string;
  }
  export interface TextMentionMessageEntity extends AbstractMessageEntity {
    type: "text_mention";
    user_id: UserId;
  }
  export interface CustomEmojiMessageEntity extends AbstractMessageEntity {
    type: "custom_emoji";
    custom_emoji_id: CustomEmojiId;
  }
  // non Bot API
  export interface MediaTimestampMessageEntity extends AbstractMessageEntity {
    type: "media_timestamp";
    timestamp: number;
  }
}

export type MessageEntity =
  | MessageEntity.CommonMessageEntity
  | MessageEntity.CustomEmojiMessageEntity
  | MessageEntity.PreMessageEntity
  | MessageEntity.TextLinkMessageEntity
  | MessageEntity.TextMentionMessageEntity
  | MessageEntity.MediaTimestampMessageEntity;

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
  Blockquote,
  BankCardNumber,
  MediaTimestamp,
  Spoiler,
  CustomEmoji,
  Size,
}
