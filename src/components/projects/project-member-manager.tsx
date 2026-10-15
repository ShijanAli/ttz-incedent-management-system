import { MemberManager } from '@/components/members/member-manager';
import {
  useAddProjectMemberMutation,
  useChangeProjectMemberRoleMutation,
  useGetProjectMembersQuery,
  useRemoveProjectMemberMutation,
} from '@/redux/features/projects/projects-api';
import type { ApiProject } from '@/redux/features/projects/projects-types';

interface ProjectMemberManagerProps {
  project: ApiProject;
  /** Users with "Manage project members" can add, remove and change roles */
  canManage: boolean;
}

/** Project members tab: the shared MemberManager wired to the project member APIs */
export function ProjectMemberManager({ project, canManage }: ProjectMemberManagerProps) {
  const { data: members = [], isLoading, error, refetch } = useGetProjectMembersQuery(project.id);
  const [addMember] = useAddProjectMemberMutation();
  const [changeRole] = useChangeProjectMemberRoleMutation();
  const [removeMember] = useRemoveProjectMemberMutation();
  const projectId = project.id;

  return (
    <MemberManager
      entityName={project.name}
      members={members}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      canManage={canManage}
      onAdd={(userId, role) => addMember({ projectId, user_id: userId, ...(role && { role }) }).unwrap()}
      onChangeRole={(userId, role) => changeRole({ projectId, userId, role }).unwrap()}
      onRemove={(userId) => removeMember({ projectId, userId }).unwrap()}
      removeWarning="They will lose access to this project."
      footnote={'Leave the role on "User\'s default role" to use the role from their account. Members added through a group are managed from that group.'}
    />
  );
}
