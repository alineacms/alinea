import {PDFDocument, PDFName, StandardFonts} from '@cantoo/pdf-lib'
import {expect, test} from 'bun:test'
import sharp from 'sharp'
import {defaultPdfResize} from './ImageTransform.js'
import {transformImage} from './TransformImage.js'

const resize = defaultPdfResize

// Generating a noisy scan is slow on CI runners, create each size once
const scans = new Map<string, Promise<Buffer>>()

function scanImage(width: number, height: number) {
  const key = `${width}x${height}`
  let jpeg = scans.get(key)
  if (!jpeg) {
    jpeg = sharp({
      create: {
        width,
        height,
        channels: 3,
        background: '#888',
        noise: {type: 'gaussian', mean: 128, sigma: 40}
      }
    })
      .blur(2)
      .jpeg({quality: 95})
      .toBuffer()
    scans.set(key, jpeg)
  }
  return jpeg
}

async function scan(pages: number, width = 2480, height = 3508) {
  const jpeg = await scanImage(width, height)
  const pdf = await PDFDocument.create()
  const image = await pdf.embedJpg(jpeg)
  for (let i = 0; i < pages; i++)
    pdf.addPage([595, 842]).drawImage(image, {width: 595, height: 842})
  return pdf
}

function blob(bytes: Uint8Array) {
  return new Blob([bytes as BlobPart], {type: 'application/pdf'})
}

test('the images of a pdf are scaled down', async () => {
  const pdf = await scan(2)
  pdf.getForm().createTextField('name').addToPage(pdf.getPage(0))
  const original = blob(await pdf.save())
  const compressed = await transformImage(original, 'scan.pdf', {resize})
  expect(compressed.size).toBeLessThan(original.size * 0.5)
  expect(compressed.type).toBe('application/pdf')
  const loaded = await PDFDocument.load(await compressed.arrayBuffer())
  expect(loaded.getPageCount()).toBe(2)
  expect(loaded.getForm().getTextField('name')).toBeDefined()
})

test('pdfs that do not get smaller, or can not be rewritten, are kept', async () => {
  const text = await PDFDocument.create()
  const font = await text.embedFont(StandardFonts.Helvetica)
  text.addPage().drawText('Hello', {font})
  const textOnly = blob(await text.save())
  expect(await transformImage(textOnly, 'text.pdf', {resize})).toBe(textOnly)
  const small = blob(await (await scan(1, 800, 1000)).save())
  expect(await transformImage(small, 'small.pdf', {resize})).toBe(small)
  const encrypted = await scan(1)
  encrypted.encrypt({userPassword: 'secret', ownerPassword: 'secret'})
  const locked = blob(await encrypted.save())
  expect(await transformImage(locked, 'locked.pdf', {resize})).toBe(locked)
  const signed = await scan(1)
  signed.context.register(
    signed.context.obj({Type: 'Sig', ByteRange: [0, 0, 0, 0]})
  )
  const signedPdf = blob(await signed.save())
  expect(await transformImage(signedPdf, 'signed.pdf', {resize})).toBe(
    signedPdf
  )
  const archive = await scan(1)
  archive.catalog.set(PDFName.of('OutputIntents'), archive.context.obj([]))
  const archivePdf = blob(await archive.save())
  expect(await transformImage(archivePdf, 'archive.pdf', {resize})).toBe(
    archivePdf
  )
  const broken = blob(new TextEncoder().encode('%PDF-1.7 not a pdf'))
  expect(await transformImage(broken, 'broken.pdf', {resize})).toBe(broken)
  const large = blob(await (await scan(1)).save())
  expect(await transformImage(large, 'large.pdf', {})).toBe(large)
})
