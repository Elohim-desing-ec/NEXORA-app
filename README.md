# NEXORA — Intelligent Operations Suite

Software de gestión empresarial para **empresas y emprendimientos**: ventas, inventario, compras, gastos, equipo y finanzas en un solo sistema, en la nube, para una o varias sucursales en cualquier país.

Desarrollado por **Elohim** · Ecuador · **https://elohim-desing-ec.github.io/NEXORA-app/**

---

## 1. Qué hace

| Módulo | Para qué sirve |
|---|---|
| **Dashboard** | Ventas, ganancia, salud del negocio, quiebres de stock y alertas de un vistazo. |
| **Espacio de trabajo** | Tablero de tareas, notas, fichas del equipo, conexiones de la empresa (Slack, Discord, Notion, sala de Meet…) y herramientas de Google. |
| **Inventario** | Productos por sucursal, kardex con costo promedio ponderado, lotes, vencimientos, prendas por color y talla, códigos de barras y QR. Muestra el **% de quiebre** y de **sobrestock** de cada producto. |
| **Compras** | Proveedores y órdenes de compra (borrador → aprobada → recibida). Al recibir, la mercadería entra al stock. |
| **Ventas** | Registrar ventas con varios productos o servicios, descuentos, cobros pendientes y clientes. Se pueden anular o **eliminar**; el stock regresa y la venta queda en la Papelera. |
| **Gastos** | Arriendo, sueldos, servicios… por sucursal y categoría. |
| **Resumen** | Estado de resultados por mes y año, y cierres de periodo. |
| **Trazabilidad** | Quién hizo qué, cuándo y en qué sucursal. Incluye la **Papelera** para recuperar lo eliminado. |
| **Reportes** | Reportes inteligentes con acciones recomendadas, en PDF y Excel. |
| **Red global** | Sucursales sobre un globo 3D, con direcciones reales y tipos de cambio del día. |
| **Análisis económico** | Evaluación financiera (VPN, TIR, CAUE, reemplazo y depreciación) con escenarios. |
| **IA NEXORA** | Pronóstico de demanda, punto de reorden, compras sugeridas y anomalías. Se calcula **en el dispositivo**: no envía datos afuera. |
| **Asistente** (botón ✦) | Responde en lenguaje natural cómo usar el sistema y consulta datos (stock, más vendidos, vencimientos…). |

Además: funciona **sin internet** (se instala como app y sincroniza al volver la conexión), tiene **3 idiomas** (español, inglés y portugués), modo claro y oscuro, y 4 temas de color. El tema inicial es el **azul Zafiro**.

## 2. Cuentas, planes y equipo

- **Nadie entra sin plan.** Desde la portada se activa la **prueba gratis de 14 días** (sin tarjeta) o se paga un plan con **Payphone**.
- **Planes** (IVA incluido, sin renovación automática; el pago anual equivale a 10 meses):

  | Plan | Mensual | Anual |
  |---|---|---|
  | Emprende | $29 | $290 |
  | Emprende Plus | $59 | $590 |
  | Crece | $99 | $990 |

  Los precios viven en el servidor (`supabase/functions/payphone`) y en `src/lib/planes.ts`; si cambian, hay que cambiarlos en los dos lugares.
- **Ingreso:** con correo y contraseña, o con Google. Hay recuperación de contraseña por correo.
- **Titular:** quien compra es el **Gerente General** de su empresa. Solo él invita al equipo, asigna roles y maneja el plan (*Configuración → Cuenta y equipo*).
- **Herramientas de Google:** cada persona las abre con **su propio correo**, pero todo queda ligado al titular. Los correos le llegan con copia, las reuniones lo invitan y la sala de Meet de la empresa es la suya.

### Roles

Cada persona puede tener hasta **3 roles** y ve la suma de sus permisos.

- **Por área** (lo más simple para emprendimientos): *Mano derecha* (todo, menos el plan y el equipo), *Encargado de Inventario*, *de Compras*, *de Ventas*, *de Gastos*, *Supervisor de Resúmenes* y *Monitor general*. Los dos últimos solo consultan.
- **Cargos de empresa:** Gerente General, Gerente Financiero, Contador, Gerente de Sucursal, Vendedor, Cajero, Jefe de Bodega, Auditor y otros.

Los permisos de cada rol están en `PERMISOS` (`src/store/useApp.ts`).

## 3. Cómo está construido

| Capa | Tecnología |
|---|---|
| Interfaz | React 18 + TypeScript + Vite, Tailwind CSS, Framer Motion, Recharts, MapLibre |
| Estado y datos locales | Zustand, guardado en IndexedDB (funciona sin conexión) |
| Nube | Supabase: Auth, Postgres con **Row Level Security** por empresa y Edge Functions |
| Pagos | Payphone (Botón de Pagos por redirección) |
| Correo | Gmail de la empresa por SMTP (desde una Edge Function) |
| Publicación | GitHub Pages (rama `gh-pages`) |

**Cómo viajan los datos:** cada dispositivo trabaja sobre su copia local y la sincroniza con la tabla `datos` de Supabase (una fila por colección y empresa). Los cambios de otros equipos llegan en vivo. La base solo deja leer y escribir los datos de la empresa a la que pertenece cada persona.

## 4. Estructura del proyecto

```
NEXORA/
├─ index.html                 Página base de la app
├─ public/                    Archivos que se publican tal cual
│  ├─ terminos.html · privacidad.html · cookies.html · seguridad.html · legal.css   ← páginas legales
│  ├─ manifest.webmanifest · sw.js · iconos                                       ← app instalable y sin conexión
├─ src/
│  ├─ main.tsx · App.tsx      Arranque y rutas (#/login, #/comprar, #/pago, #/ficha…)
│  ├─ pages/                  Una pantalla por módulo (Dashboard, Productos, Compras, Ventas…)
│  │  ├─ negocio/             Pestañas de Resumen, Ventas, Gastos e Inventario
│  │  ├─ espacio/             Tablero, Notas, Equipo y herramientas de Google
│  │  ├─ econ/                Análisis económico
│  │  └─ config/              Cuenta, plan y equipo
│  ├─ components/             Piezas reutilizables (Layout y menú, ui, gráficos, mapas, asistente…)
│  ├─ lib/                    Lógica sin interfaz: inventario, finanzas, nube, cuenta y pagos, Google, exportar…
│  ├─ store/                  Estado global (useApp: operación · useEcon: análisis económico)
│  ├─ data/                   Catálogos: países y monedas, sectores, categorías
│  └─ tests/                  Pruebas automáticas (Vitest)
├─ supabase/
│  ├─ functions/payphone/     Prepara y confirma los pagos; activa el plan
│  ├─ functions/correo/       Bienvenida, comprobantes e invitaciones
│  └─ migrations/             Cambios de seguridad aplicados a la base
└─ scripts/
   ├─ publicar.sh             Pruebas → compilación → publicación
   └─ probar_correo.py        Prueba la contraseña de aplicación de Gmail
```

## 5. Trabajar en el proyecto

```bash
npm install          # una sola vez
npm run dev          # abre http://localhost:5173
npm test             # pruebas automáticas
npm run build        # compilación de producción
npm run publicar     # pruebas + compilación + publicación en GitHub Pages
```

`npm run publicar` **no publica si alguna prueba falla**. La web se actualiza en 1 o 2 minutos y la app avisa a quien la tenga abierta que hay una versión nueva.

## 6. Configuración de Supabase

Proyecto `nexora` (`loldipdbreouzvdciuic`), en la organización **Elohim-pro** (plan Pro, con copias de seguridad diarias).

**Pagos (Payphone)**
1. Payphone Business: crear la sucursal **NEXORA** y un usuario con rol *Desarrollador*.
2. Payphone Developer: crear una aplicación **WEB** con dominio `https://elohim-desing-ec.github.io` y URL de respuesta `https://elohim-desing-ec.github.io/NEXORA-app/`.
3. Supabase → *Edge Functions → Secrets*: `PAYPHONE_TOKEN`, `PAYPHONE_STORE_ID` y, opcionalmente, `IVA` (por defecto `0.15`).

**Correo (Gmail de la empresa)**
1. Activar la verificación en dos pasos y crear una **contraseña de aplicación**. Se puede probar con `python3 scripts/probar_correo.py`.
2. Supabase → *Authentication → Emails → SMTP*: `smtp.gmail.com`, puerto `465`, el Gmail y su contraseña de aplicación.
3. Supabase → *Edge Functions → Secrets*: `GMAIL_USER` y `GMAIL_APP_PASSWORD`.
4. Supabase → *Authentication → URL Configuration*: Site URL y Redirect URL = `https://elohim-desing-ec.github.io/NEXORA-app/`.

**Seguridad**
- Todas las tablas tienen Row Level Security. Solo el titular puede invitar, cambiar roles y quitar miembros.
- Las claves secretas viven solo en *Edge Functions → Secrets*, nunca en el código. La clave de `src/lib/cuenta.ts` es la **publicable**, hecha para ir en el navegador.
- Recomendado: *Authentication → Attack Protection → Prevent use of leaked passwords*.

## 7. Páginas legales

En `public/`, enlazadas desde la portada, el ingreso, al crear la cuenta y al pagar:

- **Términos y condiciones:** cancelación libre, garantía de 7 días, límite de responsabilidad y leyes de Ecuador.
- **Privacidad:** según la LOPDP de Ecuador.
- **Cookies:** solo almacenamiento necesario, sin rastreo.
- **Seguridad.**

Si cambia algo del servicio (proveedores, precios, garantía), actualice también estas páginas y su fecha.

---

© NEXORA · Hecho por Elohim
