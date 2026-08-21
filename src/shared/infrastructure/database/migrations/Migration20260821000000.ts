import { Migration } from "@mikro-orm/migrations";

export class Migration20260821000000 extends Migration {
  async up(): Promise<void> {
    this.addSql(`
      CREATE TABLE IF NOT EXISTS wallets (
        id UUID PRIMARY KEY,
        player_id VARCHAR(255) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
        version INT NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT unique_player_currency UNIQUE (player_id, currency),
        CONSTRAINT check_non_negative_balance CHECK (balance >= 0)
      );

      CREATE TABLE IF NOT EXISTS wager_transactions (
        id UUID PRIMARY KEY,
        provider_id VARCHAR(255) NOT NULL,
        external_transaction_id VARCHAR(255) NOT NULL,
        idempotency_key VARCHAR(255) NOT NULL,
        payload_hash VARCHAR(64) NOT NULL,
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        player_id VARCHAR(255) NOT NULL,
        round_id VARCHAR(255) NOT NULL,
        game_id VARCHAR(255) NOT NULL,
        kind VARCHAR(50) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        reference_external_transaction_id VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL,
        reference_transaction_id UUID NULL REFERENCES wager_transactions(id),
        failure_code VARCHAR(100) NULL,
        created_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ NULL,
        CONSTRAINT unique_provider_ext_tx UNIQUE (provider_id, external_transaction_id),
        CONSTRAINT unique_provider_idempotency_key UNIQUE (provider_id, idempotency_key)
      );

      CREATE INDEX IF NOT EXISTS idx_wager_status ON wager_transactions(status);
      CREATE INDEX IF NOT EXISTS idx_wager_ref_ext_tx ON wager_transactions(provider_id, reference_external_transaction_id);
      CREATE INDEX IF NOT EXISTS idx_pending_reference ON wager_transactions (status, created_at) WHERE status = 'PENDING_REFERENCE';

      CREATE TABLE IF NOT EXISTS wallet_ledger_entries (
        id UUID PRIMARY KEY,
        wallet_id UUID NOT NULL REFERENCES wallets(id),
        transaction_id UUID NOT NULL REFERENCES wager_transactions(id),
        direction VARCHAR(10) NOT NULL,
        amount NUMERIC(18, 2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        balance_before NUMERIC(18, 2) NOT NULL,
        balance_after NUMERIC(18, 2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT check_ledger_balance_after_non_negative CHECK (balance_after >= 0),
        CONSTRAINT check_ledger_arithmetic CHECK (balance_before + (CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) = balance_after)
      );

      CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created ON wallet_ledger_entries(wallet_id, created_at);

      CREATE TABLE IF NOT EXISTS inbox_messages (
        consumer_name VARCHAR(255) NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        payload_hash VARCHAR(64) NOT NULL,
        received_at TIMESTAMPTZ NOT NULL,
        processed_at TIMESTAMPTZ NULL,
        PRIMARY KEY (consumer_name, message_id)
      );

      CREATE TABLE IF NOT EXISTS outbox_messages (
        id UUID PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        event_type VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        occurred_at TIMESTAMPTZ NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ NULL,
        published_at TIMESTAMPTZ NULL
      );

      CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_messages (published_at, next_attempt_at) WHERE published_at IS NULL;
    `);
  }

  async down(): Promise<void> {
    this.addSql(`
      DROP TABLE IF EXISTS outbox_messages CASCADE;
      DROP TABLE IF EXISTS inbox_messages CASCADE;
      DROP TABLE IF EXISTS wallet_ledger_entries CASCADE;
      DROP TABLE IF EXISTS wager_transactions CASCADE;
      DROP TABLE IF EXISTS wallets CASCADE;
    `);
  }
}
