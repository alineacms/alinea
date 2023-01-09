export function code(): Code
export function code(input: string): Code
export function code(input: ReadonlyArray<string>, ...inserts: Array<any>): Code
export function code(
  input?: string | ReadonlyArray<string>,
  ...inserts: Array<any>
): Code {
  if (!input) return new Code([], [])
  if (typeof input === 'string') return new Code([input], [])
  if (input instanceof Code) return input
  return new Code(input, inserts)
}

export class Code {
  constructor(
    public strings: ReadonlyArray<string>,
    public inserts: Array<string | number | Code>
  ) {}

  valueOf() {
    return this.toString()
  }

  push(...strings: Array<string | Code>) {
    const inner = [this.toString(), ...strings.map(_ => _.toString())].join(
      '\n'
    )
    this.strings = [inner]
    this.inserts = []
  }

  toString() {
    let full = ''
    for (const [index, string] of this.strings.entries()) {
      full += string
      if (index in this.inserts) {
        const insert = String(this.inserts[index])
        if (!insert.includes('\n')) {
          full += insert
          continue
        }
        let lineIndent = 0
        for (let i = full.length - 1; i >= 0; i--) {
          const char = full[i]
          if (char === ' ') lineIndent++
          else if (char === '\n') break
          else lineIndent = 0
        }
        full += lineIndent > 0 ? indent(insert, lineIndent, true) : insert
      }
    }
    let baseIndent = 0
    for (const char of full) {
      if (char === '\n') baseIndent = 0
      else if (char === ' ') baseIndent++
      else break
    }
    if (baseIndent === 0) return full.trim()
    return indent(full, -baseIndent)
  }
}

function indent(input: string, amount: number, skipStart = false) {
  const lines = input.split('\n')
  return lines
    .map((line, index) => {
      if (skipStart && index === 0) return line
      if (amount >= 0) return ' '.repeat(amount) + line
      return line.slice(-amount)
    })
    .join('\n')
    .trim()
}
