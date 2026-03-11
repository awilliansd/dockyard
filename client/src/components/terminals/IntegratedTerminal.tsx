import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { getWebSocketUrl } from '@/hooks/useTerminal'
import '@xterm/xterm/css/xterm.css'

interface IntegratedTerminalProps {
  sessionId: string
  isActive: boolean
  onExit?: (code: number) => void
}

// Theme matching DevDash dark theme (shadcn/ui)
const TERMINAL_THEME = {
  background: '#0a0a0f',
  foreground: '#e4e4e7',
  cursor: '#e4e4e7',
  cursorAccent: '#0a0a0f',
  selectionBackground: '#27272a',
  selectionForeground: '#e4e4e7',
  black: '#18181b',
  red: '#ef4444',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa',
}

export function IntegratedTerminal({ sessionId, isActive, onExit }: IntegratedTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const connectWs = useCallback(() => {
    if (!termRef.current) return

    const ws = new WebSocket(getWebSocketUrl(sessionId))
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial resize
      if (fitAddonRef.current && termRef.current) {
        const dims = fitAddonRef.current.proposeDimensions()
        if (dims) {
          ws.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
        }
      }
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'output':
            termRef.current?.write(msg.data)
            break
          case 'exit':
            termRef.current?.write(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m\r\n`)
            onExit?.(msg.code)
            break
          case 'error':
            termRef.current?.write(`\r\n\x1b[31m[Error: ${msg.data}]\x1b[0m\r\n`)
            break
        }
      } catch {}
    }

    ws.onclose = () => {
      // Attempt reconnect after 2s (session may still be alive on server)
      reconnectTimerRef.current = setTimeout(() => {
        if (termRef.current && !termRef.current.element?.closest('[data-disposed]')) {
          connectWs()
        }
      }, 2000)
    }

    ws.onerror = () => {
      ws.close()
    }
  }, [sessionId, onExit])

  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current) return

    const term = new Terminal({
      theme: TERMINAL_THEME,
      fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    term.loadAddon(fitAddon)
    term.loadAddon(webLinksAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Fit to container
    requestAnimationFrame(() => {
      try { fitAddon.fit() } catch {}
    })

    // Send keystrokes to server
    term.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }))
      }
    })

    // Connect WebSocket
    connectWs()

    return () => {
      clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, connectWs])

  // Fit on resize
  useEffect(() => {
    if (!isActive) return

    const handleResize = () => {
      if (fitAddonRef.current && termRef.current) {
        try {
          fitAddonRef.current.fit()
          const dims = fitAddonRef.current.proposeDimensions()
          if (dims && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'resize', cols: dims.cols, rows: dims.rows }))
          }
        } catch {}
      }
    }

    // ResizeObserver on the container for panel resize detection
    const observer = new ResizeObserver(handleResize)
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    window.addEventListener('resize', handleResize)

    // Initial fit when tab becomes active
    requestAnimationFrame(handleResize)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive])

  // Focus terminal when tab becomes active
  useEffect(() => {
    if (isActive && termRef.current) {
      termRef.current.focus()
    }
  }, [isActive])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ padding: '4px 0 0 8px' }}
    />
  )
}
