import {report} from '@esbx/util'
import {getManifest} from '@esbx/workspaces'
import {execSync} from 'child_process'
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

export const TagRelease = {
  command: 'tag <semver>',
  action(semver) {
    execSync(`git tag -a v${semver} -m "v${semver}"`)
    execSync(`git push --follow-tags`)
  }
}
