import {Entry} from '@alinea/core'
import {fromModule} from '@alinea/ui/styler'
import React, {useRef, useState} from 'react'
import {MdChevronRight, MdExpandMore, MdInsertDriveFile} from 'react-icons/md'
import {useQuery} from 'react-query'
import {Link, useLocation} from 'wouter'
import {useApp} from '../App'
import {useInitialEffect} from '../hooks/UseInitialEffect'
import css from './ContentTree.module.scss'

const styles = fromModule(css)

type TreeChildrenProps = {
  parent?: string | undefined
  level?: number
} & OpenChildren

function TreeChildren({
  parent,
  level = 0,
  isOpen,
  toggleOpen
}: TreeChildrenProps) {
  const {client} = useApp()
  const {isLoading, error, data} = useQuery(['children', parent], () =>
    client.content.list(parent)
  )
  return (
    <>
      {data?.map(entry => {
        return (
          <TreeNode
            key={entry.path}
            entry={entry}
            level={level}
            isOpen={isOpen}
            toggleOpen={toggleOpen}
          />
        )
      })}
    </>
  )
}

type TreeNodeProps = {
  entry: Entry & {children: number}
  level: number
} & OpenChildren

function TreeNode({entry, level, isOpen, toggleOpen}: TreeNodeProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const [location] = useLocation()
  const isSelected = location === entry.path
  useInitialEffect(() => {
    if (isSelected)
      ref.current!.scrollIntoView({behavior: 'smooth', block: 'center'})
  })
  return (
    <>
      <Link
        href={entry.path}
        onClick={() => {
          if (entry.isContainer) toggleOpen(entry.path)
        }}
      >
        <a
          ref={ref}
          className={styles.node()}
          style={{
            paddingLeft: `${10 + level * 8}px`,
            background: isSelected ? 'rgb(55, 55, 61)' : undefined
          }}
        >
          <div className={styles.node.icon()}>
            {entry.isContainer ? (
              isOpen(entry.path) ? (
                <MdExpandMore size={20} />
              ) : (
                <MdChevronRight size={20} />
              )
            ) : (
              <MdInsertDriveFile size={12} />
            )}
          </div>
          <span
            style={{
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
          >
            {entry.title} {entry.isContainer && `(${entry.children})`}
          </span>
        </a>
      </Link>
      {entry.isContainer && isOpen(entry.path) && (
        <TreeChildren
          parent={entry.path}
          level={level + 1}
          isOpen={isOpen}
          toggleOpen={toggleOpen}
        />
      )}
    </>
  )
}

type OpenChildren = {
  isOpen: (path: string) => boolean
  toggleOpen: (path: string) => void
}

export function ContentTree() {
  const [location] = useLocation()
  const [open, setOpen] = useState(
    new Set(
      location.split('/').map((part, index, parts) => {
        return parts.slice(0, index + 1).join('/')
      })
    )
  )
  const isOpen = (path: string) => open.has(path)
  const toggleOpen = (path: string) => {
    const res = new Set(open)
    if (isOpen(path)) res.delete(path)
    else res.add(path)
    setOpen(res)
  }
  return <TreeChildren isOpen={isOpen} toggleOpen={toggleOpen} />
}
