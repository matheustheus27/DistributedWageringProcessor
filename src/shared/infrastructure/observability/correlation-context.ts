import { AsyncLocalStorage } from "node:async_hooks";

export interface LogContextStore {
  correlationId: string;
  walletId?: string;
  providerId?: string;
  transactionId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<LogContextStore>();

export class CorrelationContext {
  public static getStore(): LogContextStore | undefined {
    return asyncLocalStorage.getStore();
  }

  public static getCorrelationId(): string {
    const store = asyncLocalStorage.getStore();
    return store?.correlationId || "no-correlation-id";
  }

  public static runWithContext<T>(store: LogContextStore, fn: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run(store, fn);
  }

  public static updateContext(partial: Partial<LogContextStore>): void {
    const store = asyncLocalStorage.getStore();
    if (store) {
      Object.assign(store, partial);
    }
  }
}
