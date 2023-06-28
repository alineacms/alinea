import fs from 'node:fs'
import path from 'node:path'

const defaultLocations = [
  'alinea.config',
  'src/alinea.config',
  'cms',
  'src/cms'
]
const testExtensions = ['.js', '.ts', '.tsx', '.jsx']

export function findConfigFile(cwd: string) {
  for (const location of defaultLocations) {
    for (const extension of testExtensions) {
      const testLocation = path.join(cwd, location + extension)
      if (fs.existsSync(testLocation)) {
        return testLocation
      }
    }
  }
}
