import { useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { MemberManager } from '@/components/members/member-manager';
import {
  useAddProjectMemberMutation,
  useGetProjectMembersQuery,
  useRemoveProjectMemberMutation,
  useSetProjectMemberLabelMutation,
} from '@/redux/features/projects/projects-api';
import { useGetProjectLabelsQuery } from '@/redux/features/project-labels/project-labels-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';

interface ProjectMemberManagerProps {
  project: ApiProject;
  /** Users with "Manage project members" can add, remove and change labels */
  canManage: boolean;
}

const NO_LABEL = 'No label';

/** Project members tab: the shared MemberManager wired to the project member and label APIs */
export function ProjectMemberManager({ project, canManage }: ProjectMemberManagerProps) {
  const { data: members = [], isLoading, error, refetch } = useGetProjectMembersQuery(project.id);
  // Labels are managed by super admins only; the label list is 403 for everyone else
  const { hasPermission } = useAuth();
  // Labels (e.g. Backend Dev) are managed with account.labels.manage
  const canLabel = hasPermission('account.labels.manage');
  const { data: labels = [] } = useGetProjectLabelsQuery(undefined, { skip: !canLabel });
  const [addMember] = useAddProjectMemberMutation();
  const [setLabel] = useSetProjectMemberLabelMutation();
  const [removeMember] = useRemoveProjectMemberMutation();
  const projectId = project.id;

  const roleOptions = useMemo(() => labels.map((l) => ({ value: String(l.id), label: l.name })), [labels]);
  // The row shows the label; the picker works with the label's id
  const rows = useMemo(
    () => members.map((m) => ({ ...m, role: m.label?.name ?? NO_LABEL, roleValue: m.label ? String(m.label.id) : '' })),
    [members],
  );

  return (
    <MemberManager
      entityName={project.name}
      members={rows}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      canManage={canManage}
      canChangeRole={canManage && canLabel}
      roleOptions={roleOptions}
      roleNoun="label"
      onAdd={async (userId, labelId) => {
        await addMember({ projectId, user_id: userId }).unwrap();
        if (labelId) await setLabel({ projectId, userId, labelId: Number(labelId) }).unwrap();
      }}
      onChangeRole={(userId, labelId) => setLabel({ projectId, userId, labelId: Number(labelId) }).unwrap()}
      onRemove={(userId) => removeMember({ projectId, userId }).unwrap()}
      removeWarning="They will lose access to this project."
      footnote="Labels (e.g. Backend Developer) describe what a member does on this project. Members added through a group are managed from that group."
    />
  );
}
