import type {EV} from './Expr.js'

export type Update<Row> = Partial<{[K in keyof Row]: EV<Row[K]>}>
