/**
 * Analytics Service
 * Maneja tracking de eventos con Google Analytics 4 y Mixpanel
 */

interface AnalyticsEvent {
  category: string
  action: string
  label?: string
  value?: number
}

interface UserProperties {
  userId?: string
  plan?: string
  storeId?: string
  [key: string]: unknown
}

class AnalyticsService {
  private isInitialized = false
  private gaId: string | null = null
  private mixpanelToken: string | null = null

  /**
   * Inicializa Google Analytics 4
   */
  private initGA4() {
    if (typeof window === 'undefined') return

    this.gaId = import.meta.env.VITE_GA4_MEASUREMENT_ID

    if (!this.gaId) {
      console.warn('[Analytics] GA4_MEASUREMENT_ID no configurado')
      return
    }

    // Cargar script de Google Analytics
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.gaId}`
    document.head.appendChild(script)

    // Inicializar gtag
    window.dataLayer = window.dataLayer || []
    function gtag(...args: unknown[]) {
      window.dataLayer.push(args)
    }
    gtag('js', new Date())
    gtag('config', this.gaId, {
      send_page_view: true,
      anonymize_ip: true, // GDPR compliance
    })

    // Hacer gtag disponible globalmente
    window.gtag = gtag

    console.log('[Analytics] Google Analytics 4 inicializado')
  }

  /**
   * Inicializa Mixpanel
   */
  private initMixpanel() {
    if (typeof window === 'undefined') return

    this.mixpanelToken = import.meta.env.VITE_MIXPANEL_TOKEN

    if (!this.mixpanelToken) {
      console.warn('[Analytics] MIXPANEL_TOKEN no configurado')
      return
    }

    // Cargar script de Mixpanel
    const mixpanelStub = (window as any).mixpanel || []
    ;(function (c: Document, a: any) {
      if (!a.__SV) {
        window.mixpanel = a
        a._i = []
        a.init = function (
          token: string,
          config?: Record<string, unknown>,
          name?: string
        ) {
          function g(target: any, methodName: string) {
            const parts = methodName.split('.')
            if (parts.length === 2) {
              target = target[parts[0]]
              methodName = parts[1]
            }
            target[methodName] = function (...args: unknown[]) {
              target.push([methodName, ...args])
            }
          }
          let lib = a
          name ? (lib = a[name] = []) : (name = 'mixpanel')
          lib.people = lib.people || []
          lib.toString = function (sub?: string | number) {
            let label = 'mixpanel'
            if (name !== 'mixpanel') label += '.' + name
            if (!sub) label += ' (stub)'
            return label
          }
          lib.people.toString = function () {
            return lib.toString(1) + '.people (stub)'
          }
          const methods =
            'disable time_event track track_pageview track_links track_forms track_with_groups add_group set_group remove_group register register_once alias unregister identify name_tag set_config reset opt_in_tracking opt_out_tracking has_opted_in_tracking has_opted_out_tracking clear_opt_in_out_tracking start_batch_senders people.set people.set_once people.unset people.increment people.append people.union people.track_charge people.clear_charges people.delete_user people.remove'.split(
              ' '
            )
          for (let h = 0; h < methods.length; h++) g(lib, methods[h])
          const a1 = a
          a1._i.push([token, config, name])
        }
        a.__SV = 1.2
        const scriptTag = c.createElement('script')
        scriptTag.type = 'text/javascript'
        scriptTag.async = true
        const customUrl = (window as any).MIXPANEL_CUSTOM_LIB_URL
        scriptTag.src =
          typeof customUrl !== 'undefined'
            ? customUrl
            : 'file:' === c.location.protocol &&
                '//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'.match(/^\/\//)
              ? 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'
              : '//cdn.mxpnl.com/libs/mixpanel-2-latest.min.js'
        const firstScript = c.getElementsByTagName('script')[0]
        firstScript?.parentNode?.insertBefore(scriptTag, firstScript)
      }
    })(document, mixpanelStub)

    window.mixpanel?.init(this.mixpanelToken, {
      debug: import.meta.env.DEV,
      track_pageview: true,
      persistence: 'localStorage',
    })

    console.log('[Analytics] Mixpanel inicializado')
  }

  /**
   * Inicializa todos los servicios de analytics
   */
  init() {
    if (this.isInitialized) return

    this.initGA4()
    this.initMixpanel()
    this.isInitialized = true

    console.log('[Analytics] Servicio de analytics inicializado')
  }

  /**
   * Trackea un evento
   */
  trackEvent({ category, action, label, value }: AnalyticsEvent) {
    if (!this.isInitialized) {
      console.warn('[Analytics] Servicio no inicializado')
      return
    }

    // Google Analytics 4
    if (window.gtag && this.gaId) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      })
    }

    // Mixpanel
    if (window.mixpanel && this.mixpanelToken) {
      window.mixpanel.track(`${category}: ${action}`, {
        label,
        value,
      })
    }

    if (import.meta.env.DEV) {
      console.log('[Analytics] Event tracked:', { category, action, label, value })
    }
  }

  /**
   * Trackea una vista de página
   */
  trackPageView(path: string, title?: string) {
    if (!this.isInitialized) return

    // Google Analytics 4
    if (window.gtag && this.gaId) {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: title,
      })
    }

    // Mixpanel
    if (window.mixpanel && this.mixpanelToken) {
      window.mixpanel.track_pageview({
        path,
        title,
      })
    }

    if (import.meta.env.DEV) {
      console.log('[Analytics] Page view tracked:', { path, title })
    }
  }

  /**
   * Identifica un usuario
   */
  identifyUser(userId: string, properties?: UserProperties) {
    if (!this.isInitialized) return

    // Google Analytics 4
    if (window.gtag && this.gaId) {
      window.gtag('set', 'user_properties', {
        user_id: userId,
        ...properties,
      })
    }

    // Mixpanel
    if (window.mixpanel && this.mixpanelToken) {
      window.mixpanel.identify(userId)
      if (properties) {
        window.mixpanel.people.set(properties)
      }
    }

    if (import.meta.env.DEV) {
      console.log('[Analytics] User identified:', { userId, properties })
    }
  }

  /**
   * Reinicia la sesión (logout)
   */
  reset() {
    if (!this.isInitialized) return

    // Mixpanel
    if (window.mixpanel && this.mixpanelToken) {
      window.mixpanel.reset()
    }

    if (import.meta.env.DEV) {
      console.log('[Analytics] Session reset')
    }
  }
}

// Singleton
export const analyticsService = new AnalyticsService()

// Declare global types
declare global {
  interface Window {
    dataLayer: unknown[]
    gtag?: (...args: unknown[]) => void
    mixpanel?: {
      init: (token: string, config: Record<string, unknown>) => void
      track: (eventName: string, properties?: Record<string, unknown>) => void
      track_pageview: (properties?: Record<string, unknown>) => void
      identify: (userId: string) => void
      people: {
        set: (properties: Record<string, unknown>) => void
      }
      reset: () => void
      _i: unknown[]
    }
  }
}
