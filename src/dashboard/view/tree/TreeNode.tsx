import {
  AnimateLayoutChanges,
  defaultAnimateLayoutChanges,
  useSortable
} from '@dnd-kit/sortable'
import {CSS, FirstArgument} from '@dnd-kit/utilities'
import {renderLabel} from 'alinea/core'
import {Create, fromModule, px, Stack, useInitialEffect} from 'alinea/ui'
import {IcRoundEdit} from 'alinea/ui/icons/IcRoundEdit'
import {IcRoundInsertDriveFile} from 'alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowDown} from 'alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import {HStack} from 'alinea/ui/Stack'
import {link} from 'alinea/ui/util/HashRouter'
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
import {ContentTreeEntry} from '../../hook/UseContentTree.js'
import {useCurrentDraft} from '../../hook/UseCurrentDraft.js'
import {useDashboard} from '../../hook/UseDashboard.js'
import {useDraftsList} from '../../hook/UseDraftsList.js'
import {useNav} from '../../hook/UseNav.js'
import {useWorkspace} from '../../hook/UseWorkspace.js'
import css from './TreeNode.module.scss'

const styles = fromModule(css)

type TreeNodeChildrenCreator = {
  locale: string | undefined
  entry: ContentTreeEntry
}

function TreeNodeChildrenCreator({locale, entry}: TreeNodeChildrenCreator) {
  const nav = useNav()
  const {schema} = useDashboard().config
  const type = schema.type(entry.type)
  if (!type) return null
  return (
    <Create.Link href={nav.create({...entry, locale, id: entry.source.id})} />
  )
}

type TreeNodeLinkProps = {
  locale: string | undefined
  entry: ContentTreeEntry
  link?: string
  isSelected: boolean
  level: number
  isOpened: boolean
  toggleOpen: () => void
  rootRef?: Ref<HTMLDivElement>
  isDraft?: boolean
  isDragging?: boolean
  isDragOverlay?: boolean
  isDropContainer?: boolean
} & PropsWithoutRef<HTMLProps<HTMLDivElement>>

const TreeNodeLink = memo(
  forwardRef<HTMLAnchorElement, TreeNodeLinkProps>(function TreeNodeLink(
    {
      locale,
      entry,
      link: url,
      isOpened,
      toggleOpen,
      isSelected,
      level,
      rootRef,
      isDraft,
      isDragging,
      isDragOverlay,
      isDropContainer,
      ...props
    },
    ref
  ) {
    const {schema} = useDashboard().config
    const type = schema.type(entry.type)!
    const isContainer = entry.alinea.isContainer
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
          draft: isDraft,
          untranslated: isUnTranslated
        })}
        ref={rootRef}
        {...props}
      >
        <div className={styles.root.inner()}>
          <a
            ref={ref}
            draggable={false}
            {...link(url || '')}
            className={styles.root.link()}
            style={{paddingLeft: `${10 + level * 8}px`}}
            onClick={event => {
              if (!entry.alinea.isContainer || isOpened) return
              toggleOpen()
            }}
          >
            {isContainer && (
              <div
                className={styles.root.link.icon()}
                onClick={event => {
                  if (!entry.alinea.isContainer) return
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
              {/*entry.isContainer && entry.childrenCount > 0 && (
                <div className={styles.root.link.badge()}>
                  <div>{entry.childrenCount}</div>
                </div>
              )*/}
              {isDraft && (
                <span className={styles.root.link.status()}>
                  <IcRoundEdit />
                </span>
              )}
            </HStack>
          </a>
          {entry.alinea.isContainer && (
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
  link?: string
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
  const workspace = useWorkspace()
  const {ids: drafts} = useDraftsList(workspace.name)
  const isDraft = drafts.includes(entry.source.id)
  const isSelected = draft?.id === entry.source.id
  const handleToggleOpen = useCallback(() => {
    if (entry.alinea.isContainer) toggleOpen(entry.id)
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
      isDraft={isDraft}
      toggleOpen={handleToggleOpen}
      rootRef={rootRef}
      {...props}
    />
  )
}
