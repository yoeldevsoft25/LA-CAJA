import { Settings } from 'lucide-react'
import PeripheralsList from '@/components/peripherals/PeripheralsList'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PeripheralsPage() {
  return (
    <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      <Card className="border border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl sm:text-2xl flex items-center">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7 text-primary mr-2" />
            Periféricos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PeripheralsList />
        </CardContent>
      </Card>
    </div>
  )
}



