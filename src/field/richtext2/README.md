# Rich text v2

The existing editor places React `NodeEditor` trees inside ProseMirror node
views. ProseMirror owns and synchronously mutates that DOM while React also
uses it to preserve focus and selection. With React 19, an Enter transaction
can detach React's saved selection node before React commits, causing the
documented `parentNode` crash.

The existing editor also mirrors every embedded block into Tiptap attributes,
serializes it into an HTML data attribute, keeps a session-global block cache,
and writes the entire document array after every transaction. Those layers are
needed primarily because the block form lives inside ProseMirror.

This implementation keeps one ProseMirror document so text selection, history,
keyboard navigation and native block dragging remain continuous. Embedded
blocks are atom node views containing only a stable DOM host. React portals the
`NodeEditor` into that host; ProseMirror owns the host and React owns everything
inside it, so neither renderer mutates the other's DOM.

`RichTextDocument.ts` is the pure conversion boundary. ProseMirror stores only
each block's type and `_id`, never its form value. `RichTextState.ts` reconciles
the document order into Jotai while retaining existing block `ReactiveNode`
instances. `RichTextBlocks.ts` observes only block identity and order, so typing
in a nested field does not rerender the document or surrounding text.

The toolbar, embedded block shell and insert menu use the v2 component surface
from `src/components.ts`. Their small layout wrappers are styled locally with
the v2 `--alinea-*` theme tokens.

Embedded blocks deliberately reuse the same `ListRow` composition as the
previous editor. ProseMirror handles their document-level selection and native
dragging, including drops between text paragraphs.
Toolbar ownership follows the nearest `[data-richtext-field]`, so an outer
toolbar remains open in ordinary block fields and yields only when a nested rich
text editor receives focus.

The production field registry maps the existing rich-text view keys to this
implementation, so `Field.richText` requires no public API change.

`RichTextField.stories.tsx` exposes block, plain-text, empty and read-only Ladle
fixtures. The same fixture is used by the browser component tests, and it reads
the production view registry instead of installing a test-only override.
