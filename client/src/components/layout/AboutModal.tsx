import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface AboutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const [version, setVersion] = useState('N/A')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.getAppVersion) {
      window.electronAPI.getAppVersion()
        .then((v: string) => setVersion(v || 'N/A'))
        .catch(() => setVersion('N/A'))
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] bg-[#1c1c1c] text-zinc-300 border-[#333] shadow-xl">
        <DialogHeader className="pt-2 pb-4 border-b border-[#333]/50">
          <DialogTitle className="text-white text-lg font-bold text-center">Dockyard</DialogTitle>
        </DialogHeader>
        
        <div className="p-2 flex flex-col items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Developed by:</span>
            <span className="text-zinc-200">[Alessandro Willian]</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Year:</span>
            <span className="text-zinc-200">2026</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">Version:</span>
            <span className="text-zinc-200">{version}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-medium">GitHub:</span>
            <a 
              href="https://github.com/awilliansd" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              github.com/awilliansd
            </a>
          </div>
          
          <p className="text-zinc-400 text-center mt-4">
            Dockyard is a local dashboard for developers who manage multiple projects.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
