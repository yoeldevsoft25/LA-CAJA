# WINDOWS FERRARI PLAYBOOK (TAILSCALE + WIREGUARD FALLBACK)

Este playbook deja el servidor local en Windows con operacion robusta:

- Tailscale como tunel primario (zero-trust, ACL, DNS).
- WireGuard como fallback manual/controlado (sin rutas solapadas).
- Postgres + Redis en Docker con autocuracion.
- API Nest con health checks, tareas programadas y runbook.

> Nota tecnica: Tailscale ya usa WireGuard debajo. En este plan, "WireGuard fallback" es un tunel independiente para contingencia, no para correr en paralelo con el mismo trafico.

---

## 1) Objetivos de SRE (base)

- Disponibilidad local (API): >= 99.9%.
- RPO funcional: 0 eventos perdidos (offline queue + reintentos).
- RTO local tras corte: <= 10 min para API y colas.
- Ventana de desconexion tolerada: hasta 4 horas con operacion offline.

---

## 2) Roles y prompts por peticion

Usa estos prompts tal cual para separar decisiones por rol.

### 2.1 Arquitecto de red (Windows)

```text
Actua como arquitecto de red senior para Windows Server/Windows 11.
Disena Tailscale (primario) + WireGuard (fallback) sin rutas solapadas,
con ACL, MagicDNS, split tunneling y failover controlado.
Entrega: diagrama logico, CIDRs, puertos, riesgos y criterios de rollback.
```

### 2.2 DevOps Windows + PowerShell

```text
Actua como DevOps Windows experto.
Dame implementacion production-ready con PowerShell:
servicios, Docker, Task Scheduler, scripts idempotentes, health checks
y autocuracion de API/Postgres/Redis.
```

### 2.3 Seguridad zero-trust

```text
Actua como especialista zero-trust en Windows.
Define ACL minimas para Tailscale, hardening de firewall, SSH/RDP,
rotacion de llaves, y aislamiento de puertos 5432/6379.
Entrega checklist de auditoria y acciones prioritarias.
```

### 2.4 SRE/Observabilidad

```text
Actua como SRE.
Define SLIs/SLOs, alertas accionables, probes de red/API/DB/Redis,
runbooks de incidentes y pruebas de recuperacion.
```

### 2.5 Backend reliability offline-first

```text
Actua como backend reliability engineer.
Disena failover local->cloud, circuit breaker, retries con backoff,
idempotencia, deduplicacion y drenaje robusto de cola al reconectar.
```

### 2.6 Chaos engineer

```text
Actua como chaos engineer.
Crea pruebas de corte de luz/red por 4 horas en Windows:
consistencia de datos, duplicados, backlog flush y criterios de aceptacion.
```

---

## 3) Topologia recomendada

- Primario:
  - Clientes (Desktop/PWA) -> API local `http://<tailscale-ip>:3000`.
  - API local -> Postgres local (docker `5432`) + Redis local (docker `6379`).
  - API local -> relay opcional a Render por `REMOTE_SYNC_URL` (asincrono).
- Fallback:
  - WireGuard manual para acceso de emergencia cuando Tailscale no este disponible.
  - No anunciar la misma ruta por ambos tuneles al mismo tiempo.

---

## 4) Implementacion (orden exacto)

## Paso A - Preflight

1. Confirmar Docker containers:
   - `la-caja-db`
   - `la-caja-redis`
2. Confirmar API health local:
   - `http://localhost:3000/health`
   - `http://localhost:3000/health/detailed`
3. Confirmar `.env` limpio:
   - `DB_NAME=la_caja`
   - `DATABASE_URL=postgresql://postgres:...@localhost:5432/la_caja`

## Paso B - Tailscale primario

1. Instalar Tailscale en Windows.
2. Unir nodo y fijar hostname (ejemplo):
   - `tailscale up --hostname ferrari-la-caja --accept-routes --accept-dns`
3. En Admin Console:
   - Crear tag `tag:la-caja-server`.
   - Aplicar ACL minima:
     - Solo dispositivos admin/operacion -> puerto `3000`.
     - Bloquear acceso directo a `5432` y `6379` salvo admin tecnico.
4. Activar MagicDNS para nombres estables (`ferrari-la-caja`).

## Paso C - WireGuard fallback

1. Instalar WireGuard para Windows.
2. Crear tunnel de fallback con nombre unico (ej: `LA-CAJA-FALLBACK`).
3. AllowedIPs del fallback: solo subred de contingencia (no full-tunnel si no es necesario).
4. Mantener fallback en modo manual (no auto-on) para evitar colision de rutas.

## Paso D - Autocuracion y monitoreo

Usar scripts en `scripts/windows`:

- `ferrari-healthcheck.ps1`: verifica API, Docker, DB/Redis containers, Tailscale y WireGuard.
- `ferrari-self-heal.ps1`: intenta recuperar Tailscale, containers y API.
- `register-ferrari-tasks.ps1`: crea tareas programadas para health + self-heal.

Ejecutar como admin:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\windows\register-ferrari-tasks.ps1 -ProjectRoot "C:\Users\Yoel Dev\Documents\GitHub\LA-CAJA"
```

---

## 5) Seguridad minima obligatoria

- En firewall de Windows:
  - Permitir `3000/tcp` solo para redes privadas/Tailscale.
  - Restringir `5432` y `6379` (sin exposicion publica).
- Rotar secretos comprometidos:
  - GitHub token.
  - Resend API key.
  - JWT secret si fue expuesto.
- No dejar tokens en `.env` ni en logs.

---

## 6) Runbook rapido de incidentes

## Caso 1: API down

1. `.\scripts\windows\ferrari-healthcheck.ps1`
2. `.\scripts\windows\ferrari-self-heal.ps1`
3. Verificar `http://localhost:3000/health`

## Caso 2: Tailscale down

1. Reiniciar servicio Tailscale.
2. Verificar `tailscale status`.
3. Si falla, activar temporalmente WireGuard fallback.

## Caso 3: DB auth error

1. Verificar `.env` real cargado por proceso.
2. Verificar DB name (`la_caja`) y credenciales.
3. Probar login directo al contenedor con `psql`.

---

## 7) Prueba de caos (4 horas)

- Simular desconexion de internet.
- Ejecutar operaciones POS offline (ventas, productos, clientes).
- Restaurar red.
- Confirmar:
  - Cola se drena sin duplicados.
  - Totales y deuda/cuadre consistentes.
  - `sync_metrics` y conflictos dentro de tolerancia.

---

## 8) Criterio de "Ferrari 100%"

Se considera listo cuando:

1. API + DB + Redis se recuperan solos tras reinicio.
2. Acceso remoto por Tailscale es estable.
3. Fallback WireGuard funciona bajo demanda.
4. Operacion offline 4h pasa sin perdida de eventos.
5. Alertas y runbooks permiten respuesta en minutos.

