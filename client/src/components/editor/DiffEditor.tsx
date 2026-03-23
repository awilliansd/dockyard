import { useMemo, useRef, useEffect } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { MergeView } from '@codemirror/merge'
import { oneDark } from '@codemirror/theme-one-dark'
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
import type { Extension } from '@codemirror/state'

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

interface DiffEditorProps {
  original: string
  modified: string
  extension: string
}

export function DiffEditor({ original, modified, extension }: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<MergeView | null>(null)
  const wrapCompartmentA = useRef(new Compartment())
  const wrapCompartmentB = useRef(new Compartment())
  const wordWrapRef = useRef(false)

  const langExtensions = useMemo(() => getLanguageExtension(extension), [extension])

  // DOM-level Alt+Z handler so word wrap works regardless of editor focus
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        const mv = viewRef.current
        if (!mv) return
        wordWrapRef.current = !wordWrapRef.current
        const ext = wordWrapRef.current ? EditorView.lineWrapping : []
        mv.a.dispatch({ effects: wrapCompartmentA.current.reconfigure(ext) })
        mv.b.dispatch({ effects: wrapCompartmentB.current.reconfigure(ext) })
      }
    }
    container.addEventListener('keydown', handler)
    return () => container.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const compA = wrapCompartmentA.current
    const compB = wrapCompartmentB.current

    const makeExtensions = (wrapComp: Compartment): Extension[] => [
      basicSetup,
      oneDark,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      wrapComp.of([]),
      ...langExtensions,
    ]

    const view = new MergeView({
      a: {
        doc: original,
        extensions: makeExtensions(compA),
      },
      b: {
        doc: modified,
        extensions: makeExtensions(compB),
      },
      parent: containerRef.current,
      collapseUnchanged: { margin: 3, minSize: 4 },
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
      wordWrapRef.current = false
    }
  }, [original, modified, langExtensions])

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full [&_.cm-mergeView]:h-full [&_.cm-mergeView]:overflow-auto [&_.cm-scroller]:!font-mono"
      style={{ height: '100%', outline: 'none' }}
    />
  )
}
