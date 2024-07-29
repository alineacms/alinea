import {Request} from '@alinea/iso'
import {Store} from 'alinea/backend/Store'
import {Connection} from './Connection.js'
import {PreviewRequest} from './Resolver.js'
import {User} from './User.js'

export interface Driver {
  createStore(cwd: string): Promise<Store>
  establishConnection(): Promise<Connection>
}

export interface DriverOptions {
  createContext(request: Request): Promise<RequestContext>
}

export interface RequestContext {
  inPreview?: boolean
  user?: User
  preview?: PreviewRequest
  apiKey?: string
}

export class Driver {
  constructor(options: DriverOptions) {}
}
