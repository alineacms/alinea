export function reportHalt(message: string) {
  process.stdout.write(`\x1b[95;1m${message}\x1b[39;0m\n`)
}
