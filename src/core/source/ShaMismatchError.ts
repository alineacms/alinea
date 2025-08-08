import {HttpError} from '../HttpError.js'

export class ShaMismatchError extends HttpError {
  constructor(
    public actual: string,
    public expected: string,
    message: string = 'SHA mismatch'
  ) {
    super(409, `${message}: ${actual} <> ${expected}`)
  }
}
