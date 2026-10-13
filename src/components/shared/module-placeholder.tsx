import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@/lib/types';

interface PlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  permission: Permission;
}

export function ModulePlaceholder({ title, description, icon: Icon, permission }: PlaceholderProps) {
  const { hasPermission } = useAuth();

  if (!hasPermission(permission)) {
    return (
      <div className="animate-fade-in">
        <PageHeader title={title} description={description} breadcrumbs={[{ label: title }]} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Icon className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Access restricted</h3>
            <p className="mt-1 text-sm text-muted-foreground">You don&apos;t have permission to access this module.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title={title} description={description} breadcrumbs={[{ label: title }]} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">{title} — Coming soon</h2>
          <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
            This module is part of Phase 2 of the Techtrioz IMS roadmap. The foundation is ready —
            this feature will be built next.
          </p>
          <div className="mt-6 flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
            <Construction className="h-3.5 w-3.5" />
            Phase 2 module
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
