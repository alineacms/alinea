import {
  Badge,
  Page,
  PageContent,
  Stack,
  Table,
  TableCell,
  type TableColumn,
  TableRow,
  TableTitle,
  Text
} from '#/components.js'
import {type CSSProperties, useState} from 'react'
import type {OverviewTabState} from '../atoms/overview.js'
import {ExplorerOverviewHeader} from './ExplorerOverviewHeader.js'
import {ExplorerTabs} from './ExplorerTabs.js'

interface Product {
  id: string
  title: string
  status: 'active' | 'archived'
  price: number
}

const products: Array<Product> = [
  {id: 'chair', title: 'Chair', status: 'active', price: 120},
  {id: 'table', title: 'Table', status: 'active', price: 480},
  {id: 'lamp', title: 'Lamp', status: 'active', price: 45},
  {id: 'stool', title: 'Stool', status: 'archived', price: 60},
  {id: 'shelf', title: 'Shelf', status: 'archived', price: 210}
]

const tabs: Array<OverviewTabState> = [
  {key: 'all', label: 'All'},
  {key: 'active', label: 'Active', filter: {status: 'active'}},
  {key: 'archived', label: 'Archived', filter: {status: 'archived'}}
]

const columns: Array<TableColumn> = [
  {id: 'title', header: 'Title', width: '1fr'},
  {id: 'status', header: 'Status', width: 120},
  {id: 'price', header: 'Price', width: 120}
]

const frame: CSSProperties = {display: 'flex', height: 360}

const price = new Intl.NumberFormat('en', {style: 'currency', currency: 'EUR'})

function listed(tab: string) {
  return tab === 'all'
    ? products
    : products.filter(product => product.status === tab)
}

interface ProductTotalsProps {
  items: Array<Product>
}

/** What an `overview.header` view could show: totals of the listed entries */
function ProductTotals({items}: ProductTotalsProps) {
  const total = items.reduce((sum, product) => sum + product.price, 0)
  return (
    <Stack direction="row" gap={24}>
      <Text>{items.length} products</Text>
      <Text>{price.format(total)} in total</Text>
    </Stack>
  )
}

interface ProductsStoryProps {
  header?: boolean
}

function ProductsStory({header}: ProductsStoryProps) {
  const [tab, setTab] = useState('all')
  const items = listed(tab)
  return (
    <div style={frame}>
      <Page>
        <PageContent>
          <ExplorerTabs tabs={tabs} value={tab} onValueChange={setTab}>
            {header && (
              <ExplorerOverviewHeader>
                <ProductTotals items={items} />
              </ExplorerOverviewHeader>
            )}
            <Table aria-label="Products" items={items} columns={columns}>
              {product => (
                <TableRow id={product.id} textValue={product.title}>
                  <TableTitle title={product.title} />
                  <TableCell>
                    <Badge size="sm">{product.status}</Badge>
                  </TableCell>
                  <TableCell>{price.format(product.price)}</TableCell>
                </TableRow>
              )}
            </Table>
          </ExplorerTabs>
        </PageContent>
      </Page>
    </div>
  )
}

/** `overview.tabs`: each tab lists the products of its filter */
export function Tabs() {
  return <ProductsStory />
}

/** `overview.header` above the list, here totals of the listed products */
export function TabsWithHeader() {
  return <ProductsStory header />
}

export default {
  title: 'Dashboard / ExplorerTabs'
}
