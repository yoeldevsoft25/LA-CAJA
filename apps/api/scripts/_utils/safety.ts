import { URL } from 'url';

/**
 * Strict allowlist for database hostnames.
 * Only local or ephemeral environments are permitted.
 */
const ALLOWED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '::1',
    'host.docker.internal',
    'postgres',
];

/**
 * Checks if the current environment and database connection are safe for disruptive operations.
 * 
 * @param requiredFlag - Optional environment variable that must be 'true' to proceed.
 * @throws Error if the environment is unsafe.
 */
export function checkSafeEnvironment(requiredFlag?: string): void {
    const dbUrl = process.env.DATABASE_URL || '';
    const nodeEnv = process.env.NODE_ENV;

    console.log('🛡️  Running PROD-SAFE Security Guards...');

    // 1. Block production environment
    if (nodeEnv === 'production') {
        console.error('❌ FATAL: This script is PROHIBITED in production environment.');
        process.exit(1);
    }

    // 2. Strict Hostname Allowlist
    try {
        const parsedUrl = new URL(dbUrl);
        const hostname = parsedUrl.hostname.toLowerCase();

        if (!ALLOWED_HOSTS.includes(hostname)) {
            console.error(`❌ FATAL: DATABASE_URL hostname "${hostname}" is NOT in the allowlist.`);
            console.error(`🔗 Allowed hosts: ${ALLOWED_HOSTS.join(', ')}`);
            console.error('🛑 This script is ONLY allowed on local or ephemeral databases.');
            process.exit(1);
        }
    } catch (error) {
        console.error('❌ FATAL: Invalid or missing DATABASE_URL.');
        process.exit(1);
    }

    // 3. Explicit Consent Flag
    if (requiredFlag && process.env[requiredFlag] !== 'true') {
        // We only fail if NOT in dry-run mode (checked by the caller script usually)
        // However, for consistency, if a flag is passed, we check it here.
        const isDryRun = process.argv.includes('--dry-run');
        if (!isDryRun) {
            console.error(`❌ FATAL: This script requires ${requiredFlag}=true environment variable.`);
            process.exit(1);
        }
    }

    console.log('✅ Safety Checks Passed (Local/Ephemeral host detected).');
}
