import type {Message, Phase, Row} from './initial-sync.worker.js'

// Snapshot storage reads blobs with FileReaderSync, which only exists in
// workers, so the bench runs in one as the dashboard does. Each phase runs in
// a worker of its own, as a page load would, with a Wasm heap of its own.
function run(phase: Phase) {
  return new Promise<Array<Row>>((resolve, reject) => {
    const worker = new Worker('/worker.js', {type: 'module'})
    worker.addEventListener('message', (event: MessageEvent<Message>) => {
      worker.terminate()
      const message = event.data
      if ('error' in message) reject(new Error(message.error))
      else resolve(message.rows)
    })
    worker.addEventListener('error', event => reject(event.error ?? event))
    worker.postMessage(phase)
  })
}

declare global {
  interface Window {
    bench: typeof run
  }
}

window.bench = run
