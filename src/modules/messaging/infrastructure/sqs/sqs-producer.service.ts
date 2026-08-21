import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

@Injectable()
export class SqsProducerService {
  private readonly logger = new Logger(SqsProducerService.name);
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor(private readonly configService: ConfigService) {
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

  public async publishEvent(
    aggregateId: string,
    eventId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const command = new SendMessageCommand({
        QueueUrl: this.queueUrl,
        MessageBody: JSON.stringify(payload),
        MessageGroupId: aggregateId,
        MessageDeduplicationId: eventId,
      });

      await this.sqsClient.send(command);
      this.logger.debug({
        msg: "Event published to SQS FIFO queue",
        eventId,
        aggregateId,
        queueUrl: this.queueUrl,
      });
    } catch (err: any) {
      this.logger.error({
        msg: "Failed to publish event to SQS",
        eventId,
        aggregateId,
        error: err.message,
      });
      throw err;
    }
  }
}
