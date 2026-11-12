import { useToast } from '@elevate/web-ui'
import { errorMessage, FullPageSpinner, unwrap } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { teachKeys } from '../lib/keys'
import { useCurrentProfile } from '../lib/profile'
import { useStripeLinks } from '../lib/queries'

/** Stripe sends the owner here after onboarding; re-read the account before showing the dashboard. */
export function StripeReturn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { profileId, path } = useCurrentProfile()
  const { toast } = useToast()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const { stripe } = await unwrap(
          await api.teach.profiles[':profileId'].stripe.status.$get({ param: { profileId } }),
        )
        await queryClient.invalidateQueries({ queryKey: teachKeys.stripe(profileId) })
        await queryClient.invalidateQueries({ queryKey: teachKeys.profile(profileId) })
        toast(
          stripe.status === 'active' && stripe.chargesEnabled
            ? {
                tone: 'success',
                title: 'Stripe connected',
                description: 'Learners can now pay for your courses.',
              }
            : stripe.businessType === 'company' && stripe.chargesEnabled
              ? {
                  // A company is paid only once Elevate has matched the legal name as well.
                  tone: 'info',
                  title: 'Stripe is set up',
                  description:
                    'Elevate now checks the legal name on the account. We will email you when your courses can be bought.',
                }
              : {
                  tone: 'info',
                  title: 'Almost there',
                  description: 'Stripe still needs a few details before payments are enabled.',
                },
        )
      } catch (error) {
        toast({
          tone: 'danger',
          title: 'Could not check Stripe status',
          description: errorMessage(error),
        })
      } finally {
        navigate(path(), { replace: true })
      }
    })()
  }, [navigate, queryClient, profileId, path, toast])
  return <FullPageSpinner label="Checking your Stripe account…" />
}

/** Stripe sends the owner here when an onboarding link expired; mint a new one and go back. */
export function StripeRefresh() {
  const navigate = useNavigate()
  const { path } = useCurrentProfile()
  const { connect } = useStripeLinks()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    // On success the browser is already leaving for Stripe; a sign-in redirect is on its way too.
    void connect().then((outcome) => {
      if (outcome === 'failed') navigate(path(), { replace: true })
    })
  }, [navigate, path, connect])
  return <FullPageSpinner label="Taking you back to Stripe…" />
}
