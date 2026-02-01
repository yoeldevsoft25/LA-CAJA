type MessageTone = 'friendly' | 'formal' | 'urgent'

interface DebtSummary {
    customerName: string
    totalAmount: number
    currency: 'USD' | 'Bs'
    dueDate?: Date // Opcional, por si queremos decir "vencido desde..."
    storeName?: string // Para la firma
}

export const whatsappTemplates = {
    /**
     * Genera un mensaje para WhatsApp basado en el tono y los datos de la deuda
     */
    generateMessage: (
        tone: MessageTone,
        data: DebtSummary
    ): string => {
        // Escapar caracteres para URL
        const nl = '%0A'
        const { customerName, totalAmount, currency, storeName = 'Su Tienda' } = data

        // Formatear monto
        const amountStr = currency === 'USD'
            ? `$${totalAmount.toFixed(2)}`
            : `${totalAmount.toFixed(2)} Bs`

        switch (tone) {
            case 'friendly':
                return `Hola *${customerName}*! 👋${nl}${nl}` +
                    `Esperamos que estés muy bien.${nl}` +
                    `Te escribimos para recordarte amablemente que tienes un saldo pendiente de *${amountStr}* en ${storeName}.${nl}${nl}` +
                    `Cuando puedas, por favor avísanos para coordinar el pago. ¡Gracias por tu preferencia! ✨`

            case 'formal':
                return `Estimado/a *${customerName}*,${nl}${nl}` +
                    `Le informamos que su estado de cuenta en ${storeName} presenta un saldo pendiente de *${amountStr}*.${nl}${nl}` +
                    `Agradecemos realizar el pago a la brevedad posible para mantener su cuenta al día. 📋`

            case 'urgent':
                return `⚠️ *AVISO DE COBRANZA - ${storeName}*${nl}${nl}` +
                    `Sr(a). *${customerName}*,${nl}` +
                    `Tenemos un saldo vencido pendiente por *${amountStr}* que requiere atención inmediata.${nl}${nl}` +
                    `Por favor contáctenos HOY para regularizar su situación y evitar inconvenientes con su crédito. 🛑`

            default:
                return ''
        }
    },

    /**
     * Genera el link directo de WhatsApp
     */
    generateLink: (phone: string, message: string): string => {
        // Limpiar teléfono (dejar solo números)
        const cleanPhone = phone.replace(/\D/g, '')
        return `https://wa.me/${cleanPhone}?text=${message}`
    }
}
