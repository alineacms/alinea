/** What GitHub reported left of one of its hourly budgets. */
interface Budget {
  remaining: number
  limit: number
  /** Unix time in seconds at which the budget is restored */
  reset: number
}

/** Below this share of a budget left, spending is logged as a warning. */
const lowBudget = 0.1

/**
 * Counts the GitHub requests a source makes against its REST and GraphQL
 * budgets, and logs what each operation spent and what is left, so the logs
 * show where a rate limit goes. Answers of 304 are free and not counted.
 */
export class GithubUsage {
  rest = 0
  graphql = 0
  #budgets = new Map<string, Budget>()

  record(response: Response): void {
    if (response.status === 304) return
    const resource = response.headers.get('x-ratelimit-resource')
    if (resource === 'graphql') this.graphql += 1
    else this.rest += 1
    const remaining = Number(response.headers.get('x-ratelimit-remaining'))
    const limit = Number(response.headers.get('x-ratelimit-limit'))
    const reset = Number(response.headers.get('x-ratelimit-reset'))
    if (resource && limit > 0 && Number.isFinite(remaining))
      this.#budgets.set(resource, {remaining, limit, reset})
  }

  /** The requests counted so far, to log what an operation adds. */
  count(): {rest: number; graphql: number} {
    return {rest: this.rest, graphql: this.graphql}
  }

  /** Log what `operation` spent since `before`, if anything. */
  log(operation: string, before: {rest: number; graphql: number}): void {
    const rest = this.rest - before.rest
    const graphql = this.graphql - before.graphql
    if (rest === 0 && graphql === 0) return
    const budgets = [...this.#budgets].map(
      ([resource, {remaining, limit}]) =>
        `${resource === 'core' ? 'REST' : resource} ${remaining}/${limit} left`
    )
    const reset = Math.min(
      ...[...this.#budgets.values()].map(budget => budget.reset)
    )
    const resets = Number.isFinite(reset)
      ? `, resets ${new Date(reset * 1000).toISOString().slice(11, 16)} UTC`
      : ''
    const left = budgets.length > 0 ? `; ${budgets.join(', ')}${resets}` : ''
    const message = `Alinea GitHub ${operation}: ${rest} REST, ${graphql} GraphQL requests${left}`
    const low = [...this.#budgets.values()].some(
      budget => budget.remaining < budget.limit * lowBudget
    )
    if (low) console.warn(message)
    else console.info(message)
  }
}
