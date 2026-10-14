import { useState, useMemo, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { useAuth } from '@/lib/auth-context';
import {
  issueRepo, commentRepo, historyRepo, attachmentRepo, userRepo, projectRepo,
} from '@/lib/repository';
import {
  issueService, canUserViewIssue, canUserAssignIssue, getValidTransitions,
} from '@/lib/services';
import { PageHeader } from '@/components/shared/page-header';
import { IssueFormDialog } from '@/components/issues/issue-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Pencil, Trash2, Send, Paperclip, X, CheckCircle2,
  UserPlus, UserMinus, AlertCircle, History as HistoryIcon, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ISSUE_STATUS_META, ISSUE_PRIORITY_META, ISSUE_TYPE_META, ISSUE_SEVERITY_META,
  formatDate, formatRelativeTime, isOverdue,
} from '@/lib/shared-utils';
import type { Issue, IssueComment, IssueHistoryEntry, IssueAttachment, IssueStatus, User } from '@/lib/types';

export default function IssueDetailPage() {
  const params = useParams();
  const navigate = useNavigate();
  const { session, hasPermission } = useAuth();
  const issueId = params.id as string;

  const [issue, setIssue] = useState<Issue | null>(() => issueRepo.find(issueId) || null);
  const [comments, setComments] = useState<IssueComment[]>(() => commentRepo.byIssue(issueId));
  const [history, setHistory] = useState<IssueHistoryEntry[]>(() => historyRepo.byIssue(issueId));
  const [attachments, setAttachments] = useState<IssueAttachment[]>(() => attachmentRepo.byIssue(issueId));
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [commentBody, setCommentBody] = useState('');
  const [attFileName, setAttFileName] = useState('');
  const [attFileSize, setAttFileSize] = useState('');
  const [showAttachForm, setShowAttachForm] = useState(false);
  const [assigneeSelect, setAssigneeSelect] = useState('');

  const canView = session && issue ? canUserViewIssue(session.user.id, issue) : false;

  const refresh = useCallback(() => {
    const fresh = issueRepo.find(issueId);
    setIssue(fresh || null);
    setComments(commentRepo.byIssue(issueId));
    setHistory(historyRepo.byIssue(issueId));
    setAttachments(attachmentRepo.byIssue(issueId));
  }, [issueId]);

  const eligibleAssignees: User[] = useMemo(() => {
    if (!issue) return [];
    const project = projectRepo.find(issue.projectId);
    if (!project) return [];
    return project.memberIds
      .map((id) => userRepo.find(id))
      .filter((u): u is User => u !== undefined && u.status === 'active');
  }, [issue]);

  if (!session) return null;

  if (!issue || !canView) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Issue not found" breadcrumbs={[{ label: 'Issues', href: '/issues' }, { label: 'Not Found' }]} />
        <Card className="p-8 text-center text-muted-foreground">
          The issue you are looking for does not exist or you do not have access to it.
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate('/issues')}>
              Back to Issues
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const reporter = userRepo.find(issue.reporterId);
  const assignee = issue.assigneeId ? userRepo.find(issue.assigneeId) : null;
  const project = projectRepo.find(issue.projectId);
  const approver = issue.approvedBy ? userRepo.find(issue.approvedBy) : null;

  const canEdit = hasPermission('issues.update');
  const canDelete = hasPermission('issues.delete');
  const canComment = hasPermission('issues.comment');
  const canChangeStatus = hasPermission('issues.change_status');
  const canApprove = hasPermission('issues.approve');
  const canAssign = canUserAssignIssue(session.user.id, issue);

  const validTransitions = getValidTransitions(issue.status);

  const handleAddComment = () => {
    if (!commentBody.trim()) return;
    const result = issueService.addComment(issue.id, session.user.id, commentBody);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      setCommentBody('');
      refresh();
      toast.success('Comment added');
    }
  };

  const handleStatusChange = (newStatus: IssueStatus) => {
    const result = issueService.changeStatus(issue.id, newStatus, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error('Cannot change status', { description: result.error });
    } else {
      refresh();
      toast.success('Status updated', { description: `${issue.key} moved to ${ISSUE_STATUS_META[newStatus].label}` });
    }
  };

  const handleApprove = () => {
    const result = issueService.approve(issue.id, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      refresh();
      toast.success('Issue approved', { description: `${issue.key} has been approved.` });
    }
  };

  const handleAssign = () => {
    if (!assigneeSelect) return;
    const result = issueService.assign(issue.id, assigneeSelect, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      setAssigneeSelect('');
      refresh();
      toast.success('Issue assigned');
    }
  };

  const handleUnassign = () => {
    const result = issueService.unassign(issue.id, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      refresh();
      toast.success('Issue unassigned');
    }
  };

  const handleAddAttachment = () => {
    if (!attFileName.trim()) return;
    const size = parseInt(attFileSize) || 0;
    const result = issueService.addAttachment(issue.id, attFileName.trim(), size, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      setAttFileName('');
      setAttFileSize('');
      setShowAttachForm(false);
      refresh();
      toast.success('Attachment added');
    }
  };

  const handleDeleteAttachment = (attId: string) => {
    const result = issueService.deleteAttachment(attId, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      refresh();
      toast.success('Attachment removed');
    }
  };

  const handleDelete = () => {
    const result = issueService.delete(issue.id, session.user.id);
    if (typeof result === 'object' && 'error' in result) {
      toast.error(result.error);
    } else {
      toast.success('Issue deleted');
      navigate('/issues');
    }
  };

  const statusMeta = ISSUE_STATUS_META[issue.status];
  const priorityMeta = ISSUE_PRIORITY_META[issue.priority];
  const typeMeta = ISSUE_TYPE_META[issue.type];
  const severityMeta = issue.severity ? ISSUE_SEVERITY_META[issue.severity] : null;
  const overdue = isOverdue(issue.dueDate, issue.status);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={issue.key}
        description={issue.title}
        breadcrumbs={[{ label: 'Issues', href: '/issues' }, { label: issue.key }]}
        actions={
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" onClick={() => setConfirmDelete(true)} className="text-red-600 hover:text-red-700">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              {issue.description ? (
                <p className="text-sm whitespace-pre-wrap">{issue.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No description provided.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Tabs defaultValue="comments">
                <TabsList>
                  <TabsTrigger value="comments" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments ({comments.length})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5">
                    <HistoryIcon className="h-3.5 w-3.5" />
                    History ({history.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Files ({attachments.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-4">
                  <div className="space-y-3 mb-4">
                    {comments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first to comment.</p>
                    ) : (
                      [...comments].reverse().map((c) => {
                        const author = userRepo.find(c.authorId);
                        return (
                          <div key={c.id} className="flex gap-3">
                            {author && <UserAvatar name={author.name} color={author.avatarColor} image={author.avatarUrl} size="sm" />}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium">{author?.name || 'Unknown'}</span>
                                <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                              </div>
                              <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{c.body}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  {canComment && (
                    <div className="flex gap-2">
                      <Textarea
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                        placeholder="Write a comment..."
                        rows={2}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                      />
                      <Button onClick={handleAddComment} disabled={!commentBody.trim()} className="self-end">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No history recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {[...history].reverse().map((h) => {
                        const actor = userRepo.find(h.actorId);
                        return (
                          <div key={h.id} className="flex items-start gap-3 text-sm py-2 border-b last:border-0">
                            <div className="mt-0.5">
                              <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                <HistoryIcon className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="flex-1">
                              <span className="font-medium">{actor?.name || 'Unknown'}</span>
                              {h.field === 'created' ? (
                                <span> created this issue</span>
                              ) : (
                                <span> changed <span className="font-medium">{h.field}</span> from <span className="text-muted-foreground">&quot;{h.oldValue}&quot;</span> to <span className="font-medium">&quot;{h.newValue}&quot;</span></span>
                              )}
                              <div className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(h.timestamp)}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="attachments" className="mt-4">
                  <div className="space-y-2 mb-4">
                    {attachments.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No files attached.</p>
                    ) : (
                      attachments.map((a) => {
                        const uploader = userRepo.find(a.uploadedById);
                        return (
                          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <Paperclip className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{a.fileName}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(a.fileSize)} · {uploader?.name || 'Unknown'} · {formatRelativeTime(a.uploadedAt)}
                              </div>
                            </div>
                            {canEdit && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleDeleteAttachment(a.id)}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {canEdit && (
                    showAttachForm ? (
                      <div className="rounded-lg border border-border p-3 space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">File name</Label>
                          <Input value={attFileName} onChange={(e) => setAttFileName(e.target.value)} placeholder="e.g. screenshot.png" />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">File size (bytes)</Label>
                          <Input value={attFileSize} onChange={(e) => setAttFileSize(e.target.value)} placeholder="e.g. 102400" type="number" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleAddAttachment} disabled={!attFileName.trim()}>Add file</Button>
                          <Button size="sm" variant="outline" onClick={() => setShowAttachForm(false)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => setShowAttachForm(true)}>
                        <Paperclip className="mr-2 h-4 w-4" /> Add attachment
                      </Button>
                    )
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Status &amp; Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Current status</Label>
                <StatusBadge label={statusMeta.label} className={statusMeta.badgeClass} />
              </div>

              {canChangeStatus && validTransitions.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Change status</Label>
                  <Select value="" onValueChange={(v) => handleStatusChange(v as IssueStatus)}>
                    <SelectTrigger><SelectValue placeholder="Move to..." /></SelectTrigger>
                    <SelectContent>
                      {validTransitions.map((s) => (
                        <SelectItem key={s} value={s}>{ISSUE_STATUS_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canApprove && issue.status === 'completed' && (
                <Button onClick={handleApprove} className="w-full">
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Approve Issue
                </Button>
              )}

              {issue.status === 'approved' && approver && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Approved by {approver.name} on {formatDate(issue.approvedAt)}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Project</Label>
                {project && (
                  <Link to={`/projects/${project.id}`} className="text-sm hover:text-primary flex items-center gap-2">
                    <div className="h-6 w-6 rounded text-white text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: project.color }}>
                      {project.key.slice(0, 3)}
                    </div>
                    {project.name}
                  </Link>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                <Badge variant="outline" className={typeMeta.badgeClass}>{typeMeta.label}</Badge>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
                <StatusBadge label={priorityMeta.label} className={priorityMeta.badgeClass} />
              </div>

              {severityMeta && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Severity</Label>
                  <StatusBadge label={severityMeta.label} className={severityMeta.badgeClass} />
                </div>
              )}

              {issue.reproducibility && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Reproducibility</Label>
                  <span className="text-sm">{issue.reproducibility}</span>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Reporter</Label>
                {reporter && (
                  <div className="flex items-center gap-2">
                    <UserAvatar name={reporter.name} color={reporter.avatarColor} image={reporter.avatarUrl} size="xs" />
                    <span className="text-sm">{reporter.name}</span>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Assignee</Label>
                {assignee ? (
                  <div className="flex items-center gap-2">
                    <UserAvatar name={assignee.name} color={assignee.avatarColor} image={assignee.avatarUrl} size="xs" />
                    <span className="text-sm">{assignee.name}</span>
                    {canAssign && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={handleUnassign}>
                        <UserMinus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
                {canAssign && (
                  <div className="mt-2 flex gap-2">
                    <Select value={assigneeSelect} onValueChange={setAssigneeSelect}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={assignee ? 'Reassign to...' : 'Assign to...'} /></SelectTrigger>
                      <SelectContent>
                        {eligibleAssignees.filter((u) => u.id !== assignee?.id).map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={handleAssign} disabled={!assigneeSelect}>
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Due date</Label>
                <span className={`text-sm flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                  {overdue && <AlertCircle className="h-3 w-3" />}
                  {formatDate(issue.dueDate)}
                </span>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Created</Label>
                <span className="text-sm text-muted-foreground">{formatDate(issue.createdAt)}</span>
              </div>

              {issue.resolvedAt && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Resolved</Label>
                  <span className="text-sm text-muted-foreground">{formatDate(issue.resolvedAt)}</span>
                </div>
              )}

              {issue.labels.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Labels</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.labels.map((label) => (
                      <Badge key={label} variant="secondary" className="text-xs">{label}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <IssueFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        issue={issue}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete issue"
        description={`Are you sure you want to delete "${issue.key}"? All comments, history, and attachments will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
