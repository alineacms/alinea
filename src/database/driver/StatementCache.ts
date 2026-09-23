interface FinalizableStatement {
  finalize(): void
}

interface StatementClient<Statement extends object> {
  prepare(sql: string): Statement
  close(): void
}

/**
 * Reuse prepared statements by their SQL. Rado prepares every query anew and
 * finalizes it after one use, while generated queries repeat the same SQL
 * with other parameters. Cached statements ignore finalize until evicted.
 */
export function cacheStatements<
  Statement extends object,
  Client extends StatementClient<Statement>
>(client: Client, size = 256): Client {
  const prepare = client.prepare.bind(client)
  const close = client.close.bind(client)
  const statements = new Map<string, Statement>()
  const finalizers = new WeakMap<Statement, () => void>()
  function release(statement: Statement) {
    finalizers.get(statement)?.()
  }
  client.prepare = function (sql: string): Statement {
    const cached = statements.get(sql)
    if (cached) {
      statements.delete(sql)
      statements.set(sql, cached)
      return cached
    }
    const statement = prepare(sql)
    if (isFinalizable(statement)) {
      finalizers.set(statement, statement.finalize.bind(statement))
      statement.finalize = () => {}
    }
    statements.set(sql, statement)
    if (statements.size > size) {
      const [oldest] = statements
      statements.delete(oldest![0])
      release(oldest![1])
    }
    return statement
  }
  client.close = function () {
    for (const statement of statements.values()) release(statement)
    statements.clear()
    close()
  }
  return client
}

function isFinalizable(statement: object): statement is FinalizableStatement {
  return typeof Reflect.get(statement, 'finalize') === 'function'
}
