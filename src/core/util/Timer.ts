import prettyMilliseconds from 'pretty-ms'

export function timer(name: string) {
  const startProgress = performance.now()
  process.stdout.write(`> ${name}\r`)
  return (msg?: string) => {
    const duration = performance.now() - startProgress
    process.stdout.write(
      `> ${msg || name} in ${prettyMilliseconds(duration)}\n`
    )
  }
}
