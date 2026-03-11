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
  notes?: string;
  links?: { label: string; url: string }[];
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

// ── Claude API Integration ──────────────────────────────

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── MCP Server Integration ──────────────────────────────

export interface McpConfig {
  enabled: boolean;
  requireAuth: boolean;
}

export interface OAuthClient {
  clientId: string;
  clientSecret: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken: string;
  clientId: string;
  scope: string;
  expiresAt: number;
  createdAt: number;
}

export interface McpAuthData {
  jwtSecret: string;
  clients: OAuthClient[];
  authCodes: Array<{
    code: string;
    clientId: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    redirectUri: string;
    expiresAt: number;
    scope: string;
  }>;
  refreshTokens: Array<{
    token: string;
    clientId: string;
    scope: string;
    expiresAt: number;
  }>;
}
