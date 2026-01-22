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

## Notas adicionales

- **Venta con factura fiscal emitida:** No se puede anular desde Ventas. Hay que crear una **nota de crédito** desde Facturas Fiscales:
  1. Ir a **Facturas Fiscales** → abrir la factura duplicada.
  2. Clic en **Crear nota de crédito** (o el ícono de cancelar en la lista).
  3. Opcional: indicar motivo, ej. *"Venta duplicada por error"*.
  4. Confirmar. Se crea una nota de crédito en **borrador** con los mismos datos.
  5. Revisar la nota, emitirla y luego hacer la reversión contable si aplica.
- **Venta FIAO con pagos:** Primero hay que reversar los pagos de la deuda; luego se puede anular la venta y hacer la reversión contable.
- Los **mapeos de cuentas** (ingresos, caja, costo, inventario) se definen en **Contabilidad** → **Mapeos de cuentas**. Las cuentas del asiento de la venta salen de ahí.

Si tu flujo difiere (por ejemplo, solo trabajas en USD o no usas costo de venta), adapta las líneas de la reversión manteniendo siempre débitos = créditos en cada moneda.
