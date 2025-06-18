import {HttpError} from '../HttpError.js'

export class ShaMismatchError extends HttpError {
  constructor(
    public actual: string,
    public expected: string
  ) {
    super(409, `SHA mismatch: ${actual} != ${expected}`)
  }
}
