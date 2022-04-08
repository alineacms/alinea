import {Entry} from '@alineacms/core/Entry'
import {generateKeyBetween} from '@alineacms/core/util/FractionalIndexing'
import {fromModule} from '@alineacms/ui'
import {
  closestCenter,
  defaultDropAnimation,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  LayoutMeasuringStrategy,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import useSize from '@react-hook/size'
import {useLayoutEffect, useMemo, useRef, useState} from 'react'
import {useHistory} from 'react-router'
import VirtualList from 'react-tiny-virtual-list'
import {useContentTree} from '../hook/UseContentTree'
import {useDashboard} from '../hook/UseDashboard'
import {useDrafts} from '../hook/UseDrafts'
import css from './ContentTree.module.scss'
import {TreeNode, TreeNodeSortable} from './tree/TreeNode'

const styles = fromModule(css)

const layoutMeasuringConfig = {
  strategy: LayoutMeasuringStrategy.Always
}

function applyMoves<T extends {id: string; index: string}>(
  entries: Array<T>,
  moves: Array<readonly [string, string]>
): Array<T> {
  const res = entries.slice()
  for (const [entryId, indexKey] of moves) {
    const entryIndex = res.findIndex(e => e.id === entryId)
    if (entryIndex > -1) {
      res[entryIndex] = {...res[entryIndex], index: indexKey}
    }
  }
  return res
}

function sortByIndex(entries: Array<Entry.Summary>) {
  const index = new Map(entries.map(entry => [entry.id, entry]))
  function parentIndex(id: string) {
    const parent = index.get(id)!
    return parent.index
  }
  function indexOf(entry: Entry.Summary) {
    return entry.parents.map(parentIndex).concat(entry.index).join('.')
  }
  return entries.sort((a, b) => {
    const indexA = indexOf(a)
    const indexB = indexOf(b)
    return indexA < indexB ? -1 : indexA > indexB ? 1 : 0
  })
}

export type ContentTreeProps = {
  workspace: string
  root: string
  select?: Array<string>
  redirectToRoot?: boolean
}

export function ContentTree({
  workspace,
  root,
  select = [],
  redirectToRoot
}: ContentTreeProps) {
  const {
    entries: treeEntries,
    isOpen,
    toggleOpen,
    refetch
  } = useContentTree({
    workspace,
    root,
    select
  })
  const drafts = useDrafts()
  const [moves, setMoves] = useState<Array<readonly [string, string]>>([])
  const entries = sortByIndex(applyMoves(treeEntries, moves))
  const [dragging, setDragging] = useState<Entry.Summary | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 2
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  const containerRef = useRef(null)
  const [containerWidth, containerHeight] = useSize(containerRef)
  const itemSize = 30
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
    if (dragging?.$isContainer && isOpen(dragging.id)) {
      toggleOpen(dragging.id)
    }
    setDragging(dragging)
  }

  // Todo: this is not very pretty
  function handleDragEnd(event: DragEndEvent) {
    const {active, over} = event
    setDragging(null)
    if (!over || active.id === over.id) return
    const aId = active.id
    const aIndex = entries.findIndex(entry => entry.id === aId)
    const a = entries[aIndex]
    const bId = over.id
    const bIndex = entries.findIndex(entry => entry.id === bId)
    const b = entries[bIndex]
    if (a?.parent !== b?.parent) return
    function sibling(direction: number) {
      const next = entries[bIndex + direction]
      return next && next.parent === b.parent ? next : null
    }
    const candidates = aIndex > bIndex ? [sibling(-1), b] : [b, sibling(1)]
    try {
      const newIndex = generateKeyBetween(
        candidates[0]?.index || null,
        candidates[1]?.index || null
      )
      const move = [a.id, newIndex] as const
      setMoves(current => [...current, move])
      return drafts
        .setIndex(aId, newIndex)
        .then(() => refetch())
        .then(() => {
          setMoves(current => current.filter(m => m !== move))
        })
    } catch (e) {
      console.error(e)
    }
  }

  // Not sure if this should belong here but it's convenient for now
  const history = useHistory()
  const {nav} = useDashboard()
  useLayoutEffect(() => {
    if (redirectToRoot && entries.length > 0) {
      const first = entries[0]
      if (first.workspace === workspace && first.root === root) {
        history.replace(nav.entry(first.workspace, first.root, first.id))
      }
    }
  }, [workspace, root, redirectToRoot, entries])

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      layoutMeasuring={layoutMeasuringConfig}
    >
      <SortableContext items={entries} strategy={verticalListSortingStrategy}>
        <div ref={containerRef} style={{height: '100%', overflow: 'hidden'}}>
          {containerHeight > 0 && (
            <VirtualList
              className={styles.root.list()}
              width="100%"
              height={containerHeight}
              itemCount={entries.length}
              itemSize={30}
              scrollOffset={scrollOffset}
              renderItem={({index, style}) => {
                const entry = entries[index]
                return (
                  <TreeNodeSortable
                    key={entry.id}
                    entry={entry}
                    level={entry.parents.length}
                    isOpen={isOpen}
                    toggleOpen={toggleOpen}
                    style={{...style, height: 30}}
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
            entry={dragging}
            level={dragging.parents.length}
            isOpen={isOpen}
            toggleOpen={toggleOpen}
            isDragOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
