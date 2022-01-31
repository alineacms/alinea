import {Entry} from '@alinea/core/Entry'
import yaml from 'js-yaml'
import {Loader} from '../Loader'

export const YamlLoader: Loader = {
  extension: '.yml',
  parse(input: Buffer) {
    return yaml.load(input.toString()) as Entry.Raw
  },
  format(entry: Entry.Raw) {
    return Buffer.from(yaml.dump(entry, {indent: 2, skipInvalid: true}))
  }
}
