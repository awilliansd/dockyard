import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import type { Task, Milestone, TasksFile } from '../types/index.js';
import { DATA_DIR } from './dataDir.js';

export const TASKS_DIR = join(DATA_DIR, 'tasks');

async function ensureTasksDir(): Promise<void> {
  await mkdir(TASKS_DIR, { recursive: true });
}

function getTasksFilePath(projectId: string): string {
  return join(TASKS_DIR, `${projectId}.json`);
}

async function readFile_(projectId: string): Promise<TasksFile> {
  try {
    const data = await readFile(getTasksFilePath(projectId), 'utf-8');
    return JSON.parse(data);
  } catch {
    return { tasks: [] };
  }
}

async function readTasks(projectId: string): Promise<Task[]> {
  const file = await readFile_(projectId);
  return file.tasks;
}

async function writeFile_(projectId: string, file: TasksFile): Promise<void> {
  await ensureTasksDir();
  await writeFile(getTasksFilePath(projectId), JSON.stringify(file, null, 2), 'utf-8');
}

async function writeTasks(projectId: string, tasks: Task[]): Promise<void> {
  // Preserve milestones when writing tasks
  const file = await readFile_(projectId);
  file.tasks = tasks;
  await writeFile_(projectId, file);
}

function getNextNumber(tasks: Task[]): number {
  let max = 0;
  for (const t of tasks) {
    if (t.number && t.number > max) max = t.number;
  }
  return max + 1;
}

// Backfill missing numbers on existing tasks (sorted by createdAt to assign in order)
function backfillNumbers(tasks: Task[]): boolean {
  const missing = tasks.filter(t => !t.number);
  if (missing.length === 0) return false;
  let next = getNextNumber(tasks);
  // Sort missing by createdAt so older tasks get lower numbers
  missing.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  for (const t of missing) {
    t.number = next++;
  }
  return true;
}

// Filter tasks by milestoneId: 'default' or undefined matches tasks with no milestoneId
function filterByMilestone(tasks: Task[], milestoneId?: string): Task[] {
  if (!milestoneId) return tasks;
  if (milestoneId === 'default') {
    return tasks.filter(t => !t.milestoneId || t.milestoneId === 'default');
  }
  return tasks.filter(t => t.milestoneId === milestoneId);
}

export async function getTasks(projectId: string, milestoneId?: string): Promise<Task[]> {
  const tasks = await readTasks(projectId);
  for (const t of tasks) {
    if (!t.projectId) t.projectId = projectId;
    if (!t.createdAt) t.createdAt = t.updatedAt || new Date().toISOString();
    if (t.order == null) t.order = 0;
  }
  // Backfill numbers for tasks that don't have one yet
  if (backfillNumbers(tasks)) {
    await writeTasks(projectId, tasks);
  }
  return filterByMilestone(tasks, milestoneId);
}

export async function getAllTasks(): Promise<Task[]> {
  await ensureTasksDir();
  const { readdir: rd } = await import('fs/promises');
  const files = await rd(TASKS_DIR);
  const allTasks: Task[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const projectId = file.replace('.json', '');
    const tasks = await readTasks(projectId);
    for (const t of tasks) {
      if (!t.projectId) t.projectId = projectId;
      if (!t.createdAt) t.createdAt = t.updatedAt || new Date().toISOString();
      if (t.order == null) t.order = 0;
    }
    if (backfillNumbers(tasks)) {
      await writeTasks(projectId, tasks);
    }
    allTasks.push(...tasks);
  }
  return allTasks;
}

export async function getTask(projectId: string, taskId: string): Promise<Task | undefined> {
  const tasks = await readTasks(projectId);
  return tasks.find(t => t.id === taskId);
}

// Build cascading timestamps: later stages imply earlier ones happened too
function buildCascadingTimestamps(status: Task['status'], now: string, existing?: { inboxAt?: string; inProgressAt?: string; doneAt?: string }) {
  const ts: { inboxAt?: string; inProgressAt?: string; doneAt?: string } = {}
  if (status === 'backlog' || status === 'todo' || status === 'in_progress' || status === 'done') {
    ts.inboxAt = existing?.inboxAt || now
  }
  if (status === 'in_progress' || status === 'done') {
    ts.inProgressAt = existing?.inProgressAt || now
  }
  if (status === 'done') {
    ts.doneAt = existing?.doneAt || now
  }
  return ts
}

export async function createTask(projectId: string, data: Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'order' | 'inboxAt' | 'inProgressAt' | 'doneAt'>): Promise<Task> {
  const tasks = await readTasks(projectId);
  const now = new Date().toISOString();
  const status = data.status || 'todo';
  const task: Task = {
    ...data,
    status,
    id: nanoid(10),
    number: getNextNumber(tasks),
    projectId,
    createdAt: now,
    updatedAt: now,
    order: tasks.length,
    ...buildCascadingTimestamps(status, now),
  };
  tasks.push(task);
  await writeTasks(projectId, tasks);
  return task;
}

export async function updateTask(projectId: string, taskId: string, data: Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>): Promise<Task | null> {
  const tasks = await readTasks(projectId);
  const idx = tasks.findIndex(t => t.id === taskId);
  if (idx === -1) return null;

  const now = new Date().toISOString();
  const oldStatus = tasks[idx].status;
  const newStatus = data.status;

  // Track status change timestamps (cascading: later stages fill in missing earlier ones)
  const statusTimestamps: Partial<Task> = {};
  if (newStatus && newStatus !== oldStatus) {
    const existing = tasks[idx];
    if (newStatus === 'backlog' || newStatus === 'todo') {
      statusTimestamps.inboxAt = now;
    } else if (newStatus === 'in_progress') {
      if (!existing.inboxAt) statusTimestamps.inboxAt = now;
      statusTimestamps.inProgressAt = now;
    } else if (newStatus === 'done') {
      if (!existing.inboxAt) statusTimestamps.inboxAt = now;
      if (!existing.inProgressAt) statusTimestamps.inProgressAt = now;
      statusTimestamps.doneAt = now;
    }
  }

  tasks[idx] = {
    ...tasks[idx],
    ...data,
    ...statusTimestamps,
    updatedAt: now,
  };
  await writeTasks(projectId, tasks);
  return tasks[idx];
}

export async function deleteTask(projectId: string, taskId: string): Promise<boolean> {
  const tasks = await readTasks(projectId);
  const filtered = tasks.filter(t => t.id !== taskId);
  if (filtered.length === tasks.length) return false;
  await writeTasks(projectId, filtered);
  return true;
}

export async function importTasks(projectId: string, importedTasks: Partial<Task>[]): Promise<number> {
  const existing = await readTasks(projectId);
  const now = new Date().toISOString();
  const created: Task[] = [];

  let nextNum = getNextNumber(existing);
  for (const t of importedTasks) {
    const status = (t.status as Task['status']) || 'todo';
    created.push({
      title: t.title || 'Untitled',
      description: t.description || '',
      priority: (t.priority as Task['priority']) || 'medium',
      status,
      prompt: t.prompt,
      milestoneId: t.milestoneId,
      id: nanoid(10),
      number: nextNum++,
      projectId,
      createdAt: t.createdAt || now,
      updatedAt: now,
      order: existing.length + created.length,
      ...buildCascadingTimestamps(status, now, { inboxAt: t.inboxAt, inProgressAt: t.inProgressAt, doneAt: t.doneAt }),
    });
  }

  await writeTasks(projectId, [...existing, ...created]);
  return created.length;
}

export async function applyCsvChanges(
  projectId: string,
  changes: {
    update: Array<{ id: string } & Partial<Omit<Task, 'id' | 'projectId' | 'createdAt'>>>;
    create: Array<Partial<Omit<Task, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'order'>>>;
    remove: string[];
  }
): Promise<{ updated: number; created: number; removed: number }> {
  let tasks = await readTasks(projectId);
  const now = new Date().toISOString();

  // Remove
  const removeSet = new Set(changes.remove);
  const removedCount = tasks.filter(t => removeSet.has(t.id)).length;
  tasks = tasks.filter(t => !removeSet.has(t.id));

  // Update
  let updatedCount = 0;
  for (const upd of changes.update) {
    const idx = tasks.findIndex(t => t.id === upd.id);
    if (idx !== -1) {
      const existing = tasks[idx];
      const oldStatus = existing.status;
      const newStatus = upd.status;
      const statusTimestamps: Partial<Task> = {};
      if (newStatus && newStatus !== oldStatus) {
        if (newStatus === 'backlog' || newStatus === 'todo') {
          statusTimestamps.inboxAt = now;
        } else if (newStatus === 'in_progress') {
          if (!existing.inboxAt) statusTimestamps.inboxAt = now;
          statusTimestamps.inProgressAt = now;
        } else if (newStatus === 'done') {
          if (!existing.inboxAt) statusTimestamps.inboxAt = now;
          if (!existing.inProgressAt) statusTimestamps.inProgressAt = now;
          statusTimestamps.doneAt = now;
        }
      }
      tasks[idx] = { ...tasks[idx], ...upd, ...statusTimestamps, updatedAt: now };
      updatedCount++;
    }
  }

  // Create
  let csvNextNum = getNextNumber(tasks);
  for (const newTask of changes.create) {
    const status = (newTask.status as Task['status']) || 'todo';
    tasks.push({
      title: newTask.title || 'Untitled',
      description: newTask.description || '',
      priority: (newTask.priority as Task['priority']) || 'medium',
      status,
      prompt: newTask.prompt,
      id: nanoid(10),
      number: csvNextNum++,
      projectId,
      createdAt: now,
      updatedAt: now,
      order: tasks.length,
      ...buildCascadingTimestamps(status, now),
    });
  }

  await writeTasks(projectId, tasks);
  return { updated: updatedCount, created: changes.create.length, removed: removedCount };
}

export async function replaceTasks(projectId: string, incoming: Partial<Task>[], milestoneId?: string): Promise<Task[]> {
  // Read existing tasks to preserve timestamps that aren't in the incoming data
  // (sync payloads like SheetRow don't carry createdAt/inboxAt/inProgressAt/doneAt)
  const existingTasks = await readTasks(projectId);
  const existingMap = new Map(existingTasks.map(t => [t.id, t]));
  const now = new Date().toISOString();

  // Compute next number from both existing and incoming tasks that already have numbers
  const allNumbers = [...existingTasks, ...incoming].map(t => t.number || 0);
  let replaceNextNum = Math.max(0, ...allNumbers) + 1;
  const tasks: Task[] = incoming.map((t, i) => {
    const status = (t.status as Task['status']) || 'todo';
    const existing = t.id ? existingMap.get(t.id) : undefined;
    const number = t.number || existing?.number || replaceNextNum++;
    return {
      title: t.title || 'Untitled',
      description: t.description || '',
      priority: (t.priority as Task['priority']) || 'medium',
      status,
      prompt: t.prompt,
      milestoneId: t.milestoneId || milestoneId || existing?.milestoneId,
      id: t.id || nanoid(10),
      number,
      projectId,
      createdAt: t.createdAt || existing?.createdAt || now,
      updatedAt: t.updatedAt || now,
      order: t.order ?? i,
      ...buildCascadingTimestamps(status, now, {
        inboxAt: t.inboxAt || existing?.inboxAt,
        inProgressAt: t.inProgressAt || existing?.inProgressAt,
        doneAt: t.doneAt || existing?.doneAt,
      }),
    };
  });

  if (milestoneId && milestoneId !== 'default') {
    // Scoped replace: only replace tasks for this milestone, keep others
    const otherTasks = existingTasks.filter(t => t.milestoneId !== milestoneId);
    await writeTasks(projectId, [...otherTasks, ...tasks]);
  } else if (milestoneId === 'default') {
    // Scoped replace: only replace tasks with no milestoneId
    const otherTasks = existingTasks.filter(t => t.milestoneId && t.milestoneId !== 'default');
    await writeTasks(projectId, [...otherTasks, ...tasks]);
  } else {
    await writeTasks(projectId, tasks);
  }
  return tasks;
}

export async function reorderTasks(projectId: string, taskIds: string[]): Promise<Task[]> {
  const tasks = await readTasks(projectId);
  const reordered: Task[] = [];

  for (let i = 0; i < taskIds.length; i++) {
    const task = tasks.find(t => t.id === taskIds[i]);
    if (task) {
      reordered.push({ ...task, order: i, updatedAt: new Date().toISOString() });
    }
  }

  // Add any tasks not in the reorder list at the end
  const reorderedIds = new Set(taskIds);
  for (const task of tasks) {
    if (!reorderedIds.has(task.id)) {
      reordered.push({ ...task, order: reordered.length });
    }
  }

  await writeTasks(projectId, reordered);
  return reordered;
}

// ── Milestone CRUD ─────────────────────────────────────────

const DEFAULT_MILESTONE: Milestone = {
  id: 'default',
  projectId: '',
  name: 'General',
  status: 'active',
  createdAt: '',
  updatedAt: '',
  order: 0,
};

export async function getMilestones(projectId: string): Promise<Milestone[]> {
  const file = await readFile_(projectId);
  const milestones = (file.milestones || []).map(m => ({ ...m, projectId }));
  // Always prepend virtual "default" milestone
  return [{ ...DEFAULT_MILESTONE, projectId }, ...milestones];
}

export async function createMilestone(projectId: string, data: { name: string; description?: string }): Promise<Milestone> {
  const file = await readFile_(projectId);
  const milestones = file.milestones || [];
  const now = new Date().toISOString();
  const milestone: Milestone = {
    id: nanoid(10),
    projectId,
    name: data.name,
    description: data.description,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    order: milestones.length + 1,
  };
  milestones.push(milestone);
  file.milestones = milestones;
  await writeFile_(projectId, file);
  return milestone;
}

export async function updateMilestone(projectId: string, milestoneId: string, data: { name?: string; description?: string; status?: 'active' | 'closed' }): Promise<Milestone | null> {
  if (milestoneId === 'default') return null; // Cannot edit virtual default
  const file = await readFile_(projectId);
  const milestones = file.milestones || [];
  const idx = milestones.findIndex(m => m.id === milestoneId);
  if (idx === -1) return null;
  milestones[idx] = {
    ...milestones[idx],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  file.milestones = milestones;
  await writeFile_(projectId, file);
  return { ...milestones[idx], projectId };
}

export async function deleteMilestone(projectId: string, milestoneId: string): Promise<boolean> {
  if (milestoneId === 'default') return false; // Cannot delete virtual default
  const file = await readFile_(projectId);
  const milestones = file.milestones || [];
  const filtered = milestones.filter(m => m.id !== milestoneId);
  if (filtered.length === milestones.length) return false;
  // Move tasks from deleted milestone to default
  for (const t of file.tasks) {
    if (t.milestoneId === milestoneId) {
      delete t.milestoneId;
    }
  }
  file.milestones = filtered;
  await writeFile_(projectId, file);
  return true;
}
