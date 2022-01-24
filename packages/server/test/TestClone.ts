import dotenv from 'dotenv'
//import {fs} from 'memfs'
import fs from 'fs'
import git from 'isomorphic-git'
import http from 'isomorphic-git/http/node/index.js'
import {test} from 'uvu'

dotenv.config()

const onAuth = () => ({username: process.env.GITHUB_TOKEN})

test('it clones', async () => {
  const dir = './bin/repo'
  // await git.init({fs, dir})
  await git.clone({
    fs,
    dir,
    http,
    onAuth,
    url: 'https://github.com/benmerckx/content',
    depth: 1,
    singleBranch: true,
    ref: 'main'
  })
  await fs.promises.writeFile(`${dir}/README.md`, '# Hello World 2')
  await git.add({fs, dir, filepath: 'README.md'})
  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'Mr. Test',
      email: 'mrtest@example.com'
    },
    message: 'Added the readme file'
  })
  console.log(await git.listFiles({fs, dir, ref: 'HEAD'}))
  /*await git.addRemote({
    fs,
    dir,
    remote: 'origin',
    url: 'https://github.com/benmerckx/content'
  })
  await git.branch({fs, dir, ref: 'main'})*/
  /*await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({username: process.env.GITHUB_TOKEN})
  })*/
})

test.run()
