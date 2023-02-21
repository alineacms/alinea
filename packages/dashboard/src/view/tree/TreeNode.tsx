import {renderLabel} from '@alinea/core'
import {Create, fromModule, px, Stack, useInitialEffect} from '@alinea/ui'
import {IcRoundInsertDriveFile} from '@alinea/ui/icons/IcRoundInsertDriveFile'
import {IcRoundKeyboardArrowDown} from '@alinea/ui/icons/IcRoundKeyboardArrowDown'
import {IcRoundKeyboardArrowRight} from '@alinea/ui/icons/IcRoundKeyboardArrowRight'
import {HStack} from '@alinea/ui/Stack'
import {link} from '@alinea/ui/util/HashRouter'
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
import {ContentTreeEntry} from '../../hook/UseContentTree'
import {useCurrentDraft} from '../../hook/UseCurrentDraft'
import {useDashboard} from '../../hook/UseDashboard'
import {useDraftsList} from '../../hook/UseDraftsList'
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
                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4 mr-1"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125"
                      />
                    </svg>
                    Draft
                  </span>
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
      isSelected={false}
      isOpened={isOpened}
      isDraft={isDraft}
      toggleOpen={handleToggleOpen}
      rootRef={rootRef}
      {...props}
    />
  )
}
