import {Parser} from 'htmlparser2'
import * as Y from 'yjs'
import {Type} from '../Type'

export class XmlFragmentType implements Type<string> {
  static inst = new XmlFragmentType()
  toY(value: string) {
    const fragment = new Y.XmlFragment()
    if (typeof value !== 'string') return fragment
    let parents: Array<Y.XmlFragment> = [fragment]
    const parser = new Parser({
      onopentag(name, attributes) {
        const node = new Y.XmlElement(name)
        for (const key of Object.keys(attributes))
          node.setAttribute(key, attributes[key])
        const parent = parents[parents.length - 1]
        parent.insert(parent.length, [node])
        parents.push(node)
      },
      ontext(text) {
        const parent = parents[parents.length - 1]
        parent.insert(parent.length, [new Y.XmlText(text)])
      },
      onclosetag() {
        parents.pop()
      }
    })
    parser.write(value)
    parser.end()
    return fragment
  }
  fromY(value: Y.XmlFragment) {
    return value.toString()
  }
  watch(parent: Y.Map<any>, key: string) {
    return (fun: () => void) => {
      function w(event: Y.YMapEvent<any>) {
        if (event.keysChanged.has(key)) fun()
      }
      parent.observe(w)
      return () => parent.unobserve(w)
    }
  }
  mutator(parent: Y.Map<any>, key: string) {
    return parent.get(key)
  }
}
