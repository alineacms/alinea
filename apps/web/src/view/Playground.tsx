import Editor from '@monaco-editor/react'

export default function Playground() {
  return (
    <>
      <style>{`#__next {height: 100%}`}</style>
      <div>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          defaultValue="// some comment"
        />
      </div>
    </>
  )
}
