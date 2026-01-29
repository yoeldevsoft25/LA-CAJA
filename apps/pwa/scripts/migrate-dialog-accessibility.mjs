#!/usr/bin/env node

/**
 * Script de migración para agregar DialogTitle a todos los componentes con DialogContent
 * que no lo tengan, para cumplir con requisitos de accesibilidad de Radix UI.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const COMPONENTS_DIR = path.join(__dirname, '../src')

// Contador de archivos procesados
let filesProcessed = 0
let filesModified = 0
const modifiedFiles = []

/**
 * Encuentra todos los archivos .tsx recursivamente
 */
function findTsxFiles(dir, files = []) {
    const items = fs.readdirSync(dir)

    for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            // Skip node_modules y otros directorios
            if (!item.startsWith('.') && item !== 'node_modules' && item !== 'dist' && item !== 'build') {
                findTsxFiles(fullPath, files)
            }
        } else if (item.endsWith('.tsx')) {
            files.push(fullPath)
        }
    }

    return files
}

/**
 * Verifica si un archivo tiene DialogContent pero no DialogTitle
 */
function needsDialogTitle(content) {
    const hasDialogContent = content.includes('DialogContent')
    const hasDialogTitle = content.includes('DialogTitle') || content.includes('AccessibleDialogTitle')

    return hasDialogContent && !hasDialogTitle
}

/**
 * Extrae el nombre del componente modal del contenido
 */
function extractModalName(content, filename) {
    // Intentar extraer del nombre del archivo
    const basename = path.basename(filename, '.tsx')
    if (basename.includes('Modal')) {
        return basename.replace('Modal', '')
    }

    // Intentar extraer de un DialogHeader si existe
    const headerMatch = content.match(/<DialogHeader[^>]*>(.*?)<\/DialogHeader>/s)
    if (headerMatch) {
        const headerContent = headerMatch[1]
        const textMatch = headerContent.match(/>(.*?)</s)
        if (textMatch) {
            return textMatch[1].trim()
        }
    }

    // Fallback al nombre del archivo
    return basename
}

/**
 * Agrega la importación de AccessibleDialogTitle si no existe
 */
function addImport(content) {
    // Verificar si ya existe la importación
    if (content.includes('AccessibleDialogTitle')) {
        return content
    }

    // Buscar la línea donde se importa Dialog
    const dialogImportRegex = /import\s+{([^}]+)}\s+from\s+["']@\/components\/ui\/dialog["']/
    const match = content.match(dialogImportRegex)

    if (match) {
        // Agregar AccessibleDialogTitle a la importación existente
        const imports = match[1].split(',').map(i => i.trim())
        if (!imports.includes('AccessibleDialogTitle')) {
            imports.push('AccessibleDialogTitle')
            const newImportLine = `import { ${imports.join(', ')} } from "@/components/ui/dialog"`
            return content.replace(dialogImportRegex, newImportLine)
        }
    } else {
        // No hay importación de dialog, agregar una nueva
        // Buscar la última importación
        const lastImportIndex = content.lastIndexOf('import ')
        const nextLineIndex = content.indexOf('\n', lastImportIndex)
        const before = content.substring(0, nextLineIndex + 1)
        const after = content.substring(nextLineIndex + 1)
        return before + 'import { AccessibleDialogTitle } from "@/components/ui/accessible-dialog-title"\n' + after
    }

    return content
}

/**
 * Agrega AccessibleDialogTitle después de DialogContent
 */
function addDialogTitle(content, modalName) {
    // Buscar DialogContent y agregar AccessibleDialogTitle después
    // Patrón: <DialogContent...>
    const dialogContentRegex = /(<DialogContent[^>]*>)/
    const match = content.match(dialogContentRegex)

    if (match) {
        const titleElement = `\n        <AccessibleDialogTitle hidden>${modalName}</AccessibleDialogTitle>`
        return content.replace(dialogContentRegex, match[1] + titleElement)
    }

    return content
}

/**
 * Procesa un archivo
 */
function processFile(filePath) {
    filesProcessed++

    const content = fs.readFileSync(filePath, 'utf-8')

    if (!needsDialogTitle(content)) {
        return
    }

    console.log(`\n📝 Procesando: ${path.relative(COMPONENTS_DIR, filePath)}`)

    const modalName = extractModalName(content, filePath)
    console.log(`   Nombre del modal: "${modalName}"`)

    let modifiedContent = addImport(content)
    modifiedContent = addDialogTitle(modifiedContent, modalName)

    if (modifiedContent !== content) {
        fs.writeFileSync(filePath, modifiedContent, 'utf-8')
        filesModified++
        modifiedFiles.push(path.relative(COMPONENTS_DIR, filePath))
        console.log(`   ✅ Modificado`)
    } else {
        console.log(`   ⚠️  No se pudo modificar automáticamente`)
    }
}

/**
 * Main
 */
function main() {
    console.log('🚀 Iniciando migración de accesibilidad para DialogContent...\n')

    const files = findTsxFiles(COMPONENTS_DIR)
    console.log(`📁 Encontrados ${files.length} archivos .tsx\n`)

    files.forEach(processFile)

    console.log('\n' + '='.repeat(60))
    console.log(`\n✅ Migración completada!`)
    console.log(`   Archivos procesados: ${filesProcessed}`)
    console.log(`   Archivos modificados: ${filesModified}`)

    if (modifiedFiles.length > 0) {
        console.log(`\n📝 Archivos modificados:`)
        modifiedFiles.forEach(file => console.log(`   - ${file}`))
    }

    console.log('\n⚠️  IMPORTANTE: Revisa los cambios antes de hacer commit!')
    console.log('   Algunos diálogos pueden necesitar títulos más descriptivos.')
    console.log('\n')
}

main()
