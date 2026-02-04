/**
 * 📊 MONITOR DE RENDIMIENTO - LA-CAJA
 * -----------------------------------
 * Este script mide cuántas ventas por segundo está procesando el Ryzen 
 * en tiempo real. Úsalo mientras corre el stress-test.
 */

const { Queue } = require('bullmq');

const redisOptions = {
    host: 'localhost',
    port: 6379,
    password: 'la-caja-dev-password'
};

async function monitor() {
    const queue = new Queue('sales-projections', { connection: redisOptions });

    console.log('\x1b[36m%s\x1b[0m', '🔍 MONITOREO DE VELOCIDAD DE PROCESAMIENTO 🔍');
    console.log('Esperando datos en la cola...');

    let lastCompleted = 0;
    let startTime = null;

    const interval = setInterval(async () => {
        const counts = await queue.getJobCounts('completed', 'wait', 'active', 'failed');
        const completed = counts.completed;
        const pending = counts.wait + counts.active;

        if (pending > 0 && !startTime) {
            startTime = Date.now();
            lastCompleted = completed;
            return;
        }

        if (startTime) {
            const now = Date.now();
            const elapsed = (now - startTime) / 1000;
            const processedInInterval = completed - lastCompleted;
            const eps = Math.round(processedInInterval / 1); // Basado en el intervalo de 1s

            process.stdout.write(`\r🚀 Velocidad: \x1b[32m${eps} ventas/seg\x1b[0m | Pendientes: \x1b[33m${pending}\x1b[0m | Total: ${completed}     `);

            lastCompleted = completed;

            if (pending === 0 && completed > 0) {
                const totalDuration = (now - startTime) / 1000;
                console.log('\n\n\x1b[34m%s\x1b[0m', '✅ PROCESAMIENTO COMPLETADO');
                console.log(`- Tiempo total: ${totalDuration.toFixed(2)}s`);
                console.log(`- Capacidad media: ${Math.round(completed / totalDuration)} ventas/seg`);
                clearInterval(interval);
                process.exit(0);
            }
        }
    }, 1000);
}

monitor().catch(console.error);
