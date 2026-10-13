import type { Project, Group, GroupMessage, UUID, User, Permission, Issue, IssueStatus, IssueComment, IssueAttachment, IssueHistoryEntry, ProjectRole } from '@/lib/types';
import { DEFAULT_PROJECT_ROLE, DEFAULT_PROJECT_ROLES } from '@/lib/types';
import {
  projectRepo, groupRepo, messageRepo, userRepo, activityRepo,
  issueRepo, commentRepo, historyRepo, attachmentRepo, notificationRepo,
  membershipRepo,
  getUserPermissions, getUserRoles, hasRoleName,
} from '@/lib/repository';
import { ISSUE_STATUS_META } from '@/lib/shared-utils';

// ─── Project membership helpers ───

function isProjectMember(project: Project, userId: UUID): boolean {
  return project.memberIds.includes(userId);
}

export function canUserViewProject(userId: UUID, project: Project): boolean {
  const perms = getUserPermissions(userId);
  if (perms.includes('projects.view')) {
    // Super admin sees all; others see only their projects
    const roles = getUserRoles(userId);
    const isSuperAdmin = roles.some((r) => r.name === 'Super Admin');
    if (isSuperAdmin) return true;
    return isProjectMember(project, userId);
  }
  return false;
}

export function getVisibleProjects(userId: UUID): Project[] {
  return projectRepo.all().filter((p) => canUserViewProject(userId, p));
}

export function getProjectMembers(project: Project): User[] {
  return project.memberIds
    .map((id) => userRepo.find(id))
    .filter((u): u is User => u !== undefined);
}

export function getProjectMemberRole(projectId: UUID, userId: UUID): ProjectRole {
  const membership = membershipRepo.find(projectId, userId);
  return membership?.projectRole || DEFAULT_PROJECT_ROLE;
}

export function normalizeProjectRole(role: string): string {
  const trimmed = role.trim().replace(/\s+/g, ' ');
  if (!trimmed) return DEFAULT_PROJECT_ROLE;
  const match = DEFAULT_PROJECT_ROLES.find(
    (r) => r.toLowerCase() === trimmed.toLowerCase()
  );
  return match || trimmed;
}



export function getProjectDevelopers(project: Project): User[] {
  return project.developerIds
    .map((id) => userRepo.find(id))
    .filter((u): u is User => u !== undefined);
}

export function getProjectAssigners(project: Project): User[] {
  return project.assignerIds
    .map((id) => userRepo.find(id))
    .filter((u): u is User => u !== undefined);
}

// ─── Project service with default-group creation and membership sync ───

export const projectService = {
  create(
    data: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>,
    creatorId: UUID
  ): Project {
    const project = projectRepo.create(data);

    // Seed project memberships with default roles
    membershipRepo.ensureSeed(project.id, project.memberIds);

    // Create exactly one default group for the project
    const defaultGroup = groupRepo.create({
      name: project.name,
      projectId: project.id,
      type: 'default',
      memberIds: [...project.memberIds],
      createdBy: creatorId,
    });

    activityRepo.create({
      actorId: creatorId,
      action: 'project_created',
      entityType: 'Project',
      entityId: project.id,
      entityName: project.name,
      summary: `Created project "${project.name}"`,
      projectId: project.id,
    });

    activityRepo.create({
      actorId: creatorId,
      action: 'group_created',
      entityType: 'Group',
      entityId: defaultGroup.id,
      entityName: defaultGroup.name,
      summary: `Auto-created default group for ${project.name}`,
      projectId: project.id,
    });

    return project;
  },

  update(id: UUID, patch: Partial<Project>, actorId: UUID): Project | undefined {
    const hadMemberChange = patch.memberIds !== undefined;
    const oldProject = projectRepo.find(id);
    const project = projectRepo.update(id, patch);
    if (project) {
      if (hadMemberChange && oldProject) {
        // Sync memberships: add new ones, remove departed ones
        const oldIds = oldProject.memberIds;
        const newIds = project.memberIds;
        const added = newIds.filter((uid) => !oldIds.includes(uid));
        const removed = oldIds.filter((uid) => !newIds.includes(uid));
        for (const uid of added) {
          if (!membershipRepo.find(id, uid)) {
            membershipRepo.create({ projectId: id, userId: uid, projectRole: DEFAULT_PROJECT_ROLE });
          }
        }
        for (const uid of removed) {
          membershipRepo.delete(id, uid);
        }
        syncDefaultGroupMembership(id);
      }
      activityRepo.create({
        actorId,
        action: 'project_updated',
        entityType: 'Project',
        entityId: id,
        entityName: project.name,
        summary: `Updated project "${project.name}"`,
        projectId: id,
      });
    }
    return project;
  },

  archive(id: UUID, actorId: UUID): Project | undefined {
    const project = projectRepo.update(id, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
    });
    if (project) {
      activityRepo.create({
        actorId,
        action: 'project_archived',
        entityType: 'Project',
        entityId: id,
        entityName: project.name,
        summary: `Archived project "${project.name}"`,
        projectId: id,
      });
    }
    return project;
  },

  restore(id: UUID, actorId: UUID): Project | undefined {
    const project = projectRepo.update(id, {
      status: 'active',
      archivedAt: undefined,
    });
    if (project) {
      activityRepo.create({
        actorId,
        action: 'project_restored',
        entityType: 'Project',
        entityId: id,
        entityName: project.name,
        summary: `Restored project "${project.name}" from archive`,
        projectId: id,
      });
    }
    return project;
  },

  // Add a member and sync to default group
  addMember(projectId: UUID, userId: UUID, actorId: UUID, projectRole?: string): Project | undefined {
    const project = projectRepo.find(projectId);
    if (!project) return undefined;
    if (project.memberIds.includes(userId)) return project;

    const updated = projectRepo.update(projectId, {
      memberIds: [...project.memberIds, userId],
    });

    // Create membership record with project role
    const role = projectRole ? normalizeProjectRole(projectRole) : DEFAULT_PROJECT_ROLE;
    membershipRepo.create({
      projectId,
      userId,
      projectRole: role,
    });

    // Sync to default group
    syncDefaultGroupMembership(projectId);

    if (updated) {
      const user = userRepo.find(userId);
      activityRepo.create({
        actorId,
        action: 'member_added',
        entityType: 'Project',
        entityId: projectId,
        entityName: updated.name,
        summary: `Added ${user?.name || 'user'} as ${role} to ${updated.name}`,
        projectId,
      });
    }
    return updated;
  },

  // Remove a member and sync to default group
  removeMember(projectId: UUID, userId: UUID, actorId: UUID): Project | undefined {
    const project = projectRepo.find(projectId);
    if (!project) return undefined;

    const updated = projectRepo.update(projectId, {
      memberIds: project.memberIds.filter((id) => id !== userId),
      developerIds: project.developerIds.filter((id) => id !== userId),
      assignerIds: project.assignerIds.filter((id) => id !== userId),
    });

    // Delete membership record
    membershipRepo.delete(projectId, userId);

    // Sync to default group
    syncDefaultGroupMembership(projectId);

    if (updated) {
      const user = userRepo.find(userId);
      activityRepo.create({
        actorId,
        action: 'member_removed',
        entityType: 'Project',
        entityId: projectId,
        entityName: updated.name,
        summary: `Removed ${user?.name || 'user'} from ${updated.name}`,
        projectId,
      });
    }
    return updated;
  },

  setDeveloper(projectId: UUID, userId: UUID, isDev: boolean): Project | undefined {
    const project = projectRepo.find(projectId);
    if (!project) return undefined;
    let devIds = project.developerIds;
    if (isDev && !devIds.includes(userId)) {
      devIds = [...devIds, userId];
    } else if (!isDev) {
      devIds = devIds.filter((id) => id !== userId);
    }
    return projectRepo.update(projectId, { developerIds: devIds });
  },

  setAssigner(projectId: UUID, userId: UUID, isAssigner: boolean): Project | undefined {
    const project = projectRepo.find(projectId);
    if (!project) return undefined;
    let assignerIds = project.assignerIds;
    if (isAssigner && !assignerIds.includes(userId)) {
      assignerIds = [...assignerIds, userId];
    } else if (!isAssigner) {
      assignerIds = assignerIds.filter((id) => id !== userId);
    }
    return projectRepo.update(projectId, { assignerIds });
  },

  // Update a member's project-specific role
  updateMemberRole(projectId: UUID, userId: UUID, projectRole: string, actorId: UUID): Project | undefined {
    const project = projectRepo.find(projectId);
    if (!project) return undefined;
    if (!project.memberIds.includes(userId)) return undefined;

    const normalized = normalizeProjectRole(projectRole);
    const oldMembership = membershipRepo.find(projectId, userId);
    const oldRole = oldMembership?.projectRole || DEFAULT_PROJECT_ROLE;

    membershipRepo.updateRole(projectId, userId, normalized);

    const user = userRepo.find(userId);
    activityRepo.create({
      actorId,
      action: 'member_role_changed',
      entityType: 'Project',
      entityId: projectId,
      entityName: project.name,
      summary: `Changed ${user?.name || 'user'}'s project role from "${oldRole}" to "${normalized}" in ${project.name}`,
      projectId,
    });

    return project;
  },
};

// ─── Default group membership sync ───

export function syncDefaultGroupMembership(projectId: UUID): void {
  const project = projectRepo.find(projectId);
  if (!project) return;
  const defaultGroup = groupRepo
    .byProject(projectId)
    .find((g) => g.type === 'default');
  if (defaultGroup) {
    groupRepo.update(defaultGroup.id, {
      memberIds: [...project.memberIds],
    });
  }
}

export function getDefaultGroup(projectId: UUID): Group | undefined {
  return groupRepo.byProject(projectId).find((g) => g.type === 'default');
}

// ─── Group visibility / privacy enforcement ───

export function canUserViewGroup(userId: UUID, group: Group): boolean {
  // Default groups: visible to all project members
  if (group.type === 'default') {
    const project = projectRepo.find(group.projectId);
    if (!project) return false;
    return canUserViewProject(userId, project);
  }

  // Private groups: visible to project members, but only members can see content
  if (group.type === 'private') {
    const project = projectRepo.find(group.projectId);
    if (!project) return false;
    if (!canUserViewProject(userId, project)) return false;
    return group.memberIds.includes(userId);
  }

  // Secret groups: only members can see them at all
  if (group.type === 'secret') {
    return group.memberIds.includes(userId);
  }

  return false;
}

export function getVisibleGroups(userId: UUID): Group[] {
  return groupRepo.all().filter((g) => canUserViewGroup(userId, g));
}

export function getEligibleMembersForGroup(group: Group): User[] {
  const project = projectRepo.find(group.projectId);
  if (!project) return [];
  return getProjectMembers(project);
}

export function getGroupUnreadCount(groupId: UUID, userId: UUID): number {
  return messageRepo.byGroup(groupId).filter(
    (m) => !m.readBy.includes(userId)
  ).length;
}

// ─── Group service ───

export const groupService = {
  create(
    data: { name: string; projectId: UUID; type: 'private' | 'secret'; memberIds: UUID[] },
    creatorId: UUID
  ): Group | undefined {
    // Validate that members are project members
    const project = projectRepo.find(data.projectId);
    if (!project) return undefined;

    const validMembers = data.memberIds.filter((id) =>
      project.memberIds.includes(id)
    );

    // Creator must be a member
    if (!validMembers.includes(creatorId) && project.memberIds.includes(creatorId)) {
      validMembers.push(creatorId);
    }

    const group = groupRepo.create({
      name: data.name,
      projectId: data.projectId,
      type: data.type,
      memberIds: validMembers,
      createdBy: creatorId,
    });

    activityRepo.create({
      actorId: creatorId,
      action: 'group_created',
      entityType: 'Group',
      entityId: group.id,
      entityName: group.name,
      summary: `Created ${data.type} group "${group.name}"`,
      projectId: data.projectId,
    });

    return group;
  },

  update(id: UUID, patch: Partial<Pick<Group, 'name'>>, actorId: UUID): Group | undefined {
    const group = groupRepo.update(id, patch);
    if (group) {
      activityRepo.create({
        actorId,
        action: 'group_updated',
        entityType: 'Group',
        entityId: id,
        entityName: group.name,
        summary: `Updated group "${group.name}"`,
        projectId: group.projectId,
      });
    }
    return group;
  },

  delete(id: UUID, actorId: UUID): boolean {
    const group = groupRepo.find(id);
    if (!group) return false;
    if (group.type === 'default') return false; // cannot delete default groups

    const success = groupRepo.delete(id);
    if (success) {
      activityRepo.create({
        actorId,
        action: 'group_deleted',
        entityType: 'Group',
        entityId: id,
        entityName: group.name,
        summary: `Deleted group "${group.name}"`,
        projectId: group.projectId,
      });
    }
    return success;
  },

  addMember(groupId: UUID, userId: UUID, actorId: UUID): Group | undefined {
    const group = groupRepo.find(groupId);
    if (!group) return undefined;
    if (group.type === 'default') return group; // default group membership is managed by project

    // Must be a project member
    const project = projectRepo.find(group.projectId);
    if (!project || !project.memberIds.includes(userId)) return undefined;

    if (group.memberIds.includes(userId)) return group;
    const updated = groupRepo.update(groupId, {
      memberIds: [...group.memberIds, userId],
    });
    return updated;
  },

  removeMember(groupId: UUID, userId: UUID, actorId: UUID): Group | undefined {
    const group = groupRepo.find(groupId);
    if (!group) return undefined;
    if (group.type === 'default') return group;

    const updated = groupRepo.update(groupId, {
      memberIds: group.memberIds.filter((id) => id !== userId),
    });
    return updated;
  },

  sendMessage(groupId: UUID, senderId: UUID, body: string): GroupMessage | undefined {
    const group = groupRepo.find(groupId);
    if (!group) return undefined;
    if (!group.memberIds.includes(senderId)) return undefined;

    const msg = messageRepo.create({
      groupId,
      senderId,
      body,
    });
    return msg;
  },

  markRead(groupId: UUID, userId: UUID): void {
    messageRepo.markRead(groupId, userId);
  },
};

// ─── Issue visibility ───

export function canUserViewIssue(userId: UUID, issue: Issue): boolean {
  const perms = getUserPermissions(userId);
  if (!perms.includes('issues.view')) return false;
  const roles = getUserRoles(userId);
  const isSuperAdmin = roles.some((r) => r.name === 'Super Admin');
  if (isSuperAdmin) return true;
  const project = projectRepo.find(issue.projectId);
  if (!project) return false;
  return project.memberIds.includes(userId);
}

export function getVisibleIssues(userId: UUID): Issue[] {
  return issueRepo.all().filter((i) => canUserViewIssue(userId, i));
}

export function getIssuesByProject(projectId: UUID): Issue[] {
  return issueRepo.byProject(projectId);
}

// ─── Assignment eligibility ───

export function canUserAssignIssue(userId: UUID, issue: Issue): boolean {
  const perms = getUserPermissions(userId);
  if (!perms.includes('issues.assign')) return false;
  // Issue Assigners cannot assign or reassign
  if (hasRoleName(userId, 'Issue Assigner') && !hasRoleName(userId, 'Developer') && !hasRoleName(userId, 'Super Admin')) {
    return false;
  }
  // Must be a member of the same project
  const project = projectRepo.find(issue.projectId);
  if (!project) return false;
  const roles = getUserRoles(userId);
  const isSuperAdmin = roles.some((r) => r.name === 'Super Admin');
  if (isSuperAdmin) return true;
  return project.memberIds.includes(userId);
}

export function getEligibleAssignees(issue: Issue): User[] {
  const project = projectRepo.find(issue.projectId);
  if (!project) return [];
  // Eligible assignees are project members who are developers or have assign permission
  return project.memberIds
    .map((id) => userRepo.find(id))
    .filter((u): u is User => u !== undefined && u.status === 'active');
}

// ─── Status transition validation ───

const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  todo: ['in_progress', 'on_hold', 'completed'],
  in_progress: ['todo', 'completed', 'on_hold'],
  completed: ['approved', 'in_progress'],
  approved: [],
  on_hold: ['todo', 'in_progress'],
};

export function canTransitionStatus(from: IssueStatus, to: IssueStatus): boolean {
  if (from === to) return false;
  const allowed = VALID_TRANSITIONS[from];
  return allowed.includes(to);
}

export function getValidTransitions(from: IssueStatus): IssueStatus[] {
  return VALID_TRANSITIONS[from];
}

// ─── History helper ───

function recordHistory(issueId: UUID, actorId: UUID, field: string, oldValue: string, newValue: string): void {
  historyRepo.create({ issueId, actorId, field, oldValue, newValue });
}

function notifyUser(userId: UUID, type: string, title: string, body: string, link: string): void {
  notificationRepo.create({ userId, type: type as any, title, body, link });
}

// ─── Issue service ───

export const issueService = {
  create(
    data: {
      title: string;
      description: string;
      projectId: UUID;
      type: Issue['type'];
      priority: Issue['priority'];
      severity?: Issue['severity'];
      reproducibility?: string;
      assigneeId?: UUID | null;
      labels?: string[];
      dueDate?: string;
    },
    creatorId: UUID
  ): Issue | { error: string } {
    const project = projectRepo.find(data.projectId);
    if (!project) return { error: 'Project not found' };

    // Issue Assigners can create but cannot assign
    const isAssignerOnly = hasRoleName(creatorId, 'Issue Assigner') && !hasRoleName(creatorId, 'Developer') && !hasRoleName(creatorId, 'Super Admin');
    let assigneeId = data.assigneeId ?? null;

    if (assigneeId && isAssignerOnly) {
      assigneeId = null;
    }

    // If assignee is provided, validate eligibility
    if (assigneeId) {
      if (!project.memberIds.includes(assigneeId)) {
        return { error: 'Assignee must be a project member' };
      }
      const creatorPerms = getUserPermissions(creatorId);
      if (!creatorPerms.includes('issues.assign')) {
        assigneeId = null;
      } else if (isAssignerOnly) {
        assigneeId = null;
      }
    }

    const issue = issueRepo.create({
      title: data.title.trim(),
      description: data.description.trim(),
      projectId: data.projectId,
      type: data.type,
      priority: data.priority,
      status: 'todo',
      reporterId: creatorId,
      assigneeId,
      labels: data.labels || [],
      severity: data.severity,
      reproducibility: data.reproducibility,
      startDate: new Date().toISOString(),
      dueDate: data.dueDate,
    }, project.key);

    recordHistory(issue.id, creatorId, 'created', '', 'Issue created');

    activityRepo.create({
      actorId: creatorId,
      action: 'issue_created',
      entityType: 'Issue',
      entityId: issue.id,
      entityName: issue.key,
      summary: `Created issue "${issue.title}"`,
      projectId: data.projectId,
    });

    if (assigneeId) {
      recordHistory(issue.id, creatorId, 'assignee', 'Unassigned', userRepo.find(assigneeId)?.name || 'Unknown');
      notifyUser(assigneeId, 'issue_assigned', 'Issue assigned to you', `${issue.key}: ${issue.title}`, `/issues/${issue.id}`);
      activityRepo.create({
        actorId: creatorId,
        action: 'issue_assigned',
        entityType: 'Issue',
        entityId: issue.id,
        entityName: issue.key,
        summary: `Assigned ${issue.key} to ${userRepo.find(assigneeId)?.name || 'Unknown'}`,
        projectId: data.projectId,
      });
    }

    return issue;
  },

  update(id: UUID, patch: Partial<Pick<Issue, 'title' | 'description' | 'type' | 'priority' | 'severity' | 'reproducibility' | 'labels' | 'dueDate'>>, actorId: UUID): Issue | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };

    const changes: { field: string; old: string; new: string }[] = [];
    if (patch.title !== undefined && patch.title !== issue.title) {
      changes.push({ field: 'title', old: issue.title, new: patch.title });
    }
    if (patch.description !== undefined && patch.description !== issue.description) {
      changes.push({ field: 'description', old: '(previous)', new: '(updated)' });
    }
    if (patch.type !== undefined && patch.type !== issue.type) {
      changes.push({ field: 'type', old: issue.type, new: patch.type });
    }
    if (patch.priority !== undefined && patch.priority !== issue.priority) {
      changes.push({ field: 'priority', old: issue.priority, new: patch.priority });
    }
    if (patch.severity !== undefined && patch.severity !== issue.severity) {
      changes.push({ field: 'severity', old: issue.severity || '—', new: patch.severity });
    }
    if (patch.reproducibility !== undefined && patch.reproducibility !== issue.reproducibility) {
      changes.push({ field: 'reproducibility', old: issue.reproducibility || '—', new: patch.reproducibility });
    }
    if (patch.labels !== undefined) {
      const oldLabels = issue.labels.join(', ');
      const newLabels = patch.labels.join(', ');
      if (oldLabels !== newLabels) {
        changes.push({ field: 'labels', old: oldLabels || '—', new: newLabels || '—' });
      }
    }
    if (patch.dueDate !== undefined && patch.dueDate !== issue.dueDate) {
      changes.push({ field: 'dueDate', old: issue.dueDate || '—', new: patch.dueDate || '—' });
    }

    const updated = issueRepo.update(id, patch);
    if (!updated) return { error: 'Issue not found' };

    changes.forEach((c) => recordHistory(id, actorId, c.field, c.old, c.new));

    activityRepo.create({
      actorId,
      action: 'issue_updated',
      entityType: 'Issue',
      entityId: id,
      entityName: updated.key,
      summary: `Updated ${updated.key}`,
      projectId: updated.projectId,
    });

    return updated;
  },

  assign(id: UUID, assigneeId: UUID, actorId: UUID): Issue | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };

    if (!canUserAssignIssue(actorId, issue)) {
      return { error: 'You do not have permission to assign this issue' };
    }

    const project = projectRepo.find(issue.projectId);
    if (!project) return { error: 'Project not found' };
    if (!project.memberIds.includes(assigneeId)) {
      return { error: 'Assignee must be a project member' };
    }

    const oldName = issue.assigneeId ? userRepo.find(issue.assigneeId)?.name || 'Unknown' : 'Unassigned';
    const newName = userRepo.find(assigneeId)?.name || 'Unknown';

    const updated = issueRepo.update(id, { assigneeId });
    if (!updated) return { error: 'Issue not found' };

    recordHistory(id, actorId, 'assignee', oldName, newName);
    notifyUser(assigneeId, 'issue_assigned', 'Issue assigned to you', `${updated.key}: ${updated.title}`, `/issues/${id}`);
    activityRepo.create({
      actorId,
      action: 'issue_assigned',
      entityType: 'Issue',
      entityId: id,
      entityName: updated.key,
      summary: `Assigned ${updated.key} to ${newName}`,
      projectId: updated.projectId,
    });

    return updated;
  },

  unassign(id: UUID, actorId: UUID): Issue | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };
    if (!issue.assigneeId) return { error: 'Issue is already unassigned' };
    if (!canUserAssignIssue(actorId, issue)) {
      return { error: 'You do not have permission to unassign this issue' };
    }

    const oldName = userRepo.find(issue.assigneeId)?.name || 'Unknown';
    const updated = issueRepo.update(id, { assigneeId: null });
    if (!updated) return { error: 'Issue not found' };

    recordHistory(id, actorId, 'assignee', oldName, 'Unassigned');
    activityRepo.create({
      actorId,
      action: 'issue_unassigned',
      entityType: 'Issue',
      entityId: id,
      entityName: updated.key,
      summary: `Unassigned ${updated.key}`,
      projectId: updated.projectId,
    });

    return updated;
  },

  changeStatus(id: UUID, newStatus: IssueStatus, actorId: UUID): Issue | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };

    if (!canTransitionStatus(issue.status, newStatus)) {
      return { error: `Cannot transition from ${ISSUE_STATUS_META[issue.status].label} to ${ISSUE_STATUS_META[newStatus].label}` };
    }

    const oldLabel = ISSUE_STATUS_META[issue.status].label;
    const newLabel = ISSUE_STATUS_META[newStatus].label;

    const patch: Partial<Issue> = { status: newStatus };
    if (newStatus === 'completed') {
      patch.resolvedAt = new Date().toISOString();
    }
    if (newStatus === 'approved') {
      patch.approvedAt = new Date().toISOString();
      patch.approvedBy = actorId;
    }

    const updated = issueRepo.update(id, patch);
    if (!updated) return { error: 'Issue not found' };

    recordHistory(id, actorId, 'status', oldLabel, newLabel);

    if (issue.assigneeId) {
      notifyUser(issue.assigneeId, 'issue_status_changed', 'Issue status updated', `${updated.key} moved to ${newLabel}`, `/issues/${id}`);
    }
    notifyUser(issue.reporterId, 'issue_status_changed', 'Issue status updated', `${updated.key} moved to ${newLabel}`, `/issues/${id}`);

    activityRepo.create({
      actorId,
      action: 'status_changed',
      entityType: 'Issue',
      entityId: id,
      entityName: updated.key,
      summary: `Changed ${updated.key} status from ${oldLabel} to ${newLabel}`,
      projectId: updated.projectId,
    });

    return updated;
  },

  approve(id: UUID, actorId: UUID): Issue | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };
    if (issue.status !== 'completed') return { error: 'Only completed issues can be approved' };

    return this.changeStatus(id, 'approved', actorId);
  },

  addComment(id: UUID, authorId: UUID, body: string): IssueComment | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };
    if (!body.trim()) return { error: 'Comment cannot be empty' };

    const comment = commentRepo.create({ issueId: id, authorId, body: body.trim() });

    // Notify reporter and assignee (excluding the author)
    const notifyIds = new Set<UUID>();
    if (issue.reporterId !== authorId) notifyIds.add(issue.reporterId);
    if (issue.assigneeId && issue.assigneeId !== authorId) notifyIds.add(issue.assigneeId);
    const author = userRepo.find(authorId);
    notifyIds.forEach((uid) => {
      notifyUser(uid, 'issue_commented', 'New comment on issue', `${author?.name || 'Someone'} commented on ${issue.key}`, `/issues/${id}`);
    });

    activityRepo.create({
      actorId: authorId,
      action: 'issue_commented',
      entityType: 'Issue',
      entityId: id,
      entityName: issue.key,
      summary: `Commented on ${issue.key}`,
      projectId: issue.projectId,
    });

    return comment;
  },

  addAttachment(id: UUID, fileName: string, fileSize: number, uploaderId: UUID): IssueAttachment | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };

    const att = attachmentRepo.create({ issueId: id, fileName, fileSize, uploadedById: uploaderId });

    activityRepo.create({
      actorId: uploaderId,
      action: 'attachment_added',
      entityType: 'Issue',
      entityId: id,
      entityName: issue.key,
      summary: `Added attachment "${fileName}" to ${issue.key}`,
      projectId: issue.projectId,
    });

    return att;
  },

  deleteAttachment(attachmentId: UUID, actorId: UUID): boolean | { error: string } {
    const dbAttachments = attachmentRepo.byIssue('');
    // Find by id across all issues
    const allIssues = issueRepo.all();
    let found: IssueAttachment | undefined;
    for (const issue of allIssues) {
      const atts = attachmentRepo.byIssue(issue.id);
      found = atts.find((a) => a.id === attachmentId);
      if (found) break;
    }
    if (!found) return { error: 'Attachment not found' };

    attachmentRepo.delete(attachmentId);
    return true;
  },

  delete(id: UUID, actorId: UUID): boolean | { error: string } {
    const issue = issueRepo.find(id);
    if (!issue) return { error: 'Issue not found' };

    const success = issueRepo.delete(id);
    if (success) {
      activityRepo.create({
        actorId,
        action: 'issue_deleted',
        entityType: 'Issue',
        entityId: id,
        entityName: issue.key,
        summary: `Deleted issue "${issue.title}"`,
        projectId: issue.projectId,
      });
    }
    return success;
  },

  getHistory(id: UUID): IssueHistoryEntry[] {
    return historyRepo.byIssue(id);
  },

  getComments(id: UUID): IssueComment[] {
    return commentRepo.byIssue(id);
  },

  getAttachments(id: UUID): IssueAttachment[] {
    return attachmentRepo.byIssue(id);
  },
};
