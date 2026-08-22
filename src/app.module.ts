import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import mikroOrmConfig from "../mikro-orm.config";

import { IWalletRepository } from "@modules/wallet/application/ports/wallet.repository.port";
import { WalletMikroRepository } from "@modules/wallet/infrastructure/persistence/wallet.mikro-orm.repository";
import { ILedgerRepository } from "@modules/wallet/application/ports/ledger.repository.port";
import { LedgerMikroRepository } from "@modules/wallet/infrastructure/persistence/ledger.mikro-orm.repository";
import { IWagerTransactionRepository } from "@modules/wagering/application/ports/wager-transaction.repository.port";
import { WagerTransactionMikroRepository } from "@modules/wagering/infrastructure/persistence/wager-transaction.mikro-orm.repository";
import { IInboxRepository } from "@modules/messaging/application/ports/inbox.repository.port";
import { InboxMikroRepository } from "@modules/messaging/infrastructure/persistence/inbox.mikro-orm.repository";
import { IOutboxRepository } from "@modules/messaging/application/ports/outbox.repository.port";
import { OutboxMikroRepository } from "@modules/messaging/infrastructure/persistence/outbox.mikro-orm.repository";
import { IUnitOfWork } from "@shared/application/unit-of-work.port";
import { DatabaseUnitOfWork } from "@shared/infrastructure/database/database-unit-of-work";

import { OpenWalletUseCase } from "@modules/wallet/application/open-wallet.use-case";
import { GetWalletUseCase } from "@modules/wallet/application/get-wallet.use-case";
import { GetLedgerUseCase } from "@modules/wallet/application/get-ledger.use-case";
import { ReconcileWalletUseCase } from "@modules/wallet/application/reconcile-wallet.use-case";
import { ProcessWagerUseCase } from "@modules/wagering/application/process-wager.use-case";
import { GetWagerTransactionUseCase } from "@modules/wagering/application/get-wager-transaction.use-case";

import { SqsProducerService } from "@modules/messaging/infrastructure/sqs/sqs-producer.service";
import { SqsConsumerService } from "@modules/messaging/infrastructure/sqs/sqs-consumer.service";
import { OutboxPollerWorker } from "@modules/messaging/infrastructure/outbox/outbox-poller.worker";
import { PendingReferenceWorker } from "@modules/wagering/infrastructure/workers/pending-reference.worker";
import { MetricsService } from "@shared/infrastructure/observability/metrics.service";
import { ProviderAuthGuard } from "@shared/infrastructure/guards/provider-auth.guard";
import { AppLoggerService } from "@shared/infrastructure/observability/app-logger.service";
import { CorrelationIdMiddleware } from "@shared/infrastructure/observability/correlation-id.middleware";

import { WalletController } from "@modules/wallet/infrastructure/http/wallet.controller";
import { WageringController } from "@modules/wagering/infrastructure/http/wagering.controller";
import { HealthController } from "@shared/infrastructure/observability/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", ".env.example"],
    }),
    MikroOrmModule.forRoot(mikroOrmConfig),
  ],
  controllers: [WalletController, WageringController, HealthController],
  providers: [
    // Ports & Adapters Binding
    { provide: IWalletRepository, useClass: WalletMikroRepository },
    { provide: ILedgerRepository, useClass: LedgerMikroRepository },
    { provide: IWagerTransactionRepository, useClass: WagerTransactionMikroRepository },
    { provide: IInboxRepository, useClass: InboxMikroRepository },
    { provide: IOutboxRepository, useClass: OutboxMikroRepository },
    { provide: IUnitOfWork, useClass: DatabaseUnitOfWork },

    // Application Use Cases
    OpenWalletUseCase,
    GetWalletUseCase,
    GetLedgerUseCase,
    ReconcileWalletUseCase,
    ProcessWagerUseCase,
    GetWagerTransactionUseCase,

    // Infrastructure Services & Workers
    SqsProducerService,
    SqsConsumerService,
    OutboxPollerWorker,
    PendingReferenceWorker,
    MetricsService,
    ProviderAuthGuard,
    AppLoggerService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*");
  }
}
