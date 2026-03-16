import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCreateMilestone, useUpdateMilestone, type Milestone } from '@/hooks/useMilestones'
import { toast } from 'sonner'

interface MilestoneDialogProps {
  projectId: string
  milestone?: Milestone | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (milestoneId: string) => void
}

export function MilestoneDialog({ projectId, milestone, open, onOpenChange, onCreated }: MilestoneDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const createMilestone = useCreateMilestone()
  const updateMilestone = useUpdateMilestone()

  useEffect(() => {
    if (milestone) {
      setName(milestone.name)
      setDescription(milestone.description || '')
    } else {
      setName('')
      setDescription('')
    }
  }, [milestone, open])

  const handleSave = () => {
    if (!name.trim()) return

    if (milestone) {
      updateMilestone.mutate(
        { projectId, milestoneId: milestone.id, name: name.trim(), description: description.trim() || undefined },
        {
          onSuccess: () => {
            toast.success('Milestone updated')
            onOpenChange(false)
          },
        }
      )
    } else {
      createMilestone.mutate(
        { projectId, name: name.trim(), description: description.trim() || undefined },
        {
          onSuccess: (data: any) => {
            toast.success(`Milestone "${name.trim()}" created`)
            onOpenChange(false)
            onCreated?.(data.id)
          },
        }
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{milestone ? 'Edit Milestone' : 'New Milestone'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && name.trim()) handleSave() }}
              placeholder="e.g., Sprint 1, Phase 2, v2.0..."
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            {milestone ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
