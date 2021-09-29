// Adapted from: https://github.com/yjs/y-websocket/blob/5280aeb736508bc70da4f00f970995f35488b666/bin/utils.js

import {docFromEntry} from '@alinea/core/Doc'
import {Hub} from '@alinea/core/Hub'
import {Schema} from '@alinea/core/Schema'
import {IncomingMessage} from 'http'
import {createDecoder, readVarUint, readVarUint8Array} from 'lib0/decoding'
import {
  createEncoder,
  length,
  toUint8Array,
  writeVarUint,
  writeVarUint8Array
} from 'lib0/encoding'
import {createMutex} from 'lib0/mutex'
import {WebSocket} from 'ws'
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates
} from 'y-protocols/awareness'
import {readSyncMessage, writeSyncStep1, writeUpdate} from 'y-protocols/sync'
import * as Y from 'yjs'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1

type AwarenessChanges = {
  added: Array<number>
  updated: Array<number>
  removed: Array<number>
}

class SharedDoc extends Y.Doc {
  mux = createMutex()
  conns: Map<WebSocket, Set<number>> = new Map()
  awareness: Awareness

  constructor(protected onAllConnectionsClosed: () => void) {
    super({gc: true})

    this.conns = new Map()

    this.awareness = new Awareness(this)
    this.awareness.setLocalState(null)

    const awarenessChangeHandler = (
      {added, updated, removed}: AwarenessChanges,
      conn: WebSocket | null
    ) => {
      const changedClients = added.concat(updated, removed)
      if (conn !== null) {
        const connControlledIDs = this.conns.get(conn)
        if (connControlledIDs !== undefined) {
          added.forEach(clientID => {
            connControlledIDs.add(clientID)
          })
          removed.forEach(clientID => {
            connControlledIDs.delete(clientID)
          })
        }
      }
      // broadcast awareness update
      const encoder = createEncoder()
      writeVarUint(encoder, MESSAGE_AWARENESS)
      writeVarUint8Array(
        encoder,
        encodeAwarenessUpdate(this.awareness, changedClients)
      )
      const buff = toUint8Array(encoder)
      this.conns.forEach((_, conn) => {
        this.send(conn, buff)
      })
    }
    this.awareness.on('update', awarenessChangeHandler)
    this.on('update', (update: Uint8Array) => this.updateHandler(update))
  }

  updateHandler(update: Uint8Array) {
    const encoder = createEncoder()
    writeVarUint(encoder, MESSAGE_SYNC)
    writeUpdate(encoder, update)
    const message = toUint8Array(encoder)
    this.conns.forEach((_, conn) => this.send(conn, message))
  }

  receive(conn: WebSocket, message: Uint8Array) {
    const encoder = createEncoder()
    const decoder = createDecoder(message)
    const messageType = readVarUint(decoder)
    switch (messageType) {
      case MESSAGE_SYNC:
        writeVarUint(encoder, MESSAGE_SYNC)
        readSyncMessage(decoder, encoder, this, null)
        if (length(encoder) > 1) {
          this.send(conn, toUint8Array(encoder))
        }
        break
      case MESSAGE_AWARENESS: {
        applyAwarenessUpdate(this.awareness, readVarUint8Array(decoder), conn)
        break
      }
    }
  }

  send(conn: WebSocket, message: Uint8Array) {
    const isClosed =
      conn.readyState !== WebSocket.CONNECTING &&
      conn.readyState !== WebSocket.OPEN
    if (isClosed) this.close(conn)
    try {
      conn.send(message, err => {
        if (err != null) this.close(conn)
      })
    } catch (e) {
      this.close(conn)
    }
  }

  close(conn: WebSocket) {
    if (this.conns.has(conn)) {
      const controlledIds = this.conns.get(conn)
      this.conns.delete(conn)
      removeAwarenessStates(
        this.awareness,
        Array.from(controlledIds || []),
        null
      )
      if (this.conns.size === 0) this.onAllConnectionsClosed()
    }
    conn.close()
  }
}

export class DocServer {
  pingTimeout = 30000
  docs = new Map()

  constructor(protected hub: Hub) {}

  async getDoc(path: string, gc = true): Promise<SharedDoc> {
    if (this.docs.has(path)) return this.docs.get(path)
    const doc = new SharedDoc(() => {
      doc.destroy()
      this.docs.delete(path)
    })
    const entry = await this.hub.content.get(path)
    if (entry) {
      const channel = Schema.getChannel(this.hub.schema, entry.$channel)
      if (channel) docFromEntry(channel, entry, doc)
    }
    doc.on('update', (update: Uint8Array) => {
      const updated = doc.getMap('root').toJSON()
      this.hub.content.put(path, updated)
    })

    this.docs.set(path, doc)
    return doc
  }

  connect = async (socket: WebSocket, req: IncomingMessage) => {
    const path = req.url!
    socket.binaryType = 'arraybuffer'
    // get doc, initialize if it does not exist yet
    const doc = await this.getDoc(path, true)
    doc.conns.set(socket, new Set())

    // listen and reply to events
    socket.on('message', (message: ArrayBuffer) =>
      doc.receive(socket, new Uint8Array(message))
    )

    // Check if connection is still alive
    let pongReceived = true
    const pingInterval = setInterval(() => {
      if (!pongReceived) {
        if (doc.conns.has(socket)) {
          doc.close(socket)
        }
        clearInterval(pingInterval)
      } else if (doc.conns.has(socket)) {
        pongReceived = false
        try {
          socket.ping()
        } catch (e) {
          doc.close(socket)
          clearInterval(pingInterval)
        }
      }
    }, this.pingTimeout)
    socket.on('close', () => {
      doc.close(socket)
      clearInterval(pingInterval)
    })
    socket.on('pong', () => {
      pongReceived = true
    })
    // put the following in a variables in a block so the interval handlers don't keep in in
    // scope
    {
      // send sync step 1
      const encoder = createEncoder()
      writeVarUint(encoder, MESSAGE_SYNC)
      writeSyncStep1(encoder, doc)
      doc.send(socket, toUint8Array(encoder))
      const awarenessStates = doc.awareness.getStates()
      if (awarenessStates.size > 0) {
        const encoder = createEncoder()
        writeVarUint(encoder, MESSAGE_AWARENESS)
        writeVarUint8Array(
          encoder,
          encodeAwarenessUpdate(
            doc.awareness,
            Array.from(awarenessStates.keys())
          )
        )
        doc.send(socket, toUint8Array(encoder))
      }
    }
  }
}
