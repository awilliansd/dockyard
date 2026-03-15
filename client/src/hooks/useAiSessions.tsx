import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { api } from '@/lib/api'

interface AiSessionEntry {
  taskId: string
  sessionId: string
  projectId: string
}

interface AiSessionsContextValue {
  sessions: Map<string, AiSessionEntry> // keyed by taskId
  register: (entry: AiSessionEntry) => void
  unregisterBySession: (sessionId: string) => void
  hasSession: (taskId: string) => boolean
}

const AiSessionsContext = createContext<AiSessionsContextValue | null>(null)

export function AiSessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Map<string, AiSessionEntry>>(new Map())
  const initializedRef = useRef(false)
  const sessionsRef = useRef(sessions)
  sessionsRef.current = sessions

  // Recover active AI sessions from server on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    api.getAiTerminalSessions().then(({ sessions: serverSessions }) => {
      if (serverSessions.length > 0) {
        setSessions(prev => {
          const next = new Map(prev)
          for (const s of serverSessions) {
            if (s.taskId) {
              next.set(s.taskId, { taskId: s.taskId, sessionId: s.id, projectId: s.projectId })
            }
          }
          return next
        })
      }
    }).catch(() => {})
  }, [])

  const register = useCallback((entry: AiSessionEntry) => {
    setSessions(prev => {
      const next = new Map(prev)
      next.set(entry.taskId, entry)
      return next
    })
  }, [])

  const unregisterBySession = useCallback((sessionId: string) => {
    setSessions(prev => {
      const next = new Map(prev)
      for (const [taskId, entry] of next) {
        if (entry.sessionId === sessionId) {
          next.delete(taskId)
          break
        }
      }
      return next
    })
  }, [])

  const hasSession = useCallback((taskId: string) => {
    return sessions.has(taskId)
  }, [sessions])

  // Poll task statuses to auto-unregister sessions when tasks are marked as done
  const hasActiveSessions = sessions.size > 0
  useEffect(() => {
    if (!hasActiveSessions) return

    const checkTaskStatuses = async () => {
      const current = sessionsRef.current
      if (current.size === 0) return

      // Group sessions by projectId to minimize API calls
      const byProject = new Map<string, AiSessionEntry[]>()
      for (const entry of current.values()) {
        const list = byProject.get(entry.projectId) || []
        list.push(entry)
        byProject.set(entry.projectId, list)
      }

      for (const [projectId, entries] of byProject) {
        try {
          const { tasks } = await api.getTasks(projectId)
          for (const entry of entries) {
            const task = tasks.find((t: any) => t.id === entry.taskId)
            if (task && task.status === 'done') {
              setSessions(prev => {
                const next = new Map(prev)
                next.delete(entry.taskId)
                return next
              })
            }
          }
        } catch {}
      }
    }

    const interval = setInterval(checkTaskStatuses, 10000)
    // Also check once after a short delay (task might already be done)
    const timeout = setTimeout(checkTaskStatuses, 2000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [hasActiveSessions])

  return (
    <AiSessionsContext.Provider value={{ sessions, register, unregisterBySession, hasSession }}>
      {children}
    </AiSessionsContext.Provider>
  )
}

export function useAiSessions() {
  const ctx = useContext(AiSessionsContext)
  if (!ctx) throw new Error('useAiSessions must be used within AiSessionsProvider')
  return ctx
}
