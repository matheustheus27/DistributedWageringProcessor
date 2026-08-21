#!/bin/sh
echo "Initializing SQS FIFO Queues in LocalStack..."

awslocal sqs create-queue \
  --queue-name wager-transactions-dlq.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true

awslocal sqs create-queue \
  --queue-name wager-transactions.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true,RedrivePolicy="{\"deadLetterTargetArn\":\"arn:aws:sqs:us-east-1:000000000000:wager-transactions-dlq.fifo\",\"maxReceiveCount\":\"5\"}"

echo "SQS FIFO Queues initialized successfully!"
