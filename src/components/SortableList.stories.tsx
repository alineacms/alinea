import {type ComponentType, useState} from 'react'
import {
  IcRoundEdit,
  IcRoundImage,
  IcRoundLink,
  IcRoundMoreHoriz,
  IcRoundPanorama
} from '#/dashboard/icons.js'
import {Badge} from './Badge.js'
import {Button} from './Button.js'
import {ListError, ListLabel} from './List.js'
import {Popover, PopoverContent, PopoverTrigger} from './Popover.js'
import {
  SortableList,
  SortableListAdd,
  SortableListDragPreview,
  SortableListHandle,
  SortableListItem,
  SortableListItemActions,
  SortableListItemContent,
  SortableListItemDescription,
  SortableListItemFooter,
  SortableListItemHeader,
  SortableListItemSettings,
  SortableListItemTitle,
  SortableListItemToggle
} from './SortableList.js'
import {TextField} from './TextField.js'
import type {DragMoveEvent} from './types.js'

export function Basic() {
  const [heroExpanded, setHeroExpanded] = useState(true)
  const [quoteExpanded, setQuoteExpanded] = useState(false)
  return (
    <div style={{maxWidth: 720}}>
      <ListLabel aria-label="Collapse all items" expanded hasRows shared>
        Sections
      </ListLabel>
      <SortableList aria-label="Sections" data-depth="muted">
        <SortableListItem aria-label="Hero item 1" role="listitem">
          <SortableListItemHeader>
            <SortableListItemTitle>
              <SortableListItemToggle
                aria-label={heroExpanded ? 'Collapse hero' : 'Expand hero'}
                expanded={heroExpanded}
                onClick={() => setHeroExpanded(!heroExpanded)}
              />
              <Badge icon={IcRoundPanorama} size="sm">
                Hero
              </Badge>
              <SortableListItemDescription>
                Landing page intro
              </SortableListItemDescription>
              <Badge size="sm">#landing-page-intro</Badge>
            </SortableListItemTitle>
            <SortableListItemActions>
              <Popover>
                <PopoverTrigger
                  variant="ghost"
                  aria-label="Hero settings"
                  icon={IcRoundMoreHoriz}
                  size="icon-sm"
                />
                <PopoverContent side="bottom" align="end">
                  <SortableListItemSettings>
                    <TextField label="Label" value="Landing page intro" />
                    <TextField label="Anchor" value="landing-page-intro" />
                  </SortableListItemSettings>
                  <SortableListItemSettings variant="actions">
                    <Button variant="ghost">Copy</Button>
                    <Button variant="ghost">Delete</Button>
                  </SortableListItemSettings>
                </PopoverContent>
              </Popover>
            </SortableListItemActions>
          </SortableListItemHeader>
          {heroExpanded && (
            <SortableListItemContent>
              <TextField label="Heading" value="Build structured pages" />
              <TextField
                label="Body"
                value="Compose reusable content sections with a list field."
              />
            </SortableListItemContent>
          )}
        </SortableListItem>
        <SortableListItem aria-label="Quote item 2" role="listitem">
          <SortableListItemHeader>
            <SortableListItemTitle>
              <SortableListItemToggle
                aria-label={quoteExpanded ? 'Collapse quote' : 'Expand quote'}
                expanded={quoteExpanded}
                onClick={() => setQuoteExpanded(!quoteExpanded)}
              />
              <Badge size="sm">Quote</Badge>
              <SortableListItemDescription>
                Editorial quote
              </SortableListItemDescription>
            </SortableListItemTitle>
            <SortableListItemActions>
              <Button
                variant="ghost"
                aria-label="Quote settings"
                icon={IcRoundMoreHoriz}
                size="icon-sm"
              />
            </SortableListItemActions>
          </SortableListItemHeader>
          {quoteExpanded ? (
            <SortableListItemContent>
              <TextField
                label="Quote"
                value="Content editing should stay close to the page."
              />
            </SortableListItemContent>
          ) : (
            <SortableListItemFooter>
              Quote: Content editing should stay close...
            </SortableListItemFooter>
          )}
        </SortableListItem>
        <SortableListAdd>
          <Button variant="ghost" size="sm">
            Add Hero
          </Button>
          <Button variant="ghost" size="sm">
            Add Quote
          </Button>
        </SortableListAdd>
      </SortableList>
      <ListError>At least one section is required.</ListError>
    </div>
  )
}

export function Empty() {
  return (
    <div style={{maxWidth: 720}}>
      <SortableList aria-label="Sections" data-depth="muted">
        <SortableListAdd>
          <Button variant="ghost" size="sm">
            Add Hero
          </Button>
        </SortableListAdd>
      </SortableList>
    </div>
  )
}

export function DragPreview() {
  return <SortableListDragPreview icon={IcRoundPanorama} label="Hero" />
}

interface ReorderItem {
  id: string
  label: string
  icon: ComponentType
}

const reorderItems: Array<ReorderItem> = [
  {id: 'hero', label: 'Hero', icon: IcRoundPanorama},
  {id: 'text', label: 'Text', icon: IcRoundEdit},
  {id: 'image', label: 'Image', icon: IcRoundImage},
  {id: 'links', label: 'Links', icon: IcRoundLink}
]

function moveItems<T extends {id: string}>(
  items: Array<T>,
  {keys, target}: DragMoveEvent
): Array<T> {
  const moved = items.filter(item => keys.has(item.id))
  const rest = items.filter(item => !keys.has(item.id))
  const index = rest.findIndex(item => item.id === target.key)
  if (index === -1) return items
  rest.splice(target.position === 'before' ? index : index + 1, 0, ...moved)
  return rest
}

export function Reorderable() {
  const [items, setItems] = useState(reorderItems)
  return (
    <div style={{maxWidth: 480}}>
      <SortableList
        aria-label="Sections"
        data-depth="muted"
        onReorder={event => setItems(items => moveItems(items, event))}
      >
        {items.map(item => (
          <SortableListItem
            aria-label={item.label}
            dragPreview={
              <SortableListDragPreview icon={item.icon} label={item.label} />
            }
            id={item.id}
            key={item.id}
            role="listitem"
          >
            <SortableListItemHeader>
              <SortableListHandle aria-label={`Drag ${item.label}`} />
              <SortableListItemTitle>
                <Badge icon={item.icon} size="sm">
                  {item.label}
                </Badge>
              </SortableListItemTitle>
            </SortableListItemHeader>
          </SortableListItem>
        ))}
      </SortableList>
      <p data-testid="order">{items.map(item => item.label).join(', ')}</p>
    </div>
  )
}

export default {title: 'Pure components / SortableList'}
