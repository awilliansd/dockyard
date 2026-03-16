import { useCallback, useMemo } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { keymap } from '@codemirror/view'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { python } from '@codemirror/lang-python'
import { rust } from '@codemirror/lang-rust'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import type { Extension } from '@codemirror/state'

interface CodeMirrorEditorProps {
  value: string
  extension: string
  onChange: (value: string) => void
  onSave: () => void
  readOnly?: boolean
}

function getLanguageExtension(ext: string): Extension[] {
  const map: Record<string, () => Extension> = {
    '.ts': () => javascript({ typescript: true }),
    '.tsx': () => javascript({ typescript: true, jsx: true }),
    '.js': () => javascript(),
    '.jsx': () => javascript({ jsx: true }),
    '.mjs': () => javascript(),
    '.cjs': () => javascript(),
    '.json': () => json(),
    '.jsonc': () => json(),
    '.css': () => css(),
    '.scss': () => css(),
    '.sass': () => css(),
    '.less': () => css(),
    '.html': () => html(),
    '.htm': () => html(),
    '.md': () => markdown(),
    '.mdx': () => markdown(),
    '.py': () => python(),
    '.rs': () => rust(),
    '.sql': () => sql(),
    '.yaml': () => yaml(),
    '.yml': () => yaml(),
    '.xml': () => xml(),
    '.svg': () => xml(),
  }
  const factory = map[ext]
  return factory ? [factory()] : []
}

export function CodeMirrorEditor({ value, extension, onChange, onSave, readOnly }: CodeMirrorEditorProps) {
  const handleChange = useCallback((val: string) => {
    onChange(val)
  }, [onChange])

  const extensions = useMemo(() => {
    const lang = getLanguageExtension(extension)
    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: () => {
        onSave()
        return true
      },
    }])
    return [...lang, saveKeymap]
  }, [extension, onSave])

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={oneDark}
      extensions={extensions}
      onChange={handleChange}
      readOnly={readOnly}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLineGutter: true,
        highlightActiveLine: true,
        foldGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        indentOnInput: true,
        syntaxHighlighting: true,
      }}
      className="h-full [&_.cm-editor]:h-full [&_.cm-scroller]:!font-mono"
      style={{ height: '100%' }}
    />
  )
}
