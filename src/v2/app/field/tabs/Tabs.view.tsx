import {getType} from 'alinea/core/Internal'
import {Section} from 'alinea/core/Section'
import {Type} from 'alinea/core/Type'
import {TabsSection} from 'alinea/field/tabs'
import {type KeyboardEvent, useEffect, useId, useRef, useState} from 'react'
import {EditFields} from '../../Editor.js'

interface TabsViewProps {
  section: Section
}

export function TabsView({section}: TabsViewProps) {
  const tabs = section[Section.Data] as TabsSection
  const visibleTypes = tabs.types.filter(type => !Type.isHidden(type))
  const [selectedIndex, setSelectedIndex] = useState(0)
  const tabsId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    if (selectedIndex < visibleTypes.length) return
    setSelectedIndex(Math.max(visibleTypes.length - 1, 0))
  }, [selectedIndex, visibleTypes.length])

  if (!visibleTypes.length) return null

  function getTabId(index: number) {
    return `${tabsId}-tab-${index}`
  }

  function getPanelId(index: number) {
    return `${tabsId}-panel-${index}`
  }

  function focusTab(index: number) {
    tabRefs.current[index]?.focus()
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number
  ) {
    let nextIndex = index
    switch (event.key) {
      case 'ArrowLeft':
        nextIndex = index === 0 ? visibleTypes.length - 1 : index - 1
        break
      case 'ArrowRight':
        nextIndex = index === visibleTypes.length - 1 ? 0 : index + 1
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = visibleTypes.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    setSelectedIndex(nextIndex)
    focusTab(nextIndex)
  }

  return (
    <div
      className="alinea-rac-Tabs"
      data-orientation="horizontal"
      data-variant="subtle"
    >
      <div className="alinea-rac-Tablist">
        <div
          aria-orientation="horizontal"
          className="alinea-rac-Tablist-list"
          role="tablist"
          data-orientation="horizontal"
        >
          {visibleTypes.map((type, index) => {
            const isSelected = index === selectedIndex
            return (
              <button
                key={index}
                aria-controls={getPanelId(index)}
                aria-selected={isSelected}
                className="alinea-rac-Tab"
                data-selected={isSelected ? '' : undefined}
                id={getTabId(index)}
                onClick={() => setSelectedIndex(index)}
                onKeyDown={event => handleTabKeyDown(event, index)}
                ref={element => {
                  tabRefs.current[index] = element
                }}
                role="tab"
                tabIndex={isSelected ? 0 : -1}
                type="button"
              >
                {Type.label(type)}
              </button>
            )
          })}
        </div>
      </div>
      {visibleTypes.map((type, index) => {
        const isSelected = index === selectedIndex
        return (
          <div
            key={index}
            aria-labelledby={getTabId(index)}
            className="alinea-rac-TabPanel"
            hidden={!isSelected}
            id={getPanelId(index)}
            role="tabpanel"
          >
            <EditFields fields={getType(type).fields} />
          </div>
        )
      })}
    </div>
  )
}
