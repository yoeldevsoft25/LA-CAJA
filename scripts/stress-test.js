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

    const TOTAL_EVENTS = 20000;
    const BATCH_SIZE = 1000;

    console.log('\x1b[35m%s\x1b[0m', '🔥 LA-CAJA GOD MODE BENCHMARK 🔥');
    console.log(`Inyectando ${TOTAL_EVENTS} eventos de venta para probar concurrencia...`);
    console.log(`Configuración actual: 40 Workers paralelos en Ryzen 7700X.`);

    const startTime = Date.now();

    for (let i = 0; i < TOTAL_EVENTS; i += BATCH_SIZE) {
        const jobs = Array.from({ length: BATCH_SIZE }).map(() => ({
            name: 'projection',
            data: {
                event: {
                    event_id: uuidv4(),
                    type: 'SaleCreated',
                    payload: {
                        items: [{ product_id: 'BENCHMARK-ITEM', quantity: 1, price: 99.99 }],
                        total: 99.99,
                        cash_session_id: uuidv4()
                    },
                    actor: { user_id: uuidv4() },
                    store_id: uuidv4(),
                    device_id: uuidv4(),
                    vector_clock: { 'benchmark-node': i }
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
