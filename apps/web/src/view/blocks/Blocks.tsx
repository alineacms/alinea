import {Page} from 'alinea/content'
import {fromModule} from 'alinea/ui'
import {ComponentType} from 'react'
import css from './Blocks.module.scss'
import {ColumnsBlock} from './ColumnsBlock'
import {FeaturesBlock} from './FeaturesBlock'
import {ImageBlock} from './ImageBlock'
import {ImagetextBlock} from './ImagetextBlock'
import {TextBlock} from './TextBlock'

const styles = fromModule(css)

export type BlocksViewProps = {
  blocks: Array<
    | Page.TextBlock
    | Page.ColumnsBlock
    | Page.ImagetextBlock
    | Page.ImageBlock
    | Page.FeaturesBlock
  >
  container?: ComponentType
}

export function Blocks({blocks, container}: BlocksViewProps) {
  return (
    <div className={styles.root()}>
      {blocks.map(block => {
        switch (block.type) {
          case 'ColumnsBlock':
            return (
              <ColumnsBlock key={block.id} container={container} {...block} />
            )
          case 'ImageBlock':
            return (
              <ImageBlock key={block.id} container={container} {...block} />
            )
          case 'ImagetextBlock':
            return (
              <ImagetextBlock key={block.id} container={container} {...block} />
            )
          case 'FeaturesBlock':
            return (
              <FeaturesBlock key={block.id} container={container} {...block} />
            )
          case 'TextBlock':
            return <TextBlock key={block.id} container={container} {...block} />
          //case 'TypesBlock':
          //  return <TypesBlock key={block.id} {...block} />
          default:
            return null
        }
      })}
    </div>
  )
}
