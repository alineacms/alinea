import {generateNKeysBetween} from '#/core/util/FractionalIndexing.js'
import {locales} from './initial-sync.cms.js'

export interface ContentFile {
  path: string
  contents: Uint8Array
}

const words =
  'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(
    ' '
  )
const base64 =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** A deterministic number in [0, 1) for a seed. */
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}
function pick<T>(list: ReadonlyArray<T>, seed: number): T {
  return list[Math.floor(noise(seed) * list.length)]
}
function text(seed: number, count: number) {
  return Array.from(
    {length: count},
    (_, i) => words[(seed * 7 + i * 13) % words.length]
  ).join(' ')
}
function key(seed: number, i: number) {
  return `k${seed.toString(36)}x${i}`
}

/**
 * Files of a large multilingual site: pages nested five levels deep and
 * articles in four locales, with rich text linking other entries, blocks and
 * images, and a media library holding about a third of all files.
 */
export function content(size: number): Array<ContentFile> {
  const files = Array<ContentFile>()
  const encoder = new TextEncoder()
  function add(path: string, record: object) {
    files.push({
      path,
      contents: encoder.encode(JSON.stringify(record, null, 2))
    })
  }
  const people = Math.round(size * 0.04)
  const mediaFiles = Math.round(size * 0.3)
  const folders = Math.max(1, Math.round(mediaFiles / 40))
  // Translations are counted per file: most entries exist in every locale.
  const pages = Math.round((size * 0.46) / locales.length / 0.9)
  const articles = Math.round((size * 0.2) / locales.length / 0.8)

  // Media folders nest three levels deep, files spread over them.
  const folderPaths = Array<string>()
  const folderKeys = generateNKeysBetween(null, null, folders)
  for (let f = 0; f < folders; f++) {
    const parent = f < 8 ? 'media' : folderPaths[Math.floor(noise(f) * f)]
    const path = `${parent}/folder-${f}`
    if (path.split('/').length > 4) {
      folderPaths.push(folderPaths[f % 8])
      continue
    }
    folderPaths.push(path)
    add(`${path}.json`, {
      _id: `folder-${f}`,
      _type: 'MediaLibrary',
      _index: folderKeys[f],
      ...(f < 8 ? {_root: 'media'} : {}),
      title: `Folder ${f}`
    })
  }
  const mediaIds = Array<string>()
  const fileKeys = generateNKeysBetween(null, null, 50)
  for (let m = 0; m < mediaFiles; m++) {
    const id = `media-${m}`
    const image = m % 5 !== 0
    const extension = image ? '.jpg' : '.pdf'
    mediaIds.push(id)
    const preview = image
      ? `data:image/webp;base64,${Array.from({length: 1500 + (m % 3000)}, (_, i) => base64[(m * 31 + i * 7) % 64]).join('')}`
      : undefined
    add(`${folderPaths[m % folderPaths.length]}/file-${m}.json`, {
      _id: id,
      _type: 'MediaFile',
      _index: fileKeys[m % 50],
      title: `file ${m}`,
      location: `/media/file-${m}.${id}${extension}`,
      extension,
      size: 10_000 + m * 37,
      hash: m.toString(16),
      width: image ? 1600 : null,
      height: image ? 900 : null,
      ...(image
        ? {preview, averageColor: '#76526833', thumbHash: '2UeGEgQTeHonZ/dghx'}
        : {})
    })
  }
  function imageLink(seed: number) {
    return {
      _id: key(seed, 0),
      _type: 'image',
      _index: 'a0',
      _entry: pick(mediaIds, seed)
    }
  }

  // Ids linked from rich text and link fields.
  const linkable = [
    ...Array.from({length: pages}, (_, i) => `page-${i}`),
    ...Array.from({length: articles}, (_, i) => `article-${i}`)
  ]
  function entryLink(seed: number) {
    return {
      _id: key(seed, 1),
      _type: 'entry',
      _index: 'a0',
      _entry: pick(linkable, seed)
    }
  }
  function richText(seed: number, paragraphs: number) {
    return Array.from({length: paragraphs}, (_, i) => {
      const s = seed * 31 + i
      if (i % 4 === 0)
        return {
          _type: 'heading',
          level: 2,
          content: [{_type: 'text', text: text(s, 5)}]
        }
      return {
        _type: 'paragraph',
        content: [
          {_type: 'text', text: text(s, 20 + (s % 30))},
          {
            _type: 'text',
            text: text(s + 1, 3),
            marks: [
              {
                _type: 'link',
                _id: key(s, 2),
                _link: 'entry',
                _entry: pick(linkable, s)
              }
            ]
          },
          {_type: 'text', text: text(s + 2, 10 + (s % 20))}
        ]
      }
    })
  }
  function blocks(seed: number, count: number) {
    const keys = generateNKeysBetween(null, null, count)
    return keys.map((index, i) => {
      const s = seed * 17 + i
      const base = {_id: key(s, 3), _index: index}
      switch (i % 3) {
        case 0:
          return {
            ...base,
            _type: 'Text',
            title: text(s, 4),
            text: richText(s, 2 + (s % 3))
          }
        case 1:
          return {
            ...base,
            _type: 'Image',
            image: imageLink(s),
            caption: text(s, 6)
          }
        default:
          return {
            ...base,
            _type: 'Cards',
            title: text(s, 3),
            links: Array.from({length: 3}, (_, j) => ({
              ...entryLink(s * 3 + j),
              _index: `a${j}`
            }))
          }
      }
    })
  }
  const metadata = (seed: number) => ({
    title: '',
    description: text(seed, 12),
    openGraph: {image: null, title: '', description: ''},
    createdAt: 1779881958,
    updatedAt: 1779881958 + seed
  })
  function status(seed: number) {
    const n = noise(seed + 0.5)
    return n < 0.05 ? '.draft' : n < 0.07 ? '.archived' : ''
  }

  const personKeys = generateNKeysBetween(null, null, people)
  for (let i = 0; i < people; i++)
    add(`people/person-${i}.json`, {
      _id: `person-${i}`,
      _type: 'Person',
      _index: personKeys[i],
      _root: 'people',
      title: `Person ${i}`,
      role: text(i, 3),
      image: imageLink(i),
      bio: text(i, 60)
    })

  // Pages form a tree of five children per page, about five levels deep.
  const branching = 5
  const pageKeys = generateNKeysBetween(null, null, branching)
  const pagePaths = new Map<string, Array<string>>()
  for (const locale of locales) {
    const paths = Array<string>()
    pagePaths.set(locale, paths)
    for (let p = 0; p < pages; p++) {
      const parent = p < branching ? -1 : Math.floor(p / branching) - 1
      const parentPath = parent === -1 ? `pages/${locale}` : paths[parent]
      // A translation is missing for one in ten pages, with its children.
      const translated =
        locale === locales[0] ||
        (parentPath && noise(p * 7 + locale.length) > 0.1)
      if (!translated) {
        paths.push('')
        continue
      }
      const slug = `${locale}-page-${p}`
      const path = `${parentPath}/${slug}`
      paths.push(path)
      const record = {
        _id: `page-${p}`,
        _type: 'Page',
        _index: pageKeys[p % branching],
        ...(parent === -1 ? {_root: 'pages'} : {}),
        title: `${locale} page ${p}`,
        code: `code-${p}`,
        intro: `${locale} ${text(p, 20)}`,
        image: imageLink(p),
        body: richText(p, 3 + (p % 6)),
        link: entryLink(p),
        blocks: blocks(p, 2 + (p % 4)),
        metadata: metadata(p)
      }
      add(`${path}${status(p)}.json`, record)
      if (status(p) === '.draft' && p % 2 === 0)
        add(`${path}.json`, {...record, title: `${record.title} (live)`})
    }
  }

  const articleKeys = generateNKeysBetween(null, null, articles)
  for (const locale of locales)
    for (let a = 0; a < articles; a++) {
      if (locale !== locales[0] && noise(a * 3 + locale.length) < 0.2) continue
      add(`articles/${locale}/${locale}-article-${a}${status(a + 1)}.json`, {
        _id: `article-${a}`,
        _type: 'Article',
        _index: articleKeys[a],
        _root: 'articles',
        title: `${locale} article ${a}`,
        date: '2026-01-01',
        intro: text(a, 30),
        image: imageLink(a + 1),
        author: [{...entryLink(a), _entry: `person-${a % people}`}],
        related: Array.from({length: 3}, (_, j) => ({
          ...entryLink(a * 3 + j),
          _index: `a${j}`
        })),
        body: richText(a, 4 + (a % 8)),
        blocks: blocks(a + 7, 1 + (a % 3)),
        metadata: metadata(a)
      })
    }
  return files
}
