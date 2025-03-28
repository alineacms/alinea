const isBrowser = typeof window !== 'undefined'

export function reportWarning(...messages: Array<string>) {
  const message = formatMessages(messages, 'warning')
  console[isBrowser ? 'warn' : 'log'](message)
}

export function reportFatal(...messages: Array<string>) {
  const message = formatMessages(messages, 'error', red)
  console[isBrowser ? 'error' : 'log'](message)
}

export function reportError(message: string, error?: Error) {
  const messages = Array<string>(message)
  if (error) {
    const stack = error.stack?.split('\n').slice(1)
    if (stack) messages.push(...stack.map(line => line.trim()))
  }
  return reportFatal(...messages)
}

function formatMessages(messages: Array<string>, type: string, color = yellow) {
  return messages.reduce(
    (res, line, index) => {
      const isLast = index === messages.length - 1
      const isMain = index === 0
      const connector = gray(isLast ? '╰' : isMain ? '│' : '├')
      res += '\n'
      res += `  ${connector} ${isMain ? bold(line) : gray(line)}`
      if (isLast) res += '\n'
      return res
    },
    `  ${bold(color('ɑ'))} ${color(type)}`
  )
}

const ansiSupported =
  typeof process !== 'undefined' &&
  (process.stdout?.isTTY || process.env?.FORCE_COLOR)
const ansi =
  (start: string | number, end: string | number = 39) =>
  (input: string) =>
    ansiSupported ? `\x1b[${start}m${input}\x1b[${end}m` : input

export const red = ansi(31)
export const gray = ansi(90)
export const cyan = ansi(36)
export const yellow = ansi(33)
export const bold = ansi(1, 0)
export const redBg = ansi(41, 49)
