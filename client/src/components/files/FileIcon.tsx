import {
  File, FileText, FileCode, FileJson, FileImage,
  Folder, FolderOpen, Terminal, Palette, Database,
  Settings, Lock, Globe, Package, Braces,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileIconProps {
  name: string
  extension?: string
  type: 'file' | 'dir'
  isOpen?: boolean
  className?: string
}

const extIconMap: Record<string, { icon: typeof File; color: string }> = {
  '.ts': { icon: FileCode, color: 'text-blue-400' },
  '.tsx': { icon: FileCode, color: 'text-blue-400' },
  '.js': { icon: FileCode, color: 'text-yellow-400' },
  '.jsx': { icon: FileCode, color: 'text-yellow-400' },
  '.mjs': { icon: FileCode, color: 'text-yellow-400' },
  '.cjs': { icon: FileCode, color: 'text-yellow-400' },
  '.json': { icon: FileJson, color: 'text-yellow-300' },
  '.jsonc': { icon: FileJson, color: 'text-yellow-300' },
  '.md': { icon: FileText, color: 'text-sky-400' },
  '.mdx': { icon: FileText, color: 'text-sky-400' },
  '.css': { icon: Palette, color: 'text-purple-400' },
  '.scss': { icon: Palette, color: 'text-pink-400' },
  '.html': { icon: Globe, color: 'text-orange-400' },
  '.htm': { icon: Globe, color: 'text-orange-400' },
  '.py': { icon: FileCode, color: 'text-green-400' },
  '.rs': { icon: FileCode, color: 'text-orange-500' },
  '.go': { icon: FileCode, color: 'text-cyan-400' },
  '.java': { icon: FileCode, color: 'text-red-400' },
  '.rb': { icon: FileCode, color: 'text-red-500' },
  '.c': { icon: FileCode, color: 'text-blue-300' },
  '.cpp': { icon: FileCode, color: 'text-blue-300' },
  '.h': { icon: FileCode, color: 'text-blue-300' },
  '.cs': { icon: FileCode, color: 'text-green-500' },
  '.swift': { icon: FileCode, color: 'text-orange-400' },
  '.sh': { icon: Terminal, color: 'text-green-400' },
  '.bash': { icon: Terminal, color: 'text-green-400' },
  '.zsh': { icon: Terminal, color: 'text-green-400' },
  '.bat': { icon: Terminal, color: 'text-gray-400' },
  '.cmd': { icon: Terminal, color: 'text-gray-400' },
  '.ps1': { icon: Terminal, color: 'text-blue-400' },
  '.sql': { icon: Database, color: 'text-blue-300' },
  '.prisma': { icon: Database, color: 'text-teal-400' },
  '.env': { icon: Lock, color: 'text-yellow-600' },
  '.yaml': { icon: Settings, color: 'text-red-300' },
  '.yml': { icon: Settings, color: 'text-red-300' },
  '.toml': { icon: Settings, color: 'text-gray-400' },
  '.xml': { icon: Braces, color: 'text-orange-300' },
  '.svg': { icon: FileImage, color: 'text-yellow-400' },
  '.png': { icon: FileImage, color: 'text-green-400' },
  '.jpg': { icon: FileImage, color: 'text-green-400' },
  '.jpeg': { icon: FileImage, color: 'text-green-400' },
  '.gif': { icon: FileImage, color: 'text-purple-400' },
  '.webp': { icon: FileImage, color: 'text-green-400' },
  '.ico': { icon: FileImage, color: 'text-blue-400' },
  '.lock': { icon: Lock, color: 'text-gray-500' },
}

const nameIconMap: Record<string, { icon: typeof File; color: string }> = {
  'package.json': { icon: Package, color: 'text-green-400' },
  'tsconfig.json': { icon: Settings, color: 'text-blue-400' },
  '.gitignore': { icon: Settings, color: 'text-gray-500' },
  '.editorconfig': { icon: Settings, color: 'text-gray-500' },
  'Dockerfile': { icon: Package, color: 'text-blue-400' },
  'Makefile': { icon: Terminal, color: 'text-gray-400' },
  'LICENSE': { icon: FileText, color: 'text-yellow-500' },
  'README.md': { icon: FileText, color: 'text-sky-400' },
  'CLAUDE.md': { icon: FileText, color: 'text-orange-400' },
}

export function FileIcon({ name, extension, type, isOpen, className }: FileIconProps) {
  if (type === 'dir') {
    const Icon = isOpen ? FolderOpen : Folder
    return <Icon className={cn('h-4 w-4 text-yellow-500/80', className)} />
  }

  // Check name-specific icon first
  const nameMatch = nameIconMap[name]
  if (nameMatch) {
    const Icon = nameMatch.icon
    return <Icon className={cn('h-4 w-4', nameMatch.color, className)} />
  }

  // Then extension
  const ext = extension || ''
  const extMatch = extIconMap[ext]
  if (extMatch) {
    const Icon = extMatch.icon
    return <Icon className={cn('h-4 w-4', extMatch.color, className)} />
  }

  return <File className={cn('h-4 w-4 text-muted-foreground', className)} />
}
