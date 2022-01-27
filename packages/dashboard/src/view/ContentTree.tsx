import {Entry} from '@alinea/core'
import {
  Create,
  fromModule,
  Stack,
  TextLabel,
  useInitialEffect
} from '@alinea/ui'
import {HStack} from '@alinea/ui/Stack'
import {
  forwardRef,
  memo,
  Ref,
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
    {suspense: true}
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
  entry: Entry.AsListItem
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
      {entry.$isContainer && isOpened && (
        <TreeChildren
          parent={entry.id}
          level={level + 1}
          isOpen={isOpen}
          toggleOpen={toggleOpen}
        />
      )}
    </>
  )
}

type TreeNodeChildrenCreator = {entry: Entry}

function TreeNodeChildrenCreator({entry}: TreeNodeChildrenCreator) {
  const {schema} = useSession().hub
  const type = schema.type(entry.type)
  if (!type) return null
  const typeOptions = type.options?.contains || schema.keys
  if (typeOptions.length === 1)
    return (
      <Create.Root>
        <Link to={`/${entry.id}/new`}>
          <Create.Button>
            <TextLabel label={schema.type(typeOptions[0])?.label!} />
          </Create.Button>
        </Link>
      </Create.Root>
    )
  return (
    <Create.Root>
      <Link to={`/${entry.id}/new`}>
        <Create.Button>Create new</Create.Button>
      </Link>
    </Create.Root>
  )
}

type TreeNodeLinkProps = {
  entry: Entry.AsListItem
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
    return (
      <div className={styles.node.is({selected: isSelected})()}>
        <Link
          ref={ref}
          to={'/' + entry.id}
          onClick={toggleOpen}
          className={styles.node.link()}
          style={{paddingLeft: `${10 + level * 8}px`}}
        >
          <div className={styles.node.link.icon()}>
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
          <HStack
            center
            gap={8}
            style={{width: '100%'}}
            onClick={event => {
              if (!isSelected && isOpened) event.stopPropagation()
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
                {entry.childrenCount}
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
