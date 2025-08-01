/**
 * @see {@link https://en.wikipedia.org/wiki/List_of_HTTP_status_codes}
 */
export enum ErrorCode {
  BadRequest = 400,
  Unauthorized = 401,
  PaymentRequired = 402,
  Forbidden = 403,
  NotFound = 404,
  MethodNotAllowed = 405,
  Gone = 410,
  NotAcceptable = 406,
  Timeout = 408,
  Conflict = 409,
  PayloadTooLarge = 413,
  UnsupportedMediaType = 415,
  OutOfRange = 416,
  ExpectationFailed = 417,
  I_am_a_Teapot = 418,
  AuthenticationTimeout = 419,
  UnprocessableEntity = 422,
  TooManyRequests = 429,
  InternalError = 500,
  NotImplemented = 501,
  ServiceUnavailable = 503,
  InsufficientStorage = 507,
  BandwidthLimitExceeded = 509
}

export class HttpError extends Error {
  name = 'HttpError'
  public code: ErrorCode
  constructor(
    code: number | ErrorCode,
    message?: string,
    options?: ErrorOptions
  ) {
    super(message ?? code.toString(), options)
    this.code = code
  }
}

export function isHttpError(error: Error): error is HttpError {
  return error instanceof HttpError
}
