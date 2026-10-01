/** A pdf of one page that shows a jpeg image, drawn over the whole page */
export function pdfWithImage(
  jpeg: Uint8Array,
  width: number,
  height: number
): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const content = encoder.encode('q 612 0 0 792 0 0 cm /Im0 Do Q')
  const objects: Array<Array<Uint8Array>> = [
    [encoder.encode('<< /Type /Catalog /Pages 2 0 R >>')],
    [encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [
      encoder.encode(
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
          '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>'
      )
    ],
    [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
          '/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ' +
          `/Length ${jpeg.byteLength} >>\nstream\n`
      ),
      jpeg,
      encoder.encode('\nendstream')
    ],
    [
      encoder.encode(`<< /Length ${content.byteLength} >>\nstream\n`),
      content,
      encoder.encode('\nendstream')
    ]
  ]
  const parts: Array<Uint8Array> = [encoder.encode('%PDF-1.7\n')]
  const offsets: Array<number> = []
  let size = parts[0].byteLength
  function push(part: Uint8Array) {
    parts.push(part)
    size += part.byteLength
  }
  objects.forEach((object, index) => {
    offsets.push(size)
    push(encoder.encode(`${index + 1} 0 obj\n`))
    for (const part of object) push(part)
    push(encoder.encode('\nendobj\n'))
  })
  const xref = size
  push(
    encoder.encode(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets
          .map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`)
          .join('') +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
        `startxref\n${xref}\n%%EOF\n`
    )
  )
  const pdf = new Uint8Array(size)
  let offset = 0
  for (const part of parts) {
    pdf.set(part, offset)
    offset += part.byteLength
  }
  return pdf
}
