/**
 * Contact Service
 * Maneja el envío de formularios de contacto usando Web3Forms
 * https://web3forms.com/
 */

export interface ContactFormData {
  name: string
  email: string
  subject?: string
  message: string
}

export interface ContactFormResponse {
  success: boolean
  message: string
}

class ContactService {
  private readonly apiUrl = 'https://api.web3forms.com/submit'
  private readonly accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY

  /**
   * Envía un formulario de contacto
   */
  async send(data: ContactFormData): Promise<ContactFormResponse> {
    if (!this.accessKey) {
      console.error('[Contact] WEB3FORMS_ACCESS_KEY no configurado')
      return {
        success: false,
        message: 'Servicio de contacto no configurado. Por favor intenta más tarde.',
      }
    }

    try {
      const formData = {
        access_key: this.accessKey,
        name: data.name,
        email: data.email,
        subject: data.subject || 'Nuevo mensaje desde LA CAJA',
        message: data.message,
        // Metadata adicional
        from_name: 'LA CAJA Contact Form',
        redirect: undefined, // No redirect, manejamos con JS
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        return {
          success: true,
          message: '¡Mensaje enviado exitosamente! Te contactaremos pronto.',
        }
      }

      return {
        success: false,
        message: result.message || 'Error al enviar el mensaje. Intenta nuevamente.',
      }
    } catch (error) {
      console.error('[Contact] Error sending form:', error)
      return {
        success: false,
        message: 'Error de red. Por favor verifica tu conexión e intenta nuevamente.',
      }
    }
  }

  /**
   * Envía un mensaje de soporte rápido
   */
  async sendSupport(email: string, question: string): Promise<ContactFormResponse> {
    return this.send({
      name: 'Usuario anónimo',
      email,
      subject: 'Pregunta de soporte desde FAQ',
      message: question,
    })
  }
}

// Singleton
export const contactService = new ContactService()
