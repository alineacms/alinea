import {report} from '@esbx/util'
import {getManifest} from '@esbx/workspaces'
import {execSync} from 'child_process'
import fs from 'fs-extra'

export const VersionTask = {
  command: 'version <semver>',
  action(semver) {
    const root = getManifest('.')
    root.version = semver
    // Remove the workspaces property because it is only used internally
    delete root.workspaces
    fs.writeFileSync('package.json', JSON.stringify(root, null, 2) + '\n')
    report(`bumped version to ${semver}`, false)
  }
}

export const TagRelease = {
  command: 'tag <semver>',
  action(semver) {
    const version = semver.startsWith('v') ? semver : `v${semver}`
    execSync(`git tag -a ${version} -m "${version}"`)
    execSync(`git push --follow-tags`)
  }
}
