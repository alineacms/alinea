import {useField} from '@alinea/editor'
import {link} from './view'

export function Example() {
  const [Input] = useField(link('Example link', {}))
  return <Input />
}
