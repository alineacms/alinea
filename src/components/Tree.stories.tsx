import {useMemo, useState} from 'react'
import {
  IcOutlineDescription,
  IcRoundDescription,
  IcRoundEdit,
  IcRoundVisibility,
  IcRoundVisibilityOff
} from '../dashboard/icons.js'
import {Tree, TreeItem} from './Tree.js'
import type {DropTarget, Key, Selection} from './types.js'

export function Example() {
  return (
    <Tree aria-label="Files" defaultExpandedKeys={['docs']}>
      <TreeItem id="docs" title="Documents" icon={IcOutlineDescription}>
        <TreeItem id="project" title="Project" icon={IcOutlineDescription}>
          <TreeItem
            id="report"
            title="Weekly report"
            icon={IcRoundDescription}
          />
        </TreeItem>
      </TreeItem>
      <TreeItem id="photos" title="Photos" icon={IcOutlineDescription}>
        <TreeItem id="image-1" title="Image 1" icon={IcRoundDescription} />
        <TreeItem id="image-2" title="Image 2" icon={IcRoundDescription} />
      </TreeItem>
    </Tree>
  )
}

function StatusIcon({icon: Icon, color}: StatusIconProps) {
  return <Icon style={{width: 14, height: 14, color}} />
}

interface StatusIconProps {
  icon: typeof IcRoundEdit
  color: string
}

export function WithStatus() {
  const [selected, setSelected] = useState<Selection>(new Set(['published']))
  const [action, setAction] = useState<Key>()
  return (
    <div>
      <Tree
        aria-label="Pages"
        defaultExpandedKeys={['status']}
        selectionMode="single"
        selectedKeys={selected}
        onSelectionChange={setSelected}
        onAction={setAction}
        disabledKeys={['draft']}
      >
        <TreeItem id="status" title="Status" icon={IcOutlineDescription}>
          <TreeItem
            id="published"
            title="Published"
            icon={IcRoundDescription}
            href="#published"
            suffix={<StatusIcon icon={IcRoundVisibility} color="#16a34a" />}
          />
          <TreeItem
            id="unpublished"
            title="Unpublished"
            icon={IcRoundDescription}
            suffix={<StatusIcon icon={IcRoundVisibilityOff} color="#d97706" />}
          />
          <TreeItem
            id="draft"
            title="Draft"
            icon={IcRoundDescription}
            suffix={<StatusIcon icon={IcRoundEdit} color="#2563eb" />}
          />
        </TreeItem>
      </Tree>
      <output data-testid="selected">
        {selected === 'all' ? 'all' : [...selected].join(',')}
      </output>
      <output data-testid="action">{action}</output>
    </div>
  )
}

export function MultipleSelection() {
  const [selected, setSelected] = useState<Selection>(new Set())
  return (
    <div>
      <Tree
        aria-label="Photos"
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
      >
        <TreeItem id="image-1" title="Image 1" icon={IcRoundDescription} />
        <TreeItem id="image-2" title="Image 2" icon={IcRoundDescription} />
        <TreeItem id="image-3" title="Image 3" icon={IcRoundDescription} />
      </Tree>
      <output data-testid="selected">
        {selected === 'all' ? 'all' : [...selected].join(',')}
      </output>
    </div>
  )
}

interface Node {
  id: string
  title: string
  children: Array<Node>
}

function renderNode(node: Node) {
  return (
    <TreeItem
      id={node.id}
      title={node.title}
      icon={node.children.length ? IcOutlineDescription : IcRoundDescription}
      hasChildItems={node.children.length > 0}
      items={node.children}
    >
      {renderNode}
    </TreeItem>
  )
}

function removeNodes(nodes: Array<Node>, keys: ReadonlySet<Key>) {
  const removed: Array<Node> = []
  function walk(list: Array<Node>): Array<Node> {
    return list.flatMap(node => {
      if (keys.has(node.id)) {
        removed.push(node)
        return []
      }
      return [{...node, children: walk(node.children)}]
    })
  }
  return {nodes: walk(nodes), removed}
}

function insertNodes(
  nodes: Array<Node>,
  target: DropTarget,
  inserted: Array<Node>
): Array<Node> {
  return nodes.flatMap(node => {
    const children = insertNodes(node.children, target, inserted)
    if (node.id !== target.key) return [{...node, children}]
    if (target.position === 'on')
      return [{...node, children: [...children, ...inserted]}]
    const self = {...node, children}
    return target.position === 'before'
      ? [...inserted, self]
      : [self, ...inserted]
  })
}

function moveNodes(
  nodes: Array<Node>,
  keys: ReadonlySet<Key>,
  target: DropTarget
) {
  const result = removeNodes(nodes, keys)
  return insertNodes(result.nodes, target, result.removed)
}

const initialNodes: Array<Node> = [
  {
    id: 'fruit',
    title: 'Fruit',
    children: [
      {id: 'apple', title: 'Apple', children: []},
      {id: 'banana', title: 'Banana', children: []}
    ]
  },
  {id: 'vegetables', title: 'Vegetables', children: []},
  {id: 'bread', title: 'Bread', children: []}
]

export function DragAndDrop() {
  const [nodes, setNodes] = useState(initialNodes)
  return (
    <Tree
      aria-label="Groceries"
      items={nodes}
      defaultExpandedKeys={['fruit']}
      getDragData={keys => [...keys].map(key => ({'text/plain': String(key)}))}
      canDrop={target => target.key !== 'bread' || target.position !== 'on'}
      onReorder={({keys, target}) =>
        setNodes(current => moveNodes(current, keys, target))
      }
      onMove={({keys, target}) =>
        setNodes(current => moveNodes(current, keys, target))
      }
    >
      {renderNode}
    </Tree>
  )
}

function generateNodes(count: number): Array<Node> {
  const result: Array<Node> = []
  for (let section = 0; section * 50 < count; section++) {
    const children: Array<Node> = []
    for (let item = 0; item < 50 && section * 50 + item < count; item++) {
      const index = section * 50 + item + 1
      children.push({id: `item-${index}`, title: `Item ${index}`, children: []})
    }
    result.push({
      id: `section-${section + 1}`,
      title: `Section ${section + 1}`,
      children
    })
  }
  return result
}

export function Virtualized() {
  const [count, setCount] = useState(1000)
  const nodes = useMemo(() => generateNodes(count), [count])
  const [expanded, setExpanded] = useState<Set<Key>>(new Set(['section-1']))
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
      <select
        aria-label="Items"
        value={count}
        onChange={event => setCount(Number(event.target.value))}
      >
        <option value={100}>100 items</option>
        <option value={1000}>1000 items</option>
        <option value={10000}>10000 items</option>
      </select>
      <div style={{height: 320, display: 'flex', flexDirection: 'column'}}>
        <Tree
          aria-label={`${count} items`}
          items={nodes}
          expandedKeys={expanded}
          onExpandedChange={setExpanded}
          selectionMode="single"
          virtualized
          rowHeight={34}
        >
          {renderNode}
        </Tree>
      </div>
    </div>
  )
}

export function Empty() {
  return (
    <Tree aria-label="Nothing" items={[]} renderEmptyState={() => 'No items'}>
      {renderNode}
    </Tree>
  )
}

export default {
  title: 'Pure components / Tree'
}
