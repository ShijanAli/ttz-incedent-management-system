import { useEffect } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { parseApiError } from '@/lib/api-error';
import { formatFileSize } from '@/lib/download';
import { formatRelativeTime } from '@/lib/shared-utils';
import { useGetAttachmentFileQuery } from '@/redux/features/issues/issue-detail-api';
import type { IssueAttachment } from '@/redux/features/issues/issues-types';

export type PreviewKind = 'image' | 'pdf' | 'text' | null;

/** Which files the browser can show inline */
export function previewKind(a: Pick<IssueAttachment, 'mime' | 'original_name'>): PreviewKind {
  const mime = (a.mime || '').toLowerCase();
  const ext = a.original_name.split('.').pop()?.toLowerCase() ?? '';
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.startsWith('text/') || ['txt', 'log', 'csv', 'json', 'md'].includes(ext)) return 'text';
  return null;
}

interface AttachmentViewerProps {
  /** Every previewable file, so the viewer can step through them */
  files: IssueAttachment[];
  index: number | null;
  onIndexChange: (index: number | null) => void;
  onDownload: (a: IssueAttachment) => void;
  downloadingId: number | null;
}

export function AttachmentViewer({ files, index, onIndexChange, onDownload, downloadingId }: AttachmentViewerProps) {
  const file = index !== null ? files[index] : undefined;
  const hasPrev = index !== null && index > 0;
  const hasNext = index !== null && index < files.length - 1;

  // Arrow keys step through the files
  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && hasNext) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, hasPrev, hasNext, onIndexChange]);

  return (
    <Dialog open={!!file} onOpenChange={(open) => { if (!open) onIndexChange(null); }}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        {file && (
          <>
            {/* Header (right padding leaves room for the dialog's close button) */}
            <div className="flex items-center gap-3 border-b px-4 py-3 pr-12">
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate text-sm font-semibold" title={file.original_name}>
                  {file.original_name}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {formatFileSize(file.size_bytes)} · {file.uploaded_by?.name || 'Unknown'} · {formatRelativeTime(file.created_at)}
                  {files.length > 1 && ` · ${index! + 1} of ${files.length}`}
                </DialogDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => onDownload(file)} disabled={downloadingId === file.id}>
                {downloadingId === file.id
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : <Download className="mr-2 h-4 w-4" />}
                Download
              </Button>
            </div>

            {/* Body */}
            <div className="relative min-h-0 flex-1 bg-muted/40">
              <PreviewBody key={file.id} file={file} />

              {hasPrev && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute left-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => onIndexChange(index! - 1)}
                  aria-label="Previous file"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
              )}
              {hasNext && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute right-3 top-1/2 h-10 w-10 -translate-y-1/2 rounded-full shadow-md"
                  onClick={() => onIndexChange(index! + 1)}
                  aria-label="Next file"
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ file }: { file: IssueAttachment }) {
  const kind = previewKind(file);
  const { data: url, isLoading, error } = useGetAttachmentFileQuery({ id: file.id, mime: file.mime });

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading preview...
      </div>
    );
  }
  if (error || !url) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-6 w-6" />
        {parseApiError(error, 'Could not load this file.').message}
      </div>
    );
  }
  if (kind === 'image') {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <img src={url} alt={file.original_name} className="max-h-full max-w-full rounded-md object-contain shadow-sm" />
      </div>
    );
  }
  if (kind === 'pdf' || kind === 'text') {
    return <iframe src={url} title={file.original_name} className="h-full w-full border-0 bg-white" />;
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <FileText className="h-8 w-8" />
      No preview for this file type. Download it to open.
    </div>
  );
}
