import { Injectable, LoggerService } from "@nestjs/common";
import pino from "pino";
import { CorrelationContext } from "./correlation-context";

@Injectable()
export class AppLoggerService implements LoggerService {
  private readonly logger = pino({
    level: process.env.LOG_LEVEL || "info",
    base: { pid: process.pid, env: process.env.NODE_ENV || "development" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  log(message: any, context?: string): void {
    this.enrichAndLog("info", message, context);
  }

  error(message: any, trace?: string, context?: string): void {
    this.enrichAndLog("error", message, context, trace);
  }

  warn(message: any, context?: string): void {
    this.enrichAndLog("warn", message, context);
  }

  debug(message: any, context?: string): void {
    this.enrichAndLog("debug", message, context);
  }

  verbose(message: any, context?: string): void {
    this.enrichAndLog("trace", message, context);
  }

  private enrichAndLog(level: pino.Level, message: any, context?: string, trace?: string): void {
    const store = CorrelationContext.getStore();
    const payload = typeof message === "object" ? message : { msg: message };

    const enriched = {
      ...payload,
      context: context || "App",
      correlationId: store?.correlationId || "no-correlation-id",
      walletId: store?.walletId,
      providerId: store?.providerId,
      transactionId: store?.transactionId,
      stack: trace,
    };

    this.logger[level](enriched);
  }
}
