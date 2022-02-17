import {fromModule} from '@alinea/ui'
import useSize from '@react-hook/size'
import {useMemo, useRef} from 'react'
import VirtualList from 'react-tiny-virtual-list'
import {useContentTree} from '../hook/UseContentTree'
import css from './ContentTree.module.scss'
import {TreeNode} from './tree/TreeNode'

const styles = fromModule(css)

type ContentTreeProps = {
  workspace: string
  root: string
  select?: Array<string>
}

export function ContentTree({workspace, root, select = []}: ContentTreeProps) {
  const {entries, isOpen, toggleOpen} = useContentTree({
    workspace,
    root,
    select
  })
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const itemSize = 30
  const offset = useMemo(() => {
    const selected = select[select.length - 1]
    return selected
      ? entries.findIndex(entry => entry.id === selected) * itemSize
      : undefined
  }, [])
  const scrollOffset = offset && offset < containerHeight ? 0 : offset
  return (
    <div ref={containerRef} style={{height: '100%', overflow: 'hidden'}}>
      {containerHeight > 0 && (
        <VirtualList
          className={styles.root.list()}
          width="100%"
          height={containerHeight}
          itemCount={entries.length}
          itemSize={30}
          scrollOffset={scrollOffset}
          renderItem={({index, style}) => {
            const entry = entries[index]
            return (
              <TreeNode
                key={entry.id}
                entry={entry}
                level={entry.parents.length}
                isOpen={isOpen}
                toggleOpen={toggleOpen}
                style={style}
              />
            )
          }}
        />
      )}
    </div>
  )
}
