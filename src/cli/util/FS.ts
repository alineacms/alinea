import fs from 'fs-extra'

export async function copyFileIfContentsDiffer(source: string, target: string) {
  const data = await fs.readFile(source)
  try {
    const current = await fs.readFile(target)
    if (current.equals(data)) return
  } catch (e) {}
  return fs.copyFile(source, target)
}

export async function writeFileIfContentsDiffer(
  destination: string,
  contents: string | Buffer
) {
  const data = Buffer.from(contents)
  try {
    const current = await fs.readFile(destination)
    if (current.equals(data)) return
  } catch (e) {}
  return fs.writeFile(destination, data)
}
