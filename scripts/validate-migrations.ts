import * as fs from 'fs';
import * as path from 'path';

/**
 * Migration Governance Validator
 * 
 * Rules:
 * 1. UNICA CONVENCION: New migrations must match [V|D]YYYYMMDDHHMMSS__description.sql
 * 2. NO COLLISIONS: Version prefix must be unique across all files.
 *    - New convention collisions are HARD ERRORS.
 *    - Legacy convention collisions are WARNINGS (baseline for existing messy state).
 * 3. SEPARATION: 
 *    - Structural (V) files: No DML (INSERT, UPDATE, DELETE)
 *    - Data Fix (D) files: No DDL (CREATE, ALTER, DROP)
 */

export interface ValidationResult {
    file: string;
    errors: string[];
    warnings: string[];
}

export class MigrationValidator {
    private readonly NEW_CONVENTION_REGEX = /^([VD])(\d{14})__(.*)\.sql$/;
    private readonly LEGACY_CONVENTION_REGEX = /^(\d{1,4})_(.*)\.sql$/;

    constructor(private readonly migrationsDir: string) { }

    public validate(): boolean {
        console.log('🚀 Starting Migration Governance Validation...');
        console.log(`📂 Scanning: ${this.migrationsDir}\n`);

        if (!fs.existsSync(this.migrationsDir)) {
            console.error(`❌ Migrations directory not found: ${this.migrationsDir}`);
            process.exit(1);
        }

        const files = fs.readdirSync(this.migrationsDir);
        const results: ValidationResult[] = this.validateFiles(files);

        // Output results
        let fatalError = false;
        results.sort((a, b) => a.file.localeCompare(b.file)).forEach(res => {
            if (res.errors.length > 0) {
                fatalError = true;
                console.error(`❌ ${res.file}`);
                res.errors.forEach(err => console.error(`   - ERROR: ${err}`));
            }
            // Only show warnings if they aren't overshadowed by errors for the same file
            if (res.warnings.length > 0 && res.errors.length === 0) {
                console.warn(`⚠️  ${res.file}`);
                res.warnings.forEach(warn => console.warn(`   - WARNING: ${warn}`));
            }
        });

        if (fatalError) {
            console.error('\n🛑 Migration validation FAILED. Governance rules violated.');
            return false;
        } else {
            console.log('\n✅ Migration governance check PASSED (with legacy warnings).');
            return true;
        }
    }

    public validateFiles(files: string[]): ValidationResult[] {
        const results: ValidationResult[] = [];
        const versionMap = new Map<string, string[]>();

        files.forEach(file => {
            // Only validate SQL files
            if (!file.endsWith('.sql')) {
                return;
            }

            const errors: string[] = [];
            const warnings: string[] = [];

            // 1. Check Convention
            const newMatch = file.match(this.NEW_CONVENTION_REGEX);
            const legacyMatch = file.match(this.LEGACY_CONVENTION_REGEX);
            let versionPrefix = '';

            if (newMatch) {
                versionPrefix = newMatch[2]; // The timestamp
                const type = newMatch[1];
                this.validateContent(file, type, errors);
            } else if (legacyMatch) {
                versionPrefix = legacyMatch[1].padStart(4, '0'); // Normalize legacy numbers for collision check
                warnings.push(`Legacy naming detected. New migrations MUST use [V|D]YYYYMMDDHHMMSS__description.sql`);
            } else if (file === 'manual_licensing_setup.sql') {
                warnings.push(`Special legacy file detected. Should be refactored to standard convention.`);
            } else if (file === 'README.md') {
                // Ignore README
            } else {
                errors.push(`Invalid naming convention. Must match [V|D]YYYYMMDDHHMMSS__description.sql`);
            }

            // 2. Track versions for collision check
            if (versionPrefix) {
                const existing = versionMap.get(versionPrefix) || [];
                existing.push(file);
                versionMap.set(versionPrefix, existing);
            }

            if (errors.length > 0 || warnings.length > 0) {
                results.push({ file, errors, warnings });
            }
        });

        // 3. Check for collisions
        versionMap.forEach((filesWithSameVersion, version) => {
            if (filesWithSameVersion.length > 1) {
                const hasNewConvention = filesWithSameVersion.some(f => this.NEW_CONVENTION_REGEX.test(f));

                filesWithSameVersion.forEach(file => {
                    let result = results.find(r => r.file === file);
                    if (!result) {
                        result = { file, errors: [], warnings: [] };
                        results.push(result);
                    }

                    const msg = `Collision detected! Version prefix '${version}' is used by: ${filesWithSameVersion.join(', ')}`;

                    // Critical: If any of the colliding files use the NEW convention, it's a HARD ERROR.
                    // If all are legacy, it's a WARNING (to maintain stability in messy history).
                    if (hasNewConvention) {
                        result.errors.push(msg);
                    } else {
                        result.warnings.push(msg);
                    }
                });
            }
        });

        return results;
    }

    private validateContent(file: string, type: string, errors: string[]) {
        const filePath = path.join(this.migrationsDir, file);
        if (!fs.existsSync(filePath)) return; // For testing purposes

        const content = fs.readFileSync(filePath, 'utf-8').toUpperCase();

        // Basic content inspection to avoid schema/data mixing
        if (type === 'V') {
            const dml = ['INSERT INTO ', 'UPDATE ', 'DELETE FROM '];
            dml.forEach(keyword => {
                if (content.includes(keyword)) {
                    errors.push(`Structural migration (V) should NOT contain DML items like '${keyword}'`);
                }
            });
        } else if (type === 'D') {
            const ddl = ['CREATE TABLE ', 'ALTER TABLE ', 'DROP TABLE ', 'CREATE INDEX ', 'DROP INDEX '];
            ddl.forEach(keyword => {
                if (content.includes(keyword)) {
                    errors.push(`Data fix migration (D) should NOT contain DDL items like '${keyword}'`);
                }
            });
        }
    }
}

// Only execute if run directly
if (require.main === module) {
    const migrationsDir = path.join(__dirname, '../apps/api/src/database/migrations');
    const validator = new MigrationValidator(migrationsDir);
    const success = validator.validate();
    process.exit(success ? 0 : 1);
}
