import {Entry} from '@alinea/core'
import {css} from '@stitches/react'
import React, {useState} from 'react'
import {useQuery} from 'react-query'
import {useApp} from '../App'

const styles = {
  root: css({
    height: '100%',
    width: '320px',
    borderRight: '1px solid #595959',
    background: '#191A1F',
    padding: '10px',
    overflow: 'auto'
  })
}

type TreeChildrenProps = {
  parent?: string | undefined
}

function TreeChildren({parent}: TreeChildrenProps) {
  const {client} = useApp()
  const {isLoading, error, data} = useQuery(['children', parent], () =>
    client.content.list(parent)
  )
  return (
    <div style={{paddingLeft: '10px'}}>
      {data?.map(entry => {
        return <TreeNode key={entry.path} entry={entry} />
      })}
    </div>
  )
}

type TreeNodeProps = {
  entry: Entry
}

function TreeNode({entry}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div>
      <a
        style={{
          display: 'block',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden'
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {entry.isContainer ? (isOpen ? '▴' : '▾') : '═'} {entry.title}
      </a>
      {entry.isContainer && isOpen && <TreeChildren parent={entry.path} />}
    </div>
  )
}

export function Sidebar() {
  const {client} = useApp()
  const {isLoading, error, data} = useQuery('sidebar', () =>
    client.content.list()
  )
  return (
    <div className={styles.root()}>
      <TreeChildren />
    </div>
  )
}
