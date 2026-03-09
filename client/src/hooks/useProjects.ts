import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Project {
  id: string
  name: string
  path: string
  category: string
  isGitRepo: boolean
  gitBranch?: string
  gitDirty?: boolean
  lastCommitDate?: string
  lastCommitMessage?: string
  gitRemoteUrl?: string
  techStack: string[]
  favorite: boolean
  lastOpenedAt?: string
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const data = await api.getProjects()
      return data.projects as Project[]
    },
    refetchInterval: 30000,
  })
}

export function useRefreshProjects() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.refreshProjects(),
    onSuccess: (data) => {
      queryClient.setQueryData(['projects'], data.projects)
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Pick<Project, 'name' | 'favorite' | 'lastOpenedAt'>>) =>
      api.updateProject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useLaunchTerminal() {
  return useMutation({
    mutationFn: ({ projectId, type }: { projectId: string; type: string }) =>
      api.launchTerminal(projectId, type),
  })
}

export function useLaunchVSCode() {
  return useMutation({
    mutationFn: (projectId: string) => api.launchVSCode(projectId),
  })
}

export function useOpenFolder() {
  return useMutation({
    mutationFn: (projectId: string) => api.openFolder(projectId),
  })
}
