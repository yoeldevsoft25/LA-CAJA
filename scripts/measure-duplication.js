const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dir1 = 'apps/pwa/src';
const dir2 = 'apps/desktop/src';

function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            getFiles(filePath, fileList);
        } else {
            fileList.push(filePath);
        }
    });
    return fileList;
}

function getFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
}

const files1 = getFiles(dir1);
const files2 = getFiles(dir2);

console.log(`Files in ${dir1}: ${files1.length}`);
console.log(`Files in ${dir2}: ${files2.length}`);

let exactDuplicates = 0;
let nameCollisions = 0;

const map1 = new Map();
files1.forEach(f => {
    const relative = path.relative(dir1, f);
    map1.set(relative, getFileHash(f));
});

files2.forEach(f => {
    const relative = path.relative(dir2, f);
    if (map1.has(relative)) {
        nameCollisions++;
        if (map1.get(relative) === getFileHash(f)) {
            exactDuplicates++;
        }
    }
});

console.log(`Name collisions (same path relative to src): ${nameCollisions}`);
console.log(`Exact duplications (same content): ${exactDuplicates}`);
console.log(`Duplication percentage (bases on pwa count): ${(exactDuplicates / files1.length * 100).toFixed(2)}%`);
