import { useRef, useState } from 'react';
import { Download, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { parseApiError } from '@/lib/api-error';
import { formatFileSize } from '@/lib/download';
import { formatRelativeTime } from '@/lib/shared-utils';
import {
  useDeleteAttachmentMutation,
  useDownloadAttachmentMutation,
  useGetIssueAttachmentsQuery,
  useUploadAttachmentMutation,
} from '@/redux/features/issues/issue-detail-api';
import type { IssueAttachment } from '@/redux/features/issues/issues-types';

interface IssueAttachmentsProps {
  issueId: number;
  canUpload: boolean;
  /** attachments.delete; without it no file can be removed */
  canDelete: boolean;
  /** Issue editors may remove any file; everyone else only their own */
  canDeleteAny: boolean;
  myId: number | undefined;
}

export function IssueAttachments({ issueId, canUpload, canDelete, canDeleteAny, myId }: IssueAttachmentsProps) {
  const { data: attachments = [], isLoading, error, refetch } = useGetIssueAttachmentsQuery(issueId);
  const [uploadAttachment] = useUploadAttachmentMutation();
  const [deleteAttachment] = useDeleteAttachmentMutation();
  const [downloadAttachment] = useDownloadAttachmentMutation();
  const [uploading, setUploading] = useState(0);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<IssueAttachment | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const picked = Array.from(files);
    setUploading(picked.length);
    // One request per file, so one bad file doesn't block the rest
    const results = await Promise.allSettled(picked.map((file) => uploadAttachment({ issueId, file }).unwrap()));
    setUploading(0);
    if (fileInput.current) fileInput.current.value = '';

    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length < picked.length) {
      toast.success(`${picked.length - failed.length} file${picked.length - failed.length !== 1 ? 's' : ''} uploaded`);
    }
    if (failed.length) {
      toast.error(`${failed.length} file${failed.length !== 1 ? 's' : ''} failed to upload`, {
        description: parseApiError(failed[0].reason).message,
      });
    }
  };

  const handleDownload = async (a: IssueAttachment) => {
    setDownloadingId(a.id);
    try {
      await downloadAttachment({ id: a.id, original_name: a.original_name }).unwrap();
    } catch (err) {
      toast.error('Download failed', { description: parseApiError(err).message });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (a: IssueAttachment) => {
    try {
      await deleteAttachment({ issueId, attachmentId: a.id }).unwrap();
      toast.success('Attachment removed');
    } catch (err) {
      toast.error('Failed to remove attachment', { description: parseApiError(err).message });
    }
  };

  return (
    <>
      <div className="space-y-2 mb-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[62px] w-full rounded-lg" />)
        ) : error ? (
          <div className="py-6 text-center text-sm">
            <p className="text-destructive">{parseApiError(error, 'Failed to load files.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No files attached.</p>
        ) : (
          attachments.map((a) => {
            const canRemove = canDelete && (canDeleteAny || a.uploaded_by?.id === myId);
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" title={a.original_name}>{a.original_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(a.size_bytes)} · {a.uploaded_by?.name || 'Unknown'} · {formatRelativeTime(a.created_at)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleDownload(a)}
                  disabled={downloadingId === a.id}
                  aria-label={`Download ${a.original_name}`}
                >
                  {downloadingId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-600"
                    onClick={() => setConfirmDelete(a)}
                    aria-label={`Remove ${a.original_name}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {canUpload && (
        <>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
            aria-label="Choose files to attach"
          />
          <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading > 0}>
            {uploading > 0 ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading {uploading} file{uploading !== 1 ? 's' : ''}...</>
            ) : (
              <><Paperclip className="mr-2 h-4 w-4" /> Add attachment</>
            )}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Remove attachment"
        description={`Remove "${confirmDelete?.original_name}" from this issue? This cannot be undone.`}
        confirmLabel="Remove"
        variant="destructive"
        onConfirm={async () => { if (confirmDelete) await handleDelete(confirmDelete); }}
      />
    </>
  );
}
