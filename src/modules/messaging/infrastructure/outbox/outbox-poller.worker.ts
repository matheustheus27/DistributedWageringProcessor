import { Inject, Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { IOutboxRepository } from "@modules/messaging/application/ports/outbox.repository.port";
import { SqsProducerService } from "../sqs/sqs-producer.service";

@Injectable()
export class OutboxPollerWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPollerWorker.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    @Inject(IOutboxRepository)
    private readonly outboxRepo: IOutboxRepository,
    private readonly sqsProducer: SqsProducerService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.pollOutbox(), 1000);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  public async pollOutbox(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingMessages = await this.outboxRepo.findPending(20);
      for (const msg of pendingMessages) {
        try {
          await this.sqsProducer.publishEvent(msg.aggregateId, msg.id, msg.payload);
          await this.outboxRepo.markPublished(msg.id, new Date());
          this.logger.log({
            msg: "Outbox message published",
            outboxId: msg.id,
            eventType: msg.eventType,
            aggregateId: msg.aggregateId,
          });
        } catch (err: any) {
          msg.scheduleRetry();
          await this.outboxRepo.scheduleRetry(msg.id, msg.attempts, msg.nextAttemptAt!);
          this.logger.warn({
            msg: "Failed to publish outbox message, scheduled retry",
            outboxId: msg.id,
            attempts: msg.attempts,
            nextAttemptAt: msg.nextAttemptAt,
            error: err.message,
          });
        }
      }
    } catch (err: any) {
      this.logger.error({ msg: "Error polling outbox table", error: err.message });
    } finally {
      this.isProcessing = false;
    }
  }
}
