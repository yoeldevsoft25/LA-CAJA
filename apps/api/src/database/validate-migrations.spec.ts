import { MigrationValidator } from '../../../../scripts/validate-migrations';
import * as fs from 'fs';

jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('MigrationValidator', () => {
    const MOCK_DIR = '/mock/migrations';
    let validator: MigrationValidator;

    beforeEach(() => {
        jest.clearAllMocks();
        validator = new MigrationValidator(MOCK_DIR);
        mockedFs.existsSync.mockReturnValue(true);
    });

    describe('validateFiles', () => {
        it('should return no errors for valid new convention files', () => {
            const files = [
                'V20260203100000__create_billing.sql',
                'D20260203100100__fix_tax.sql'
            ];

            // Mock content reading
            mockedFs.readFileSync.mockImplementation((filePath: string | number | Buffer | URL) => {
                const pathStr = typeof filePath === 'string' ? filePath : String(filePath);
                if (pathStr.includes('V')) return 'CREATE TABLE test;';
                if (pathStr.includes('D')) return 'UPDATE test SET x=1;';
                return '';
            });

            const results = validator.validateFiles(files);
            expect(results.filter(r => r.errors.length > 0)).toHaveLength(0);
        });

        it('should return error for invalid naming convention', () => {
            const files = ['invalid_name.sql'];
            const results = validator.validateFiles(files);

            const result = results.find(r => r.file === 'invalid_name.sql');
            expect(result?.errors).toContain('Invalid naming convention. Must match [V|D]YYYYMMDDHHMMSS__description.sql');
        });

        it('should detect collisions in new convention files (HARD ERROR)', () => {
            const files = [
                'V20260203000000__test1.sql',
                'D20260203000000__test2.sql'
            ];
            mockedFs.readFileSync.mockReturnValue('CREATE TABLE test;');

            const results = validator.validateFiles(files);

            const collisionErrors = results.flatMap(r => r.errors).filter(e => e.includes('Collision detected'));
            expect(collisionErrors).toHaveLength(2);
        });

        it('should fail if V file contains DML', () => {
            const file = 'V20260203000000__test.sql';
            mockedFs.readFileSync.mockReturnValue('INSERT INTO users VALUES (1);');

            const results = validator.validateFiles([file]);
            const result = results.find(r => r.file === file);
            expect(result?.errors[0]).toContain('Structural migration (V) should NOT contain DML');
        });

        it('should fail if D file contains DDL', () => {
            const file = 'D20260203000000__test.sql';
            mockedFs.readFileSync.mockReturnValue('CREATE TABLE oops (id int);');

            const results = validator.validateFiles([file]);
            const result = results.find(r => r.file === file);
            expect(result?.errors[0]).toContain('Data fix migration (D) should NOT contain DDL');
        });

        it('should accept legacy files with warning', () => {
            const files = ['01_initial.sql'];
            mockedFs.readFileSync.mockReturnValue('CREATE TABLE legacy;');

            const results = validator.validateFiles(files);
            const result = results.find(r => r.file === '01_initial.sql');
            expect(result?.warnings[0]).toContain('Legacy naming detected');
            expect(result?.errors).toHaveLength(0);
        });
    });
});
