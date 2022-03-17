import {Entry} from '@alinea/core'
import {Create, fromModule, Stack, useInitialEffect} from '@alinea/ui'
import {HStack} from '@alinea/ui/Stack'
import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  useSortable
} from '@dnd-kit/sortable'
import {CSS, FirstArgument} from '@dnd-kit/utilities'
import {
  CSSProperties,
  forwardRef,
  HTMLProps,
  memo,
  PropsWithoutRef,
  Ref,
  useCallback,
  useRef
} from 'react'
import {MdChevronRight, MdExpandMore, MdInsertDriveFile} from 'react-icons/md'
import {Link, useLocation} from 'react-router-dom'
import {useDashboard} from '../../hook/UseDashboard'
import {useWorkspace} from '../../hook/UseWorkspace'
import css from './TreeNode.module.scss'

const styles = fromModule(css)

type TreeNodeChildrenCreator = {entry: Entry.Summary}

function TreeNodeChildrenCreator({entry}: TreeNodeChildrenCreator) {
  const {nav} = useDashboard()
  const {schema} = useWorkspace()
  const type = schema.type(entry.type)
  if (!type) return null
  return (
    <Create.Root>
      <Create.Link to={nav.create(entry.workspace, entry.root, entry.id)} />
    </Create.Root>
  )
}

type TreeNodeLinkProps = {
  entry: Entry.Summary
  isSelected: boolean
  level: number
  isOpened: boolean
  toggleOpen: () => void
  rootRef?: Ref<HTMLDivElement>
  isDragging?: boolean
  isDragOverlay?: boolean
  isDropContainer?: boolean
} & PropsWithoutRef<HTMLProps<HTMLDivElement>>

const TreeNodeLink = memo(
  forwardRef<HTMLAnchorElement, TreeNodeLinkProps>(function TreeNodeLink(
    {
      entry,
      isOpened,
      toggleOpen,
      isSelected,
      level,
      rootRef,
      isDragging,
      isDragOverlay,
      isDropContainer,
      ...props
    },
    ref
  ) {
    const {nav} = useDashboard()
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
      <div
        className={styles.root({
          selected: isSelected,
          dragging: isDragging,
          dragOverlay: isDragOverlay,
          dropContainer: isDropContainer
        })}
        ref={rootRef}
        {...props}
      >
        <div className={styles.root.inner()}>
          <Link
            ref={ref}
            draggable={false}
            to={nav.entry(entry.workspace, entry.root, entry.id)}
            className={styles.root.link()}
            style={{paddingLeft: `${10 + level * 8}px`}}
            onClick={event => {
              if (!entry.$isContainer || isOpened) return
              toggleOpen()
            }}
          >
            <div
              className={styles.root.link.icon()}
              onClick={event => {
                if (!entry.$isContainer) return
                event.preventDefault()
                event.stopPropagation()
                toggleOpen()
              }}
            >
              {icon}
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
                <div className={styles.root.link.badge()}>
                  <div>{entry.childrenCount}</div>
                </div>
              )}
            </HStack>
          </Link>
          {entry.$isContainer && (
            <Stack.Right className={styles.root.create()}>
              <TreeNodeChildrenCreator entry={entry} />
            </Stack.Right>
          )}
        </div>
      </div>
    )
  })
)

function animateLayoutChanges(args: FirstArgument<AnimateLayoutChanges>) {
  const {isSorting, wasSorting} = args
  if (isSorting || wasSorting) return defaultAnimateLayoutChanges(args)
  return true
}

// Todo: once there's a resolution here: https://github.com/clauderic/dnd-kit/pull/612
// we can disable nodes based on the type we're dragging

export function TreeNodeSortable(props: TreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    over
  } = useSortable({
    animateLayoutChanges: () => false,
    id: props.entry.id
  })
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined
  }
  return (
    <TreeNode
      {...props}
      rootRef={setNodeRef}
      style={{...props.style, ...style}}
      {...listeners}
      {...attributes}
      isDragging={isDragging}
      isDropContainer={over?.id === props.entry.id}
    />
  )
}

export type TreeNodeProps = {
  entry: Entry.Summary
  level: number
  isOpen: (path: string) => boolean
  toggleOpen: (path: string) => void
  isDragging?: boolean
  isDragOverlay?: boolean
  isDropContainer?: boolean
  rootRef?: Ref<HTMLDivElement>
} & PropsWithoutRef<HTMLProps<HTMLDivElement>>

export function TreeNode({
  entry,
  level,
  isOpen,
  toggleOpen,
  rootRef,
  ...props
}: TreeNodeProps) {
  const {nav} = useDashboard()
  const ref = useRef<HTMLAnchorElement>(null)
  const location = useLocation()
  const isSelected =
    location.pathname === nav.entry(entry.workspace, entry.root, entry.id)
  const handleToggleOpen = useCallback(() => {
    if (entry.$isContainer) toggleOpen(entry.id)
  }, [toggleOpen])
  const isOpened = isOpen(entry.id)
  useInitialEffect(() => {
    if (isSelected)
      ref.current!.scrollIntoView({/*behavior: 'smooth',*/ block: 'center'})
  })
  return (
    <TreeNodeLink
      ref={ref}
      entry={entry}
      level={level}
      isSelected={isSelected}
      isOpened={isOpened}
      toggleOpen={handleToggleOpen}
      rootRef={rootRef}
      {...props}
    />
  )
}
