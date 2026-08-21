export interface IUnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}

export const IUnitOfWork = Symbol("IUnitOfWork");
