import {Infer} from 'alinea'
import {ImageBlock} from '../schema/blocks/ImageBlock.js'

export function ImageBlockView(props: Infer<typeof ImageBlock>) {
  return <div>{JSON.stringify(props, null, 2)}</div>
}
