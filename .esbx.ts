import {report} from '@esbx/util'
import {getManifest} from '@esbx/workspaces'
import fs from 'fs-extra'

export const VersionTask = {
  command: 'version <semver>',
  action(semver) {
    const root = getManifest('.')
    root.version = semver
    fs.writeFileSync('package.json', JSON.stringify(root, null, 2) + '\n')
    report(`bumped version to ${semver}`, false)
  }
}
