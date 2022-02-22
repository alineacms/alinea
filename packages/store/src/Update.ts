import type {EV} from './Expr'

export type Update<Row> = Partial<{[K in keyof Row]: EV<Row[K]>}>
