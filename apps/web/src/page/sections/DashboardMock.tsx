import styler from '@alinea/styler'
import NextImage from 'next/image'
import heroBg from '@/assets/hero-alinea.jpg'
import css from './DashboardMock.module.scss'

const styles = styler(css)

export type DashboardMockMode = 'light' | 'dark' | 'auto'

export interface DashboardMockProps {
  /** Color scheme, `auto` follows the website theme */
  mode?: DashboardMockMode
  className?: string
}

function IconFile() {
  return (
    <svg viewBox="0 0 24 24" className={styles.root.svg()} aria-hidden="true">
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </svg>
  )
}

function IconImage() {
  return (
    <svg viewBox="0 0 24 24" className={styles.root.svg()} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  )
}

function IconChevron({direction}: {direction: 'down' | 'right'}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.root.svg('small')}
      aria-hidden="true"
    >
      <path d={direction === 'down' ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'} />
    </svg>
  )
}

function IconSearch() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.root.svg('small')}
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

function IconPlus() {
  return (
    <svg
      viewBox="0 0 24 24"
      className={styles.root.svg('small')}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** Static illustration of the Alinea dashboard, rendered at 960×600 */
export function DashboardMock({mode = 'light', className}: DashboardMockProps) {
  return (
    <div
      className={styles.root(styler.merge({className}), mode)}
      role="img"
      aria-label="The Alinea dashboard editing a blog post next to a live preview"
    >
      <div className={styles.root.rail()} aria-hidden="true">
        <span className={styles.root.rail.button('active')}>
          <IconFile />
        </span>
        <span className={styles.root.rail.button()}>
          <IconImage />
        </span>
        <span className={styles.root.grow()} />
        <span className={styles.root.rail.avatar()}>JD</span>
      </div>
      <div className={styles.root.tree()} aria-hidden="true">
        <div className={styles.root.tree.workspace()}>
          <span>Acme website</span>
          <IconChevron direction="down" />
        </div>
        <div className={styles.root.tree.search()}>
          <IconSearch />
          <span>Search</span>
          <span className={styles.root.grow()} />
          <span className={styles.root.tree.shortcut()}>⌘K</span>
        </div>
        <div className={styles.root.tree.items()}>
          <div className={styles.root.tree.item('level1')}>Homepage</div>
          <div className={styles.root.tree.item()}>
            <IconChevron direction="down" />
            <span>Blog</span>
            <span className={styles.root.grow()} />
            <span className={styles.root.tree.count()}>24</span>
          </div>
          <div className={styles.root.tree.item('level2', 'selected')}>
            Introducing 2.0
          </div>
          <div className={styles.root.tree.item('level2')}>
            Spring release notes
          </div>
          <div className={styles.root.tree.item('level2')}>
            <span>Hello world</span>
            <span className={styles.root.tree.draft()} />
          </div>
          <div className={styles.root.tree.item()}>
            <IconChevron direction="right" />
            <span>Docs</span>
          </div>
          <div className={styles.root.tree.item('level1')}>About us</div>
          <div className={styles.root.tree.item('level1')}>Contact</div>
        </div>
        <span className={styles.root.grow()} />
        <div className={styles.root.tree.create()}>
          <IconPlus />
          <span>Create new</span>
        </div>
      </div>
      <div className={styles.root.editor()} aria-hidden="true">
        <div className={styles.root.editor.toolbar()}>
          <span className={styles.root.muted()}>Blog</span>
          <span className={styles.root.muted()}>/</span>
          <span className={styles.root.editor.crumb()}>Introducing 2.0</span>
          <span className={styles.root.grow()} />
          <span className={styles.root.editor.status()}>Draft</span>
          <span className={styles.root.editor.publish()}>Publish</span>
        </div>
        <div className={styles.root.editor.tabs()}>
          <span className={styles.root.editor.tab('active')}>Document</span>
          <span className={styles.root.editor.tab()}>Metadata</span>
          <span className={styles.root.editor.tab()}>History</span>
        </div>
        <div className={styles.root.editor.fields()}>
          <div className={styles.root.field()}>
            <span className={styles.root.field.label()}>Title</span>
            <div className={styles.root.field.input('title')}>
              Introducing Alinea 2.0
            </div>
          </div>
          <div className={styles.root.editor.row()}>
            <div className={styles.root.field('grow')}>
              <span className={styles.root.field.label()}>Author</span>
              <div className={styles.root.field.input('compact')}>
                <span className={styles.root.field.tag()}>Jane Doe</span>
              </div>
            </div>
            <div className={styles.root.field('date')}>
              <span className={styles.root.field.label()}>Published</span>
              <div className={styles.root.field.input()}>23-09-2026</div>
            </div>
          </div>
          <div className={styles.root.field()}>
            <span className={styles.root.field.label()}>Cover image</span>
            <div className={styles.root.field.media()}>
              <NextImage
                src={heroBg}
                alt=""
                sizes="72px"
                className={styles.root.field.thumb()}
              />
              <div className={styles.root.field.file()}>
                <span className={styles.root.field.filename()}>
                  launch-cover.jpg
                </span>
                <span className={styles.root.field.meta()}>
                  2000 × 936 · media/blog
                </span>
              </div>
            </div>
          </div>
          <div className={styles.root.field()}>
            <span className={styles.root.field.label()}>Body</span>
            <div className={styles.root.field.rich()}>
              <div className={styles.root.field.rich.toolbar()}>
                <span>H2</span>
                <span>B</span>
                <span className={styles.root.field.rich.italic()}>I</span>
                <span className={styles.root.field.rich.underline()}>Link</span>
                <span>• List</span>
                <span>Image</span>
              </div>
              <div className={styles.root.field.rich.content()}>
                <span className={styles.root.field.rich.heading()}>
                  A dashboard your editors will enjoy
                </span>
                <span>
                  Version 2 ships a rebuilt editing experience, fast full-text
                  search and a new media library
                  <span className={styles.root.field.rich.caret()} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.root.preview()} aria-hidden="true">
        <div className={styles.root.preview.bar()}>
          <span className={styles.root.preview.live()} />
          <div className={styles.root.preview.url()}>
            acme.com/blog/introducing-2
          </div>
        </div>
        <div className={styles.root.preview.page()}>
          <div className={styles.root.preview.nav()}>
            <span className={styles.root.preview.logo()}>acme</span>
            <span className={styles.root.preview.menu()} />
          </div>
          <span className={styles.root.preview.date()}>
            23 September 2026 · Jane Doe
          </span>
          <span className={styles.root.preview.title()}>
            Introducing Alinea 2.0
          </span>
          <NextImage
            src={heroBg}
            alt=""
            sizes="220px"
            className={styles.root.preview.cover()}
          />
          <span className={styles.root.preview.heading()}>
            A dashboard your editors will enjoy
          </span>
          <span className={styles.root.preview.text()}>
            Version 2 ships a rebuilt editing experience, fast full-text search
            and a new media library
          </span>
        </div>
      </div>
    </div>
  )
}
