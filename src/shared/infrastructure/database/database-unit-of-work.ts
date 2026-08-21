import { Injectable } from "@nestjs/common";
import { EntityManager } from "@mikro-orm/postgresql";
import { IUnitOfWork } from "@shared/application/unit-of-work.port";

@Injectable()
export class DatabaseUnitOfWork implements IUnitOfWork {
  constructor(private readonly em: EntityManager) {}

  public async execute<T>(work: () => Promise<T>): Promise<T> {
    return await this.em.transactional(async () => {
      return await work();
    });
  }
}
