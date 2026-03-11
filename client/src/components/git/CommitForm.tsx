import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGitCommit, useGitPush } from '@/hooks/useGit'
import { useLaunchTerminal } from '@/hooks/useProjects'
import { useTerminalStatus } from '@/hooks/useTerminal'
import { toast } from 'sonner'

function openIntegratedTerminal(projectId: string, type: string) {
  window.dispatchEvent(new CustomEvent('shipyard:open-terminal', { detail: { projectId, type } }))
}

interface CommitFormProps {
  projectId: string
  hasStagedChanges: boolean
}

export function CommitForm({ projectId, hasStagedChanges }: CommitFormProps) {
  const [message, setMessage] = useState('')
  const gitCommit = useGitCommit()
  const gitPush = useGitPush()
  const launchTerminal = useLaunchTerminal()
  const { data: terminalStatus } = useTerminalStatus()
  const hasIntegrated = terminalStatus?.available ?? false

  const handleAICommit = () => {
    const prompt = 'Review the staged changes with git diff --cached, then commit with a simple and descriptive message. Only commit, do not push.'
    navigator.clipboard.writeText(prompt)
    const skipPerm = localStorage.getItem('shipyard:skipPermissions') === 'true'
    const type = skipPerm ? 'claude-yolo' : 'claude'
    if (hasIntegrated) {
      openIntegratedTerminal(projectId, type)
      toast.success('Claude opened — paste the prompt')
    } else {
      launchTerminal.mutate(
        { projectId, type },
        { onSuccess: () => toast.success('Claude opened — paste the prompt') }
      )
    }
  }

  const handleCommit = () => {
    if (!message.trim()) return
    gitCommit.mutate(
      { projectId, message },
      {
        onSuccess: () => {
          toast.success('Committed successfully')
          setMessage('')
        },
        onError: (err) => toast.error(`Commit failed: ${err.message}`),
      }
    )
  }

  const handleCommitAndPush = () => {
    if (!message.trim()) return
    gitCommit.mutate(
      { projectId, message },
      {
        onSuccess: () => {
          setMessage('')
          gitPush.mutate(projectId, {
            onSuccess: () => toast.success('Committed and pushed'),
            onError: (err) => toast.error(`Push failed: ${err.message}`),
          })
        },
        onError: (err) => toast.error(`Commit failed: ${err.message}`),
      }
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Input
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Commit message..."
          className="text-sm"
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCommit()}
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!hasStagedChanges}
          onClick={handleAICommit}
          title="Open Claude to generate commit"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!message.trim() || !hasStagedChanges || gitCommit.isPending}
          onClick={handleCommit}
        >
          Commit
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 h-8 text-xs"
          disabled={!message.trim() || !hasStagedChanges || gitCommit.isPending}
          onClick={handleCommitAndPush}
        >
          Commit & Push
        </Button>
      </div>
    </div>
  )
}
