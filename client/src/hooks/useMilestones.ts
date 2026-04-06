import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'
import { api } from '@/lib/api'

export interface Milestone {
  id: string
  projectId: string
  name: string
  description?: string
  status: 'active' | 'closed'
  createdAt: string
  updatedAt: string
  order: number
}

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const data = await api.getMilestones(projectId)
      return data.milestones as Milestone[]
    },
    enabled: !!projectId,
    staleTime: 30_000,
  })
}

export function useCreateMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name, description }: { projectId: string; name: string; description?: string }) =>
      api.createMilestone(projectId, { name, description }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.projectId] })
    },
  })
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, milestoneId, ...data }: { projectId: string; milestoneId: string; name?: string; description?: string; status?: string }) =>
      api.updateMilestone(projectId, milestoneId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.projectId] })
    },
  })
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, milestoneId }: { projectId: string; milestoneId: string }) =>
      api.deleteMilestone(projectId, milestoneId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['tasks', 'all'] })
    },
  })
}

const MILESTONE_KEY = (projectId: string) => `dockyard:milestone:${projectId}`

export function useActiveMilestone(projectId: string) {
  const [milestoneId, setMilestoneIdState] = useState<string>(() =>
    localStorage.getItem(MILESTONE_KEY(projectId)) || 'default'
  )

  // Re-read when projectId changes
  useEffect(() => {
    setMilestoneIdState(localStorage.getItem(MILESTONE_KEY(projectId)) || 'default')
  }, [projectId])

  const setMilestoneId = useCallback((id: string) => {
    if (id === 'default') {
      localStorage.removeItem(MILESTONE_KEY(projectId))
    } else {
      localStorage.setItem(MILESTONE_KEY(projectId), id)
    }
    setMilestoneIdState(id)
  }, [projectId])

  return { milestoneId, setMilestoneId }
}
