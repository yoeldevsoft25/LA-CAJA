/**
 * 🚀 God Mode Stress Test for Ryzen 7700X
 * ---------------------------------------
 * Este script inyecta ráfagas masivas de eventos directamente en BullMQ
 * para poner a prueba los 40 workers de concurrencia.
 */

const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');

// Configuración de conexión (Ajustada según tu .env local)
const redisOptions = {
    host: 'localhost',
    port: 6379,
    password: 'la-caja-dev-password'
};

async function run() {
    const queue = new Queue('sales-projections', { connection: redisOptions });

    const TOTAL_EVENTS = 500000; // ☢️ 500,000 Ventas (Medio Millón)
    const BATCH_SIZE = 2000;

    console.log('\x1b[31m%s\x1b[0m', '☢️  LA-CAJA NUCLEAR LIMIT TEST - 500,000 EVENTS ☢️');
    console.log(`Poniendo a prueba el Ryzen 7700X con medio millón de transacciones...`);
    console.log(`Configuración: 40 Workers paralelos | 8GB DB RAM | 24GB Docker Limit`);

    const startTime = Date.now();

    for (let i = 0; i < TOTAL_EVENTS; i += BATCH_SIZE) {
        const jobs = Array.from({ length: BATCH_SIZE }).map(() => ({
            name: 'projection',
            data: {
                event: {
                    event_id: uuidv4(),
                    type: 'SaleCreated',
                    created_at: new Date().toISOString(),
                    payload: {
                        sale_id: uuidv4(),
                        items: [
                            {
                                item_id: uuidv4(),
                                product_id: 'P1',
                                qty: 1,
                                unit_price_bs: 10.5,
                                unit_price_usd: 0.3,
                                discount_bs: 0,
                                discount_usd: 0
                            },
                            {
                                item_id: uuidv4(),
                                product_id: 'P2',
                                qty: 2,
                                unit_price_bs: 20.0,
                                unit_price_usd: 0.6,
                                discount_bs: 0,
                                discount_usd: 0
                            }
                        ],
                        totals: {
                            total_bs: 50.5,
                            total_usd: 1.5,
                            tax_bs: 0,
                            discount_bs: 0
                        },
                        payment: {
                            method: 'CASH',
                            amount_bs: 50.5,
                            amount_usd: 0,
                            currency: 'BS'
                        },
                        cash_session_id: uuidv4(),
                        customer_id: uuidv4()
                    },
                    actor_user_id: uuidv4(), // Fix: actor_user_id at top level
                    store_id: uuidv4(),
                    device_id: uuidv4(),
                    vector_clock: { 'nuclear-node': i }
                }
            },
            opts: {
                removeOnComplete: true,
                removeOnFail: false
            }
        }));

        await queue.addBulk(jobs);
        console.log(`✅ Lote inyectado: ${i + BATCH_SIZE}/${TOTAL_EVENTS} (${Math.round(((i + BATCH_SIZE) / TOTAL_EVENTS) * 100)}%)`);
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log('\n\x1b[32m%s\x1b[0m', `🏁 Inyección completada en ${duration}s.`);
    console.log('---------------------------------------------------------');
    console.log('INSTRUCCIONES DE MONITOREO:');
    console.log('1. Abre tu Administrador de Tareas (RAM y CPU).');
    console.log('2. Verás como los procesos de Node.js empiezan a trabajar en paralelo.');
    console.log('3. Con 100 workers, el Ryzen debería devorar estos 500k eventos rápidamente.');
    console.log('---------------------------------------------------------');

    await queue.close();
    process.exit(0);
}

run().catch((err) => {
    console.error('\n❌ ERROR AL CONECTAR CON REDIS:', err.message);
    console.log('Asegúrate de que Docker esté corriendo y Redis esté arriba.');
    process.exit(1);
});
