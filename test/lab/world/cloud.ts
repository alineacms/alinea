/**
 * Alinea Cloud as `CloudRemote` sees it: the tree, blobs and write endpoints
 * of its API, answering in the shapes the cloud does. It keeps no content of
 * its own here: it reads and commits the repository on the git host.
 */
import type {CommitRequest} from '#/core/db/CommitRequest.js'
import type {SerializedResponse} from '../shared/protocol.js'
import {bus} from './bus.js'
import {github} from './github.js'
import {jsonResponse, network, requestJson, textResponse} from './network.js'

class CloudServer {
  node = 'cloud'

  async serve(
    path: string,
    body: any,
    from: string
  ): Promise<SerializedResponse> {
    const head = github.head
    switch (path) {
      case '/api/v1/tree': {
        const same = body.sha === head.contentSha
        bus.log({
          node: this.node,
          kind: 'read',
          text: same
            ? `${from} is current at ${body.sha.slice(0, 7)}`
            : `${from} is behind: answer tree ${head.contentSha.slice(0, 7)}`
        })
        return jsonResponse({success: true, data: same ? null : head.tree})
      }
      case '/api/v1/blobs': {
        const form = new FormData()
        for (const sha of body.shas as Array<string>) {
          const blob = github.blobs.get(sha)
          if (blob) form.append(sha, new Blob([blob as BlobPart]), sha)
        }
        bus.log({
          node: this.node,
          kind: 'read',
          text: `${from} downloads ${body.shas.length} blob(s)`
        })
        const response = new Response(form)
        return {
          status: 200,
          headers: [['content-type', response.headers.get('content-type')!]],
          body: new Uint8Array(await response.arrayBuffer())
        }
      }
      case '/api/v1/write': {
        const result = await github.write(
          body as CommitRequest,
          `cloud for ${from}`
        )
        if ('conflict' in result) {
          bus.log({
            node: this.node,
            kind: 'conflict',
            text: `✗ write from ${from} rejected: the branch moved to ${result.conflict.actualSha.slice(0, 7)}`
          })
          return jsonResponse({success: false, error: result.conflict}, 409)
        }
        return jsonResponse({success: true, data: result})
      }
    }
    return textResponse(404, `The lab cloud does not serve ${path}`)
  }
}

export const cloud = new CloudServer()

network.route(url => {
  if (url.host !== 'cloud.lab') return
  return {
    node: cloud.node,
    handle: (request, from) =>
      cloud.serve(url.pathname, request.body ? requestJson(request) : {}, from)
  }
})
