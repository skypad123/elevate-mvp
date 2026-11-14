import type { InvitationPreview, MembershipRole, MembersView } from '@elevate/core'
import { unwrap } from '@elevate/web-ui/portal'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from './api'
import { teachKeys } from './keys'
import { useCurrentProfile } from './profile'

const scoped = api.teach.profiles[':profileId']

/** The profile's managers and writers, and the invitations still waiting on someone. */
export function useMembers(enabled = true) {
  const { profileId } = useCurrentProfile()
  return useQuery({
    queryKey: teachKeys.members(profileId),
    enabled,
    queryFn: async () =>
      (await unwrap(await scoped.members.$get({ param: { profileId } }))) as MembersView,
  })
}

/** Every change to members answers with the list as it is afterwards; the cache takes it as is. */
export function useMemberActions() {
  const { profileId } = useCurrentProfile()
  const queryClient = useQueryClient()
  return useMemo(() => {
    const store = (list: MembersView) => {
      queryClient.setQueryData(teachKeys.members(profileId), list)
      return list
    }
    const reload = () => queryClient.invalidateQueries({ queryKey: teachKeys.members(profileId) })
    return {
      invite: async (email: string, role: MembershipRole) => {
        const sent = await unwrap(
          await scoped.invitations.$post({ param: { profileId }, json: { email, role } }),
        )
        await reload()
        return sent
      },
      resend: async (id: string) => {
        const sent = await unwrap(
          await scoped.invitations[':id'].resend.$post({ param: { profileId, id } }),
        )
        await reload()
        return sent
      },
      revoke: async (id: string) =>
        store(await unwrap(await scoped.invitations[':id'].$delete({ param: { profileId, id } }))),
      confirm: async (id: string) =>
        store(
          await unwrap(await scoped.invitations[':id'].confirm.$post({ param: { profileId, id } })),
        ),
      remove: async (userId: string) =>
        store(
          await unwrap(await scoped.members[':userId'].$delete({ param: { profileId, userId } })),
        ),
      changeRole: async (userId: string, role: MembershipRole) =>
        store(
          await unwrap(
            await scoped.members[':userId'].$patch({
              param: { profileId, userId },
              json: { role },
            }),
          ),
        ),
      leave: async () => {
        await unwrap(await scoped.members.me.$delete({ param: { profileId } }))
      },
    }
  }, [profileId, queryClient])
}

/** What an invitation link leads to. Needs no sign-in: the token in the link is the proof. */
export function useInvitationPreview(token: string) {
  return useQuery({
    queryKey: ['teach', 'invitation', token],
    enabled: !!token,
    retry: false,
    queryFn: async () =>
      (await unwrap(await api.teach.invitations[':token'].$get({ param: { token } })))
        .invitation as InvitationPreview,
  })
}

export async function acceptInvitation(token: string) {
  return (await unwrap(await api.teach.invitations[':token'].accept.$post({ param: { token } })))
    .accepted
}
