import {styler} from '@alinea/styler'
import type {ReactNode} from 'react'
import {BlockSheetProvider, BlockSheetSlot} from './BlockSheet.js'
import css from './BlockSheetStoryFrame.module.css'

const styles = styler(css)

export interface BlockSheetStoryFrameProps {
  children: ReactNode
}

/** Shows field stories next to a panel that hosts their block sheets */
export function BlockSheetStoryFrame({children}: BlockSheetStoryFrameProps) {
  return (
    <BlockSheetProvider>
      <div className={styles.BlockSheetStoryFrame()}>
        <div className={styles.BlockSheetStoryFrame.content()}>{children}</div>
        <div className={styles.BlockSheetStoryFrame.panel()}>
          <BlockSheetSlot />
        </div>
      </div>
    </BlockSheetProvider>
  )
}
