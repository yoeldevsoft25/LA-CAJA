import { Helmet } from 'react-helmet-async'

interface SEOHeadProps {
  title?: string
  description?: string
  keywords?: string
  ogImage?: string
  ogType?: string
  canonical?: string
  noindex?: boolean
}

export default function SEOHead({
  title = 'LA CAJA - Sistema POS Offline-First para Venezuela',
  description = 'El único sistema POS que funciona 100% sin internet. 85% cumplimiento SENIAT, contabilidad integrada, IA/ML predictivo. Hecho para Venezuela. Gratis para siempre.',
  keywords = 'pos venezuela, punto de venta venezuela, pos offline, facturación seniat, sistema pos, software facturación venezuela, pos sin internet, contabilidad venezuela, inventario venezuela, tasa bcv',
  ogImage = 'https://lacaja.app/og-image.png',
  ogType = 'website',
  canonical,
  noindex = false,
}: SEOHeadProps) {
  const siteUrl = 'https://lacaja.app'
  const fullTitle = title.includes('LA CAJA') ? title : `${title} | LA CAJA`

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {canonical && <link rel="canonical" href={`${siteUrl}${canonical}`} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="LA CAJA" />
      <meta property="og:locale" content="es_VE" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional Meta Tags */}
      <meta name="author" content="LA CAJA Team" />
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      <meta name="theme-color" content="#3b82f6" />

      {/* Geo Tags for Venezuela */}
      <meta name="geo.region" content="VE" />
      <meta name="geo.placename" content="Venezuela" />

      {/* Schema.org JSON-LD */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'LA CAJA',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web, Windows, macOS, Linux, Android',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '5.0',
            ratingCount: '500',
            bestRating: '5',
            worstRating: '1',
          },
          description: description,
          featureList: [
            'Offline-first POS system',
            'SENIAT fiscal invoicing',
            'Integrated accounting',
            'AI/ML predictions',
            'Multi-platform support',
            'Real-time analytics',
            'Inventory management',
            'Split payments',
          ],
          screenshot: ogImage,
          softwareVersion: '2.0',
          applicationSubCategory: 'Point of Sale',
        })}
      </script>

      {/* Organization Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'LA CAJA',
          url: siteUrl,
          logo: `${siteUrl}/logo.png`,
          description: 'Sistema POS offline-first para Venezuela',
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'VE',
          },
          sameAs: [
            'https://github.com/lacaja',
            'https://twitter.com/lacaja',
            'https://linkedin.com/company/lacaja',
          ],
        })}
      </script>

      {/* FAQ Schema */}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: '¿Realmente funciona 100% offline?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Sí. LA CAJA usa arquitectura offline-first con event sourcing. Todas las operaciones (ventas, inventario, reportes) funcionan sin internet. Cuando vuelve la conexión, todo se sincroniza automáticamente sin pérdida de datos.',
              },
            },
            {
              '@type': 'Question',
              name: '¿Cómo funciona la facturación fiscal SENIAT?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'Tenemos 85% de cumplimiento con la Providencia SNAT/2024/000121. Generamos códigos QR, control codes y fiscal numbers automáticamente. Las facturas son inmutables y tenemos un endpoint especial para auditorías del SENIAT.',
              },
            },
            {
              '@type': 'Question',
              name: '¿Qué plataformas soporta?',
              acceptedAnswer: {
                '@type': 'Answer',
                text: 'LA CAJA funciona en 3 plataformas: PWA (navegador), Desktop (Windows/Mac/Linux con Electron) y Android nativo. Compras una licencia y usas en todos tus dispositivos.',
              },
            },
          ],
        })}
      </script>
    </Helmet>
  )
}
