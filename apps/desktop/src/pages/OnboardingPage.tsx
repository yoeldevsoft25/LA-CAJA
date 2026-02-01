import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard'
import { getDefaultRoute } from '@/lib/permissions'
import { useAuth } from '@/stores/auth.store'

export default function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const handleComplete = () => {
    // Invalidar cache para que se recargue la configuración
    queryClient.invalidateQueries({ queryKey: ['setup'] })
    
    // Redirigir al dashboard después de completar
    const defaultRoute = getDefaultRoute(user?.role || 'owner')
    navigate(defaultRoute)
  }

  const handleSkip = () => {
    // Permitir saltar el wizard (redirigir al dashboard)
    const defaultRoute = getDefaultRoute(user?.role || 'owner')
    navigate(defaultRoute)
  }

  return <OnboardingWizard onComplete={handleComplete} onSkip={handleSkip} />
}