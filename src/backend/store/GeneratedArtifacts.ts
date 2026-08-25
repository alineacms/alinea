import {readFile} from 'node:fs/promises'
import path from 'node:path'

export const generatedArtifactsPath = '.alinea/generated'

export function generatedArtifactPath(
  name: string,
  rootDir = process.cwd()
): string {
  return path.join(rootDir, generatedArtifactsPath, name)
}

export async function readGeneratedJson<Value>(name: string): Promise<Value> {
  const location = generatedArtifactPath(name)
  const contents = await readFile(location, 'utf8')
  return JSON.parse(contents) as Value
}
