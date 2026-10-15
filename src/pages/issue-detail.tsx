import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router';
import { toast } from 'sonner';
import {
  Pencil, Trash2, Paperclip, CheckCircle2, AlertCircle, History as HistoryIcon, MessageSquare, Hand,
  LogOut, RotateCcw, Loader2, Hourglass,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTabParam } from '@/hooks/use-tab-param';
import { parseApiError } from '@/lib/api-error';
import { formatDate, getAvatarColor, isOverdue } from '@/lib/shared-utils';
import { getProjectColor, getProjectInitials, sortStatuses } from '@/lib/project-utils';
import {
  useChangeMyIssueStatusMutation,
  useDeleteIssueMutation,
  useGetIssueAssigneesQuery,
  useGetIssueQuery,
  usePickIssueMutation,
  useReviewIssueMutation,
  useUnpickIssueMutation,
} from '@/redux/features/issues/issue-detail-api';
import type { IssueDetail, ReviewDecision } from '@/redux/features/issues/issues-types';
import { useGetProjectMembersQuery, useGetProjectStatusesQuery } from '@/redux/features/projects/projects-api';
import { PageHeader } from '@/components/shared/page-header';
import { IssueFormDialog } from '@/components/issues/issue-form-dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import {
  IssuePriorityBadge, IssueProgress, IssueSeverityBadge, IssueStatusBadge, IssueTypeBadge,
} from '@/components/issues/issue-badges';
import { IssueComments } from '@/components/issues/issue-comments';
import { IssueHistory } from '@/components/issues/issue-history';
import { IssueAttachments } from '@/components/issues/issue-attachments';
import { IssueAssignees } from '@/components/issues/issue-assignees';
import { StatusUpdateDialog } from '@/components/issues/status-update-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ISSUE_TABS = ['comments', 'history', 'attachments'] as const;

export default function IssueDetailPage() {
  const issueId = Number(useParams().id);
  const navigate = useNavigate();
  const { data: issue, isLoading, error, refetch } = useGetIssueQuery(issueId, { skip: !Number.isFinite(issueId) });

  if (isLoading) return <IssueDetailSkeleton />;

  if (!issue) {
    const apiError = parseApiError(error, 'Failed to load the issue.');
    const missing = !Number.isFinite(issueId) || apiError.status === 404 || apiError.status === 403;
    return (
      <div className="animate-fade-in">
        <PageHeader title="Issue not found" breadcrumbs={[{ label: 'Issues', href: '/issues' }, { label: 'Not Found' }]} />
        <Card className="p-8 text-center text-muted-foreground">
          {missing ? 'The issue you are looking for does not exist or you do not have access to it.' : apiError.message}
          <div className="mt-4 flex justify-center gap-2">
            {!missing && <Button variant="outline" onClick={() => refetch()}>Retry</Button>}
            <Button variant="outline" onClick={() => navigate('/issues')}>
              Back to Issues
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return <IssueDetailView issue={issue} />;
}

function IssueDetailView({ issue }: { issue: IssueDetail }) {
  const navigate = useNavigate();
  const { session } = useAuth();
  const myId = session ? Number(session.user.id) : undefined;
  const can = issue.abilities;
  const [tab, setTab] = useTabParam(ISSUE_TABS, 'comments');

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{ status_id?: number } | null>(null);
  const [review, setReview] = useState<ReviewDecision | null>(null);

  // Fresh assignee list (the issue payload embeds one too, used until it loads)
  const { data: assignees = issue.assignees } = useGetIssueAssigneesQuery(issue.id);
  const needsStatuses = can.can_change_own_status || can.can_assign;
  const { data: statusList = [] } = useGetProjectStatusesQuery(issue.project.id, { skip: !needsStatuses });
  const { data: members = [] } = useGetProjectMembersQuery(issue.project.id, { skip: !can.can_assign });
  const statuses = sortStatuses(statusList);

  const [deleteIssue] = useDeleteIssueMutation();
  const [pickIssue, { isLoading: picking }] = usePickIssueMutation();
  const [unpickIssue, { isLoading: unpicking }] = useUnpickIssueMutation();
  const [changeMyStatus] = useChangeMyIssueStatusMutation();

  const myAssignment = assignees.find((a) => a.user.id === myId);
  const overdue = issue.progress < 100 && !issue.closed_at && isOverdue(issue.due_date ?? undefined);

  const run = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      toast.success(success);
    } catch (err) {
      toast.error(failure, { description: parseApiError(err).message });
    }
  };

  const handleDelete = async () => {
    try {
      await deleteIssue(issue.id).unwrap();
      toast.success('Issue deleted', { description: `${issue.code} has been deleted.` });
      navigate('/issues', { replace: true });
    } catch (err) {
      toast.error('Failed to delete issue', { description: parseApiError(err).message });
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={issue.code}
        description={issue.title}
        breadcrumbs={[{ label: 'Issues', href: '/issues' }, { label: issue.code }]}
        actions={
          <div className="flex items-center gap-2">
            {can.can_pick && (
              <Button onClick={() => run(() => pickIssue(issue.id).unwrap(), 'You picked up this issue', 'Failed to pick up')} disabled={picking}>
                {picking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hand className="mr-2 h-4 w-4" />} Pick up
              </Button>
            )}
            {can.can_unpick && (
              <Button variant="outline" onClick={() => run(() => unpickIssue(issue.id).unwrap(), 'You dropped this issue', 'Failed to drop')} disabled={unpicking}>
                {unpicking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />} Drop
              </Button>
            )}
            {(can.can_edit || can.can_triage) && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
            {can.can_delete && (
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
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="comments" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Comments ({issue.comment_count})
                  </TabsTrigger>
                  <TabsTrigger value="history" className="gap-1.5">
                    <HistoryIcon className="h-3.5 w-3.5" />
                    History ({issue.status_history.length})
                  </TabsTrigger>
                  <TabsTrigger value="attachments" className="gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" />
                    Files ({issue.attachment_count})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="comments" className="mt-4">
                  <IssueComments issueId={issue.id} canComment={can.can_comment} myId={myId} />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <IssueHistory issueId={issue.id} />
                </TabsContent>

                <TabsContent value="attachments" className="mt-4">
                  <IssueAttachments issueId={issue.id} canUpload={can.can_upload} canEdit={can.can_edit} myId={myId} />
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
                <IssueStatusBadge issue={issue} />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Progress</Label>
                <IssueProgress issue={issue} />
              </div>

              {can.can_change_own_status && statuses.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Change status{myAssignment?.status ? ` (yours: ${myAssignment.status.name}, ${myAssignment.progress}%)` : ''}
                  </Label>
                  <Select value="" onValueChange={(v) => setStatusDialog({ status_id: Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="Move to..." /></SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                            {s.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {issue.awaiting_review && (
                can.can_review ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">All assignees are done. Check the fix and confirm it, or send it back.</p>
                    <Button onClick={() => setReview('confirm')} className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" /> Confirm fix
                    </Button>
                    <Button variant="outline" onClick={() => setReview('recheck')} className="w-full">
                      <RotateCcw className="mr-2 h-4 w-4" /> Send back
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Hourglass className="h-3.5 w-3.5 text-amber-600" />
                    Waiting for the reporter to confirm the fix
                  </div>
                )
              )}

              {issue.closed_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  Closed on {formatDate(issue.closed_at)}
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
                <Link to={`/projects/${issue.project.id}`} className="text-sm hover:text-primary flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded text-white text-[9px] font-bold flex items-center justify-center"
                    style={{ backgroundColor: getProjectColor(issue.project) }}
                  >
                    {getProjectInitials(issue.project)}
                  </div>
                  {issue.project.name}
                </Link>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
                <IssueTypeBadge issue={issue} />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Priority</Label>
                <IssuePriorityBadge priority={issue.priority} />
              </div>

              {issue.severity && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Severity</Label>
                  <IssueSeverityBadge severity={issue.severity} />
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Reporter</Label>
                {issue.reported_by ? (
                  <div className="flex items-center gap-2">
                    <UserAvatar name={issue.reported_by.name} color={getAvatarColor(issue.reported_by.id)} size="xs" />
                    <span className="text-sm">{issue.reported_by.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Assignee</Label>
                <IssueAssignees
                  issueId={issue.id}
                  assignees={assignees}
                  canAssign={can.can_assign}
                  members={members}
                  statuses={statuses}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Due date</Label>
                <span className={`text-sm flex items-center gap-1 ${overdue ? 'text-red-600 font-medium' : ''}`}>
                  {overdue && <AlertCircle className="h-3 w-3" />}
                  {formatDate(issue.due_date ?? undefined)}
                </span>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Created</Label>
                <span className="text-sm text-muted-foreground">{formatDate(issue.created_at)}</span>
              </div>

              {issue.closed_at && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Resolved</Label>
                  <span className="text-sm text-muted-foreground">{formatDate(issue.closed_at)}</span>
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

      <IssueFormDialog open={editOpen} onOpenChange={setEditOpen} issue={issue} onSaved={() => undefined} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete issue"
        description={`Are you sure you want to delete "${issue.code}"? All comments, history, and attachments will be permanently removed.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <StatusUpdateDialog
        open={!!statusDialog}
        onOpenChange={(open) => { if (!open) setStatusDialog(null); }}
        title="Change my status"
        description="Update where you are on this issue. The overall status follows everyone's progress."
        statuses={statuses}
        initial={{ status_id: statusDialog?.status_id ?? myAssignment?.status?.id, progress: myAssignment?.progress ?? 0 }}
        onSubmit={async (body) => {
          try {
            await changeMyStatus({ issueId: issue.id, ...body }).unwrap();
            toast.success('Status updated');
          } catch (err) {
            toast.error('Failed to update status', { description: parseApiError(err).message });
            throw err;
          }
        }}
      />

      <ReviewDialog issueId={issue.id} decision={review} onClose={() => setReview(null)} />
    </div>
  );
}

/** Confirm the fix (comment optional) or send it back for a recheck (comment required) */
function ReviewDialog({ issueId, decision, onClose }: { issueId: number; decision: ReviewDecision | null; onClose: () => void }) {
  const [reviewIssue, { isLoading }] = useReviewIssueMutation();
  const [comment, setComment] = useState('');
  const isRecheck = decision === 'recheck';
  const valid = !isRecheck || comment.trim().length > 0;

  const close = () => {
    setComment('');
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision || !valid) return;
    try {
      await reviewIssue({ issueId, decision, ...(comment.trim() && { comment: comment.trim() }) }).unwrap();
      toast.success(isRecheck ? 'Sent back for a recheck' : 'Fix confirmed');
      close();
    } catch (err) {
      toast.error('Review failed', { description: parseApiError(err).message });
    }
  };

  return (
    <Dialog open={!!decision} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRecheck ? 'Send it back' : 'Confirm the fix'}</DialogTitle>
          <DialogDescription>
            {isRecheck
              ? 'Explain what still needs work. The assignees will pick it up again.'
              : 'Confirming closes the issue. You can leave a note for the team.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reviewComment">
              Comment {isRecheck ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <Textarea
              id="reviewComment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={isRecheck ? 'e.g. Still misaligned on a 360px wide screen.' : 'e.g. Works on my device now.'}
              rows={4}
              maxLength={5000}
              disabled={isLoading}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={isLoading}>Cancel</Button>
            <Button type="submit" variant={isRecheck ? 'destructive' : 'default'} disabled={isLoading || !valid}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isRecheck ? 'Send back' : 'Confirm fix'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function IssueDetailSkeleton() {
  return (
    <div className="animate-fade-in space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-80" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
