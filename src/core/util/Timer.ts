import prettyMilliseconds from 'pretty-ms'

const out = globalThis.process
  ? process.stdout.write.bind(process.stdout)
  : console.log.bind(console)

export function timer(name: string) {
  const startProgress = performance.now()
  out(`> ${name}\r`)
  return (msg?: string) => {
    const duration = performance.now() - startProgress
    out(`> ${msg || name} in ${prettyMilliseconds(duration)}\n`)
  }
}
