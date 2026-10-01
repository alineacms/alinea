import {pdfWithImage} from '#test/PdfFixture.js'
import {expect, test} from 'bun:test'
import {openPdf, listImages} from 'leanpdf'
import sharp from 'sharp'
import {compressPdf} from './CompressPdf.js'
import {smallerPdf} from './Pdf.js'

async function scan(width: number, height: number) {
  const noise = Buffer.alloc(width * height * 3)
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 251
  const jpeg = await sharp(noise, {raw: {width, height, channels: 3}})
    .jpeg({quality: 95})
    .toBuffer()
  return new Blob([pdfWithImage(jpeg, width, height)], {
    type: 'application/pdf'
  })
}

test('recompresses the images of a pdf with sharp', async () => {
  const original = await scan(3000, 3000)

  const compressed = await compressPdf(original)

  expect(compressed.size).toBeLessThan(original.size)
  expect(compressed.type).toBe('application/pdf')
  const [image] = await listImages(await openPdf(compressed))
  expect(Math.max(image.width, image.height)).toBeLessThanOrEqual(1600)
})

test('keeps a pdf that can not be made smaller', async () => {
  // Images below 20 KB are left as they are
  const original = await scan(64, 64)

  expect(await compressPdf(original)).toBe(original)
})

test('keeps the original when compressing fails or breaks signatures', async () => {
  const original = new Blob(['%PDF-1.7'])
  const smaller = new Blob(['%PDF'])
  const report = {signaturesInvalidated: false}
  const compress = (signaturesInvalidated: boolean) => async () => ({
    blob: smaller,
    report: {...report, signaturesInvalidated} as never
  })

  expect(await smallerPdf(original, compress(true))).toBe(original)
  expect(
    await smallerPdf(original, async () => {
      throw new Error('Encrypted')
    })
  ).toBe(original)
  expect((await smallerPdf(original, compress(false))).size).toBe(4)
})
