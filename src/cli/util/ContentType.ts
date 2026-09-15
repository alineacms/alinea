// Source: https://github.com/evanw/esbuild/blob/71be8bc24e70609ab50a80e90a17a1f5770c89b5/internal/helpers/mime.go#L5
const contentTypes: Record<string, string> = {
  // Text
  '.css': 'text/css; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.mjs': 'text/javascript; charset=utf-8',
  '.xml': 'text/xml; charset=utf-8',

  // Images
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',

  // Fonts
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.sfnt': 'font/sfnt',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',

  // Other
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm'
}

export function contentType(extension: string): string {
  return contentTypes[extension.toLowerCase()] ?? 'application/octet-stream'
}
