import { useMemo, useRef, useState } from 'react';
import { Check, Loader2, Pencil, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/shared/user-avatar';
import { UserHoverCard } from '@/components/shared/user-hover-card';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MentionTextarea } from '@/components/issues/mention-textarea';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { useIssuePeople } from '@/hooks/use-issue-people';
import { parseApiError } from '@/lib/api-error';
import { formatRelativeTime, getAvatarColor } from '@/lib/shared-utils';
import { extractMentionIds, splitMentions, type MentionUser } from '@/lib/mentions';
import { cn } from '@/lib/utils';
import {
  useAddCommentMutation,
  useDeleteCommentMutation,
  useEditCommentMutation,
  useGetIssueCommentsInfiniteQuery,
} from '@/redux/features/issues/issue-detail-api';
import { useGetProjectMembersQuery } from '@/redux/features/projects/projects-api';
import type { IssueComment } from '@/redux/features/issues/issues-types';
import type { HoverCardUser } from '@/components/shared/user-hover-card';

interface IssueCommentsProps {
  issueId: number;
  /** Its members are who can be @mentioned */
  projectId: number;
  canComment: boolean;
  /** comments.edit / comments.delete; they still only apply to the user's own comments */
  canEdit: boolean;
  canDelete: boolean;
  /** Signed-in user; only authors may edit or delete their own comments */
  myId: number | undefined;
}

export function IssueComments({ issueId, projectId, canComment, canEdit, canDelete, myId }: IssueCommentsProps) {
  const list = useInfiniteList(useGetIssueCommentsInfiniteQuery(issueId));
  const { data: members = [], isSuccess: membersLoaded } = useGetProjectMembersQuery(projectId);
  // Comment authors come without a photo; fill it in from the members and assignees
  const { enrich } = useIssuePeople(issueId, projectId);
  const [addComment, { isLoading: adding }] = useAddCommentMutation();
  const [editComment, { isLoading: savingEdit }] = useEditCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [commentBody, setCommentBody] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IssueComment | null>(null);
  // People picked from the @ list; they win when two members share a name
  const pickedIds = useRef(new Set<number>());

  const memberUsers = useMemo(() => members.map((m) => m.user), [members]);

  // Names to highlight: current members, plus comment authors for anyone who has since left
  const knownUsers = useMemo(() => {
    const byId = new Map<number, HoverCardUser>();
    for (const u of memberUsers) byId.set(u.id, u);
    for (const c of list.items) if (c.author) byId.set(c.author.id, enrich(c.author));
    return byId;
  }, [list.items, memberUsers, enrich]);

  const mentionIds = (body: string) => extractMentionIds(body, memberUsers, pickedIds.current);

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    try {
      const body = commentBody.trim();
      await addComment({ issueId, body, mentioned_user_ids: mentionIds(body) }).unwrap();
      setCommentBody('');
      pickedIds.current.clear();
      toast.success('Comment added');
    } catch (err) {
      toast.error('Failed to add comment', { description: parseApiError(err).message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editing?.body.trim()) return;
    try {
      const body = editing.body.trim();
      // The full list after the edit; without the member list, leave it out to keep the current mentions
      await editComment({
        issueId,
        commentId: editing.id,
        body,
        ...(membersLoaded && { mentioned_user_ids: mentionIds(body) }),
      }).unwrap();
      setEditing(null);
      toast.success('Comment updated');
    } catch (err) {
      toast.error('Failed to update comment', { description: parseApiError(err).message });
    }
  };

  const handleDelete = async (comment: IssueComment) => {
    try {
      await deleteComment({ issueId, commentId: comment.id }).unwrap();
      toast.success('Comment deleted');
    } catch (err) {
      toast.error('Failed to delete comment', { description: parseApiError(err).message });
    }
  };

  return (
    <>
      <div className="space-y-3 mb-4">
        {list.showSkeleton ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 flex-1 rounded-lg" />
            </div>
          ))
        ) : list.isError ? (
          <div className="py-6 text-center text-sm">
            <p className="text-destructive">{parseApiError(list.error, 'Failed to load comments.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={list.refresh}>Retry</Button>
          </div>
        ) : list.items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No comments yet. Be the first to comment.</p>
        ) : (
          list.items.map((c) => {
            const author = c.author ? enrich(c.author) : null;
            const isMine = author?.id === myId;
            const canEditThis = canEdit && isMine;
            const canDeleteThis = canDelete && isMine;
            const isEditing = editing?.id === c.id;
            return (
              <div key={c.id} className="flex gap-3">
                {author && (
                  <UserHoverCard user={author}>
                    <UserAvatar name={author.name} color={getAvatarColor(author.id)} image={author.photo_url ?? undefined} size="sm" />
                  </UserHoverCard>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{author?.name || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground" title={new Date(c.created_at).toLocaleString()}>
                      {formatRelativeTime(c.created_at)}
                    </span>
                    {c.edited_at && <span className="text-xs text-muted-foreground">(edited)</span>}
                    {(canEditThis || canDeleteThis) && !isEditing && (
                      <div className="ml-auto flex gap-1">
                        {canEditThis && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground"
                            onClick={() => setEditing({ id: c.id, body: c.body })}
                            aria-label="Edit comment"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {canDeleteThis && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => setConfirmDelete(c)}
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <MentionTextarea
                        value={editing.body}
                        onChange={(body) => setEditing({ id: c.id, body })}
                        members={members}
                        excludeUserId={myId}
                        onMention={(id) => pickedIds.current.add(id)}
                        rows={2}
                        autoFocus
                        disabled={savingEdit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSaveEdit();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                      <div className="flex flex-col gap-1 self-end">
                        <Button size="icon" className="h-8 w-8" onClick={handleSaveEdit} disabled={!editing.body.trim() || savingEdit} aria-label="Save comment">
                          {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(null)} disabled={savingEdit} aria-label="Cancel">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <CommentBody comment={c} users={knownUsers} myId={myId} />
                  )}
                </div>
              </div>
            );
          })
        )}
        <InfiniteScrollTrigger {...list.trigger} disabled={list.trigger.disabled || list.showSkeleton} />
      </div>

      {canComment && (
        <div className="flex gap-2">
          <MentionTextarea
            value={commentBody}
            onChange={setCommentBody}
            members={members}
            excludeUserId={myId}
            onMention={(id) => pickedIds.current.add(id)}
            placeholder="Write a comment... Type @ to mention someone (Ctrl+Enter to send)"
            rows={2}
            disabled={adding}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleAddComment(); }}
          />
          <Button onClick={handleAddComment} disabled={!commentBody.trim() || adding} className="self-end" aria-label="Send comment">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete comment"
        description="Delete this comment? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </>
  );
}

/** The comment text, with tagged people highlighted (and the signed-in user's own tag stronger) */
function CommentBody({ comment, users, myId }: { comment: IssueComment; users: Map<number, HoverCardUser>; myId: number | undefined }) {
  const tagged = (comment.mentioned_user_ids ?? [])
    .map((id) => users.get(id))
    .filter((u): u is HoverCardUser => !!u);
  const parts = tagged.length ? splitMentions<MentionUser & HoverCardUser>(comment.body, tagged) : [comment.body];

  return (
    <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        typeof part === 'string' ? (
          part
        ) : (
          <UserHoverCard key={i} user={part}>
            <span
              className={cn(
                'rounded px-0.5 font-medium',
                part.id === myId ? 'bg-primary/15 text-primary' : 'text-primary',
              )}
            >
              @{part.name}
            </span>
          </UserHoverCard>
        ),
      )}
    </p>
  );
}
