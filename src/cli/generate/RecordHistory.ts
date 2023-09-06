import {timer} from 'alinea/core/util/Timer'
import simpleGit from 'simple-git'

export async function recordHistory(rootDir: string) {
  const endTimer = timer('Git log')
  const git = simpleGit(rootDir)
  const list = await git.log({
    //'--name-status': true
  } as any)
  endTimer()
}
