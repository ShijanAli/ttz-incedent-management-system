import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IssueFormDialog } from '@/components/issues/issue-form-dialog';
import { parseApiError } from '@/lib/api-error';
import { useGetIssueQuery } from '@/redux/features/issues/issue-detail-api';

interface EditIssueDialogProps {
  /** null keeps the dialog closed */
  issueId: number | null;
  onClose: () => void;
}

/**
 * Opens the issue form for an issue known only by id (e.g. a list row): loads the
 * full issue first, since editing needs its abilities, assignees and description.
 */
export function EditIssueDialog({ issueId, onClose }: EditIssueDialogProps) {
  const { data: issue, isFetching, error } = useGetIssueQuery(issueId ?? 0, { skip: issueId === null });

  if (issueId !== null && issue && issue.id === issueId && !isFetching) {
    return <IssueFormDialog open onOpenChange={(open) => { if (!open) onClose(); }} issue={issue} onSaved={() => undefined} />;
  }

  return (
    <Dialog open={issueId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit issue</DialogTitle>
          <DialogDescription>
            {error ? parseApiError(error, 'Failed to load the issue.').message : 'Loading the issue...'}
          </DialogDescription>
        </DialogHeader>
        {!error && (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
