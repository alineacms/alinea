'use client'

import styler from '@alinea/styler'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  DataList,
  DataListItem,
  DataListLabel,
  DataListValue,
  Field,
  Table,
  type TableColumn,
  TableCell,
  TableRow
} from 'alinea/components'
import {useSiblingFieldValue} from 'alinea/cms'
import css from './DemoStockOverview.module.scss'

const styles = styler(css)

// Finishes with this many items or fewer are flagged as running low
const lowStock = 3

interface FinishRow {
  _id: string
  name?: string
  swatch?: string
  stock?: number | null
  surcharge?: number | null
}

type StockStatus = 'in-stock' | 'low' | 'out'

const statusLabel: Record<StockStatus, string> = {
  'in-stock': 'In stock',
  low: 'Running low',
  out: 'Made to order'
}

function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'out'
  if (stock <= lowStock) return 'low'
  return 'in-stock'
}

interface StockBadgeProps {
  status: StockStatus
}

function StockBadge({status}: StockBadgeProps) {
  return (
    <Badge
      size="sm"
      status={
        status === 'in-stock'
          ? 'published'
          : status === 'low'
            ? 'unpublished'
            : undefined
      }
    >
      {statusLabel[status]}
    </Badge>
  )
}

const euro = new Intl.NumberFormat('en-BE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0
})

const columns: Array<TableColumn> = [
  {id: 'finish', header: 'Finish', width: '2fr', minWidth: 140},
  {id: 'price', header: 'Price', width: '1fr', align: 'end'},
  {id: 'stock', header: 'Stock', width: '1fr', align: 'end'},
  {id: 'status', header: 'Status', width: 120}
]

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function finishName(row: FinishRow) {
  return row.name || 'Unnamed finish'
}

/**
 * A read-only summary of the pricing and stock fields next to it, built with
 * the same components as the rest of the dashboard.
 */
export function DemoStockOverview() {
  const price = asNumber(useSiblingFieldValue('price'))
  const leadTime = asNumber(useSiblingFieldValue('leadTime'))
  const available = Boolean(useSiblingFieldValue('inStock'))
  const finishes = (useSiblingFieldValue('finishes') ?? []) as Array<FinishRow>
  const totalStock = finishes.reduce((sum, row) => sum + asNumber(row.stock), 0)
  const status = stockStatus(totalStock)
  const soldOut = finishes.filter(row => asNumber(row.stock) <= 0)
  const prices = finishes.map(row => price + asNumber(row.surcharge))
  const lowest = prices.length ? Math.min(...prices) : price
  const highest = prices.length ? Math.max(...prices) : price
  return (
    <Field
      label="Stock overview"
      description="Calculated from the price and the finishes below"
      className={styles.DemoStockOverview()}
    >
      <DataList
        orientation="vertical"
        className={styles.DemoStockOverview.stats()}
      >
        <DataListItem>
          <DataListLabel>Price</DataListLabel>
          <DataListValue className={styles.DemoStockOverview.value()}>
            {lowest === highest
              ? euro.format(lowest)
              : `${euro.format(lowest)} – ${euro.format(highest)}`}
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Units in stock</DataListLabel>
          <DataListValue className={styles.DemoStockOverview.value()}>
            {totalStock}
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Lead time</DataListLabel>
          <DataListValue className={styles.DemoStockOverview.value()}>
            {leadTime ? `${leadTime} weeks` : 'Ships now'}
          </DataListValue>
        </DataListItem>
        <DataListItem>
          <DataListLabel>Status</DataListLabel>
          <DataListValue>
            {available ? (
              <StockBadge status={status} />
            ) : (
              <Badge size="sm">Hidden from shop</Badge>
            )}
          </DataListValue>
        </DataListItem>
      </DataList>
      {finishes.length > 0 && (
        <div
          className={styles.DemoStockOverview.table()}
          style={{height: 34 + finishes.length * 44}}
        >
          <Table
            aria-label="Stock per finish"
            items={finishes}
            columns={columns}
            dependencies={[price]}
          >
            {row => (
              <TableRow id={row._id} textValue={finishName(row)}>
                <TableCell>
                  <span className={styles.DemoStockOverview.finish()}>
                    <span
                      className={styles.DemoStockOverview.finish.swatch()}
                      style={{background: row.swatch || 'transparent'}}
                    />
                    {finishName(row)}
                  </span>
                </TableCell>
                <TableCell align="end">
                  {euro.format(price + asNumber(row.surcharge))}
                </TableCell>
                <TableCell align="end">{asNumber(row.stock)}</TableCell>
                <TableCell>
                  <StockBadge status={stockStatus(asNumber(row.stock))} />
                </TableCell>
              </TableRow>
            )}
          </Table>
        </div>
      )}
      {available && soldOut.length > 0 && (
        <Alert variant="warning">
          <AlertTitle>
            {soldOut.length === 1
              ? `${finishName(soldOut[0])} is sold out`
              : `${soldOut.length} finishes are sold out`}
          </AlertTitle>
          <AlertDescription>
            Orders will be made to order and ship in {leadTime || 'a few'}{' '}
            weeks. The product page shows this automatically.
          </AlertDescription>
        </Alert>
      )}
    </Field>
  )
}
