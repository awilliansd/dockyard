import { useState, useCallback } from 'react'
import { FileJson, FileText, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getProvider } from '@/lib/sync/registry'
import { readProviderConfig, writeProviderConfig } from '@/lib/sync/configStore'
import type { ProviderConfig } from '@/lib/sync/types'
import type { Task } from '@/hooks/useTasks'
import { toast } from 'sonner'

// Ensure providers are registered
import '@/lib/sync/providers'

interface SyncPanelExportsProps {
  projectId: string
  tasks: Task[]
}

function downloadFile(data: string | Blob, filename: string, mimeType: string) {
  const blob = typeof data === 'string' ? new Blob([data], { type: mimeType }) : data
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export buttons for JSON and Markdown in the TaskBoard toolbar.
 * These are quick-action buttons — no config needed.
 */
export function SyncPanelExports({ projectId, tasks }: SyncPanelExportsProps) {
  const [exporting, setExporting] = useState<string | null>(null)
  const [mdPopoverOpen, setMdPopoverOpen] = useState(false)

  const handleJsonExport = useCallback(async () => {
    const provider = getProvider('json-export')
    if (!provider?.export) return

    setExporting('json')
    try {
      const config: ProviderConfig = {
        providerId: 'json-export',
        projectId,
        enabled: true,
        settings: { includeCompleted: true, prettyPrint: true },
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      }
      const result = await provider.export(config, tasks)
      downloadFile(result.data, result.filename, result.mimeType)
      toast.success(`Exported ${tasks.length} tasks as JSON`)
    } catch (err: any) {
      toast.error(err.message || 'Export failed')
    } finally {
      setExporting(null)
    }
  }, [projectId, tasks])

  const handleMarkdownExport = useCallback(async (format: string, groupBy: string, includeDone: boolean) => {
    const provider = getProvider('markdown-export')
    if (!provider?.export) return

    setExporting('md')
    try {
      const config: ProviderConfig = {
        providerId: 'markdown-export',
        projectId,
        enabled: true,
        settings: { format, groupBy, includeDone },
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      }
      const result = await provider.export(config, tasks)

      // Copy to clipboard instead of download for quick use
      if (typeof result.data === 'string') {
        await navigator.clipboard.writeText(result.data)
        toast.success('Markdown copied to clipboard')
      }
    } catch (err: any) {
      toast.error(err.message || 'Export failed')
    } finally {
      setExporting(null)
      setMdPopoverOpen(false)
    }
  }, [projectId, tasks])

  const handleMarkdownDownload = useCallback(async (format: string, groupBy: string, includeDone: boolean) => {
    const provider = getProvider('markdown-export')
    if (!provider?.export) return

    setExporting('md')
    try {
      const config: ProviderConfig = {
        providerId: 'markdown-export',
        projectId,
        enabled: true,
        settings: { format, groupBy, includeDone },
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
      }
      const result = await provider.export(config, tasks)
      downloadFile(result.data, result.filename, result.mimeType)
      toast.success('Markdown file downloaded')
    } catch (err: any) {
      toast.error(err.message || 'Export failed')
    } finally {
      setExporting(null)
      setMdPopoverOpen(false)
    }
  }, [projectId, tasks])

  return (
    <>
      {/* JSON Export */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={handleJsonExport}
            disabled={exporting === 'json'}
          >
            {exporting === 'json' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
            JSON
          </Button>
        </TooltipTrigger>
        <TooltipContent>Export tasks as JSON backup file</TooltipContent>
      </Tooltip>

      {/* Markdown Export */}
      <Popover open={mdPopoverOpen} onOpenChange={setMdPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={exporting === 'md'}
              >
                {exporting === 'md' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Markdown
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Export tasks as Markdown</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-2">
            <h4 className="text-xs font-semibold">Export as Markdown</h4>
            <div className="space-y-1">
              <button
                onClick={() => handleMarkdownExport('checklist', 'status', false)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
              >
                Copy as checklist (by status)
              </button>
              <button
                onClick={() => handleMarkdownExport('checklist', 'priority', false)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
              >
                Copy as checklist (by priority)
              </button>
              <button
                onClick={() => handleMarkdownExport('table', 'status', false)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
              >
                Copy as table
              </button>
              <button
                onClick={() => handleMarkdownExport('detailed', 'status', true)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
              >
                Copy detailed (with descriptions)
              </button>
              <div className="border-t my-1" />
              <button
                onClick={() => handleMarkdownDownload('checklist', 'status', false)}
                className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors flex items-center gap-1.5 text-muted-foreground"
              >
                <Download className="h-3 w-3" />
                Download as .md file
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
