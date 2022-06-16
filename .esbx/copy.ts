import {promises as fs} from 'fs'
import path from 'path'

// Source: https://stackoverflow.com/a/52562541
export async function copyDir(src, dest) {
  const entries = await fs.readdir(src, {withFileTypes: true})
  await fs.mkdir(dest, {recursive: true})
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}
