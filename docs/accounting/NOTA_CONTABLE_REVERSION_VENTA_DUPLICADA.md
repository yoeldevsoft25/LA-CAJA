# Cómo crear una nota contable para revertir una venta duplicada

Cuando se registra una venta por error dos veces, hay que:

1. **Corregir operativamente** la venta duplicada (anularla o devolverla).
2. **Corregir en libros** con una **nota contable de reversión** que deshaga el asiento generado por esa venta.

---

## 1. Anular la venta duplicada (si aplica)

**Cuándo:** La venta duplicada **no** tiene factura fiscal emitida ni pagos de deuda.

**Cómo:**

- Ir a **Ventas** → abrir la venta duplicada → **Anular**.
- Solo usuarios **owner** pueden anular.
- Opcional: indicar motivo, ej. *"Venta registrada doble por error"*.

**Qué hace la anulación:**

- Marca la venta como anulada (`voided_at`).
- Devuelve el inventario (movimientos de ajuste).
- **No** revierte el asiento contable automáticamente.

Por eso hace falta la nota contable de reversión.

---

## 2. Obtener los datos del asiento original

El asiento de la venta se genera automáticamente y suele tener:

| Cuenta              | Débito BS | Crédito BS | Débito USD | Crédito USD |
|---------------------|-----------|------------|------------|-------------|
| Caja (o por cobrar) | Total     | 0          | Total      | 0           |
| Ingresos por venta  | 0         | Total      | 0          | Total       |
| Costo de venta      | Costo     | 0          | Costo      | 0           |
| Inventario          | 0         | Costo      | 0          | Costo       |

**Pasos:**

1. Ir a **Contabilidad** → **Asientos contables**.
2. Filtrar por **Tipo: Venta** y por fecha.
3. Abrir el asiento cuya **descripción** o **referencia** corresponde a la venta duplicada (número de factura o ID de venta).
4. Anotar:
   - Cuentas (`account_code`, `account_name`, `account_id`).
   - Montos en BS y USD de cada línea (débitos y créditos).
   - Totales y tipo de moneda si es mixto.

---

## 3. Crear la nota contable de reversión

**Dónde:** **Contabilidad** → **Asientos contables** → **Nuevo asiento**.

**Configuración del asiento:**

- **Fecha:** La del día en que se hace la corrección (o la de la operación, según tu criterio).
- **Tipo:** **Ajuste** (o **Manual** si no usas Ajuste).
- **Descripción:** Por ejemplo:  
  *"Reversión venta duplicada [número de factura o ID]. Motivo: venta registrada dos veces por error."*

**Líneas del asiento:**

Para **revertir** el asiento original, se invierten débitos y créditos en las **mismas cuentas**:

| Cuenta              | En el asiento original | En la reversión      |
|---------------------|------------------------|----------------------|
| Caja (o por cobrar) | Débito Total           | **Crédito** Total    |
| Ingresos por venta  | Crédito Total          | **Débito** Total     |
| Costo de venta      | Débito Costo           | **Crédito** Costo    |
| Inventario          | Crédito Costo          | **Débito** Costo     |

**Ejemplo** (venta solo en BS, total 100, costo 40):

| Cuenta         | Débito BS | Crédito BS |
|----------------|-----------|------------|
| Caja           | 0         | 100        |
| Ingresos venta | 100       | 0          |
| Costo de venta | 0         | 40         |
| Inventario     | 40        | 0          |
| **Totales**    | **140**   | **140**    |

**Importante:**

- Débitos y créditos deben cuadrar (totales BS iguales, totales USD iguales).
- Usar las **mismas cuentas** que el asiento de la venta (las que ves en el plan de cuentas / mapeos de venta).

---

## 4. Postear la nota contable

Después de guardar el asiento de reversión:

1. Abrirlo en la lista de asientos.
2. Usar la acción **Postear** para pasarlo de *borrador* a *posteado*.

Así la reversión queda registrada y reflejada en reportes y mayor.

---

## 5. Resumen del flujo

```
1. Anular la venta duplicada (Ventas → Anular) si no tiene factura fiscal ni pagos.
2. En Contabilidad, localizar el asiento de esa venta y anotar cuentas y montos.
3. Crear nuevo asiento tipo Ajuste/Manual con descripción “Reversión venta duplicada…”.
4. Cargar las mismas cuentas con débitos y créditos invertidos. Verificar que cuadre.
5. Postear el asiento de reversión.
```

---

---

## 6. CASO ESPECIAL: Venta duplicada con factura fiscal emitida

Si la venta duplicada tiene una **factura fiscal emitida**, el proceso es diferente porque según SENIAT no se pueden cancelar facturas emitidas directamente. Debes crear una **nota de crédito**.

### Paso a paso completo:

#### Paso 1: Crear la nota de crédito

**Opción A: Desde el detalle de la factura**

1. Ve al menú lateral y selecciona **"Facturas Fiscales"**.
2. Busca la factura duplicada (puedes usar el buscador por número de factura o cliente).
3. Haz clic en la factura para abrir su detalle.
4. Verás un botón rojo **"Crear nota de crédito"** (en lugar de "Cancelar").
5. Haz clic en ese botón.
6. Se abrirá un diálogo explicando que se creará una nota de crédito con los mismos datos.
7. **Opcional:** Escribe un motivo en el campo "Motivo", por ejemplo: *"Venta duplicada por error"*.
8. Confirma con **"Sí, crear nota de crédito"**.

**Opción B: Desde la lista de facturas**

1. Ve a **Facturas Fiscales**.
2. En la fila de la factura duplicada, localiza el ícono rojo de cancelar (X) en la columna de acciones.
3. Haz clic en ese ícono.
4. Sigue los pasos 6-8 de la Opción A.

#### Paso 2: Revisar y emitir la nota de crédito

Después de crear la nota de crédito:

1. **El sistema te redirige automáticamente** al detalle de la nueva nota de crédito.
2. Verifica que los datos sean correctos:
   - **Cliente:** Debe ser el mismo que la factura original.
   - **Ítems:** Mismos productos y cantidades.
   - **Totales:** Mismos montos en BS y USD.
   - **Tipo:** Debe decir **"Nota de Crédito"** (no "Factura").
   - **Estado:** Debe estar en **"Borrador"**.
   - **Nota:** Debe mencionar la factura original que anula.
3. Si todo está correcto, haz clic en el botón verde **"Emitir Factura"**.
4. Confirma la emisión.
5. La nota de crédito queda **emitida** y anula la factura original según normativa SENIAT.

#### Paso 3: Reversión contable (si aplica)

Si la factura original generó un asiento contable automático, ahora tienes dos opciones:

**Opción 1: Verificar si el sistema genera el asiento automáticamente**

1. Ve a **Contabilidad → Asientos contables**.
2. Busca si se creó un asiento para la nota de crédito (filtra por tipo "Factura Fiscal" o busca por número de nota de crédito).
3. Si existe, revísalo y postéalo si está en borrador.

**Opción 2: Crear reversión contable manual**

Si el sistema no genera asientos automáticos para notas de crédito, o si necesitas ajustar algo:

1. Ve a **Contabilidad → Asientos contables**.
2. Busca el asiento de la **factura original** (filtra por tipo "Factura Fiscal" o busca por número de factura).
3. Abre ese asiento y anota:
   - Todas las cuentas usadas.
   - Los montos de débito y crédito en BS y USD.
4. Crea un nuevo asiento:
   - **Tipo:** "Ajuste" o "Manual".
   - **Descripción:** *"Reversión nota de crédito [número NC]. Anula factura [número factura] duplicada."*
   - **Líneas:** Invierte débitos y créditos en las mismas cuentas (ver sección 3 de esta guía).
5. Verifica que los totales cuadren (débitos = créditos en BS y USD).
6. Guarda y **postea** el asiento.

---

## Resumen rápido por escenario

### Escenario 1: Venta duplicada SIN factura fiscal

1. ✅ Anular venta: **Ventas** → abrir venta → **Anular**.
2. ✅ Crear nota contable de reversión: **Contabilidad** → **Nuevo asiento** → tipo "Ajuste" → invertir débitos/créditos.

### Escenario 2: Venta duplicada CON factura fiscal emitida

1. ✅ Crear nota de crédito: **Facturas Fiscales** → abrir factura → **Crear nota de crédito** → indicar motivo → confirmar.
2. ✅ Emitir la nota de crédito: Revisar datos → **Emitir Factura**.
3. ✅ Reversión contable: **Contabilidad** → revisar/crear asiento de reversión si aplica.

---

## Notas adicionales

- **Venta FIAO con pagos:** Primero hay que reversar los pagos de la deuda; luego se puede anular la venta y hacer la reversión contable.
- Los **mapeos de cuentas** (ingresos, caja, costo, inventario) se definen en **Contabilidad** → **Mapeos de cuentas**. Las cuentas del asiento de la venta salen de ahí.
- Si tu flujo difiere (por ejemplo, solo trabajas en USD o no usas costo de venta), adapta las líneas de la reversión manteniendo siempre débitos = créditos en cada moneda.
