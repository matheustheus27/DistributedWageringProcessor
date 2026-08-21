import { Controller, Get, Res, HttpStatus } from "@nestjs/common";
import { Response } from "express";
import { EntityManager } from "@mikro-orm/postgresql";
import { ConfigService } from "@nestjs/config";
import { SQSClient, ListQueuesCommand } from "@aws-sdk/client-sqs";
import { MetricsService } from "./metrics.service";

@Controller()
export class HealthController {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly em: EntityManager,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    const endpoint = this.configService.get<string>("SQS_ENDPOINT") || "http://localhost:4566";
    const region = this.configService.get<string>("AWS_REGION") || "us-east-1";

    this.sqsClient = new SQSClient({
      region,
      endpoint,
      credentials: { accessKeyId: "mock", secretAccessKey: "mock" },
    });
  }

  @Get("health/live")
  public getLiveness(@Res() res: Response): void {
    res.status(HttpStatus.OK).json({ status: "UP", timestamp: new Date().toISOString() });
  }

  @Get("health/ready")
  public async getReadiness(@Res() res: Response): Promise<void> {
    let dbHealthy = false;
    let sqsHealthy = false;

    try {
      await this.em.getKnex().raw("SELECT 1");
      dbHealthy = true;
    } catch {
      dbHealthy = false;
    }

    try {
      await this.sqsClient.send(new ListQueuesCommand({}));
      sqsHealthy = true;
    } catch {
      sqsHealthy = false;
    }

    const isHealthy = dbHealthy && sqsHealthy;
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(statusCode).json({
      status: isHealthy ? "UP" : "DOWN",
      components: {
        postgresql: dbHealthy ? "UP" : "DOWN",
        sqs: sqsHealthy ? "UP" : "DOWN",
      },
      timestamp: new Date().toISOString(),
    });
  }

  @Get("metrics")
  public async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.setHeader("Content-Type", this.metricsService.registry.contentType);
    res.status(HttpStatus.OK).send(metrics);
  }
}
