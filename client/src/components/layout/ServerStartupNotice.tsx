import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

type Status = 'checking' | 'slow' | 'ready'

const SLOW_THRESHOLD_MS = 4500
const POLL_INTERVAL_MS = 900

export function ServerStartupNotice() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    // Only show this notice inside the Electron app
    if (!(window as any).electronAPI) {
      setStatus('ready')
      return
    }

    let cancelled = false
    const slowTimer = setTimeout(() => {
      if (!cancelled) setStatus((prev) => (prev === 'ready' ? prev : 'slow'))
    }, SLOW_THRESHOLD_MS)

    const check = async () => {
      while (!cancelled) {
        try {
          await api.getProjects()
          if (cancelled) return
          setStatus('ready')
          return
        } catch {
          await new Promise((res) => setTimeout(res, POLL_INTERVAL_MS))
        }
      }
    }

    check()

    return () => {
      cancelled = true
      clearTimeout(slowTimer)
    }
  }, [])

  if (status !== 'slow') return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="max-w-md rounded-xl border border-zinc-800 bg-zinc-950/95 px-5 py-4 text-center shadow-2xl">
        <div className="text-sm font-semibold text-zinc-100">Inicializando o Shipyard…</div>
        <div className="mt-2 text-xs text-zinc-400">
          O servidor ainda está carregando. Isso pode levar alguns segundos na primeira abertura.
        </div>
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 hover:bg-zinc-700"
            onClick={() => window.location.reload()}
          >
            Recarregar agora
          </button>
        </div>
      </div>
    </div>
  )
}
