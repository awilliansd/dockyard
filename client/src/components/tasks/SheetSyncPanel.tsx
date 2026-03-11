import { useState, useCallback } from 'react'
import { Sheet, Download, Upload, Settings2, Loader2, CheckCircle2, XCircle, Unplug, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSyncConfig, useSyncPush, useSyncPull, useSyncTest, type SyncConfig } from '@/hooks/useSheetSync'
import type { Task } from '@/hooks/useTasks'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

const APPS_SCRIPT_TEMPLATE = `// DevDash Sync — Cole este script no Google Apps Script
// Deploy > New deployment > Web App
// Execute as: Me | Access: Anyone

const HEADERS = ['id', 'title', 'description', 'priority', 'status', 'prompt', 'updatedAt'];

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'read';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (action === 'ping') {
    return jsonResp({ ok: true, rows: Math.max(0, sheet.getLastRow() - 1) });
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return jsonResp({ tasks: [] });

  const headers = data[0].map(function(h) { return String(h).toLowerCase().trim(); });
  var tasks = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (!row.some(function(c) { return String(c).trim(); })) continue;
    var task = {};
    headers.forEach(function(h, idx) { task[h] = String(row[idx] || ''); });
    if (task.title) tasks.push(task);
  }
  return jsonResp({ tasks: tasks });
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var tasks = payload.tasks || [];
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    sheet.clear();
    sheet.appendRow(HEADERS);

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      sheet.appendRow(HEADERS.map(function(h) { return t[h] || ''; }));
    }

    if (HEADERS.length > 0) sheet.autoResizeColumns(1, HEADERS.length);
    return jsonResp({ success: true, updated: tasks.length });
  } catch (err) {
    return jsonResp({ error: err.message });
  }
}

function jsonResp(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// Auto-update updatedAt when editing cells manually
function onEdit(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  if (row < 2) return; // skip header
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var col = headers.indexOf('updatedAt');
  if (col === -1) return;
  // Don't trigger if editing the updatedAt column itself
  if (e.range.getColumn() === col + 1) return;
  sheet.getRange(row, col + 1).setValue(new Date().toISOString());
}`

interface SheetSyncPanelProps {
  projectId: string
  tasks: Task[]
}

export function SheetSyncPanel({ projectId, tasks }: SheetSyncPanelProps) {
  const { config, save, clear } = useSyncConfig(projectId)
  const push = useSyncPush(projectId)
  const pull = useSyncPull(projectId)
  const test = useSyncTest()

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [autoSync, setAutoSync] = useState(false)
  const [showScript, setShowScript] = useState(false)
  const [copied, setCopied] = useState(false)

  const isWorking = push.isPending || pull.isPending

  const handleOpenPopover = useCallback(() => {
    setUrlInput(config?.url || '')
    setAutoSync(config?.autoSync || false)
    setShowScript(false)
    setCopied(false)
  }, [config])

  const handleSave = useCallback(() => {
    const url = urlInput.trim()
    if (!url) {
      toast.error('Enter an Apps Script URL')
      return
    }
    if (!url.startsWith('https://script.google.com/macros/s/')) {
      toast.error('URL must start with https://script.google.com/macros/s/')
      return
    }
    save({
      url,
      autoSync,
      lastSyncAt: config?.lastSyncAt || null,
      lastSyncStatus: config?.lastSyncStatus || null,
      lastSyncError: config?.lastSyncError || null,
    })
    setPopoverOpen(false)
    toast.success('Google Sheet sync configured')
  }, [urlInput, autoSync, config, save])

  const handleTest = useCallback(() => {
    const url = urlInput.trim()
    if (!url) return
    test.mutate(url, {
      onSuccess: (data) => {
        toast.success(`Connected! Sheet has ${data.data?.rows ?? '?'} task rows.`)
      },
      onError: (err) => {
        toast.error(`Connection failed: ${err.message}`)
      },
    })
  }, [urlInput, test])

  const handleDisconnect = useCallback(() => {
    clear()
    setPopoverOpen(false)
    toast.info('Google Sheet disconnected')
  }, [clear])

  const handlePush = useCallback(() => {
    if (!config?.url) return
    push.mutate({ url: config.url, tasks })
  }, [config, push, tasks])

  const handlePull = useCallback(() => {
    if (!config?.url) return
    pull.mutate({ url: config.url })
  }, [config, pull])

  const handleCopyScript = useCallback(() => {
    navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE)
    setCopied(true)
    toast.success('Apps Script copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const lastSyncLabel = config?.lastSyncAt
    ? formatDistanceToNow(new Date(config.lastSyncAt), { addSuffix: true })
    : null

  // Not configured — show setup button
  if (!config) {
    return (
      <Popover open={popoverOpen} onOpenChange={(open) => { setPopoverOpen(open); if (open) handleOpenPopover() }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                <Sheet className="h-3.5 w-3.5" />
                Sheets
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Sync tasks with a Google Sheet</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="end">
          <SetupContent
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            autoSync={autoSync}
            setAutoSync={setAutoSync}
            showScript={showScript}
            setShowScript={setShowScript}
            copied={copied}
            onCopyScript={handleCopyScript}
            onTest={handleTest}
            onSave={handleSave}
            isTesting={test.isPending}
          />
        </PopoverContent>
      </Popover>
    )
  }

  // Configured — show sync controls
  return (
    <div className="flex items-center gap-1">
      {/* Status badge */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 cursor-default">
            <Sheet className="h-3 w-3" />
            Sheets
            {config.lastSyncStatus === 'error' && <XCircle className="h-3 w-3 text-red-400" />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {config.lastSyncStatus === 'error'
            ? `Sync error: ${config.lastSyncError}`
            : lastSyncLabel
              ? `Last synced ${lastSyncLabel}`
              : 'Connected to Google Sheet'
          }
          {config.autoSync && ' (auto-sync on)'}
        </TooltipContent>
      </Tooltip>

      {/* Pull */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePull} disabled={isWorking}>
            {pull.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Pull tasks from Google Sheet (overwrites local)</TooltipContent>
      </Tooltip>

      {/* Push */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePush} disabled={isWorking}>
            {push.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Push local tasks to Google Sheet (overwrites sheet)</TooltipContent>
      </Tooltip>

      {/* Settings */}
      <Popover open={popoverOpen} onOpenChange={(open) => { setPopoverOpen(open); if (open) handleOpenPopover() }}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Sheet sync settings</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-96" align="end">
          <SetupContent
            urlInput={urlInput}
            setUrlInput={setUrlInput}
            autoSync={autoSync}
            setAutoSync={setAutoSync}
            showScript={showScript}
            setShowScript={setShowScript}
            copied={copied}
            onCopyScript={handleCopyScript}
            onTest={handleTest}
            onSave={handleSave}
            onDisconnect={handleDisconnect}
            isTesting={test.isPending}
            isConfigured
            lastSyncLabel={lastSyncLabel}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

// --- Setup/Config popover content ---

interface SetupContentProps {
  urlInput: string
  setUrlInput: (v: string) => void
  autoSync: boolean
  setAutoSync: (v: boolean) => void
  showScript: boolean
  setShowScript: (v: boolean) => void
  copied: boolean
  onCopyScript: () => void
  onTest: () => void
  onSave: () => void
  onDisconnect?: () => void
  isTesting: boolean
  isConfigured?: boolean
  lastSyncLabel?: string | null
}

function SetupContent({
  urlInput, setUrlInput, autoSync, setAutoSync,
  showScript, setShowScript, copied, onCopyScript,
  onTest, onSave, onDisconnect, isTesting,
  isConfigured, lastSyncLabel,
}: SetupContentProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold">Google Sheet Sync</h4>
        <p className="text-[11px] text-muted-foreground">
          Sync tasks with a Google Sheet via Apps Script. Config is saved only in this browser.
        </p>
      </div>

      {/* Setup guide toggle */}
      <button
        onClick={() => setShowScript(!showScript)}
        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"
      >
        {showScript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {showScript ? 'Hide' : 'Show'} setup guide
      </button>

      {showScript && (
        <div className="space-y-2 rounded-md border p-3 bg-muted/50">
          <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside">
            <li>Create a Google Sheet (any name)</li>
            <li>Open <strong>Extensions &gt; Apps Script</strong></li>
            <li>Delete default code, paste the script below</li>
            <li><strong>Deploy &gt; New deployment &gt; Web App</strong></li>
            <li>Set: Execute as <strong>Me</strong>, Access <strong>Anyone</strong></li>
            <li>Copy the deployment URL and paste below</li>
          </ol>
          <div className="relative">
            <pre className="text-[10px] bg-background rounded p-2 overflow-auto max-h-48 border font-mono">
              {APPS_SCRIPT_TEMPLATE}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-1 right-1 h-6 text-[10px] gap-1"
              onClick={onCopyScript}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </div>
      )}

      {/* URL input */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium">Apps Script URL</label>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://script.google.com/macros/s/..."
          className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Auto-sync toggle */}
      <label className="flex items-center gap-2 text-xs cursor-pointer">
        <input
          type="checkbox"
          checked={autoSync}
          onChange={(e) => setAutoSync(e.target.checked)}
          className="rounded border-muted-foreground/30"
        />
        Auto-pull on workspace open
      </label>

      {/* Last sync info */}
      {isConfigured && lastSyncLabel && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          Last synced {lastSyncLabel}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 text-xs flex-1" onClick={onSave}>
          Save
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onTest} disabled={isTesting || !urlInput.trim()}>
          {isTesting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Test
        </Button>
        {isConfigured && onDisconnect && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={onDisconnect}>
                <Unplug className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Disconnect Google Sheet</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
