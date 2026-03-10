export interface Project {
  id: string;
  name: string;
  path: string;
  category: string;
  isGitRepo: boolean;
  gitBranch?: string;
  gitDirty?: boolean;
  gitAhead?: number;       // Commits ahead of remote (not pushed)
  gitBehind?: number;      // Commits behind remote (not pulled)
  gitStaged?: number;      // Number of staged files
  gitUnstaged?: number;    // Number of modified but unstaged files
  gitUntracked?: number;   // Number of untracked files
  lastCommitDate?: string;
  lastCommitMessage?: string;
  gitRemoteUrl?: string;
  techStack: string[];
  favorite: boolean;
  lastOpenedAt?: string;
  externalLink?: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in_progress' | 'done';
  prompt?: string;
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
