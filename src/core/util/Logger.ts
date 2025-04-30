import prettyMilliseconds from 'pretty-ms'

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

const consoleLog = console.log.bind(console)
const output =
  (typeof process !== 'undefined' &&
    process.stdout?.write.bind(process.stdout)) ||
  consoleLog
const isConsole = output === consoleLog

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export namespace Report {
  export function toConsole(report: Report, prefix = '') {
    if (prefix && !isConsole) output(prefix)
    console.info(`${report.name} in ${prettyMilliseconds(report.duration)}`)
    for (const log of report.logs) {
      if ('name' in log) toConsole(log, `${' '.repeat(prefix.length)}└ `)
      else {
        if (prefix && !isConsole) output(prefix)
        console.info(...log.args)
      }
    }
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

function durationSince(time: number) {
  return now() - time
}

export class Logger {
  logs: Array<Log | Report> = []
  started = now()
  operations: Array<Logger> = []
  startProgress: number | undefined = undefined

  constructor(public name: string) {}

  time(name: string, justTime = false) {
    const op = new Logger(name)
    if (!justTime) this.progress(name)
    return () => {
      this.logs.push(op.report())
    }
  }

  log(...args: Array<any>) {
    this.logs.push({args, time: now()})
  }

  progress(message: string) {
    if (!this.startProgress) {
      this.startProgress = now()
    }
    output(`> ${message}          \r`)
  }

  summary(message: string) {
    if (this.startProgress) {
      const duration = durationSince(this.startProgress)
      output(`> ${message} in ${prettyMilliseconds(duration)}\n`)
      this.startProgress = undefined
      // Report.toConsole(this.report(), '└ ')
    } else {
      console.info(`> ${message}`)
    }
  }

  result<T>(result: Promise<T>): Promise<LoggerResult<T>> {
    return result.then(result => ({result, logger: this}))
  }

  report() {
    const current = now()
    const duration = current - this.started
    return {
      name: this.name,
      duration,
      logs: this.logs
    }
  }
}
