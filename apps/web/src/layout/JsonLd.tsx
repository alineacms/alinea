export interface JsonLdProps {
  /** Structured data describing the page, see https://schema.org */
  data: Record<string, unknown>
}

/** Structured data for search engines, rendered as a JSON-LD script */
export function JsonLd({data}: JsonLdProps) {
  // Escape < so the content can never close the script tag
  const json = JSON.stringify({'@context': 'https://schema.org', ...data})
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{__html: json.replace(/</g, '\\u003c')}}
    />
  )
}
