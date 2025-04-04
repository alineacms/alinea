import styler from '@alinea/styler'
import {getType} from 'alinea/core/Internal'
import type {SummaryProps} from 'alinea/core/media/Summary'
import type {Schema} from 'alinea/core/Schema'
import {resolveView} from 'alinea/core/View'
import {link} from 'alinea/dashboard/util/HashRouter'
import {EntryReference} from 'alinea/picker/entry/EntryReference'
import {Icon} from 'alinea/ui'
import {IcOutlineInsertDriveFile} from 'alinea/ui/icons/IcOutlineInsertDriveFile'
import {IcRoundCheckBox} from 'alinea/ui/icons/IcRoundCheckBox'
import {IcRoundCheckBoxOutlineBlank} from 'alinea/ui/icons/IcRoundCheckBoxOutlineBlank'
import {IcRoundKeyboardArrowRight} from 'alinea/ui/icons/IcRoundKeyboardArrowRight'
import type {ComponentType} from 'react'
import {useDashboard} from '../../hook/UseDashboard.js'
import {useExplorer} from '../../hook/UseExplorer.js'
import {useFocusListItem} from '../../hook/UseFocusList.js'
import {useNav} from '../../hook/UseNav.js'
import type {ExporerItemSelect} from './Explorer.js'
import css from './ExplorerItem.module.scss'

const styles = styler(css)

export interface ExplorerItemProps {
  schema: Schema
  entry: ExporerItemSelect
  summaryView: 'summaryRow' | 'summaryThumb'
  defaultView: ComponentType<SummaryProps>
}

export function ExplorerItem({
  schema,
  entry,
  summaryView,
  defaultView
}: ExplorerItemProps) {
  const nav = useNav()
  const {views} = useDashboard()
  const explorer = useExplorer()
  const itemRef = useFocusListItem<HTMLDivElement>(() =>
    explorer?.onSelect(entry)
  )
  const type = schema[entry.type]
  const typeView = type && getType(type)[summaryView]
  const View: any = typeView ? resolveView(views, typeView) : defaultView
  const isSelectable =
    explorer.selectable === true ||
    (Array.isArray(explorer.selectable) &&
      explorer.selectable.includes(entry.type))
  const Tag: any = isSelectable ? 'label' : 'a'
  const props = isSelectable
    ? {}
    : explorer.selectable
      ? {onClick: navigateTo}
      : link(nav.entry(entry))
  const isSelected = Boolean(
    isSelectable &&
      explorer.selection.find(
        v =>
          EntryReference.isEntryReference(v) &&
          v[EntryReference.entry] === entry.id
      )
  )
  const childrenAmount = entry.childrenAmount ?? 0

  function navigateTo() {
    explorer.onNavigate?.(entry.id)
  }

  return (
    <div
      ref={itemRef}
      key={entry.id}
      className={styles.root(summaryView === 'summaryRow' ? 'row' : 'thumb', {
        selected: isSelected,
        border: explorer.border
      })}
    >
      <div className={styles.root.inner()}>
        <Tag
          className={styles.root.inner.hitBox()}
          style={{flexGrow: 1}}
          {...props}
        >
          {isSelectable && (
            <>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {
                  explorer.onSelect(entry)
                }}
                className={styles.root.checkbox()}
              />
              <div className={styles.root.selection()}>
                {isSelected ? (
                  <IcRoundCheckBox />
                ) : (
                  <IcRoundCheckBoxOutlineBlank />
                )}
              </div>
            </>
          )}

          <View {...entry} />
        </Tag>

        {explorer.withNavigation &&
          explorer.onNavigate &&
          childrenAmount > 0 && (
            <button
              type="button"
              className={styles.root.children()}
              onClick={navigateTo}
            >
              <Icon icon={IcOutlineInsertDriveFile} size={18} />

              <span className={styles.root.children.badge()}>
                {childrenAmount}
              </span>

              <Icon icon={IcRoundKeyboardArrowRight} size={18} />
            </button>
          )}
      </div>
    </div>
  )
}
