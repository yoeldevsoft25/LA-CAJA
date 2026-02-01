import { useState, useEffect } from 'react'
import { pushNotificationsService } from '@/services/push-notifications.service'

/**
 * Hook para manejar push notifications
 */
export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSupported, setIsSupported] = useState(false)

  useEffect(() => {
    const supported = pushNotificationsService.isAvailable()
    setIsSupported(supported)
    if (supported) {
      pushNotificationsService.isSubscribed().then(setIsSubscribed)
    }
  }, [])

  const subscribe = async () => {
    const result = await pushNotificationsService.requestPermissionAndSubscribe()
    setIsSubscribed(result !== null)
    return result
  }

  const unsubscribe = async () => {
    await pushNotificationsService.unsubscribe()
    setIsSubscribed(false)
  }

  return {
    isSupported,
    isSubscribed,
    subscribe,
    unsubscribe,
  }
}

