import {Entry} from '@alinea/core'
import {Create, fromModule, Stack, useInitialEffect} from '@alinea/ui'
import {HStack} from '@alinea/ui/Stack'
import {
  forwardRef,
  memo,
  Ref,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import {
  MdChevronRight,
  MdError,
  MdExpandMore,
  MdInsertDriveFile
} from 'react-icons/md'
import {useQuery} from 'react-query'
import {Link, useLocation} from 'react-router-dom'
import {useSession} from '../hook/UseSession'
import {useWorkspace} from '../hook/UseWorkspace'
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
  const {data} = useQuery(
    ['children', parent],
    () => session.hub.list(parent),
    {suspense: true, keepPreviousData: true}
  )
  if (data?.isFailure()) {
    console.error(data.error)
    return (
      <div
        style={{margin: '10px auto', display: 'flex', justifyContent: 'center'}}
      >
        <MdError />
      </div>
    )
  }
  const list = data && data.isSuccess() ? data.value : undefined
  return (
    <>
      {list?.map(entry => {
        return (
          <TreeNode
            key={entry.id}
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
  entry: Entry.Summary
  level: number
} & OpenChildren

function TreeNode({entry, level, isOpen, toggleOpen}: TreeNodeProps) {
  const ref = useRef<HTMLAnchorElement>(null)
  const location = useLocation()
  const isSelected = location.pathname.slice(1) === entry.id
  const handleToggleOpen = useCallback(() => {
    if (entry.$isContainer) toggleOpen(entry.id)
  }, [toggleOpen])
  const isOpened = isOpen(entry.id)
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
        isOpened={isOpened}
        toggleOpen={handleToggleOpen}
      />
      <Suspense
        fallback={
          null /*<div className={styles.node.loader()}>
            <Loader small />
          </div>*/
        }
      >
        {entry.$isContainer && isOpened && (
          <TreeChildren
            parent={entry.id}
            level={level + 1}
            isOpen={isOpen}
            toggleOpen={toggleOpen}
          />
        )}
      </Suspense>
    </>
  )
}

type TreeNodeChildrenCreator = {entry: Entry}

function TreeNodeChildrenCreator({entry}: TreeNodeChildrenCreator) {
  const {schema} = useWorkspace()
  const type = schema.type(entry.type)
  if (!type) return null
  return (
    <Create.Root>
      <Create.Link to={`/${entry.id}/new`} />
    </Create.Root>
  )
}

type TreeNodeLinkProps = {
  entry: Entry.Summary
  isSelected: boolean
  level: number
  isOpened: boolean
  toggleOpen: () => void
}

const TreeNodeLink = memo(
  forwardRef(function TreeNodeLink(
    {entry, isOpened, toggleOpen, isSelected, level}: TreeNodeLinkProps,
    ref: Ref<HTMLAnchorElement>
  ) {
    const {schema} = useWorkspace()
    const type = schema.type(entry.type)!
    const isContainer = entry.$isContainer
    const icon =
      (type.options.icon && <type.options.icon />) ||
      (isContainer ? (
        isOpened ? (
          <MdExpandMore size={20} />
        ) : (
          <MdChevronRight size={20} />
        )
      ) : (
        <MdInsertDriveFile size={12} />
      ))
    return (
      <div className={styles.node({selected: isSelected})}>
        <Link
          ref={ref}
          to={'/' + entry.id}
          onClick={toggleOpen}
          className={styles.node.link()}
          style={{paddingLeft: `${10 + level * 8}px`}}
        >
          <div className={styles.node.link.icon()}>{icon}</div>
          <HStack
            center
            gap={8}
            style={{width: '100%'}}
            onClick={event => {
              event.stopPropagation()
            }}
          >
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
              <div className={styles.node.link.badge()}>
                <div>{entry.childrenCount}</div>
              </div>
            )}
          </HStack>
        </Link>
        {entry.$isContainer && (
          <Stack.Right className={styles.node.create()}>
            <TreeNodeChildrenCreator entry={entry} />
          </Stack.Right>
        )}
      </div>
    )
  })
)

type OpenChildren = {
  isOpen: (path: string) => boolean
  toggleOpen: (path: string) => void
}

type ContentTreeProps = {
  select?: Array<string>
}

export function ContentTree({select = []}: ContentTreeProps) {
  const [open, setOpen] = useState(() => new Set())
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
  useEffect(() => {
    if (select.length) setOpen(new Set([...open, ...select]))
  }, [select.join('.')])
  return (
    <div>
      <TreeChildren isOpen={isOpen} toggleOpen={toggleOpen} />
    </div>
  )
}
