import {Tabs, TabsContent, TabsList, TabsTrigger} from '#/components.js'
import styler from '@alinea/styler'
import type {ReactNode} from 'react'
import type {OverviewTabState} from '../atoms/overview.js'
import css from './ExplorerTabs.module.css'

const styles = styler(css)

export interface ExplorerTabsProps {
  tabs: Array<OverviewTabState>
  /** The key of the selected tab */
  value: string
  onValueChange: (value: string) => void
  /** The listed entries of the selected tab */
  children: ReactNode
}

/** The tabs of an overview, above the entries listed for the selected tab */
export function ExplorerTabs({
  tabs,
  value,
  onValueChange,
  children
}: ExplorerTabsProps) {
  return (
    <Tabs
      className={styles.ExplorerTabs()}
      value={value}
      onValueChange={onValueChange}
    >
      <div className={styles.ExplorerTabs.bar()}>
        <TabsList aria-label="Overview tabs">
          {tabs.map(tab => (
            <TabsTrigger key={tab.key} value={tab.key}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      <TabsContent value={value} className={styles.ExplorerTabs.panel()}>
        {children}
      </TabsContent>
    </Tabs>
  )
}
