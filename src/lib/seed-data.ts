import type {
  Role, User, Project, Issue, IssueComment, IssueHistoryEntry, IssueAttachment,
  Group, GroupMessage, AppNotification, ActivityLog, Permission, ProjectMember,
} from '@/lib/types';
import { ALL_PERMISSIONS } from '@/lib/permissions';

function uid(prefix: string, n: number): string {
  return `${prefix}_${n}`;
}

const now = new Date('2026-10-13T09:00:00Z');
function daysAgo(d: number): string {
  return new Date(now.getTime() - d * 86400000).toISOString();
}
function daysAhead(d: number): string {
  return new Date(now.getTime() + d * 86400000).toISOString();
}

// ─── Roles ───
export const SEED_ROLES: Role[] = [
  {
    id: 'role_super_admin',
    name: 'Super Admin',
    description: 'Full system administration. Manages projects, users, roles, permissions, groups, and settings.',
    permissions: [...ALL_PERMISSIONS],
    isSystem: true,
    isActive: true,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(2),
  },
  {
    id: 'role_developer',
    name: 'Developer',
    description: 'Works on assigned projects. Creates and assigns issues, uses the Kanban board, and updates status.',
    permissions: [
      'dashboard.view',
      'projects.view',
      'issues.view', 'issues.create', 'issues.update', 'issues.assign', 'issues.change_status', 'issues.comment',
      'groups.view', 'groups.send_message',
      'notifications.view',
      'settings.view', 'activity.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(5),
  },
  {
    id: 'role_issue_assigner',
    name: 'Issue Assigner',
    description: 'Creates issues for authorized projects but cannot assign them. Assignment is handled by admins or developers.',
    permissions: [
      'dashboard.view',
      'projects.view',
      'issues.view', 'issues.create',
      'notifications.view',
      'settings.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(10),
  },
  {
    id: 'role_customer',
    name: 'Customer',
    description: 'External user created through public registration. Limited to customer-facing features only.',
    permissions: [
      'dashboard.view',
      'notifications.view',
      'settings.view',
    ],
    isSystem: true,
    isActive: true,
    createdAt: daysAgo(120),
    updatedAt: daysAgo(30),
  },
  {
    id: 'role_qa_engineer',
    name: 'QA Engineer',
    description: 'Tests issues, comments, and approves completed work. Cannot assign issues.',
    permissions: [
      'dashboard.view',
      'projects.view',
      'issues.view', 'issues.create', 'issues.update', 'issues.comment', 'issues.approve', 'issues.change_status',
      'groups.view', 'groups.send_message',
      'notifications.view',
      'settings.view', 'activity.view',
    ],
    isSystem: false,
    isActive: true,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(3),
  },
];

// ─── Users ───
const AVATAR_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#ea580c'];

export const SEED_USERS: User[] = [
  {
    id: 'user_1',
    name: 'Sarah Chen',
    email: 'sarah.chen@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[0],
    roleIds: ['role_super_admin'],
    status: 'active',
    title: 'System Administrator',
    department: 'IT Operations',
    phone: '+1-555-0101',
    bio: 'Super Admin responsible for overall system configuration and user management.',
    createdAt: daysAgo(120),
    lastActiveAt: daysAgo(0),
  },
  {
    id: 'user_2',
    name: 'Marcus Johnson',
    email: 'marcus.johnson@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[1],
    roleIds: ['role_developer'],
    status: 'active',
    title: 'Senior Developer',
    department: 'Engineering',
    phone: '+1-555-0102',
    bio: 'Full-stack developer working on the Atlas platform and Phoenix portal.',
    createdAt: daysAgo(110),
    lastActiveAt: daysAgo(1),
  },
  {
    id: 'user_3',
    name: 'Emily Rodriguez',
    email: 'emily.rodriguez@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[2],
    roleIds: ['role_developer'],
    status: 'active',
    title: 'Frontend Developer',
    department: 'Engineering',
    phone: '+1-555-0103',
    bio: 'Frontend specialist focused on the Nimbus mobile app and Sigma analytics.',
    createdAt: daysAgo(100),
    lastActiveAt: daysAgo(2),
  },
  {
    id: 'user_4',
    name: 'David Kim',
    email: 'david.kim@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[3],
    roleIds: ['role_developer'],
    status: 'active',
    title: 'Backend Developer',
    department: 'Engineering',
    phone: '+1-555-0104',
    bio: 'Backend engineer handling API development for Atlas and Quantum Sync.',
    createdAt: daysAgo(95),
    lastActiveAt: daysAgo(3),
  },
  {
    id: 'user_5',
    name: 'Priya Patel',
    email: 'priya.patel@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[4],
    roleIds: ['role_issue_assigner'],
    status: 'active',
    title: 'Product Analyst',
    department: 'Product',
    phone: '+1-555-0105',
    bio: 'Reports issues and incidents reported by stakeholders. Does not assign issues.',
    createdAt: daysAgo(80),
    lastActiveAt: daysAgo(1),
  },
  {
    id: 'user_6',
    name: 'James Wilson',
    email: 'james.wilson@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[5],
    roleIds: ['role_issue_assigner'],
    status: 'active',
    title: 'Support Specialist',
    department: 'Customer Support',
    phone: '+1-555-0106',
    bio: 'Front-line support creating incident tickets for customer-reported problems.',
    createdAt: daysAgo(70),
    lastActiveAt: daysAgo(2),
  },
  {
    id: 'user_7',
    name: 'Alex Thompson',
    email: 'alex.thompson@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[6],
    roleIds: ['role_qa_engineer'],
    status: 'active',
    title: 'QA Engineer',
    department: 'Quality Assurance',
    phone: '+1-555-0107',
    bio: 'Tests completed issues and approves work. Reviews bug reports and verifies fixes.',
    createdAt: daysAgo(55),
    lastActiveAt: daysAgo(1),
  },
  {
    id: 'user_8',
    name: 'Lisa Wang',
    email: 'lisa.wang@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[7],
    roleIds: ['role_qa_engineer', 'role_developer'],
    status: 'active',
    title: 'DevOps Engineer',
    department: 'Engineering',
    phone: '+1-555-0108',
    bio: 'Dual-role DevOps engineer with QA responsibilities. Manages deployments and verifies releases.',
    createdAt: daysAgo(45),
    lastActiveAt: daysAgo(0),
  },
  {
    id: 'user_9',
    name: 'Robert Brown',
    email: 'robert.brown@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[0],
    roleIds: ['role_developer'],
    status: 'inactive',
    title: 'Junior Developer',
    department: 'Engineering',
    phone: '+1-555-0109',
    bio: 'Junior developer currently on leave.',
    createdAt: daysAgo(40),
    lastActiveAt: daysAgo(20),
  },
  {
    id: 'user_10',
    name: 'Jennifer Davis',
    email: 'jennifer.davis@techtrioz.com',
    password: 'demo123',
    avatarColor: AVATAR_COLORS[2],
    roleIds: ['role_customer'],
    status: 'active',
    title: 'Customer',
    department: 'External',
    phone: '+1-555-0110',
    bio: 'External customer with limited access.',
    createdAt: daysAgo(15),
    lastActiveAt: daysAgo(5),
  },
];

// ─── Projects ───
export const SEED_PROJECTS: Project[] = [
  {
    id: 'proj_1',
    name: 'Atlas Platform',
    key: 'ATL',
    description: 'Core enterprise platform for customer data management and analytics.',
    objectives: 'Build a scalable customer data platform with real-time analytics and reporting capabilities.',
    status: 'active',
    priority: 'high',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_2', 'user_4', 'user_5', 'user_7'],
    developerIds: ['user_2', 'user_4'],
    assignerIds: ['user_5'],
    tags: ['platform', 'enterprise', 'data'],
    color: '#2563eb',
    startDate: daysAgo(60),
    dueDate: daysAhead(45),
    createdAt: daysAgo(60),
    updatedAt: daysAgo(1),
  },
  {
    id: 'proj_2',
    name: 'Phoenix Portal',
    key: 'PHX',
    description: 'Customer self-service portal for account management and support tickets.',
    objectives: 'Deliver a responsive portal with SSO, ticket tracking, and knowledge base integration.',
    status: 'active',
    priority: 'critical',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_2', 'user_3', 'user_6', 'user_8'],
    developerIds: ['user_2', 'user_3', 'user_8'],
    assignerIds: ['user_6'],
    tags: ['portal', 'customer-facing', 'sso'],
    color: '#dc2626',
    startDate: daysAgo(45),
    dueDate: daysAhead(20),
    createdAt: daysAgo(45),
    updatedAt: daysAgo(2),
  },
  {
    id: 'proj_3',
    name: 'Nimbus Mobile App',
    key: 'NMB',
    description: 'Cross-platform mobile application for field operations and reporting.',
    objectives: 'Ship iOS and Android apps with offline sync, push notifications, and field reporting.',
    status: 'active',
    priority: 'medium',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_3', 'user_6', 'user_7'],
    developerIds: ['user_3'],
    assignerIds: ['user_6'],
    tags: ['mobile', 'ios', 'android', 'offline'],
    color: '#059669',
    startDate: daysAgo(30),
    dueDate: daysAhead(60),
    createdAt: daysAgo(30),
    updatedAt: daysAgo(3),
  },
  {
    id: 'proj_4',
    name: 'Quantum Sync',
    key: 'QSY',
    description: 'Real-time data synchronization service across distributed systems.',
    objectives: 'Build a low-latency sync engine with conflict resolution and event sourcing.',
    status: 'planning',
    priority: 'high',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_4', 'user_8'],
    developerIds: ['user_4', 'user_8'],
    assignerIds: [],
    tags: ['infrastructure', 'realtime', 'sync'],
    color: '#7c3aed',
    startDate: daysAgo(10),
    dueDate: daysAhead(90),
    createdAt: daysAgo(10),
    updatedAt: daysAgo(5),
  },
  {
    id: 'proj_5',
    name: 'Sigma Analytics',
    key: 'SGM',
    description: 'Business intelligence dashboard suite with custom report builder.',
    objectives: 'Provide self-service analytics with drag-and-drop report building and scheduled exports.',
    status: 'completed',
    priority: 'medium',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_3', 'user_5', 'user_7'],
    developerIds: ['user_3'],
    assignerIds: ['user_5'],
    tags: ['analytics', 'bi', 'reports'],
    color: '#d97706',
    startDate: daysAgo(100),
    dueDate: daysAgo(10),
    createdAt: daysAgo(100),
    updatedAt: daysAgo(10),
  },
  {
    id: 'proj_6',
    name: 'Legacy Migration',
    key: 'LGM',
    description: 'Migrate legacy on-premise systems to cloud infrastructure.',
    objectives: 'Complete phased migration of 12 legacy services to AWS with zero data loss.',
    status: 'on_hold',
    priority: 'low',
    ownerId: 'user_1',
    memberIds: ['user_1', 'user_4', 'user_9'],
    developerIds: ['user_4', 'user_9'],
    assignerIds: [],
    tags: ['migration', 'cloud', 'legacy'],
    color: '#64748b',
    startDate: daysAgo(80),
    dueDate: daysAhead(120),
    createdAt: daysAgo(80),
    updatedAt: daysAgo(15),
  },
];

// ─── Issues ───
let issueCounter = 100;
function makeIssue(
  projectKey: string,
  projectId: string,
  partial: Partial<Issue> & { title: string; reporterId: string; type: Issue['type']; priority: Issue['priority']; status: Issue['status'] }
): Issue {
  issueCounter++;
  return {
    id: `issue_${issueCounter}`,
    key: `${projectKey}-${issueCounter}`,
    title: partial.title,
    description: partial.description || '',
    projectId,
    type: partial.type,
    priority: partial.priority,
    status: partial.status,
    reporterId: partial.reporterId,
    assigneeId: partial.assigneeId ?? null,
    labels: partial.labels || [],
    severity: partial.severity,
    reproducibility: partial.reproducibility,
    startDate: partial.startDate || daysAgo(20),
    dueDate: partial.dueDate,
    createdAt: partial.createdAt || daysAgo(20),
    updatedAt: partial.updatedAt || daysAgo(1),
    resolvedAt: partial.resolvedAt,
    approvedAt: partial.approvedAt,
    approvedBy: partial.approvedBy,
  };
}

export const SEED_ISSUES: Issue[] = [
  // Atlas Platform (ATL)
  makeIssue('ATL', 'proj_1', {
    title: 'Data export fails for datasets larger than 50MB',
    description: 'When users attempt to export datasets exceeding 50MB, the request times out after 30 seconds. Need to implement chunked export or background job processing.',
    type: 'bug', priority: 'high', status: 'in_progress',
    reporterId: 'user_5', assigneeId: 'user_2',
    labels: ['export', 'performance'], severity: 'sev2', reproducibility: 'Always',
    dueDate: daysAhead(7), createdAt: daysAgo(12), updatedAt: daysAgo(1),
  }),
  makeIssue('ATL', 'proj_1', {
    title: 'Add audit trail for customer record modifications',
    description: 'Compliance team requires full audit logging for all customer record changes including who, what, and when.',
    type: 'improvement', priority: 'medium', status: 'todo',
    reporterId: 'user_5', assigneeId: 'user_4',
    labels: ['compliance', 'audit'], dueDate: daysAhead(30),
    createdAt: daysAgo(8), updatedAt: daysAgo(3),
  }),
  makeIssue('ATL', 'proj_1', {
    title: 'API rate limiting not enforced on /api/v2/customers',
    description: 'Security scan revealed that the v2 customer API endpoints do not enforce rate limits, allowing potential abuse.',
    type: 'security', priority: 'critical', status: 'todo',
    reporterId: 'user_5', assigneeId: null,
    labels: ['security', 'api'], severity: 'sev1', reproducibility: 'Always',
    dueDate: daysAhead(3), createdAt: daysAgo(2), updatedAt: daysAgo(2),
  }),
  makeIssue('ATL', 'proj_1', {
    title: 'Implement OAuth2 SSO integration for Atlas login',
    description: 'Replace the legacy authentication with OAuth2 SSO supporting SAML and OpenID Connect providers.',
    type: 'task', priority: 'high', status: 'completed',
    reporterId: 'user_1', assigneeId: 'user_2',
    labels: ['auth', 'sso'], dueDate: daysAgo(5),
    createdAt: daysAgo(40), updatedAt: daysAgo(5), resolvedAt: daysAgo(5),
  }),
  makeIssue('ATL', 'proj_1', {
    title: 'Dashboard widget for real-time customer count',
    description: 'Add a live-updating widget showing total active customers on the main dashboard.',
    type: 'improvement', priority: 'low', status: 'approved',
    reporterId: 'user_5', assigneeId: 'user_4',
    labels: ['dashboard', 'widgets'],
    createdAt: daysAgo(35), updatedAt: daysAgo(15), resolvedAt: daysAgo(18), approvedAt: daysAgo(15), approvedBy: 'user_7',
  }),
  makeIssue('ATL', 'proj_1', {
    title: 'Database connection pool exhaustion under load',
    description: 'Under high concurrency, the connection pool becomes exhausted causing 503 errors. Need to tune pool size and add retry logic.',
    type: 'incident', priority: 'critical', status: 'on_hold',
    reporterId: 'user_5', assigneeId: 'user_4',
    labels: ['database', 'performance', 'incident'], severity: 'sev1', reproducibility: 'Intermittent',
    dueDate: daysAhead(10), createdAt: daysAgo(15), updatedAt: daysAgo(7),
  }),

  // Phoenix Portal (PHX)
  makeIssue('PHX', 'proj_2', {
    title: 'SSO redirect loop on Safari browser',
    description: 'Safari users experience an infinite redirect loop when attempting SSO login. Suspected cookie SameSite issue.',
    type: 'bug', priority: 'critical', status: 'in_progress',
    reporterId: 'user_6', assigneeId: 'user_2',
    labels: ['sso', 'safari', 'auth'], severity: 'sev1', reproducibility: 'Always',
    dueDate: daysAhead(2), createdAt: daysAgo(5), updatedAt: daysAgo(1),
  }),
  makeIssue('PHX', 'proj_2', {
    title: 'Ticket creation form loses data on validation error',
    description: 'When a validation error occurs on the support ticket form, all entered data is lost. Need to preserve form state.',
    type: 'bug', priority: 'high', status: 'todo',
    reporterId: 'user_6', assigneeId: 'user_3',
    labels: ['forms', 'ux'], dueDate: daysAhead(7),
    createdAt: daysAgo(3), updatedAt: daysAgo(2),
  }),
  makeIssue('PHX', 'proj_2', {
    title: 'Knowledge base search returns irrelevant results',
    description: 'The search ranking algorithm returns irrelevant articles. Need to implement TF-IDF or similar relevance scoring.',
    type: 'improvement', priority: 'medium', status: 'todo',
    reporterId: 'user_6', assigneeId: null,
    labels: ['search', 'kb'], dueDate: daysAhead(14),
    createdAt: daysAgo(4), updatedAt: daysAgo(4),
  }),
  makeIssue('PHX', 'proj_2', {
    title: 'Add dark mode support for the portal',
    description: 'Implement CSS custom properties for dark theme with a toggle in user preferences.',
    type: 'task', priority: 'low', status: 'todo',
    reporterId: 'user_1', assigneeId: 'user_3',
    labels: ['ui', 'dark-mode'], dueDate: daysAhead(20),
    createdAt: daysAgo(6), updatedAt: daysAgo(3),
  }),
  makeIssue('PHX', 'proj_2', {
    title: 'Password reset email not being sent',
    description: 'Users reporting they never receive the password reset email. SMTP relay logs show messages queued but not delivered.',
    type: 'incident', priority: 'high', status: 'completed',
    reporterId: 'user_6', assigneeId: 'user_8',
    labels: ['email', 'auth', 'incident'], severity: 'sev2',
    createdAt: daysAgo(10), updatedAt: daysAgo(4), resolvedAt: daysAgo(4),
  }),

  // Nimbus Mobile App (NMB)
  makeIssue('NMB', 'proj_3', {
    title: 'Offline sync conflicts when two devices edit same record',
    description: 'When two field agents edit the same record offline and sync, the later sync silently overwrites the earlier one.',
    type: 'bug', priority: 'high', status: 'in_progress',
    reporterId: 'user_6', assigneeId: 'user_3',
    labels: ['offline', 'sync', 'conflict'], severity: 'sev2', reproducibility: 'Sometimes',
    dueDate: daysAhead(10), createdAt: daysAgo(7), updatedAt: daysAgo(1),
  }),
  makeIssue('NMB', 'proj_3', {
    title: 'Push notifications not delivered on Android 14',
    description: 'FCM notifications are silently dropped on Android 14 devices. Likely related to foreground service restrictions.',
    type: 'bug', priority: 'medium', status: 'todo',
    reporterId: 'user_6', assigneeId: 'user_3',
    labels: ['android', 'push', 'fcm'], dueDate: daysAhead(14),
    createdAt: daysAgo(5), updatedAt: daysAgo(2),
  }),
  makeIssue('NMB', 'proj_3', {
    title: 'Add barcode scanning for asset tracking',
    description: 'Integrate camera-based barcode scanning to allow field agents to scan asset tags instead of manual entry.',
    type: 'task', priority: 'medium', status: 'todo',
    reporterId: 'user_1', assigneeId: null,
    labels: ['feature', 'barcode', 'camera'], dueDate: daysAhead(30),
    createdAt: daysAgo(3), updatedAt: daysAgo(3),
  }),
  makeIssue('NMB', 'proj_3', {
    title: 'App crashes on startup with low memory devices',
    description: 'On devices with less than 2GB RAM, the app crashes during initialization due to heavy preload of reference data.',
    type: 'bug', priority: 'high', status: 'completed',
    reporterId: 'user_6', assigneeId: 'user_3',
    labels: ['crash', 'memory', 'android'], severity: 'sev2', reproducibility: 'Always',
    createdAt: daysAgo(20), updatedAt: daysAgo(8), resolvedAt: daysAgo(8),
  }),
  makeIssue('NMB', 'proj_3', {
    title: 'Implement biometric authentication',
    description: 'Add fingerprint and face recognition for login on supported devices with fallback to PIN.',
    type: 'task', priority: 'medium', status: 'approved',
    reporterId: 'user_1', assigneeId: 'user_3',
    labels: ['auth', 'biometric', 'security'],
    createdAt: daysAgo(25), updatedAt: daysAgo(12), resolvedAt: daysAgo(14), approvedAt: daysAgo(12), approvedBy: 'user_7',
  }),

  // Quantum Sync (QSY)
  makeIssue('QSY', 'proj_4', {
    title: 'Define conflict resolution strategy for multi-master sync',
    description: 'Design document needed for conflict resolution approach: LWW, CRDT, or application-level merge.',
    type: 'task', priority: 'high', status: 'todo',
    reporterId: 'user_1', assigneeId: 'user_4',
    labels: ['design', 'sync'], dueDate: daysAhead(15),
    createdAt: daysAgo(8), updatedAt: daysAgo(5),
  }),
  makeIssue('QSY', 'proj_4', {
    title: 'Evaluate message broker: Kafka vs RabbitMQ vs Redis Streams',
    description: 'Benchmark and compare three message brokers for throughput, latency, and operational complexity.',
    type: 'task', priority: 'medium', status: 'todo',
    reporterId: 'user_1', assigneeId: 'user_8',
    labels: ['evaluation', 'infrastructure'], dueDate: daysAhead(20),
    createdAt: daysAgo(5), updatedAt: daysAgo(5),
  }),

  // Sigma Analytics (SGM)
  makeIssue('SGM', 'proj_5', {
    title: 'Scheduled report export to S3 fails intermittently',
    description: 'Reports scheduled for S3 export fail approximately 10% of the time with a timeout error.',
    type: 'bug', priority: 'medium', status: 'approved',
    reporterId: 'user_5', assigneeId: 'user_3',
    labels: ['export', 's3', 'scheduling'],
    createdAt: daysAgo(50), updatedAt: daysAgo(20), resolvedAt: daysAgo(22), approvedAt: daysAgo(20), approvedBy: 'user_7',
  }),
  makeIssue('SGM', 'proj_5', {
    title: 'Add custom date range picker for reports',
    description: 'Allow users to specify arbitrary date ranges instead of predefined presets.',
    type: 'improvement', priority: 'low', status: 'completed',
    reporterId: 'user_5', assigneeId: 'user_3',
    labels: ['ui', 'date-range'],
    createdAt: daysAgo(60), updatedAt: daysAgo(25), resolvedAt: daysAgo(25),
  }),

  // Legacy Migration (LGM)
  makeIssue('LGM', 'proj_6', {
    title: 'Assessment of legacy SOAP services for REST conversion',
    description: 'Catalog all SOAP endpoints and map them to REST equivalents. Identify dependencies and migration order.',
    type: 'task', priority: 'medium', status: 'on_hold',
    reporterId: 'user_1', assigneeId: 'user_4',
    labels: ['assessment', 'soap', 'rest'], dueDate: daysAhead(60),
    createdAt: daysAgo(50), updatedAt: daysAgo(20),
  }),
  makeIssue('LGM', 'proj_6', {
    title: 'Data migration script for customer table (50M rows)',
    description: 'Write and test batch migration script for the customer table with validation checks.',
    type: 'task', priority: 'high', status: 'on_hold',
    reporterId: 'user_1', assigneeId: 'user_9',
    labels: ['migration', 'data'], dueDate: daysAhead(90),
    createdAt: daysAgo(40), updatedAt: daysAgo(18),
  }),
];

// ─── Issue Comments ───
export const SEED_COMMENTS: IssueComment[] = [
  { id: 'cmt_1', issueId: 'issue_101', authorId: 'user_2', body: 'I can reproduce this consistently. The timeout occurs in the export service at line 234.', createdAt: daysAgo(10) },
  { id: 'cmt_2', issueId: 'issue_101', authorId: 'user_5', body: 'Thanks for confirming. This is blocking a customer report delivery.', createdAt: daysAgo(9) },
  { id: 'cmt_3', issueId: 'issue_101', authorId: 'user_4', body: 'I suggest implementing a background job with a polling endpoint. I can take a look this sprint.', createdAt: daysAgo(8) },
  { id: 'cmt_4', issueId: 'issue_107', authorId: 'user_2', body: 'Confirmed the redirect loop on Safari 17. The SameSite=Lax cookie is being rejected.', createdAt: daysAgo(4) },
  { id: 'cmt_5', issueId: 'issue_107', authorId: 'user_6', body: 'This is affecting ~15% of our portal users. Marking as critical.', createdAt: daysAgo(3) },
  { id: 'cmt_6', issueId: 'issue_112', authorId: 'user_3', body: 'The conflict happens because we are using last-write-wins. We need to switch to a merge strategy.', createdAt: daysAgo(5) },
  { id: 'cmt_7', issueId: 'issue_112', authorId: 'user_7', body: 'Agreed. Suggest implementing field-level merge with timestamp comparison.', createdAt: daysAgo(4) },
];

// ─── Issue History ───
export const SEED_HISTORY: IssueHistoryEntry[] = [
  { id: 'hist_1', issueId: 'issue_101', actorId: 'user_5', field: 'created', oldValue: '', newValue: 'Issue created', timestamp: daysAgo(12) },
  { id: 'hist_2', issueId: 'issue_101', actorId: 'user_1', field: 'assignee', oldValue: 'Unassigned', newValue: 'Marcus Johnson', timestamp: daysAgo(11) },
  { id: 'hist_3', issueId: 'issue_101', actorId: 'user_2', field: 'status', oldValue: 'To Do', newValue: 'In Progress', timestamp: daysAgo(8) },
  { id: 'hist_4', issueId: 'issue_105', actorId: 'user_7', field: 'status', oldValue: 'Completed', newValue: 'Approved', timestamp: daysAgo(15) },
  { id: 'hist_5', issueId: 'issue_107', actorId: 'user_6', field: 'created', oldValue: '', newValue: 'Issue created', timestamp: daysAgo(5) },
  { id: 'hist_6', issueId: 'issue_107', actorId: 'user_1', field: 'assignee', oldValue: 'Unassigned', newValue: 'Marcus Johnson', timestamp: daysAgo(4) },
  { id: 'hist_7', issueId: 'issue_107', actorId: 'user_2', field: 'status', oldValue: 'To Do', newValue: 'In Progress', timestamp: daysAgo(3) },
];

// ─── Issue Attachments ───
export const SEED_ATTACHMENTS: IssueAttachment[] = [
  { id: 'att_1', issueId: 'issue_101', fileName: 'export-timeout-log.txt', fileSize: 24576, uploadedById: 'user_2', uploadedAt: daysAgo(10) },
  { id: 'att_2', issueId: 'issue_101', fileName: 'export-service-stacktrace.png', fileSize: 153600, uploadedById: 'user_2', uploadedAt: daysAgo(10) },
  { id: 'att_3', issueId: 'issue_107', fileName: 'safari-sso-capture.har', fileSize: 81920, uploadedById: 'user_6', uploadedAt: daysAgo(4) },
];

// ─── Groups ───
export const SEED_GROUPS: Group[] = [
  // Default project groups
  {
    id: 'grp_atl_default', name: 'Atlas Platform', projectId: 'proj_1',
    type: 'default', memberIds: ['user_1', 'user_2', 'user_4', 'user_5', 'user_7'],
    createdBy: 'user_1', createdAt: daysAgo(60), updatedAt: daysAgo(1),
  },
  {
    id: 'grp_phx_default', name: 'Phoenix Portal', projectId: 'proj_2',
    type: 'default', memberIds: ['user_1', 'user_2', 'user_3', 'user_6', 'user_8'],
    createdBy: 'user_1', createdAt: daysAgo(45), updatedAt: daysAgo(2),
  },
  {
    id: 'grp_nmb_default', name: 'Nimbus Mobile App', projectId: 'proj_3',
    type: 'default', memberIds: ['user_1', 'user_3', 'user_6', 'user_7'],
    createdBy: 'user_1', createdAt: daysAgo(30), updatedAt: daysAgo(3),
  },
  {
    id: 'grp_qsy_default', name: 'Quantum Sync', projectId: 'proj_4',
    type: 'default', memberIds: ['user_1', 'user_4', 'user_8'],
    createdBy: 'user_1', createdAt: daysAgo(10), updatedAt: daysAgo(5),
  },
  {
    id: 'grp_sgm_default', name: 'Sigma Analytics', projectId: 'proj_5',
    type: 'default', memberIds: ['user_1', 'user_3', 'user_5', 'user_7'],
    createdBy: 'user_1', createdAt: daysAgo(100), updatedAt: daysAgo(10),
  },
  {
    id: 'grp_lgm_default', name: 'Legacy Migration', projectId: 'proj_6',
    type: 'default', memberIds: ['user_1', 'user_4', 'user_9'],
    createdBy: 'user_1', createdAt: daysAgo(80), updatedAt: daysAgo(15),
  },
  // Private group
  {
    id: 'grp_atl_private', name: 'Atlas Security Review', projectId: 'proj_1',
    type: 'private', memberIds: ['user_1', 'user_2', 'user_4'],
    createdBy: 'user_1', createdAt: daysAgo(20), updatedAt: daysAgo(2),
  },
];

// ─── Group Messages ───
export const SEED_MESSAGES: GroupMessage[] = [
  { id: 'msg_1', groupId: 'grp_atl_default', senderId: 'user_1', body: 'Welcome to the Atlas Platform group. Use this space for project discussions.', createdAt: daysAgo(60), readBy: ['user_1', 'user_2', 'user_4', 'user_5'] },
  { id: 'msg_2', groupId: 'grp_atl_default', senderId: 'user_2', body: 'Thanks! I will be working on the data export issue this sprint.', createdAt: daysAgo(10), readBy: ['user_1', 'user_2'] },
  { id: 'msg_3', groupId: 'grp_atl_default', senderId: 'user_4', body: 'I can help with the background job implementation if needed.', createdAt: daysAgo(9), readBy: ['user_1', 'user_2', 'user_4'] },
  { id: 'msg_4', groupId: 'grp_atl_default', senderId: 'user_5', body: 'The security issue with API rate limiting is urgent. Can we prioritize it?', createdAt: daysAgo(2), readBy: ['user_5'] },
  { id: 'msg_5', groupId: 'grp_phx_default', senderId: 'user_1', body: 'Phoenix Portal team - the SSO redirect bug is our top priority this week.', createdAt: daysAgo(5), readBy: ['user_1', 'user_2', 'user_3'] },
  { id: 'msg_6', groupId: 'grp_phx_default', senderId: 'user_6', body: 'I have created a detailed issue for the SSO bug with reproduction steps.', createdAt: daysAgo(4), readBy: ['user_1', 'user_6'] },
  { id: 'msg_7', groupId: 'grp_atl_private', senderId: 'user_1', body: 'This private group is for security-sensitive discussions only. Do not share outside this group.', createdAt: daysAgo(20), readBy: ['user_1', 'user_2', 'user_4'] },
  { id: 'msg_8', groupId: 'grp_atl_private', senderId: 'user_2', body: 'Understood. I will post my security review findings here.', createdAt: daysAgo(15), readBy: ['user_1', 'user_2'] },
];

// ─── Notifications ───
export const SEED_NOTIFICATIONS: AppNotification[] = [
  { id: 'ntf_1', userId: 'user_2', type: 'issue_assigned', title: 'Issue assigned to you', body: 'ATL-101: Data export fails for datasets larger than 50MB', link: '/issues/issue_101', isRead: false, createdAt: daysAgo(11) },
  { id: 'ntf_2', userId: 'user_2', type: 'issue_commented', title: 'New comment on your issue', body: 'Priya Patel commented on ATL-101', link: '/issues/issue_101', isRead: false, createdAt: daysAgo(9) },
  { id: 'ntf_3', userId: 'user_2', type: 'group_message', title: 'New message in Atlas Platform', body: 'Priya Patel: The security issue with API rate limiting is urgent...', link: '/groups/grp_atl_default', isRead: false, createdAt: daysAgo(2) },
  { id: 'ntf_4', userId: 'user_2', type: 'issue_assigned', title: 'Issue assigned to you', body: 'PHX-107: SSO redirect loop on Safari browser', link: '/issues/issue_107', isRead: true, createdAt: daysAgo(4) },
  { id: 'ntf_5', userId: 'user_3', type: 'issue_assigned', title: 'Issue assigned to you', body: 'NMB-112: Offline sync conflicts when two devices edit same record', link: '/issues/issue_112', isRead: false, createdAt: daysAgo(5) },
  { id: 'ntf_6', userId: 'user_3', type: 'group_message', title: 'New message in Phoenix Portal', body: 'Sarah Chen: Phoenix Portal team - the SSO redirect bug is our top priority', link: '/groups/grp_phx_default', isRead: false, createdAt: daysAgo(5) },
  { id: 'ntf_7', userId: 'user_4', type: 'issue_assigned', title: 'Issue assigned to you', body: 'QSY-118: Define conflict resolution strategy for multi-master sync', link: '/issues/issue_118', isRead: false, createdAt: daysAgo(8) },
  { id: 'ntf_8', userId: 'user_5', type: 'issue_status_changed', title: 'Issue status updated', body: 'ATL-101 moved to In Progress', link: '/issues/issue_101', isRead: true, createdAt: daysAgo(8) },
  { id: 'ntf_9', userId: 'user_1', type: 'project_membership', title: 'New project created', body: 'Quantum Sync project has been created', link: '/projects/proj_4', isRead: true, createdAt: daysAgo(10) },
  { id: 'ntf_10', userId: 'user_2', type: 'issue_deadline', title: 'Issue approaching deadline', body: 'PHX-107 is due in 2 days', link: '/issues/issue_107', isRead: false, createdAt: daysAgo(1) },
];

// ─── Activity Log ───
export const SEED_ACTIVITY: ActivityLog[] = [
  { id: 'act_1', actorId: 'user_1', action: 'project_created', entityType: 'Project', entityId: 'proj_4', entityName: 'Quantum Sync', summary: 'Created project "Quantum Sync"', projectId: 'proj_4', timestamp: daysAgo(10) },
  { id: 'act_2', actorId: 'user_1', action: 'member_assigned', entityType: 'Project', entityId: 'proj_4', entityName: 'Quantum Sync', summary: 'Assigned David Kim to Quantum Sync', projectId: 'proj_4', timestamp: daysAgo(10) },
  { id: 'act_3', actorId: 'user_5', action: 'issue_created', entityType: 'Issue', entityId: 'issue_101', entityName: 'ATL-101', summary: 'Created issue "Data export fails for datasets larger than 50MB"', projectId: 'proj_1', timestamp: daysAgo(12) },
  { id: 'act_4', actorId: 'user_1', action: 'issue_assigned', entityType: 'Issue', entityId: 'issue_101', entityName: 'ATL-101', summary: 'Assigned ATL-101 to Marcus Johnson', projectId: 'proj_1', timestamp: daysAgo(11) },
  { id: 'act_5', actorId: 'user_2', action: 'status_changed', entityType: 'Issue', entityId: 'issue_101', entityName: 'ATL-101', summary: 'Changed ATL-101 status from To Do to In Progress', projectId: 'proj_1', timestamp: daysAgo(8) },
  { id: 'act_6', actorId: 'user_6', action: 'issue_created', entityType: 'Issue', entityId: 'issue_107', entityName: 'PHX-107', summary: 'Created issue "SSO redirect loop on Safari browser"', projectId: 'proj_2', timestamp: daysAgo(5) },
  { id: 'act_7', actorId: 'user_1', action: 'issue_assigned', entityType: 'Issue', entityId: 'issue_107', entityName: 'PHX-107', summary: 'Assigned PHX-107 to Marcus Johnson', projectId: 'proj_2', timestamp: daysAgo(4) },
  { id: 'act_8', actorId: 'user_7', action: 'issue_approved', entityType: 'Issue', entityId: 'issue_105', entityName: 'ATL-105', summary: 'Approved ATL-105 "Dashboard widget for real-time customer count"', projectId: 'proj_1', timestamp: daysAgo(15) },
  { id: 'act_9', actorId: 'user_1', action: 'role_created', entityType: 'Role', entityId: 'role_qa_engineer', entityName: 'QA Engineer', summary: 'Created role "QA Engineer"', timestamp: daysAgo(60) },
  { id: 'act_10', actorId: 'user_1', action: 'user_created', entityType: 'User', entityId: 'user_7', entityName: 'Alex Thompson', summary: 'Created user "Alex Thompson" with QA Engineer role', timestamp: daysAgo(55) },
  { id: 'act_11', actorId: 'user_6', action: 'issue_created', entityType: 'Issue', entityId: 'issue_112', entityName: 'NMB-112', summary: 'Created issue "Offline sync conflicts when two devices edit same record"', projectId: 'proj_3', timestamp: daysAgo(7) },
  { id: 'act_12', actorId: 'user_1', action: 'group_created', entityType: 'Group', entityId: 'grp_atl_private', entityName: 'Atlas Security Review', summary: 'Created private group "Atlas Security Review"', projectId: 'proj_1', timestamp: daysAgo(20) },
];

// ─── Project Memberships (project-specific roles) ───
function makeMembership(
  projectId: string,
  userId: string,
  projectRole: string,
  ageDays: number = 60
): ProjectMember {
  return {
    id: `pmem_${projectId}_${userId}`,
    projectId,
    userId,
    projectRole,
    createdAt: daysAgo(ageDays),
    updatedAt: daysAgo(ageDays),
  };
}

export const SEED_PROJECT_MEMBERS: ProjectMember[] = [
  // Atlas Platform (proj_1)
  makeMembership('proj_1', 'user_1', 'Project Manager', 60),
  makeMembership('proj_1', 'user_2', 'Full-Stack Developer', 60),
  makeMembership('proj_1', 'user_4', 'Backend Developer', 60),
  makeMembership('proj_1', 'user_5', 'Issue Assigner', 60),
  makeMembership('proj_1', 'user_7', 'QA Engineer / Tester', 60),

  // Phoenix Portal (proj_2)
  makeMembership('proj_2', 'user_1', 'Project Manager', 45),
  makeMembership('proj_2', 'user_2', 'Backend Developer', 45),
  makeMembership('proj_2', 'user_3', 'Frontend Developer', 45),
  makeMembership('proj_2', 'user_6', 'Issue Assigner', 45),
  makeMembership('proj_2', 'user_8', 'DevOps Engineer', 45),

  // Nimbus Mobile App (proj_3)
  makeMembership('proj_3', 'user_1', 'Project Manager', 30),
  makeMembership('proj_3', 'user_3', 'Frontend Developer', 30),
  makeMembership('proj_3', 'user_6', 'Issue Assigner', 30),
  makeMembership('proj_3', 'user_7', 'QA Engineer / Tester', 30),

  // Quantum Sync (proj_4)
  makeMembership('proj_4', 'user_1', 'Project Manager', 10),
  makeMembership('proj_4', 'user_4', 'Backend Developer', 10),
  makeMembership('proj_4', 'user_8', 'DevOps Engineer', 10),

  // Sigma Analytics (proj_5)
  makeMembership('proj_5', 'user_1', 'Project Manager', 100),
  makeMembership('proj_5', 'user_3', 'Frontend Developer', 100),
  makeMembership('proj_5', 'user_5', 'Business Analyst', 100),
  makeMembership('proj_5', 'user_7', 'QA Engineer / Tester', 100),

  // Legacy Migration (proj_6)
  makeMembership('proj_6', 'user_1', 'Project Manager', 80),
  makeMembership('proj_6', 'user_4', 'Backend Developer', 80),
  makeMembership('proj_6', 'user_9', 'Project Contributor / Other', 80),
];

export const DEMO_CREDENTIALS = [
  { email: 'sarah.chen@techtrioz.com', password: 'demo123', role: 'Super Admin', name: 'Sarah Chen' },
  { email: 'marcus.johnson@techtrioz.com', password: 'demo123', role: 'Developer', name: 'Marcus Johnson' },
  { email: 'priya.patel@techtrioz.com', password: 'demo123', role: 'Issue Assigner', name: 'Priya Patel' },
  { email: 'alex.thompson@techtrioz.com', password: 'demo123', role: 'QA Engineer', name: 'Alex Thompson' },
  { email: 'jennifer.davis@techtrioz.com', password: 'demo123', role: 'Customer', name: 'Jennifer Davis' },
];
