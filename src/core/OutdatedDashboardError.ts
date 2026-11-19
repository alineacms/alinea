import {ErrorCode, HttpError} from './HttpError.js'

/**
 * The dashboard was built with another config than the handler it talks to,
 * as after a deploy. Its changes are refused: they were made with fields
 * that may no longer match.
 */
export class OutdatedDashboardError extends HttpError {
  name = 'OutdatedDashboardError'
  constructor() {
    super(
      ErrorCode.Conflict,
      'A new version of the dashboard is available. Reload it to save changes.'
    )
  }
}

/**
 * Whether an error is an `OutdatedDashboardError`, also once it crossed from
 * the dashboard worker, which keeps only its name and message.
 */
export function isOutdatedDashboardError(error: unknown): boolean {
  return (
    error instanceof OutdatedDashboardError ||
    (error instanceof Error && error.name === 'OutdatedDashboardError')
  )
}
