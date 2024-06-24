import type {PreviewMetadata, PreviewUpdate} from 'alinea/core/Resolver'

export enum PreviewAction {
  Ping = '[alinea-ping]',
  Pong = '[alinea-pong]',
  Reload = '[alinea-reload]',
  Refetch = '[alinea-refetch]',
  Previous = '[alinea-previous]',
  Next = '[alinea-next]',
  Preview = '[alinea-preview]',
  Meta = '[alinea-meta]'
}

export type PreviewMessage =
  | {action: PreviewAction.Ping}
  | {action: PreviewAction.Pong}
  | {action: PreviewAction.Reload}
  | {action: PreviewAction.Refetch}
  | {action: PreviewAction.Previous}
  | {action: PreviewAction.Next}
  | ({action: PreviewAction.Preview} & PreviewUpdate)
  | ({action: PreviewAction.Meta} & PreviewMetadata)
