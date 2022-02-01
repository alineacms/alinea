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

export class ErrorWithCode extends Error {
  public code: ErrorCode
  constructor(code: number)
  constructor(code: ErrorCode)
  constructor(message: string)
  constructor(code: number, message: string)
  constructor(code: ErrorCode, message: string)
  constructor(a: any, b?: any) {
    super(typeof b === 'string' ? b : a)
    this.code = typeof a === 'number' ? a : ErrorCode.InternalError
  }

  static NotFound = new ErrorWithCode(ErrorCode.NotFound)
  static Unauthorized = new ErrorWithCode(ErrorCode.Unauthorized)
}

export function isError(error: Error): error is ErrorWithCode {
  return error instanceof ErrorWithCode
}

export function createError(code: number): ErrorWithCode
export function createError(code: ErrorCode): ErrorWithCode
export function createError(message: string): ErrorWithCode
export function createError(code: number, message: string): ErrorWithCode
export function createError(code: ErrorCode, message: string): ErrorWithCode
export function createError(a: any, b?: any) {
  return new ErrorWithCode(a, b)
}
