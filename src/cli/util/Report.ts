export function reportHalt(message: string) {
  process.stdout.write(`${red(bold('Error:'))} ${message}\n`)
}

const ansiSupported = process.stdout.isTTY || process.env.FORCE_COLOR
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
