import { Module } from '@nestjs/common';
import { FiscalSequenceService } from './fiscal-sequence.service';
import { FiscalController } from './fiscal.controller';

@Module({
    controllers: [FiscalController],
    providers: [FiscalSequenceService],
    exports: [FiscalSequenceService],
})
export class FiscalModule { }
