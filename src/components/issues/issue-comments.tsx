import { useState } from 'react';
import { Check, Loader2, Pencil, Send, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/shared/user-avatar';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { InfiniteScrollTrigger } from '@/components/shared/infinite-scroll-trigger';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { parseApiError } from '@/lib/api-error';
import { formatRelativeTime, getAvatarColor } from '@/lib/shared-utils';
import {
  useAddCommentMutation,
  useDeleteCommentMutation,
  useEditCommentMutation,
  useGetIssueCommentsInfiniteQuery,
} from '@/redux/features/issues/issue-detail-api';
import type { IssueComment } from '@/redux/features/issues/issues-types';

interface IssueCommentsProps {
  issueId: number;
  canComment: boolean;
  /** Signed-in user; only authors may edit or delete their own comments */
  myId: number | undefined;
}

export function IssueComments({ issueId, canComment, myId }: IssueCommentsProps) {
  const list = useInfiniteList(useGetIssueCommentsInfiniteQuery(issueId));
  const [addComment, { isLoading: adding }] = useAddCommentMutation();
  const [editComment, { isLoading: savingEdit }] = useEditCommentMutation();
  const [deleteComment] = useDeleteCommentMutation();
  const [commentBody, setCommentBody] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IssueComment | null>(null);

  const handleAddComment = async () => {
    if (!commentBody.trim()) return;
    try {
      await addComment({ issueId, body: commentBody.trim() }).unwrap();
      setCommentBody('');
      toast.success('Comment added');
    } catch (err) {
      toast.error('Failed to add comment', { description: parseApiError(err).message });
    }
  };

  const handleSaveEdit = async () => {
    if (!editing?.body.trim()) return;
    try {
      await editComment({ issueId, commentId: editing.id, body: editing.body.trim() }).unwrap();
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
            // canComment is off on closed issues, which also locks existing comments
            const isMine = canComment && c.author?.id === myId;
            const isEditing = editing?.id === c.id;
            return (
              <div key={c.id} className="flex gap-3">
                {c.author && <UserAvatar name={c.author.name} color={getAvatarColor(c.author.id)} size="sm" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium">{c.author?.name || 'Unknown'}</span>
                    <span className="text-xs text-muted-foreground" title={new Date(c.created_at).toLocaleString()}>
                      {formatRelativeTime(c.created_at)}
                    </span>
                    {c.edited_at && <span className="text-xs text-muted-foreground">(edited)</span>}
                    {isMine && !isEditing && (
                      <div className="ml-auto flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={() => setEditing({ id: c.id, body: c.body })}
                          aria-label="Edit comment"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmDelete(c)}
                          aria-label="Delete comment"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Textarea
                        value={editing.body}
                        onChange={(e) => setEditing({ id: c.id, body: e.target.value })}
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
                    <p className="text-sm bg-muted/40 rounded-lg p-3 whitespace-pre-wrap">{c.body}</p>
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
          <Textarea
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            placeholder="Write a comment... (Ctrl+Enter to send)"
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
