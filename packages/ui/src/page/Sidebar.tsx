import {Entry} from '@alinea/core'
import {css} from '@stitches/react'
import React, {useEffect, useRef, useState} from 'react'
import {useQuery} from 'react-query'
import {useApp} from '../App'
import {MdChevronRight, MdExpandMore, MdInsertDriveFile} from 'react-icons/md'
import {Link, Route} from 'wouter'

const styles = {
  root: css({
    height: '100%',
    width: '330px',
    borderRight: '1px solid #595959',
    background: '#191A1F',
    overflow: 'auto'
  }),
  link: Object.assign(
    css({
      height: '22px',
      fontSize: '13px',
      color: 'rgb(204, 204, 204)',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      padding: '0 10px',
      textDecoration: 'none',
      '&:hover': {
        background: 'rgb(55, 55, 61)'
      }
    }),
    {
      icon: css({
        width: '22px',
        textAlign: 'center',
        flexShrink: 0
      })
    }
  )
}

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
  entry: Entry
  level: number
} & OpenChildren

function TreeNode({entry, level, isOpen, toggleOpen}: TreeNodeProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  /*
  // Do this for selected one (through route), not open one
  useEffect(() => {
    if (isOpen(entry.path)) {
      ref.current!.scrollIntoView({behavior: 'smooth'})
    }
  }, [])*/
  return (
    <>
      <Link
        href={'/#' + entry.path}
        onClick={() => {
          if (entry.isContainer) toggleOpen(entry.path)
        }}
      >
        <a
          ref={ref}
          className={styles.link()}
          style={{
            paddingLeft: `${10 + level * 8}px`
          }}
        >
          <div className={styles.link.icon()}>
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
            {entry.title}
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

export function Sidebar() {
  const [open, setOpen] = useState(new Set())
  const isOpen = (path: string) => open.has(path)
  const toggleOpen = (path: string) => {
    const res = new Set(open)
    if (isOpen(path)) res.delete(path)
    else res.add(path)
    setOpen(res)
  }
  return (
    <div className={styles.root()}>
      <TreeChildren isOpen={isOpen} toggleOpen={toggleOpen} />
    </div>
  )
}
