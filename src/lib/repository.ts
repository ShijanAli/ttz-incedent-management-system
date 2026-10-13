import type {
  Role, User, Project, Issue, IssueComment, IssueHistoryEntry, IssueAttachment,
  Group, GroupMessage, AppNotification, ActivityLog, Permission,
  UserPreferences, AppSettings, UUID, ProjectMember,
} from '@/lib/types';
import { DEFAULT_PROJECT_ROLE } from '@/lib/types';
import {
  SEED_ROLES, SEED_USERS, SEED_PROJECTS, SEED_ISSUES,
  SEED_COMMENTS, SEED_HISTORY, SEED_ATTACHMENTS,
  SEED_GROUPS, SEED_MESSAGES,
  SEED_NOTIFICATIONS, SEED_ACTIVITY, SEED_PROJECT_MEMBERS,
} from '@/lib/seed-data';

const STORAGE_KEY = 'techtrioz_ims_db_v1';

interface DBShape {
  roles: Role[];
  users: User[];
  projects: Project[];
  projectMembers: ProjectMember[];
  issues: Issue[];
  comments: IssueComment[];
  history: IssueHistoryEntry[];
  attachments: IssueAttachment[];
  groups: Group[];
  messages: GroupMessage[];
  notifications: AppNotification[];
  activity: ActivityLog[];
  settings: AppSettings;
  preferences: Record<string, UserPreferences>;
  issueCounter: number;
}

function defaultSettings(): AppSettings {
  return {
    defaultIssueStatus: 'todo',
    requireApprovalForCompletion: true,
    allowSelfAssignment: true,
    notifyOnAssignment: true,
    notifyOnStatusChange: true,
  };
}

function defaultPreferences(): UserPreferences {
  return {
    theme: 'light',
    emailNotifications: true,
    pushNotifications: true,
    deadlineAlerts: true,
    mentionAlerts: true,
  };
}

function createSeedDB(): DBShape {
  return {
    roles: structuredClone(SEED_ROLES),
    users: structuredClone(SEED_USERS),
    projects: structuredClone(SEED_PROJECTS),
    projectMembers: structuredClone(SEED_PROJECT_MEMBERS),
    issues: structuredClone(SEED_ISSUES),
    comments: structuredClone(SEED_COMMENTS),
    history: structuredClone(SEED_HISTORY),
    attachments: structuredClone(SEED_ATTACHMENTS),
    groups: structuredClone(SEED_GROUPS),
    messages: structuredClone(SEED_MESSAGES),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    activity: structuredClone(SEED_ACTIVITY),
    settings: defaultSettings(),
    preferences: {},
    issueCounter: 124,
  };
}

function loadDB(): DBShape {
  if (typeof window === 'undefined') return createSeedDB();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createSeedDB();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw) as Partial<DBShape>;
    // Migration: ensure projectMembers exists; seed from existing memberIds
    if (!parsed.projectMembers) {
      parsed.projectMembers = [];
      if (parsed.projects) {
        for (const proj of parsed.projects) {
          for (const uid of proj.memberIds) {
            if (!parsed.projectMembers.find((m) => m.projectId === proj.id && m.userId === uid)) {
              parsed.projectMembers.push({
                id: genId('pmem'),
                projectId: proj.id,
                userId: uid,
                projectRole: DEFAULT_PROJECT_ROLE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            }
          }
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed as DBShape;
  } catch {
    return createSeedDB();
  }
}

function saveDB(db: DBShape): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // ignore quota errors
  }
}

// Singleton in-memory mirror synced with localStorage
let db: DBShape | null = null;

function getDB(): DBShape {
  if (!db) db = loadDB();
  return db;
}

function persist(): void {
  if (db) saveDB(db);
}

export function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function resetDB(): void {
  db = createSeedDB();
  saveDB(db);
}

// ─── Roles ───
export const roleRepo = {
  all(): Role[] {
    return [...getDB().roles];
  },
  find(id: UUID): Role | undefined {
    return getDB().roles.find((r) => r.id === id);
  },
  findByName(name: string): Role | undefined {
    return getDB().roles.find((r) => r.name.toLowerCase() === name.toLowerCase());
  },
  create(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Role {
    const newRole: Role = {
      ...role,
      id: genId('role'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getDB().roles.push(newRole);
    persist();
    return newRole;
  },
  update(id: UUID, patch: Partial<Role>): Role | undefined {
    const db = getDB();
    const idx = db.roles.findIndex((r) => r.id === id);
    if (idx === -1) return undefined;
    db.roles[idx] = { ...db.roles[idx], ...patch, updatedAt: new Date().toISOString() };
    persist();
    return db.roles[idx];
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.roles.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    db.roles.splice(idx, 1);
    persist();
    return true;
  },
};

// ─── Users ───
export const userRepo = {
  all(): User[] {
    return [...getDB().users];
  },
  find(id: UUID): User | undefined {
    return getDB().users.find((u) => u.id === id);
  },
  findByEmail(email: string): User | undefined {
    return getDB().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  },
  create(user: Omit<User, 'id' | 'createdAt'>): User {
    const newUser: User = {
      ...user,
      id: genId('user'),
      createdAt: new Date().toISOString(),
    };
    getDB().users.push(newUser);
    persist();
    return newUser;
  },
  update(id: UUID, patch: Partial<User>): User | undefined {
    const db = getDB();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return undefined;
    db.users[idx] = { ...db.users[idx], ...patch };
    persist();
    return db.users[idx];
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    db.users.splice(idx, 1);
    persist();
    return true;
  },
};

// ─── Projects ───
export const projectRepo = {
  all(): Project[] {
    return [...getDB().projects];
  },
  find(id: UUID): Project | undefined {
    return getDB().projects.find((p) => p.id === id);
  },
  findByKey(key: string): Project | undefined {
    return getDB().projects.find((p) => p.key.toLowerCase() === key.toLowerCase());
  },
  create(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Project {
    const newProject: Project = {
      ...project,
      id: genId('proj'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getDB().projects.push(newProject);
    persist();
    return newProject;
  },
  update(id: UUID, patch: Partial<Project>): Project | undefined {
    const db = getDB();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    db.projects[idx] = { ...db.projects[idx], ...patch, updatedAt: new Date().toISOString() };
    persist();
    return db.projects[idx];
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.projects.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    db.projects.splice(idx, 1);
    persist();
    return true;
  },
};

// ─── Project Memberships ───
export const membershipRepo = {
  all(): ProjectMember[] {
    return [...getDB().projectMembers];
  },
  byProject(projectId: UUID): ProjectMember[] {
    return getDB().projectMembers.filter((m) => m.projectId === projectId);
  },
  find(projectId: UUID, userId: UUID): ProjectMember | undefined {
    return getDB().projectMembers.find((m) => m.projectId === projectId && m.userId === userId);
  },
  create(membership: Omit<ProjectMember, 'id' | 'createdAt' | 'updatedAt'>): ProjectMember {
    const newMembership: ProjectMember = {
      ...membership,
      id: genId('pmem'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getDB().projectMembers.push(newMembership);
    persist();
    return newMembership;
  },
  updateRole(projectId: UUID, userId: UUID, projectRole: string): ProjectMember | undefined {
    const db = getDB();
    const idx = db.projectMembers.findIndex((m) => m.projectId === projectId && m.userId === userId);
    if (idx === -1) return undefined;
    db.projectMembers[idx] = {
      ...db.projectMembers[idx],
      projectRole,
      updatedAt: new Date().toISOString(),
    };
    persist();
    return db.projectMembers[idx];
  },
  delete(projectId: UUID, userId: UUID): boolean {
    const db = getDB();
    const idx = db.projectMembers.findIndex((m) => m.projectId === projectId && m.userId === userId);
    if (idx === -1) return false;
    db.projectMembers.splice(idx, 1);
    persist();
    return true;
  },
  ensureSeed(projectId: UUID, userIds: UUID[]): void {
    const db = getDB();
    for (const userId of userIds) {
      const exists = db.projectMembers.find(
        (m) => m.projectId === projectId && m.userId === userId
      );
      if (!exists) {
        db.projectMembers.push({
          id: genId('pmem'),
          projectId,
          userId,
          projectRole: DEFAULT_PROJECT_ROLE,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    persist();
  },
};

// ─── Issues ───
export const issueRepo = {
  all(): Issue[] {
    return [...getDB().issues];
  },
  find(id: UUID): Issue | undefined {
    return getDB().issues.find((i) => i.id === id);
  },
  byProject(projectId: UUID): Issue[] {
    return getDB().issues.filter((i) => i.projectId === projectId);
  },
  nextKey(projectKey: string): string {
    const db = getDB();
    db.issueCounter++;
    persist();
    return `${projectKey}-${db.issueCounter}`;
  },
  create(issue: Omit<Issue, 'id' | 'key' | 'createdAt' | 'updatedAt'>, projectKey: string): Issue {
    const db = getDB();
    db.issueCounter++;
    const newIssue: Issue = {
      ...issue,
      id: genId('issue'),
      key: `${projectKey}-${db.issueCounter}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.issues.push(newIssue);
    persist();
    return newIssue;
  },
  update(id: UUID, patch: Partial<Issue>): Issue | undefined {
    const db = getDB();
    const idx = db.issues.findIndex((i) => i.id === id);
    if (idx === -1) return undefined;
    db.issues[idx] = { ...db.issues[idx], ...patch, updatedAt: new Date().toISOString() };
    persist();
    return db.issues[idx];
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.issues.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    db.issues.splice(idx, 1);
    db.comments = db.comments.filter((c) => c.issueId !== id);
    db.history = db.history.filter((h) => h.issueId !== id);
    db.attachments = db.attachments.filter((a) => a.issueId !== id);
    persist();
    return true;
  },
};

// ─── Attachments ───
export const attachmentRepo = {
  byIssue(issueId: UUID): IssueAttachment[] {
    return getDB().attachments.filter((a) => a.issueId === issueId);
  },
  create(att: Omit<IssueAttachment, 'id' | 'uploadedAt'>): IssueAttachment {
    const newAtt: IssueAttachment = {
      ...att,
      id: genId('att'),
      uploadedAt: new Date().toISOString(),
    };
    getDB().attachments.push(newAtt);
    persist();
    return newAtt;
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.attachments.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    db.attachments.splice(idx, 1);
    persist();
    return true;
  },
};

// ─── Comments ───
export const commentRepo = {
  byIssue(issueId: UUID): IssueComment[] {
    return getDB().comments.filter((c) => c.issueId === issueId);
  },
  create(comment: Omit<IssueComment, 'id' | 'createdAt'>): IssueComment {
    const newComment: IssueComment = {
      ...comment,
      id: genId('cmt'),
      createdAt: new Date().toISOString(),
    };
    getDB().comments.push(newComment);
    persist();
    return newComment;
  },
};

// ─── History ───
export const historyRepo = {
  byIssue(issueId: UUID): IssueHistoryEntry[] {
    return getDB().history.filter((h) => h.issueId === issueId);
  },
  create(entry: Omit<IssueHistoryEntry, 'id' | 'timestamp'>): IssueHistoryEntry {
    const newEntry: IssueHistoryEntry = {
      ...entry,
      id: genId('hist'),
      timestamp: new Date().toISOString(),
    };
    getDB().history.push(newEntry);
    persist();
    return newEntry;
  },
};

// ─── Groups ───
export const groupRepo = {
  all(): Group[] {
    return [...getDB().groups];
  },
  find(id: UUID): Group | undefined {
    return getDB().groups.find((g) => g.id === id);
  },
  byProject(projectId: UUID): Group[] {
    return getDB().groups.filter((g) => g.projectId === projectId);
  },
  create(group: Omit<Group, 'id' | 'createdAt' | 'updatedAt'>): Group {
    const newGroup: Group = {
      ...group,
      id: genId('grp'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    getDB().groups.push(newGroup);
    persist();
    return newGroup;
  },
  update(id: UUID, patch: Partial<Group>): Group | undefined {
    const db = getDB();
    const idx = db.groups.findIndex((g) => g.id === id);
    if (idx === -1) return undefined;
    db.groups[idx] = { ...db.groups[idx], ...patch, updatedAt: new Date().toISOString() };
    persist();
    return db.groups[idx];
  },
  delete(id: UUID): boolean {
    const db = getDB();
    const idx = db.groups.findIndex((g) => g.id === id);
    if (idx === -1) return false;
    db.groups.splice(idx, 1);
    db.messages = db.messages.filter((m) => m.groupId !== id);
    persist();
    return true;
  },
};

// ─── Messages ───
export const messageRepo = {
  byGroup(groupId: UUID): GroupMessage[] {
    return getDB().messages.filter((m) => m.groupId === groupId);
  },
  create(msg: Omit<GroupMessage, 'id' | 'createdAt' | 'readBy'>): GroupMessage {
    const newMsg: GroupMessage = {
      ...msg,
      id: genId('msg'),
      createdAt: new Date().toISOString(),
      readBy: [msg.senderId],
    };
    getDB().messages.push(newMsg);
    persist();
    return newMsg;
  },
  markRead(groupId: UUID, userId: UUID): void {
    const db = getDB();
    db.messages.forEach((m) => {
      if (m.groupId === groupId && !m.readBy.includes(userId)) {
        m.readBy.push(userId);
      }
    });
    persist();
  },
};

// ─── Notifications ───
export const notificationRepo = {
  byUser(userId: UUID): AppNotification[] {
    return getDB().notifications.filter((n) => n.userId === userId);
  },
  create(notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): AppNotification {
    const newNotif: AppNotification = {
      ...notif,
      id: genId('ntf'),
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    getDB().notifications.push(newNotif);
    persist();
    return newNotif;
  },
  markRead(id: UUID): void {
    const db = getDB();
    const n = db.notifications.find((x) => x.id === id);
    if (n) { n.isRead = true; persist(); }
  },
  markAllRead(userId: UUID): void {
    const db = getDB();
    db.notifications.forEach((n) => {
      if (n.userId === userId) n.isRead = true;
    });
    persist();
  },
};

// ─── Activity Log ───
export const activityRepo = {
  all(): ActivityLog[] {
    return [...getDB().activity];
  },
  byProject(projectId: UUID): ActivityLog[] {
    return getDB().activity.filter((a) => a.projectId === projectId);
  },
  byEntity(entityType: string, entityId: UUID): ActivityLog[] {
    return getDB().activity.filter((a) => a.entityType === entityType && a.entityId === entityId);
  },
  create(entry: Omit<ActivityLog, 'id' | 'timestamp'>): ActivityLog {
    const newEntry: ActivityLog = {
      ...entry,
      id: genId('act'),
      timestamp: new Date().toISOString(),
    };
    getDB().activity.push(newEntry);
    persist();
    return newEntry;
  },
};

// ─── Settings & Preferences ───
export const settingsRepo = {
  get(): AppSettings {
    return { ...getDB().settings };
  },
  update(patch: Partial<AppSettings>): AppSettings {
    const db = getDB();
    db.settings = { ...db.settings, ...patch };
    persist();
    return db.settings;
  },
};

export const preferencesRepo = {
  get(userId: UUID): UserPreferences {
    const db = getDB();
    return db.preferences[userId] || defaultPreferences();
  },
  update(userId: UUID, patch: Partial<UserPreferences>): UserPreferences {
    const db = getDB();
    const current = db.preferences[userId] || defaultPreferences();
    db.preferences[userId] = { ...current, ...patch };
    persist();
    return db.preferences[userId];
  },
};

// ─── Permission helper ───
export function getUserPermissions(userId: UUID): Permission[] {
  const user = userRepo.find(userId);
  if (!user) return [];
  const perms = new Set<Permission>();
  for (const roleId of user.roleIds) {
    const role = roleRepo.find(roleId);
    if (role && role.isActive) {
      role.permissions.forEach((p) => perms.add(p));
    }
  }
  return Array.from(perms);
}

export function getUserRoles(userId: UUID): Role[] {
  const user = userRepo.find(userId);
  if (!user) return [];
  return user.roleIds
    .map((rid) => roleRepo.find(rid))
    .filter((r): r is Role => r !== undefined);
}

export function hasRoleName(userId: UUID, roleName: string): boolean {
  return getUserRoles(userId).some((r) => r.name.toLowerCase() === roleName.toLowerCase());
}
