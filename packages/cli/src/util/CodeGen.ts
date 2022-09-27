export function code(strings: ReadonlyArray<string>, ...inserts: Array<any>) {
  const res: Array<string> = []
  strings.forEach(function (str, i) {
    res.push(str)
    if (i in inserts) res.push(String(inserts[i]))
  })
  return res.join('').replace(/  /g, '').trim()
}
