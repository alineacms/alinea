import {
  closestCenter,
  defaultDropAnimation,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  MouseSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import {fromModule, usePreferences} from 'alinea/ui'
import {useMemo, useRef, useState} from 'react'
import {TreeNode, TreeNodeSortable} from './tree/TreeNode.js'

import useSize from '@react-hook/size'
import {Entry} from 'alinea/core/Entry'
import {generateKeyBetween} from 'alinea/core/util/FractionalIndexing'
import VirtualList from 'react-tiny-virtual-list'
import {ContentTreeEntry} from '../hook/UseContentTree.js'
import {useDashboard} from '../hook/UseDashboard.js'
import {useDrafts} from '../hook/UseDrafts.js'
import {useNav} from '../hook/UseNav.js'
import {useRoot} from '../hook/UseRoot.js'
import css from './ContentTree.module.scss'

const styles = fromModule(css)

type Move = {
  id: string
  parent: string | undefined
  parents: Array<string>
  index: string
}

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

function applyMoves(
  entries: Array<ContentTreeEntry>,
  moves: Array<Move>
): Array<ContentTreeEntry> {
  const toMove = new Map(moves.map(m => [m.id, m]))
  return entries.map(entry => {
    if (toMove.has(entry.id)) {
      const move = toMove.get(entry.id)!
      return {...entry, alinea: {...entry.alinea, ...move}}
    }
    return entry
  })
}

function sortByIndex(
  index: Map<string, ContentTreeEntry>,
  entries: Array<ContentTreeEntry>
): Array<ContentTreeEntry> {
  function parentIndex(id: string) {
    const parent = index.get(id)
    return parent?.alinea.index
  }
  function indexOf(entry: Entry.Summary) {
    return entry.alinea.parents
      .map(parentIndex)
      .concat(entry.alinea.index)
      .join('.')
  }
  return entries.sort((a, b) => {
    const indexA = indexOf(a)
    const indexB = indexOf(b)
    return indexA < indexB ? -1 : indexA > indexB ? 1 : 0
  })
}

export type ContentTreeProps = {
  locale: string | undefined
  select?: Array<string>
  redirectToRoot?: boolean
  entries: ContentTreeEntry[]
  index: Map<string, ContentTreeEntry>
  toggleOpen: (id: string) => void
  isOpen: (id: string) => boolean
  refetch: () => void
}

export function ContentTree({
  locale,
  select = [],
  redirectToRoot,
  entries: treeEntries,
  index,
  toggleOpen,
  isOpen,
  refetch
}: ContentTreeProps) {
  const {schema} = useDashboard().config
  const root = useRoot()
  const drafts = useDrafts()
  const [moves, setMoves] = useState<Array<Move>>([])
  const entries = sortByIndex(index, applyMoves(treeEntries, moves))
  const [dragging, setDragging] = useState<ContentTreeEntry | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 2
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  const preferences = usePreferences()
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const itemSize = (30 / 16) * preferences.size
  const offset = useMemo(() => {
    const selected = select[select.length - 1]
    return selected
      ? entries.findIndex(entry => entry.id === selected) * itemSize
      : undefined
  }, [])
  const scrollOffset = offset && offset < containerHeight ? 0 : offset

  function handleDragStart(event: DragStartEvent) {
    const {active} = event
    const dragging = entries.find(entry => entry.id === active.id) || null
    if (dragging?.alinea.isContainer && isOpen(dragging.id)) {
      toggleOpen(dragging.id)
    }
    setDragging(dragging)
  }

  function handleDragEnd(event: DragEndEvent): void {
    const {active, over} = event
    setDragging(null)
    if (!over || active.id === over.id) return
    const aId = active.id
    const aIndex = entries.findIndex(entry => entry.id === aId)
    const a = entries[aIndex]
    let bId = over.id
    let bIndex = entries.findIndex(entry => entry.id === bId)
    let b = entries[bIndex]

    // Todo:
    // Currently disabled below: if b is a container and open, drop as a child
    // This logic also does not work if we're dragging up.
    // Ideally we can drop on top of the container.
    const parent = /*b.alinea.isContainer && isOpen(b.id)
        ? index.get(b.source.id)
        :*/ index.get(b.alinea.parent!)

    if (a?.alinea.parent !== parent?.id) {
      // Check if parent of b handles child of type a
      if (parent?.id) {
        const type = schema.type(parent?.type)
        const contains = type?.options.contains
        if (contains && !contains.includes(a.type)) return
      } else {
        if (!root.contains.includes(a.type)) return
      }
    }

    function sibling(direction: number) {
      const next = entries[bIndex + direction]
      return next && next.alinea.parent === b.alinea.parent ? next : null
    }

    const candidates = aIndex > bIndex ? [sibling(-1), b] : [b, sibling(1)]

    try {
      const newIndex = generateKeyBetween(
        candidates[0]?.alinea.index || null,
        candidates[1]?.alinea.index || null
      )
      const move = {
        id: a.id,
        index: newIndex,
        parent: parent?.id,
        parents: (parent?.alinea.parents || [])
          .concat(parent?.id!)
          .filter(Boolean)
      }
      setMoves(current => [...current, move])
      drafts
        .move({
          id: a.source.id,
          index: newIndex,
          parent: parent?.source.id
        })
        .then(() => refetch())
        .then(() => {
          setMoves(current => current.filter(m => m !== move))
        })
    } catch (e) {
      console.error(e)
    }
  }

  const nav = useNav()
  const height = (32 / 16) * preferences.size
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      layoutMeasuring={layoutMeasuringConfig}
    >
      <SortableContext
        items={entries.map(entry => entry.id)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={containerRef} style={{height: '100%', overflow: 'hidden'}}>
          {containerHeight > 0 && (
            <VirtualList
              className={styles.root.list()}
              width="100%"
              height={containerHeight}
              itemCount={entries.length}
              itemSize={height}
              scrollOffset={scrollOffset}
              renderItem={({index, style}) => {
                const entry = entries[index]
                return (
                  <TreeNodeSortable
                    key={entry.id}
                    entry={entry}
                    locale={locale}
                    level={entry.alinea.parents.length}
                    link={nav.entry({
                      ...entry.alinea,
                      locale,
                      id: entry.source.id
                    })}
                    isOpen={isOpen}
                    toggleOpen={toggleOpen}
                    style={{...style, height: height}}
                  />
                )
              }}
            />
          )}
        </div>
      </SortableContext>

      <DragOverlay
        dropAnimation={{
          ...defaultDropAnimation,
          dragSourceOpacity: 0.5
        }}
      >
        {dragging ? (
          <TreeNode
            key="overlay"
            locale={locale}
            entry={dragging}
            level={dragging.alinea.parents.length}
            isOpen={isOpen}
            toggleOpen={toggleOpen}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
