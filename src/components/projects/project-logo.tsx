import { useEffect, useState } from 'react';
import { getProjectColor, getProjectInitials } from '@/lib/project-utils';
import { cn } from '@/lib/utils';

interface ProjectLogoProps {
  project: { id: number; name: string; color?: string | null; logo_url?: string | null };
  /** Size, corner radius and initials text size, e.g. "h-9 w-9 rounded-lg text-xs" */
  className?: string;
  /** Overrides the project's own color for the initials tile */
  color?: string;
}

/**
 * The project's logo when it has one (`logo_url`), otherwise its initials on its color.
 * A logo that fails to load falls back to the initials too.
 */
export function ProjectLogo({ project, className, color }: ProjectLogoProps) {
  const [failed, setFailed] = useState(false);
  // A new or changed logo gets another chance to load
  useEffect(() => setFailed(false), [project.logo_url]);

  if (project.logo_url && !failed) {
    return (
      <img
        src={project.logo_url}
        alt={`${project.name} logo`}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('shrink-0 border bg-background object-cover', className)}
      />
    );
  }

  return (
    <div
      className={cn('flex shrink-0 items-center justify-center font-bold text-white', className)}
      style={{ backgroundColor: color ?? getProjectColor({ id: project.id, color: project.color ?? undefined }) }}
      aria-hidden
    >
      {getProjectInitials(project)}
    </div>
  );
}
