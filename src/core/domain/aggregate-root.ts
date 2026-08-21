export abstract class AggregateRoot<T> {
  protected readonly props: T;
  public readonly id: string;

  protected constructor(props: T, id: string) {
    this.props = props;
    this.id = id;
  }

  public equals(object?: AggregateRoot<T>): boolean {
    if (object === null || object === undefined) {
      return false;
    }
    if (this === object) {
      return true;
    }
    return this.id === object.id;
  }
}
