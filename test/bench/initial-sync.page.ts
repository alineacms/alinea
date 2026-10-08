import type {BenchResult} from './initial-sync.worker.js'

// Snapshot storage reads blobs with FileReaderSync, which only exists in
// workers, so the bench runs in one as the dashboard does.
function run() {
  return new Promise<BenchResult>((resolve, reject) => {
    const worker = new Worker('/worker.js', {type: 'module'})
    worker.addEventListener('message', event => resolve(event.data))
    worker.addEventListener('error', event => reject(event.error ?? event))
  })
}

declare global {
  interface Window {
    bench: typeof run
  }
}

window.bench = run
