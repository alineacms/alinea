import type {EmbeddingSpace, EmbeddingTarget} from './Embedding.js'

export interface EmbeddingSearchQuery {
  /** Exact derived revision at which the caller selected/authorized candidates. */
  revision: string
  candidateIds: ReadonlyArray<string>
  space: EmbeddingSpace
  vector: ReadonlyArray<number>
  limit: number
}

export interface EmbeddingMatch {
  id: string
  owner: EmbeddingTarget['owner']
  slot: string
  chunk: string
  /** Smaller is closer: cosine distance, Euclidean L2, or negative dot product. */
  distance: number
}

export interface EmbeddingSearchResult {
  revision: string
  spaceId: string
  scope: 'provided-candidates'
  candidates: number
  exact: true
  matches: Array<EmbeddingMatch>
}

/** Exact over the supplied vectors, not an assertion about global candidate coverage. */
export function embeddingDistance(
  metric: EmbeddingSpace['metric'],
  left: ReadonlyArray<number>,
  right: ReadonlyArray<number>
): number {
  if (!left.length || left.length !== right.length)
    throw new Error('Embedding dimension mismatch')
  let dot = 0,
    leftNorm = 0,
    rightNorm = 0,
    squared = 0
  for (let i = 0; i < left.length; i++) {
    const a = left[i],
      b = right[i]
    if (!Number.isFinite(a) || !Number.isFinite(b))
      throw new Error('Nonfinite embedding component')
    dot += a * b
    leftNorm += a * a
    rightNorm += b * b
    squared += (a - b) ** 2
  }
  if (![dot, leftNorm, rightNorm, squared].every(Number.isFinite))
    throw new Error('Embedding distance overflow')
  switch (metric) {
    case 'dot':
      return -dot
    case 'l2':
      return Math.sqrt(squared)
    case 'cosine': {
      if (!leftNorm || !rightNorm)
        throw new Error('Cosine embedding must be nonzero')
      const similarity = dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
      return 1 - Math.max(-1, Math.min(1, similarity))
    }
    default:
      throw new Error('Unsupported embedding metric')
  }
}
