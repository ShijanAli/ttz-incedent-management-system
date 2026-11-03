import { useMemo, useRef, useState } from 'react';
import { Download, Eye, FileArchive, FileSpreadsheet, FileText, File as FileIcon, Loader2, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { AttachmentViewer, previewKind } from '@/components/issues/attachment-viewer';
import { parseApiError } from '@/lib/api-error';
import { formatFileSize } from '@/lib/download';
import { formatRelativeTime } from '@/lib/shared-utils';
import { cn } from '@/lib/utils';
import {
  useDeleteAttachmentMutation,
  useDownloadAttachmentMutation,
  useGetAttachmentFileQuery,
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
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // The viewer steps through the files it can show
  const previewable = useMemo(() => attachments.filter((a) => previewKind(a) !== null), [attachments]);

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

  /** Previewable files open in the viewer; anything else downloads */
  const open = (a: IssueAttachment) => {
    const i = previewable.findIndex((p) => p.id === a.id);
    if (i === -1) void handleDownload(a);
    else setViewerIndex(i);
  };

  return (
    <>
      <div className="mb-4">
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[190px] w-full rounded-xl" />)}
          </div>
        ) : error ? (
          <div className="py-6 text-center text-sm">
            <p className="text-destructive">{parseApiError(error, 'Failed to load files.').message}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No files attached.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {attachments.map((a) => (
              <AttachmentCard
                key={a.id}
                attachment={a}
                onOpen={() => open(a)}
                onDownload={() => void handleDownload(a)}
                downloading={downloadingId === a.id}
                onRemove={canDelete && (canDeleteAny || a.uploaded_by?.id === myId) ? () => setConfirmDelete(a) : undefined}
              />
            ))}
          </div>
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

      <AttachmentViewer
        files={previewable}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onDownload={(a) => void handleDownload(a)}
        downloadingId={downloadingId}
      />

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

interface AttachmentCardProps {
  attachment: IssueAttachment;
  onOpen: () => void;
  onDownload: () => void;
  downloading: boolean;
  onRemove?: () => void;
}

function AttachmentCard({ attachment: a, onOpen, onDownload, downloading, onRemove }: AttachmentCardProps) {
  const kind = previewKind(a);
  return (
    <div className="group overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Preview area: click to view (or download when the browser can't show it) */}
      <button
        type="button"
        onClick={onOpen}
        className="relative block h-32 w-full overflow-hidden bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={kind ? `Preview ${a.original_name}` : `Download ${a.original_name}`}
      >
        {kind === 'image' ? <ImageThumb attachment={a} /> : <FileTile attachment={a} />}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <span className="flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-1 text-xs font-medium shadow">
            {kind ? <><Eye className="h-3.5 w-3.5" /> View</> : <><Download className="h-3.5 w-3.5" /> Download</>}
          </span>
        </span>
      </button>

      <div className="flex items-center gap-1 p-2.5 pr-1.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium" title={a.original_name}>{a.original_name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatFileSize(a.size_bytes)} · {a.uploaded_by?.name || 'Unknown'} · {formatRelativeTime(a.created_at)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onDownload}
          disabled={downloading}
          aria-label={`Download ${a.original_name}`}
          title="Download"
        >
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        </Button>
        {onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"
            onClick={onRemove}
            aria-label={`Remove ${a.original_name}`}
            title="Remove"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Loads the image through the API (it needs the auth header) and shows it as a cover */
function ImageThumb({ attachment: a }: { attachment: IssueAttachment }) {
  const { data: url, isLoading, isError } = useGetAttachmentFileQuery({ id: a.id, mime: a.mime });
  if (isLoading) return <Skeleton className="h-full w-full rounded-none" />;
  if (isError || !url) return <FileTile attachment={a} />;
  return (
    <img
      src={url}
      alt={a.original_name}
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
  );
}

const EXT_STYLES: Record<string, { icon: typeof FileIcon; className: string }> = {
  pdf: { icon: FileText, className: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' },
  doc: { icon: FileText, className: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  docx: { icon: FileText, className: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
  xls: { icon: FileSpreadsheet, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  xlsx: { icon: FileSpreadsheet, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  csv: { icon: FileSpreadsheet, className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  zip: { icon: FileArchive, className: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400' },
};

/** Icon tile for files without an image thumbnail, colored by type */
function FileTile({ attachment: a }: { attachment: IssueAttachment }) {
  const ext = a.original_name.includes('.') ? a.original_name.split('.').pop()!.toLowerCase() : '';
  const style = EXT_STYLES[ext] ?? { icon: FileIcon, className: 'bg-muted text-muted-foreground' };
  const Icon = style.icon;
  return (
    <div className={cn('flex h-full w-full flex-col items-center justify-center gap-1.5', style.className)}>
      <Icon className="h-9 w-9" strokeWidth={1.5} />
      {ext && <span className="text-[11px] font-semibold uppercase tracking-wider">{ext}</span>}
    </div>
  );
}
