import {promises as fs} from 'fs'
import path from 'path'

async function copyIfContentsDifferent(source: string, destination: string) {
  try {
    const [a, b] = await Promise.all([
      fs.readFile(source),
      fs.readFile(destination)
    ])
    if (a.equals(b)) return
    return fs.writeFile(destination, a)
  } catch (e) {
    return fs.copyFile(source, destination)
  }
}

// Source: https://stackoverflow.com/a/52562541
export async function copyDir(src, dest): Promise<void> {
  const entries = await fs.readdir(src, {withFileTypes: true})
  const tasks: Array<Promise<any>> = []
  await fs.mkdir(dest, {recursive: true})
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      tasks.push(copyDir(srcPath, destPath))
    } else {
      tasks.push(copyIfContentsDifferent(srcPath, destPath))
    }
  }
  return Promise.all(tasks) as Promise<any>
}
