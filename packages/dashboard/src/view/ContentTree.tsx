import {Entry} from '@alinea/core'
import {fromModule, useInitialEffect} from '@alinea/ui'
import {HStack} from '@alinea/ui/Stack'
import {forwardRef, memo, Ref, useCallback, useRef, useState} from 'react'
import {MdChevronRight, MdExpandMore, MdInsertDriveFile} from 'react-icons/md'
import {useQuery} from 'react-query'
import {Link, useLocation} from 'react-router-dom'
import {useSession} from '../hook/UseSession'
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
  const session = useSession()
  const {isLoading, error, data} = useQuery(['children', parent], () =>
    session.hub.content.list(parent)
  )
  return (
    <>
      {data?.map(entry => {
        return (
          <TreeNode
            key={entry.$id}
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
  entry: Entry.WithChildrenCount
  level: number
} & OpenChildren

function TreeNode({entry, level, isOpen, toggleOpen}: TreeNodeProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const location = useLocation()
  const isSelected = location.pathname.slice(1) === entry.$id
  const handleOpen = useCallback(() => {
    if (entry.$isContainer) toggleOpen(entry.$id)
  }, [toggleOpen])
  useInitialEffect(() => {
    if (isSelected)
      ref.current!.scrollIntoView({/*behavior: 'smooth',*/ block: 'center'})
  })
  return (
    <>
      <TreeNodeLink
        ref={ref}
        entry={entry}
        level={level}
        isSelected={isSelected}
        isOpened={isOpen(entry.$id)}
        onOpen={handleOpen}
      />
      {entry.$isContainer && isOpen(entry.$id) && (
        <TreeChildren
          parent={entry.$id}
          level={level + 1}
          isOpen={isOpen}
          toggleOpen={toggleOpen}
        />
      )}
    </>
  )
}

type TreeNodeLinkProps = {
  entry: Entry.WithChildrenCount
  isSelected: boolean
  level: number
  isOpened: boolean
  onOpen: () => void
}

const TreeNodeLink = memo(
  forwardRef(function TreeNodeLink(
    {entry, isOpened, onOpen, isSelected, level}: TreeNodeLinkProps,
    ref: Ref<HTMLAnchorElement>
  ) {
    return (
      <Link
        ref={ref}
        to={entry.$id}
        onClick={onOpen}
        className={styles.node.is({selected: isSelected})()}
        style={{paddingLeft: `${10 + level * 8}px`}}
      >
        <div className={styles.node.icon()}>
          {entry.$isContainer ? (
            isOpened ? (
              <MdExpandMore size={20} />
            ) : (
              <MdChevronRight size={20} />
            )
          ) : (
            <MdInsertDriveFile size={12} />
          )}
        </div>
        <HStack center gap={8} style={{width: '100%'}}>
          <span
            style={{
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              overflow: 'hidden'
            }}
          >
            {entry.title}
          </span>
          {entry.$isContainer && entry.childrenCount > 0 && (
            <div className={styles.node.badge()}>{entry.childrenCount}</div>
          )}
        </HStack>
      </Link>
    )
  })
)

type OpenChildren = {
  isOpen: (path: string) => boolean
  toggleOpen: (path: string) => void
}

export function ContentTree() {
  const location = useLocation()
  const [open, setOpen] = useState(
    new Set(
      location.pathname.split('/').map((part, index, parts) => {
        return parts.slice(0, index + 1).join('/')
      })
    )
  )
  const isOpen = useCallback((path: string) => open.has(path), [open])
  const toggleOpen = useCallback(
    (path: string) => {
      setOpen(currentOpen => {
        const res = new Set(currentOpen)
        if (res.has(path)) res.delete(path)
        else res.add(path)
        return res
      })
    },
    [setOpen]
  )
  return <TreeChildren isOpen={isOpen} toggleOpen={toggleOpen} />
}
