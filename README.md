# Clima Laboral: Sistema de Retroalimentación 360

Plataforma web para aplicar encuestas anónimas de clima laboral y evaluaciones 360 por área, ver los resultados en un dashboard y recibir alertas de riesgo de rotación. Proyecto escolar de Administración (tema: Liderazgo).

Empresa ficticia: *Componentes Industriales del Norte, S.A. de C.V.*, ~200 empleados, 5 áreas. **Todos los datos son simulados**, y la interfaz lo dice en un aviso permanente.

Stack: React + Vite + TypeScript + Tailwind (cliente), Node + Express + TypeScript + Prisma 7 + PostgreSQL (servidor).

## Instalación en PowerShell (Windows)

Requisitos: Node 20 o superior y PostgreSQL 16 (con Docker Desktop o instalado).

```powershell
# 1. Base de datos (opción Docker)
docker compose up -d

# 2. Variables de entorno
Copy-Item server\.env.example server\.env

# 3. Dependencias (no hay módulos nativos: se usa bcryptjs)
npm run install:all

# 4. Migración y datos simulados
npm run db:migrate
npm run db:seed

# 5. Cliente en http://localhost:5173 y API en http://localhost:3001
npm run dev
```

Si usas PostgreSQL instalado, edita `DATABASE_URL` en `server\.env`.
Pruebas: `npm test` (necesita la base migrada y con el seed cargado; restauran lo que modifican).

## Cuentas de prueba

Contraseña de todas: `Demo1234!`

| Rol | Correo |
|---|---|
| RH | `rh@clima.demo`, `rh2@clima.demo` |
| Líder | `lider.produccion@clima.demo`, `lider.calidad@clima.demo`, `lider.almacen@clima.demo`, `lider.mantenimiento@clima.demo`, `lider.administrativo@clima.demo` |
| Colaborador | `colaborador01@clima.demo` en adelante |

Todas las encuestas del seed están cerradas. Para probar el formulario de respuesta: entra como RH, crea una encuesta (hay un botón para cargar preguntas de ejemplo), actívala, genera invitaciones y entra como colaborador.

## Escenario del seed (`npm run db:seed`, reproducible)

Tres encuestas de clima cerradas (T1, T2 y T3 de 2026) y una evaluación 360. Riesgo de la más reciente: Producción **crítico** (liderazgo y permanencia en caída; el turno nocturno no es un campo del modelo, se representa con valores bajos en el área), Almacén **alto** (tendencia negativa marcada), Mantenimiento bajo, Calidad y Administrativo con variación normal. Solo Producción y Almacén generan alerta. Una prueba comprueba que este resultado se sostiene con 40 semillas aleatorias distintas.

## Modelo de riesgo de rotación

Índice ponderado y explicable (0 a 100), no aprendizaje automático:

```
riesgo = 0.30*desfavorable(PERMANENCIA) + 0.20*desfavorable(LIDERAZGO) + 0.15*desfavorable(COMUNICACION)
       + 0.10*desfavorable(RECONOCIMIENTO) + 0.10*desfavorable(CARGA_TRABAJO)
       + 0.10*tendencia + 0.05*rotacionHistorica
```

Favorable = respuestas 4 o 5. `tendencia` = caída del % favorable global contra la encuesta anterior, por 5, entre 0 y 100 (vale 0 sin encuesta anterior). `rotacionHistorica` = rotación anualizada de los últimos 6 meses / 60 * 100, tope 100. Niveles: menos de 40 bajo, 40 a 59 en observación, 60 a 74 alto, 75 o más crítico; solo alto y crítico crean alerta, con los 3 componentes que más aportan en `drivers`. Pesos y umbrales se editan en `/configuracion` (deben sumar 100 %). **Los pesos son supuestos de trabajo y no están calibrados con datos reales.** Un área con menos de k respuestas no recibe índice.

## Anonimato

- `Response` no tiene columna ni llave hacia el usuario ni hacia la invitación; su id es un UUID aleatorio (un id ordenado en el tiempo se podría cruzar con la hora de uso de la invitación).
- El envío es una sola transacción: marca la invitación como usada (solo con fecha) e inserta la respuesta. Solo se guarda la fecha de envío, sin hora.
- Umbral k por encuesta (por defecto 5) en cada corte: área, antigüedad y relación en 360. En vez de la cifra se muestra "Muestra insuficiente para proteger el anonimato". Si solo un corte queda oculto, también se oculta el menor de los visibles, para que no pueda deducirse por resta.
- Comentarios abiertos: solo a nivel de área con k cumplido, sin fecha ni autor y en orden alfabético.
- En la evaluación 360, `evaluatedUserId` identifica a quien se evalúa (un líder), nunca a quien responde. La autoevaluación es de la propia persona y no requiere umbral. Relación: Equipo = personas de su área; Pares = los otros líderes.

## Alcance y limitaciones

- Una sola organización, datos simulados, contraseña única de demostración.
- El anonimato se apoya en el diseño de datos y en k; con grupos pequeños y muchos cortes cruzados un análisis externo de la base podría reducir la incertidumbre, y el orden físico de las filas en PostgreSQL no está protegido (el seed las inserta mezcladas).
- Los permisos se validan en el servidor; las pantallas solo ocultan rutas por comodidad.
- La migración inicial (`server/prisma/migrations`) se escribió a mano porque el entorno donde se desarrolló no podía descargar el motor de migraciones de Prisma. Se aplicó con `psql` contra PostgreSQL 16 y las pruebas pasan sobre ella, pero si `npm run db:migrate` detecta diferencias con `schema.prisma`, acepta la migración de ajuste que proponga.
- El mapa de calor usa cinco rangos de color propios (80, 65, 50 y 35 %) que el prompt no definía; siempre se escribe la cifra.
- El selector de fecha del navegador usa el formato de tu sistema.

## No implementado

- Envío real de correos o notificaciones push.
- Integración con nómina o sistemas de RH reales.
- Modelos predictivos de aprendizaje automático.
- Multiempresa.
- Exportación a PDF ni CSV.
- Recuperación de contraseña, alta y baja de usuarios desde la interfaz.
