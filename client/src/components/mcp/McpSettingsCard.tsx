import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useMcpStatus, useSaveMcpConfig, useRevokeMcpClient } from '@/hooks/useMcp'
import { Server, Copy, Check, X, Trash2, Shield, ShieldOff } from 'lucide-react'
import { toast } from 'sonner'

export function McpSettingsCard() {
  const { data: status } = useMcpStatus()
  const saveConfig = useSaveMcpConfig()
  const revokeClient = useRevokeMcpClient()
  const [copied, setCopied] = useState<string | null>(null)

  const serverUrl = `${window.location.protocol}//${window.location.host}/mcp`

  const claudeDesktopConfig = JSON.stringify({
    mcpServers: {
      shipyard: {
        url: serverUrl,
      },
    },
  }, null, 2)

  const claudeCodeConfig = JSON.stringify({
    mcpServers: {
      shipyard: {
        type: "url",
        url: serverUrl,
      },
    },
  }, null, 2)

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    toast.success(`${label} copied`)
    setTimeout(() => setCopied(null), 2000)
  }

  const toggleEnabled = () => {
    saveConfig.mutate({
      enabled: !status?.enabled,
      requireAuth: status?.requireAuth,
    })
  }

  const toggleAuth = () => {
    saveConfig.mutate({
      enabled: status?.enabled || false,
      requireAuth: !status?.requireAuth,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Server className="h-4 w-4" />
          MCP Server
          {status?.enabled && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">Active</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Expose Shipyard as an MCP server so MCP clients (e.g., Claude Desktop / Claude Code) can read projects, manage tasks, and view git status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Enable MCP Server</p>
            <p className="text-xs text-muted-foreground">Accept connections from MCP clients</p>
          </div>
          <Button
            variant={status?.enabled ? 'default' : 'outline'}
            size="sm"
            onClick={toggleEnabled}
            disabled={saveConfig.isPending}
          >
            {status?.enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        {status?.enabled && (
          <>
            {/* Auth Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status.requireAuth ? <Shield className="h-4 w-4 text-green-500" /> : <ShieldOff className="h-4 w-4 text-yellow-500" />}
                <div>
                  <p className="text-sm font-medium">Require Authorization</p>
                  <p className="text-xs text-muted-foreground">
                    {status.requireAuth ? 'Clients must authorize via OAuth' : 'Any local client can connect (no auth)'}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={toggleAuth} disabled={saveConfig.isPending}>
                {status.requireAuth ? 'Required' : 'Off'}
              </Button>
            </div>

            {/* Connection URL */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Connection URL</p>
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                <code className="text-xs flex-1 break-all">{serverUrl}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleCopy(serverUrl, 'URL')}
                >
                  {copied === 'URL' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Claude Desktop Config */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Claude Desktop Config (Example)</p>
              <p className="text-xs text-muted-foreground">
                Add to <code className="bg-muted px-1 rounded">claude_desktop_config.json</code>:
              </p>
              <div className="relative">
                <pre className="bg-muted/50 rounded-lg p-3 text-[11px] overflow-x-auto">{claudeDesktopConfig}</pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-6 w-6"
                  onClick={() => handleCopy(claudeDesktopConfig, 'Desktop config')}
                >
                  {copied === 'Desktop config' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Claude Code Config */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Claude Code Config (Example)</p>
              <p className="text-xs text-muted-foreground">
                Add to <code className="bg-muted px-1 rounded">.claude/settings.json</code> or run: <code className="bg-muted px-1 rounded">claude mcp add shipyard --transport http --url {serverUrl}</code>
              </p>
              <div className="relative">
                <pre className="bg-muted/50 rounded-lg p-3 text-[11px] overflow-x-auto">{claudeCodeConfig}</pre>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1.5 right-1.5 h-6 w-6"
                  onClick={() => handleCopy(claudeCodeConfig, 'Code config')}
                >
                  {copied === 'Code config' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Available Tools */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Available MCP Tools</p>
              <div className="grid grid-cols-2 gap-1">
                {[
                  'list_projects', 'get_project', 'list_tasks', 'get_all_tasks',
                  'get_task', 'create_task', 'update_task', 'delete_task',
                  'get_git_status', 'get_git_log', 'search_tasks',
                ].map(tool => (
                  <div key={tool} className="text-[11px] text-muted-foreground bg-muted/30 px-2 py-1 rounded font-mono">
                    {tool}
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Clients */}
            {status.clients.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Authorized Clients</p>
                <div className="space-y-1">
                  {status.clients.map(c => (
                    <div key={c.clientId} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{c.clientName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => revokeClient.mutate(c.clientId)}
                        title="Revoke access"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
