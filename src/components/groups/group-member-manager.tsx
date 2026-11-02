import { useMemo } from 'react';
import { MemberManager } from '@/components/members/member-manager';
import {
  useAddGroupMemberMutation,
  useChangeGroupMemberLabelMutation,
  useGetGroupMembersQuery,
  useRemoveGroupMemberMutation,
} from '@/redux/features/groups/groups-api';
import { useGetProjectLabelsQuery } from '@/redux/features/project-labels/project-labels-api';
import type { GroupDetail } from '@/redux/features/groups/groups-types';

interface GroupMemberManagerProps {
  group: GroupDetail;
  /** Users with "Manage group members" can add, remove and change labels */
  canManage: boolean;
}

const NO_LABEL = 'No label';

/** Group members tab: the shared MemberManager wired to the group member and label APIs */
export function GroupMemberManager({ group, canManage }: GroupMemberManagerProps) {
  const { data: members = [], isLoading, error, refetch } = useGetGroupMembersQuery(group.id);
  const { data: labels = [] } = useGetProjectLabelsQuery(undefined, { skip: !canManage });
  const [addMember] = useAddGroupMemberMutation();
  const [changeLabel] = useChangeGroupMemberLabelMutation();
  const [removeMember] = useRemoveGroupMemberMutation();
  const groupId = group.id;

  const roleOptions = useMemo(() => labels.map((l) => ({ value: String(l.id), label: l.name })), [labels]);
  // The row shows the label; the picker works with the label's id
  const rows = useMemo(
    () => members.map((m) => ({ ...m, role: m.label?.name ?? NO_LABEL, roleValue: m.label ? String(m.label.id) : '' })),
    [members],
  );

  return (
    <MemberManager
      entityName={group.name}
      members={rows}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      canManage={canManage}
      roleOptions={roleOptions}
      roleNoun="label"
      onAdd={(userId, labelId) => addMember({ groupId, user_id: userId, ...(labelId && { label_id: Number(labelId) }) }).unwrap()}
      onChangeRole={(userId, labelId) => changeLabel({ groupId, userId, labelId: Number(labelId) }).unwrap()}
      onRemove={(userId) => removeMember({ groupId, userId }).unwrap()}
      removeWarning="They will lose any project access they had only through this group."
      footnote="Labels (e.g. Backend Developer) describe what a member does. Members get their account role in every project the group is attached to."
    />
  );
}
