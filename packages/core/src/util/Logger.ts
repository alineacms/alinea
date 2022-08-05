type Run<T> = (logger: Logger) => T
interface Log {
  args: Array<any>
  time: number
}
export interface Report {
  name: string
  duration: number
  logs: Array<Log | Report>
}

export namespace Report {
  export function toConsole(report: Report, prefix = '') {
    console.groupCollapsed(report.name, report.duration, 'ms')
    for (const log of report.logs) {
      if ('name' in log) toConsole(log, '└ ')
      else console.log(prefix, ...log.args)
    }
    console.groupEnd()
  }

  export function toServerTiming(report: Report, index = 0) {
    const res = [`t${index};desc="${report.name}";dur=${report.duration}`]
    for (const log of report.logs) {
      if ('name' in log) res.push(toServerTiming(log, ++index))
    }
    return res.join(',')
  }
}

export interface LoggerResult<T> {
  result: T
  logger: Logger
}

export class Logger {
  logs: Array<Log | Report> = []
  started = Date.now()
  operations: Array<Logger> = []

  constructor(public name: string) {}

  operation<T>(name: string, run: Run<T>) {
    const op = new Logger(name)
    const result = run(op)
    const report = () => {
      this.logs.push(op.report())
    }
    if (result instanceof Promise) return result.finally(report)
    report()
    return result
  }

  log(...args: Array<any>) {
    this.logs.push({args, time: Date.now()})
  }

  result<T>(result: Promise<T>): Promise<LoggerResult<T>> {
    return result.then(result => ({result, logger: this}))
  }

  report() {
    const current = Date.now()
    const duration = current - this.started
    return {
      name: this.name,
      duration,
      logs: this.logs
    }
  }
}
