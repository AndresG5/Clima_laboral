# Clima Laboral: Sistema de Retroalimentación 360

Plataforma web para aplicar encuestas anónimas de clima laboral y evaluaciones 360 por área, ver los resultados en un dashboard y recibir alertas de riesgo de rotación de personal.

Proyecto escolar de Administración (tema: **Liderazgo**).

> **Aviso:** la empresa del proyecto es ficticia (*Componentes Industriales del Norte, S.A. de C.V.*, unos 200 empleados en 5 áreas) y **todos los datos son simulados**. La interfaz lo indica con un aviso permanente.

<!-- Agrega aquí una captura del panel: ![Panel de clima laboral](docs/panel.png) -->

## Contenido

- [Qué hace](#qué-hace)
- [Tecnologías](#tecnologías)
- [Instalación en Windows](#instalación-en-windows-powershell)
- [Cuentas de prueba](#cuentas-de-prueba)
- [Datos simulados](#datos-simulados-npm-run-dbseed)
- [Modelo de riesgo de rotación](#modelo-de-riesgo-de-rotación)
- [Anonimato](#anonimato)
- [Alcance y limitaciones](#alcance-y-limitaciones)
- [No implementado](#no-implementado)
- [Equipo](#equipo)

## Qué hace

- **Encuestas de clima laboral anónimas** por área, con invitaciones de un solo uso.
- **Evaluación 360** de líderes: autoevaluación, equipo y pares.
- **Dashboard** con mapa de calor de % favorable por área y dimensión, tendencia contra la encuesta anterior y participación.
- **Alertas de riesgo de rotación** por área, con los factores que más aportan al puntaje.
- **Configuración** de pesos y umbrales del modelo de riesgo desde la interfaz.
- **Roles** con permisos validados en el servidor: RH, Líder y Colaborador.

## Tecnologías

| Capa | Herramientas |
|---|---|
| Cliente | React, Vite, TypeScript, Tailwind |
| Servidor | Node, Express, TypeScript, Prisma 7 |
| Base de datos | PostgreSQL 16 |
| Pruebas | Vitest |

## Instalación en Windows (PowerShell)

**Requisitos:** Node 20 o superior y PostgreSQL 16 (con Docker Desktop o instalado directamente).

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

# 5. Cliente y API en modo desarrollo
npm run dev
```

Al terminar:

- Cliente: http://localhost:5173
- API: http://localhost:3001

Si usas PostgreSQL instalado en lugar de Docker, edita `DATABASE_URL` en `server\.env`.

**Pruebas:** `npm test`. Necesitan la base migrada y con el seed cargado, y restauran lo que modifican.

### Problemas comunes

- **No conecta a la base de datos:** revisa que Docker Desktop esté abierto y que `DATABASE_URL` en `server\.env` coincida con tu instalación.
- **Puerto ocupado:** cierra el proceso que use el 5173 o el 3001, o cambia el puerto correspondiente.
- **`db:migrate` propone una migración de ajuste:** acéptala (ver [limitaciones](#alcance-y-limitaciones)).

## Cuentas de prueba

Las cuentas se crean con el seed. **La contraseña de demostración no se documenta en el repositorio**: pídesela a alguien del equipo.

| Rol | Correo |
|---|---|
| RH | `rh@clima.demo`, `rh2@clima.demo` |
| Líder | `lider.produccion@clima.demo`, `lider.calidad@clima.demo`, `lider.almacen@clima.demo`, `lider.mantenimiento@clima.demo`, `lider.administrativo@clima.demo` |
| Colaborador | `colaborador01@clima.demo` en adelante |

Todas las encuestas del seed están cerradas. Para probar el formulario de respuesta:

1. Entra como RH y crea una encuesta (hay un botón para cargar preguntas de ejemplo).
2. Actívala y genera las invitaciones.
3. Entra como colaborador y contesta.

## Datos simulados (`npm run db:seed`)

El seed es reproducible. Crea tres encuestas de clima cerradas (T1, T2 y T3 de 2026) y una evaluación 360.

Riesgo de la encuesta más reciente:

| Área | Nivel | Nota |
|---|---|---|
| Producción | Crítico | Liderazgo y permanencia en caída. El turno nocturno no es un campo del modelo: se representa con valores bajos en el área. |
| Almacén | Alto | Tendencia negativa marcada. |
| Mantenimiento | Bajo | |
| Calidad | Bajo | Variación normal. |
| Administrativo | Bajo | Variación normal. |

Solo Producción y Almacén generan alerta. Una prueba comprueba que este resultado se sostiene con 40 semillas aleatorias distintas.

## Modelo de riesgo de rotación

Es un índice ponderado y explicable de 0 a 100, **no** aprendizaje automático.

```
riesgo = 0.30*desfavorable(PERMANENCIA) + 0.20*desfavorable(LIDERAZGO) + 0.15*desfavorable(COMUNICACION)
       + 0.10*desfavorable(RECONOCIMIENTO) + 0.10*desfavorable(CARGA_TRABAJO)
       + 0.10*tendencia + 0.05*rotacionHistorica
```

| Componente | Peso | Definición |
|---|---|---|
| Permanencia | 30 % | % desfavorable de la dimensión |
| Liderazgo | 20 % | % desfavorable de la dimensión |
| Comunicación | 15 % | % desfavorable de la dimensión |
| Reconocimiento | 10 % | % desfavorable de la dimensión |
| Carga de trabajo | 10 % | % desfavorable de la dimensión |
| Tendencia | 10 % | Caída del % favorable global contra la encuesta anterior, por 5, entre 0 y 100 (vale 0 sin encuesta anterior) |
| Rotación histórica | 5 % | Rotación anualizada de los últimos 6 meses / 60 * 100, con tope de 100 |

**Favorable** = respuestas 4 o 5.

| Índice | Nivel | ¿Crea alerta? |
|---|---|---|
| Menos de 40 | Bajo | No |
| 40 a 59 | En observación | No |
| 60 a 74 | Alto | Sí |
| 75 o más | Crítico | Sí |

Cada alerta guarda en `drivers` los 3 componentes que más aportan al índice. Los pesos y umbrales se editan en `/configuracion` y deben sumar 100 %. Un área con menos de *k* respuestas no recibe índice.

> **Los pesos son supuestos de trabajo y no están calibrados con datos reales.**

## Anonimato

- `Response` no tiene columna ni llave hacia el usuario ni hacia la invitación. Su id es un UUID aleatorio, porque un id ordenado en el tiempo se podría cruzar con la hora de uso de la invitación.
- El envío es una sola transacción: marca la invitación como usada (solo con fecha) e inserta la respuesta. Solo se guarda la fecha de envío, sin hora.
- **Umbral *k*** por encuesta (por defecto 5) en cada corte: área, antigüedad y relación en 360. En lugar de la cifra se muestra "Muestra insuficiente para proteger el anonimato". Si solo un corte queda oculto, también se oculta el menor de los visibles, para que no pueda deducirse por resta.
- **Comentarios abiertos:** solo a nivel de área con *k* cumplido, sin fecha ni autor y en orden alfabético.
- **Evaluación 360:** `evaluatedUserId` identifica a quien se evalúa (un líder), nunca a quien responde. La autoevaluación es de la propia persona y no requiere umbral. Relación: Equipo = personas de su área; Pares = los otros líderes.

## Alcance y limitaciones

- Una sola organización, datos simulados y una contraseña única de demostración.
- El anonimato se apoya en el diseño de datos y en *k*. Con grupos pequeños y muchos cortes cruzados, un análisis externo de la base podría reducir la incertidumbre, y el orden físico de las filas en PostgreSQL no está protegido (el seed las inserta mezcladas).
- Los permisos se validan en el servidor; las pantallas solo ocultan rutas por comodidad.
- La migración inicial (`server/prisma/migrations`) se escribió a mano porque el entorno donde se desarrolló no podía descargar el motor de migraciones de Prisma. Se aplicó con `psql` contra PostgreSQL 16 y las pruebas pasan sobre ella. Si `npm run db:migrate` detecta diferencias con `schema.prisma`, acepta la migración de ajuste que proponga.
- El mapa de calor usa cinco rangos de color propios (80, 65, 50 y 35 %). Siempre se escribe la cifra, el color no es la única señal.
- El selector de fecha del navegador usa el formato de tu sistema.

## No implementado

- Envío real de correos o notificaciones push.
- Integración con nómina o sistemas de RH reales.
- Modelos predictivos de aprendizaje automático.
- Multiempresa.
- Exportación a PDF o CSV.
- Recuperación de contraseña y alta o baja de usuarios desde la interfaz.

## Equipo

<!-- Agrega aquí a los integrantes, materia, profesor y periodo -->
