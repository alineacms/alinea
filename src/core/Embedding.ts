/** Stable identity of a compatible vector coordinate space. No credentials. */
export interface EmbeddingSpace {
  provider: string
  model: string
  revision: string
  preprocessing: string
  dimensions: number
  metric: 'cosine' | 'l2' | 'dot'
  encoding: 'float32-le'
}

/** Declarative preparation only. Providers run separately from content saves. */
export interface EntryEmbedding {
  source: 'searchableText'
  space: EmbeddingSpace
}
