export interface Project {
  id: string;
  name: string;
  path: string;
  category: string;
  isGitRepo: boolean;
  gitBranch?: string;
  gitDirty?: boolean;
  lastCommitDate?: string;
  lastCommitMessage?: string;
  gitRemoteUrl?: string;
  techStack: string[];
  favorite: boolean;
  lastOpenedAt?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  promptTemplate?: string;
  createdAt: string;
  updatedAt: string;
  order: number;
  // Status change timestamps
  inboxAt?: string;       // When moved to backlog/todo
  inProgressAt?: string;  // When moved to in_progress
  doneAt?: string;        // When moved to done
}

export interface ProjectsCache {
  projects: Project[];
  lastScannedAt: string;
}

export interface TasksFile {
  tasks: Task[];
}

export interface Settings {
  // Paths of projects the user has added to the dashboard
  selectedProjects: string[];
}
