export class Result<T, E = Error> {
  private constructor(
    public readonly isSuccess: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {
    if (isSuccess && _error !== undefined) {
      throw new Error("InvalidOperation: A result cannot be successful and contain an error");
    }
    if (!isSuccess && _error === undefined) {
      throw new Error("InvalidOperation: A failing result must contain an error");
    }
  }

  public get value(): T {
    if (!this.isSuccess) {
      throw new Error(`Can't get the value of an error result: ${JSON.stringify(this._error)}`);
    }
    return this._value as T;
  }

  public get error(): E {
    if (this.isSuccess) {
      throw new Error("Can't get the error of a successful result");
    }
    return this._error as E;
  }

  public static ok<U, E = Error>(value?: U): Result<U, E> {
    return new Result<U, E>(true, value, undefined);
  }

  public static fail<U, E = Error>(error: E): Result<U, E> {
    return new Result<U, E>(false, undefined, error);
  }
}
