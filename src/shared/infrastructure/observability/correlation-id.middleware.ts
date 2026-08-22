import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { CorrelationContext } from "./correlation-context";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers["x-correlation-id"] as string) ||
      (req.headers["correlation-id"] as string) ||
      crypto.randomUUID();

    res.setHeader("x-correlation-id", correlationId);

    CorrelationContext.runWithContext(
      {
        correlationId,
        providerId: req.headers["x-provider-id"] as string || req.body?.providerId,
        walletId: req.params?.walletId || req.body?.walletId,
      },
      () => {
        next();
        return Promise.resolve();
      },
    );
  }
}
