import {
  SQSClient,
  ReceiveMessageCommand,
  SendMessageCommand,
  DeleteMessageCommand,
  PurgeQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";

const endpoint = process.env.SQS_ENDPOINT || "http://localhost:4566";
const region = process.env.AWS_REGION || "us-east-1";
const mainQueueUrl =
  process.env.SQS_QUEUE_URL ||
  "http://localhost:4566/000000000000/wager-transactions.fifo";
const dlqUrl =
  process.env.SQS_DLQ_URL ||
  "http://localhost:4566/000000000000/wager-transactions-dlq.fifo";

const sqsClient = new SQSClient({
  region,
  endpoint,
  credentials: { accessKeyId: "mock", secretAccessKey: "mock" },
});

async function inspectDlq(): Promise<void> {
  console.log("🔍 Checking SQS Dead Letter Queue (DLQ) status...");
  try {
    const attrRes = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: dlqUrl,
        AttributeNames: ["ApproximateNumberOfMessages"],
      }),
    );

    const messageCount = attrRes.Attributes?.ApproximateNumberOfMessages || "0";
    console.log(`📊 DLQ Message Count: ${messageCount}`);

    if (parseInt(messageCount, 10) === 0) {
      console.log("✅ DLQ is empty. No dead messages found.");
      return;
    }

    const receiveRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: dlqUrl,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 10,
        AttributeNames: ["All"],
      }),
    );

    if (receiveRes.Messages) {
      console.log(`\nFound ${receiveRes.Messages.length} message(s) in DLQ:`);
      receiveRes.Messages.forEach((msg, idx) => {
        console.log(`-------------------------------------------------`);
        console.log(`[${idx + 1}] MessageId: ${msg.MessageId}`);
        console.log(`Body: ${msg.Body}`);
      });
    }
  } catch (err: any) {
    console.error(`❌ Error inspecting DLQ: ${err.message}`);
  }
}

async function replayDlq(): Promise<void> {
  console.log("🔄 Replaying DLQ messages back to main queue...");
  try {
    const receiveRes = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: dlqUrl,
        MaxNumberOfMessages: 10,
        VisibilityTimeout: 30,
        AttributeNames: ["All"],
      }),
    );

    if (!receiveRes.Messages || receiveRes.Messages.length === 0) {
      console.log("✅ No DLQ messages to replay.");
      return;
    }

    let replayedCount = 0;
    for (const msg of receiveRes.Messages) {
      const body = JSON.parse(msg.Body || "{}");
      const aggregateId = body.data?.walletId || body.aggregateId || "default-group";
      const eventId = body.eventId || msg.MessageId || crypto.randomUUID();

      // Send to main FIFO queue
      await sqsClient.send(
        new SendMessageCommand({
          QueueUrl: mainQueueUrl,
          MessageBody: msg.Body,
          MessageGroupId: aggregateId,
          MessageDeduplicationId: `replay-${eventId}`,
        }),
      );

      // Delete from DLQ
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: dlqUrl,
          ReceiptHandle: msg.ReceiptHandle,
        }),
      );

      replayedCount++;
      console.log(`✅ Replayed message '${msg.MessageId}' to main queue.`);
    }

    console.log(`\n🎉 Successfully replayed ${replayedCount} DLQ message(s)!`);
  } catch (err: any) {
    console.error(`❌ Error replaying DLQ messages: ${err.message}`);
  }
}

async function purgeDlq(): Promise<void> {
  console.log("⚠️ Purging DLQ queue...");
  try {
    await sqsClient.send(new PurgeQueueCommand({ QueueUrl: dlqUrl }));
    console.log("🧹 DLQ queue purged successfully!");
  } catch (err: any) {
    console.error(`❌ Error purging DLQ: ${err.message}`);
  }
}

async function main() {
  const command = process.argv[2] || "inspect";
  switch (command) {
    case "inspect":
      await inspectDlq();
      break;
    case "replay":
      await replayDlq();
      break;
    case "purge":
      await purgeDlq();
      break;
    default:
      console.log("Usage: bun scripts/dlq-management.ts [inspect|replay|purge]");
  }
}

void main();
