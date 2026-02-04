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
                    payload: {
                        items: [
                            { product_id: 'P1', quantity: 1, price: 10.5 },
                            { product_id: 'P2', quantity: 2, price: 20.0 },
                            { product_id: 'P3', quantity: 5, price: 5.99 }
                        ],
                        total: 80.45,
                        cash_session_id: uuidv4(),
                        customer_id: uuidv4()
                    },
                    actor: { user_id: uuidv4() },
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
    console.log('3. Con 40 workers, el Ryzen debería devorar estos 20k eventos en segundos.');
    console.log('---------------------------------------------------------');

    await queue.close();
    process.exit(0);
}

run().catch((err) => {
    console.error('\n❌ ERROR AL CONECTAR CON REDIS:', err.message);
    console.log('Asegúrate de que Docker esté corriendo y Redis esté arriba.');
    process.exit(1);
});
