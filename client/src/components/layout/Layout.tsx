import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TabBar } from './TabBar'
import { GlobalSearch } from './GlobalSearch'
import { FileContentSearch } from './FileContentSearch'
import { TabsProvider } from '@/hooks/useTabs'
import { TerminalPanel } from '@/components/terminals/TerminalPanel'
import { ServerStartupNotice } from './ServerStartupNotice'

const SIDEBAR_KEY = 'shipyard-sidebar-collapsed'
const SIDEBAR_WIDTH_KEY = 'shipyard-sidebar-width'
const SIDEBAR_WIDTH_DEFAULT = 240
const SIDEBAR_WIDTH_MIN = 200
const SIDEBAR_WIDTH_MAX = 420

export function Layout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === 'true')
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const raw = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY))
    if (!Number.isFinite(raw) || raw <= 0) return SIDEBAR_WIDTH_DEFAULT
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, raw))
  })
  const isResizingRef = useRef(false)
  const resizeStartXRef = useRef(0)
  const resizeStartWidthRef = useRef(sidebarWidth)
  const currentWidthRef = useRef(sidebarWidth)

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }

  useEffect(() => {
    currentWidthRef.current = sidebarWidth
  }, [sidebarWidth])

  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (!isResizingRef.current || collapsed) return
      const delta = e.clientX - resizeStartXRef.current
      const next = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, resizeStartWidthRef.current + delta)
      )
      currentWidthRef.current = next
      setSidebarWidth(next)
    }
    const onUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(currentWidthRef.current))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [collapsed])

  const startResize = (e: ReactMouseEvent) => {
    if (collapsed) return
    isResizingRef.current = true
    resizeStartXRef.current = e.clientX
    resizeStartWidthRef.current = currentWidthRef.current
    e.preventDefault()
  }

  return (
    <TabsProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={toggle} width={sidebarWidth} />
        <div
          className="w-1 cursor-col-resize bg-border/40 hover:bg-border/70 transition-colors"
          onMouseDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
        />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TabBar />
          <div className="flex-1 flex flex-col overflow-hidden min-h-0">
            <Outlet />
          </div>
          <TerminalPanel />
        </main>
      </div>
      <ServerStartupNotice />
      <GlobalSearch />
      <FileContentSearch />
    </TabsProvider>
  )
}
