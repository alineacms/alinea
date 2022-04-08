import {Entry, Schema} from '@alineacms/core'
import yaml from 'js-yaml'
import {Loader} from '../Loader'

export const YamlLoader: Loader = {
  extension: '.yml',
  parse(schema: Schema, input: Buffer) {
    return yaml.load(input.toString()) as Entry.Raw
  },
  format(schema: Schema, entry: Entry.Raw) {
    return Buffer.from(yaml.dump(entry, {indent: 2, skipInvalid: true}))
  }
}
