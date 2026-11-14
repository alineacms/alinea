/** A save the remote did not take, it stays in the activity to retry */
export class PendingMutationError extends Error {
  name = 'PendingMutationError'
}
