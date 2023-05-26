import type {Entry} from 'alinea/core'

export enum PreviewAction {
  Ping = '[alinea-ping]',
  Pong = '[alinea-pong]',
  Reload = '[alinea-reload]',
  Refetch = '[alinea-refetch]',
  Previous = '[alinea-previous]',
  Next = '[alinea-next]',
  Preview = '[alinea-preview]'
}

export type PreviewMessage =
  | {action: PreviewAction.Ping}
  | {action: PreviewAction.Pong}
  | {action: PreviewAction.Reload}
  | {action: PreviewAction.Refetch}
  | {action: PreviewAction.Previous}
  | {action: PreviewAction.Next}
  | {action: PreviewAction.Preview; entry: Entry}
