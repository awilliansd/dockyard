import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFileContent } from '@/hooks/useFiles'
import { FileIcon } from './FileIcon'
import { Copy, Download, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
function extname(p: string): string {
  const dot = p.lastIndexOf('.')
  return dot > 0 ? p.slice(dot) : ''
}

interface FilePreviewDialogProps {
  projectId: string
  filePath: string | null
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getLanguage(ext: string): string {
  const map: Record<string, string> = {
    '.ts': 'typescript', '.tsx': 'tsx', '.js': 'javascript', '.jsx': 'jsx',
    '.json': 'json', '.css': 'css', '.scss': 'scss', '.html': 'html',
    '.py': 'python', '.rs': 'rust', '.go': 'go', '.java': 'java',
    '.rb': 'ruby', '.sh': 'bash', '.sql': 'sql', '.yaml': 'yaml',
    '.yml': 'yaml', '.xml': 'xml', '.md': 'markdown', '.toml': 'toml',
    '.c': 'c', '.cpp': 'cpp', '.cs': 'csharp', '.swift': 'swift',
    '.kt': 'kotlin', '.scala': 'scala', '.graphql': 'graphql',
    '.prisma': 'prisma', '.vue': 'vue', '.svelte': 'svelte',
  }
  return map[ext] || 'text'
}

export function FilePreviewDialog({ projectId, filePath, onClose }: FilePreviewDialogProps) {
  const { data, isLoading, error } = useFileContent(projectId, filePath)

  const fileName = filePath?.split(/[/\\]/).pop() || ''
  const ext = fileName ? extname(fileName).toLowerCase() : ''

  const handleCopyPath = () => {
    if (filePath) {
      navigator.clipboard.writeText(filePath)
      toast.success('Path copied')
    }
  }

  const handleCopyContent = () => {
    if (data?.content && data.encoding === 'utf8') {
      navigator.clipboard.writeText(data.content)
      toast.success('Content copied')
    }
  }

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm">Failed to load file</p>
          <p className="text-xs">{(error as Error).message}</p>
        </div>
      )
    }

    if (!data) return null

    if (data.mimeHint === 'too-large') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <AlertTriangle className="h-8 w-8 text-yellow-400" />
          <p className="text-sm">File too large to preview</p>
          <p className="text-xs">{formatSize(data.size)}</p>
        </div>
      )
    }

    // Image
    if (data.mimeHint?.startsWith('image/')) {
      const src = data.encoding === 'base64'
        ? `data:${data.mimeHint};base64,${data.content}`
        : `/api/projects/${projectId}/files/content?path=${encodeURIComponent(filePath!)}`
      return (
        <div className="flex items-center justify-center h-full p-4 overflow-auto">
          <img src={src} alt={fileName} className="max-w-full max-h-full object-contain rounded" />
        </div>
      )
    }

    // Markdown
    if (data.mimeHint === 'text/markdown') {
      return (
        <div className="prose prose-invert prose-sm max-w-none p-4 overflow-auto h-full scrollbar-dark">
          <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> }}>{data.content}</Markdown>
        </div>
      )
    }

    // Binary
    if (data.mimeHint === 'application/octet-stream') {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
          <p className="text-sm">Binary file - cannot preview</p>
          <p className="text-xs">{formatSize(data.size)}</p>
        </div>
      )
    }

    // Text / Code
    const lines = data.content.split('\n')
    const lineNumWidth = String(lines.length).length
    return (
      <div className="h-full overflow-auto scrollbar-dark">
        <pre className="text-xs font-mono p-4 leading-relaxed">
          <code>{lines.map((line, i) => (
            <div key={i} className="flex hover:bg-accent/20">
              <span className="select-none text-muted-foreground/30 text-right pr-4 shrink-0" style={{ width: `${lineNumWidth + 2}ch` }}>
                {i + 1}
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">{line}</span>
            </div>
          ))}</code>
        </pre>
      </div>
    )
  }

  return (
    <Dialog open={!!filePath} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-5xl w-[90vw] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 pr-12 py-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <FileIcon name={fileName} extension={ext} type="file" />
              <DialogTitle className="text-sm font-medium truncate" title={filePath || undefined}>
                {filePath}
              </DialogTitle>
              {data && data.mimeHint !== 'too-large' && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatSize(data.size)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyPath} title="Copy path">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              {data?.encoding === 'utf8' && data.mimeHint !== 'too-large' && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopyContent} title="Copy content">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          {renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  )
}
