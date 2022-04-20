import fs from 'node:fs'
import {JSONOutput} from 'typedoc'

export const parseTypes = {
  command: 'parse-types',
  description: 'Extract typescript types for use in docs',
  async action() {
    const data = JSON.parse(fs.readFileSync('dist/types.json', 'utf-8'))
    const api = data as JSONOutput.ProjectReflection
    for (const child of api.children) {
      console.log(child.sources)
      console.log('===================')
      const location = ['@alinea']
        .concat(child.name.split('/').filter(segment => segment !== 'dist'))
        .join('/')
      console.log(location)
      console.log('===================')
      for (const member of child.children) {
        console.log(`${member.kindString} -- ${member.name}`)
        if (member.children)
          for (const sub of member.children) {
            console.log(` -> ${sub.kindString} -- ${sub.name}`)
          }
      }
    }
  }
}
