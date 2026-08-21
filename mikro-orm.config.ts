import { defineConfig } from "@mikro-orm/postgresql";
import { Migrator } from "@mikro-orm/migrations";
import { WalletMikroEntity } from "./src/modules/wallet/infrastructure/persistence/wallet.mikro-orm.entity";
import { LedgerEntryMikroEntity } from "./src/modules/wallet/infrastructure/persistence/ledger-entry.mikro-orm.entity";
import { WagerTransactionMikroEntity } from "./src/modules/wagering/infrastructure/persistence/wager-transaction.mikro-orm.entity";
import { InboxMessageMikroEntity } from "./src/modules/messaging/infrastructure/persistence/inbox.mikro-orm.entity";
import { OutboxMessageMikroEntity } from "./src/modules/messaging/infrastructure/persistence/outbox.mikro-orm.entity";

export default defineConfig({
  entities: [
    WalletMikroEntity,
    LedgerEntryMikroEntity,
    WagerTransactionMikroEntity,
    InboxMessageMikroEntity,
    OutboxMessageMikroEntity,
  ],
  dbName: process.env.DB_NAME || "wagering_db",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || "wagering_user",
  password: process.env.DB_PASSWORD || "wagering_password",
  extensions: [Migrator],
  migrations: {
    path: "./src/shared/infrastructure/database/migrations",
    pathTs: "./src/shared/infrastructure/database/migrations",
    transactional: true,
  },
  debug: false,
});
