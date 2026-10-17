export type UUID = string;
export type ISODate = string;

export type Permission =
  | 'dashboard.view'
  | 'projects.view' | 'projects.create' | 'projects.update' | 'projects.delete' | 'projects.assign_members'
  | 'issues.view' | 'issues.create' | 'issues.update' | 'issues.delete' | 'issues.assign' | 'issues.pick' | 'issues.change_status' | 'issues.comment' | 'issues.approve'
  | 'comments.view' | 'comments.create' | 'comments.edit' | 'comments.delete'
  | 'attachments.view' | 'attachments.create' | 'attachments.delete'
  | 'users.view' | 'users.create' | 'users.update' | 'users.deactivate'
  | 'roles.view' | 'roles.create' | 'roles.update' | 'roles.delete' | 'roles.assign_permissions'
  | 'groups.view' | 'groups.create' | 'groups.update' | 'groups.delete' | 'groups.manage_members' | 'groups.send_message'
  | 'reports.view' | 'reports.export'
  | 'notifications.view' | 'settings.view' | 'settings.update'
  | 'activity.view' | 'activity.export';

export type PermissionModule =
  | 'dashboard' | 'projects' | 'issues' | 'comments' | 'attachments' | 'users' | 'roles' | 'groups' | 'reports'
  | 'notifications' | 'settings' | 'activity';

export interface Role {
  id: UUID;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type UserStatus = 'active' | 'inactive';

export interface User {
  id: UUID;
  name: string;
  email: string;
  password: string;
  avatarColor: string;
  /** Resized image as a data URL; falls back to initials on avatarColor when absent */
  avatarUrl?: string;
  roleIds: UUID[];
  status: UserStatus;
  title?: string;
  department?: string;
  phone?: string;
  bio?: string;
  createdAt: ISODate;
  lastActiveAt?: ISODate;
}

export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed' | 'archived';
export type ProjectPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Project {
  id: UUID;
  name: string;
  key: string;
  description: string;
  objectives: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  ownerId: UUID;
  memberIds: UUID[];
  developerIds: UUID[];
  assignerIds: UUID[];
  tags: string[];
  color: string;
  startDate: ISODate;
  dueDate: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
  archivedAt?: ISODate;
}

export type ProjectRole = string;

export const DEFAULT_PROJECT_ROLES: string[] = [
  'Project Manager',
  'Frontend Developer',
  'Backend Developer',
  'Full-Stack Developer',
  'UI/UX Designer',
  'QA Engineer / Tester',
  'DevOps Engineer',
  'Business Analyst',
  'Issue Assigner',
  'Project Contributor / Other',
];

export const DEFAULT_PROJECT_ROLE = 'Project Contributor / Other';

export interface ProjectMember {
  id: UUID;
  projectId: UUID;
  userId: UUID;
  projectRole: ProjectRole;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type IssueStatus = 'todo' | 'in_progress' | 'completed' | 'approved' | 'on_hold';
export type IssuePriority = 'critical' | 'high' | 'medium' | 'low';
export type IssueType = 'bug' | 'incident' | 'task' | 'improvement' | 'security';
export type IssueSeverity = 'sev1' | 'sev2' | 'sev3' | 'sev4';

export interface Issue {
  id: UUID;
  key: string;
  title: string;
  description: string;
  projectId: UUID;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  reporterId: UUID;
  assigneeId: UUID | null;
  labels: string[];
  severity?: IssueSeverity;
  reproducibility?: string;
  startDate: ISODate;
  dueDate?: ISODate;
  createdAt: ISODate;
  updatedAt: ISODate;
  resolvedAt?: ISODate;
  approvedAt?: ISODate;
  approvedBy?: UUID;
}

export interface IssueComment {
  id: UUID;
  issueId: UUID;
  authorId: UUID;
  body: string;
  createdAt: ISODate;
  updatedAt?: ISODate;
}

export interface IssueHistoryEntry {
  id: UUID;
  issueId: UUID;
  actorId: UUID;
  field: string;
  oldValue: string;
  newValue: string;
  timestamp: ISODate;
}

export interface IssueAttachment {
  id: UUID;
  issueId: UUID;
  fileName: string;
  fileSize: number;
  uploadedById: UUID;
  uploadedAt: ISODate;
}

export type GroupType = 'default' | 'private' | 'secret';

export interface Group {
  id: UUID;
  name: string;
  projectId: UUID;
  type: GroupType;
  memberIds: UUID[];
  createdBy: UUID;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface GroupMessage {
  id: UUID;
  groupId: UUID;
  senderId: UUID;
  body: string;
  createdAt: ISODate;
  readBy: UUID[];
}

export type NotificationType =
  | 'issue_assigned' | 'issue_status_changed' | 'issue_commented'
  | 'project_membership' | 'group_message' | 'issue_deadline' | 'role_changed';

export interface AppNotification {
  id: UUID;
  userId: UUID;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt: ISODate;
}

export interface ActivityLog {
  id: UUID;
  actorId: UUID;
  action: string;
  entityType: string;
  entityId: UUID;
  entityName: string;
  summary: string;
  projectId?: UUID;
  timestamp: ISODate;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  pushNotifications: boolean;
  deadlineAlerts: boolean;
  mentionAlerts: boolean;
}

export interface AppSettings {
  defaultIssueStatus: IssueStatus;
  requireApprovalForCompletion: boolean;
  allowSelfAssignment: boolean;
  notifyOnAssignment: boolean;
  notifyOnStatusChange: boolean;
}
