import {expectTypeOf, test, expect} from 'bun:test'
import {Config, Field} from '#/index.js'
import * as Edit from '#/edit.js'
import type {ImageLink} from '#/field/link/ImageLink.js'
import type {Infer} from './Infer.js'

const customFields = {
  alt: Field.text('Alt'),
  caption: Field.text('Caption')
}
const Gallery = Config.type('Gallery', {
  fields: {
    images: Field.image.multiple('Images', {fields: customFields})
  }
})

test('infers stored gallery content separately from resolved images', () => {
  const images = Edit.links(Gallery.images)
  images.addImage('image-id', {alt: 'Alt text', caption: 'Caption text'})
  const gallery = {images: images.value()} satisfies Infer.Stored<
    typeof Gallery
  >
  const [image] = gallery.images

  expectTypeOf(image.alt).toEqualTypeOf<string>()
  expectTypeOf(image.caption).toEqualTypeOf<string>()
  expectTypeOf<Infer<typeof Gallery>['images']>().toEqualTypeOf<
    Array<ImageLink<{alt: string; caption: string}>>
  >()
  // @ts-expect-error Stored references do not contain resolved image metadata.
  gallery satisfies Infer<typeof Gallery>
  expect(image).toMatchObject({
    _type: 'image',
    _entry: 'image-id',
    alt: 'Alt text',
    caption: 'Caption text'
  })
})

test('preserves custom stored fields for single and multiple link editors', () => {
  const fields = {
    image: Field.image('Image', {fields: customFields}),
    files: Field.file.multiple('Files', {fields: customFields}),
    entries: Field.entry.multiple('Entries', {fields: customFields}),
    urls: Field.url.multiple('URLs', {fields: customFields})
  }
  const custom = {alt: 'Alt text', caption: 'Caption text'}
  const image = Edit.link(fields.image).addImage('image-id', custom).value()
  const files = Edit.links(fields.files).addFile('file-id', custom).value()
  const entries = Edit.links(fields.entries)
    .addEntry('entry-id', custom)
    .value()
  const urls = Edit.links(fields.urls)
    .addUrl({url: 'https://example.com', title: 'Example'}, custom)
    .value()

  expectTypeOf(image.alt).toEqualTypeOf<string>()
  expectTypeOf(files[0].caption).toEqualTypeOf<string>()
  expectTypeOf(entries[0].caption).toEqualTypeOf<string>()
  expectTypeOf(urls[0].caption).toEqualTypeOf<string>()
  expectTypeOf<Infer.Stored<typeof customFields>>().toEqualTypeOf<{
    alt: string
    caption: string
  }>()
  for (const value of [image, ...files, ...entries, ...urls]) {
    expect(value).toMatchObject(custom)
  }
})
