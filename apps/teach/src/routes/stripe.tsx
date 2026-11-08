import { useToast } from '@elevate/web-ui'
import { errorMessage, FullPageSpinner, unwrap, usePortalAuth } from '@elevate/web-ui/portal'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../lib/api'
import { startStripeOnboarding, teachKeys } from '../lib/queries'

/** Stripe sends teachers here after onboarding; re-read the account before showing the dashboard. */
export function StripeReturn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { refreshUser } = usePortalAuth()
  const { toast } = useToast()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const { stripe } = await unwrap(await api.teach.stripe.status.$get())
        await queryClient.invalidateQueries({ queryKey: teachKeys.stripe })
        await refreshUser()
        toast(
          stripe.chargesEnabled
            ? {
                tone: 'success',
                title: 'Stripe connected',
                description: 'Learners can now pay for your courses.',
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
        navigate('/', { replace: true })
      }
    })()
  }, [navigate, queryClient, refreshUser, toast])
  return <FullPageSpinner label="Checking your Stripe account…" />
}

/** Stripe sends teachers here when an onboarding link expired; mint a new one and go back. */
export function StripeRefresh() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    startStripeOnboarding().catch((error) => {
      toast({ tone: 'danger', title: 'Stripe', description: errorMessage(error) })
      navigate('/', { replace: true })
    })
  }, [navigate, toast])
  return <FullPageSpinner label="Taking you back to Stripe…" />
}
