import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  CreateQueueCommand,
} from "@aws-sdk/client-sqs";
import { ProcessWagerUseCase } from "@modules/wagering/application/process-wager.use-case";
import { CorrelationContext } from "@shared/infrastructure/observability/correlation-context";

@Injectable()
export class SqsConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SqsConsumerService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;
  private isRunning = false;
  private isShuttingDown = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly processWagerUseCase: ProcessWagerUseCase,
  ) {
    const endpoint = this.configService.get<string>("SQS_ENDPOINT") || "http://localhost:4566";
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";
    this.queueUrl =
      this.configService.get<string>("SQS_QUEUE_URL") ||
      "http://localhost:4566/000000000000/wager-transactions.fifo";

    this.sqsClient = new SQSClient({
      region,
      endpoint,
      credentials: {
        accessKeyId: "mock_key",
        secretAccessKey: "mock_secret",
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureQueuesExist();
    this.isRunning = true;
    void this.pollLoop();
  }

  onModuleDestroy(): void {
    this.isShuttingDown = true;
    this.isRunning = false;
  }

  private async ensureQueuesExist(): Promise<void> {
    try {
      // Auto-provision DLQ queue if missing
      await this.sqsClient.send(
        new CreateQueueCommand({
          QueueName: "wager-transactions-dlq.fifo",
          Attributes: { FifoQueue: "true", ContentBasedDeduplication: "true" },
        }),
      );

      // Auto-provision main FIFO queue if missing
      await this.sqsClient.send(
        new CreateQueueCommand({
          QueueName: "wager-transactions.fifo",
          Attributes: {
            FifoQueue: "true",
            ContentBasedDeduplication: "true",
            RedrivePolicy: JSON.stringify({
              deadLetterTargetArn:
                "arn:aws:sqs:us-east-1:000000000000:wager-transactions-dlq.fifo",
              maxReceiveCount: "5",
            }),
          },
        }),
      );
      this.logger.log("AWS SQS FIFO queues verified/provisioned successfully");
    } catch (err: any) {
      this.logger.warn({
        msg: "SQS queue auto-provisioning skipped or queue already exists",
        error: err.message,
      });
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning && !this.isShuttingDown) {
      try {
        const receiveCmd = new ReceiveMessageCommand({
          QueueUrl: this.queueUrl,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 5,
          AttributeNames: ["All"],
        });

        const response = await this.sqsClient.send(receiveCmd);
        if (response.Messages && response.Messages.length > 0) {
          for (const msg of response.Messages) {
            if (this.isShuttingDown) break;
            await this.handleMessage(msg);
          }
        }
      } catch (err: any) {
        if (!this.isShuttingDown) {
          this.logger.error({ msg: "Error polling SQS queue", error: err.message });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  private async handleMessage(msg: any): Promise<void> {
    const messageId = msg.MessageId;
    const receiptHandle = msg.ReceiptHandle;
    const body = JSON.parse(msg.Body || "{}");
    const data = body.data || body;

    const correlationId = body.correlationId || data.idempotencyKey || `sqs-${messageId}`;

    await CorrelationContext.runWithContext(
      {
        correlationId,
        providerId: data.providerId,
        walletId: data.walletId,
      },
      async () => {
        try {
          const result = await this.processWagerUseCase.execute({
            providerId: data.providerId,
            externalTransactionId: data.externalTransactionId,
            idempotencyKey: data.idempotencyKey,
            playerId: data.playerId,
            walletId: data.walletId,
            roundId: data.roundId,
            gameId: data.gameId,
            kind: data.kind,
            money: data.money,
            referenceExternalTransactionId: data.referenceExternalTransactionId,
            messageId,
            consumerName: "wager-sqs-consumer",
          });

          if (result.isSuccess) {
            await this.ackMessage(receiptHandle);
            this.logger.log({
              msg: "SQS message processed and ACKed",
              messageId,
              transactionId: result.value.transactionId,
              status: result.value.status,
            });
          } else {
            this.logger.error({
              msg: "Business failure processing SQS message, ACKed to prevent loop",
              messageId,
              error: result.error.message,
            });
            await this.ackMessage(receiptHandle);
          }
        } catch (err: any) {
          this.logger.error({
            msg: "Transient error processing SQS message, message left for redelivery",
            messageId,
            error: err.message,
          });
        }
      },
    );
  }

  private async ackMessage(receiptHandle: string): Promise<void> {
    await this.sqsClient.send(
      new DeleteMessageCommand({
        QueueUrl: this.queueUrl,
        ReceiptHandle: receiptHandle,
      }),
    );
  }
}
