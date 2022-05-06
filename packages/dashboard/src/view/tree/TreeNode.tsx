import {renderLabel} from '@alinea/core'
import {usePaneIndex} from '@alinea/dashboard/hook/UsePaneIndex'
import {Create, fromModule, px, Stack, useInitialEffect} from '@alinea/ui'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from '@alinea/ui/icons/IcRoundKeyboardArrowRight'
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
import {Link} from 'react-router-dom'
import {ContentTreeEntry} from '../../hook/UseContentTree'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useNav} from '../../hook/UseNav'
import {useWorkspace} from '../../hook/UseWorkspace'
import css from './TreeNode.module.scss'

const styles = fromModule(css)

type TreeNodeChildrenCreator = {
  locale: string | undefined
  entry: ContentTreeEntry
}

function TreeNodeChildrenCreator({locale, entry}: TreeNodeChildrenCreator) {
  const nav = useNav()
  const {schema} = useWorkspace()
  const type = schema.type(entry.type)
  if (!type) return null
  return (
    <Create.Link to={nav.create({...entry, locale, id: entry.source.id})} />
  )
}

type TreeNodeLinkProps = {
  locale: string | undefined
  entry: ContentTreeEntry
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
      locale,
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
    const nav = useNav()
    const {schema} = useWorkspace()
    const paneIndex = usePaneIndex()
    const type = schema.type(entry.type)!
    const isContainer = entry.$isContainer
    const containerIcon = isOpened ? (
      <IcRoundKeyboardArrowDown style={{fontSize: px(20)}} />
    ) : (
      <IcRoundKeyboardArrowRight style={{fontSize: px(20)}} />
    )
    const hasIcon = Boolean(type.options.icon)
    const icon = type.options.icon ? (
      <type.options.icon />
    ) : (
      <IcRoundInsertDriveFile style={{fontSize: px(12)}} />
    )
    const isUnTranslated = locale && entry.locale !== locale
    return (
      <div
        className={styles.root({
          selected: isSelected,
          dragging: isDragging,
          dragOverlay: isDragOverlay,
          dropContainer: isDropContainer,
          untranslated: isUnTranslated
        })}
        ref={rootRef}
        {...props}
      >
        <div className={styles.root.inner()}>
          <Link
            ref={ref}
            draggable={false}
            to={nav.entry({...entry, locale, id: entry.source.id})}
            className={styles.root.link()}
            style={{paddingLeft: `${10 + level * 8}px`}}
            onClick={event => {
              if (!entry.$isContainer || isOpened) {
                if (paneIndex?.index !== 2) paneIndex?.setIndex(1)
                return
              }
              toggleOpen()
            }}
          >
            {isContainer && (
              <div
                className={styles.root.link.icon()}
                onClick={event => {
                  if (!entry.$isContainer) return
                  event.preventDefault()
                  event.stopPropagation()
                  toggleOpen()
                }}
              >
                {containerIcon}
              </div>
            )}
            {(hasIcon || !isContainer) && (
              <div className={styles.root.link.icon()}>{icon}</div>
            )}
            <HStack center gap={8} style={{width: '100%'}}>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}
              >
                {renderLabel(entry.title)}
              </span>
              {/*entry.$isContainer && entry.childrenCount > 0 && (
                <div className={styles.root.link.badge()}>
                  <div>{entry.childrenCount}</div>
                </div>
              )*/}
            </HStack>
          </Link>
          {entry.$isContainer && (
            <Stack.Right className={styles.root.create()}>
              <TreeNodeChildrenCreator locale={locale} entry={entry} />
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
  entry: ContentTreeEntry
  locale: string | undefined
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
  const nav = useNav()
  const ref = useRef<HTMLAnchorElement>(null)
  const draft = useCurrentDraft()
  const isSelected = draft?.id === entry.source.id
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
