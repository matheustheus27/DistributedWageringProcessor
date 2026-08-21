import { InboxMessage } from "@modules/messaging/domain/inbox-message";

export interface IInboxRepository {
  findByMessageId(consumerName: string, messageId: string): Promise<InboxMessage | null>;
  save(message: InboxMessage): Promise<void>;
}

export const IInboxRepository = Symbol("IInboxRepository");
