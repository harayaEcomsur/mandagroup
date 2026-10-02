# Starter kit — webs con IA para pymes chilenas

Sitio Next.js config-driven: todo el contenido de un cliente vive en un único
archivo `config/client.config.ts`, validado con zod. El mismo código sirve para
cualquier cliente cambiando solo ese archivo (y las imágenes en `public/clients/<slug>/`).

## Comandos

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run start
npm run lint
npm run typecheck
npm run new-client -- --name "Panadería Rosita" [--preset restaurante|barberia|profesional]
npm run palette -- ruta/al/logo.svg   # extrae la paleta del logo del cliente (svg/png/jpg)
```

### Layouts por rubro

`branding.layout` cambia la estructura de la home para que dos clientes de rubros
distintos no se vean como el mismo sitio con otra paleta:

- `clasico` (default) — cards centradas, el layout original. Sirve para cualquier rubro.
- `inmobiliaria` — hero full-screen con la propiedad como protagonista, servicios como
  lista aireada sin cards y galería tipo "Propiedades destacadas" (inspirado en
  corretajes premium como Property Partners y Engel & Völkers).
- `corporativo` — banda oscura sobria, áreas de práctica numeradas (01, 02…) y
  tipografía en mayúsculas con tracking (inspirado en grandes estudios jurídicos).
- `salud` — hero editorial con la foto real del espacio enmarcada (en vez de fondo
  oscurecido con texto encima) y especialidades en tarjetas con ícono en círculo
  (pensado para clínicas y boutiques de salud — dental, estética, kinesiología).
- `belleza` — "exaggerated minimalism": tipografía oversized (hasta text-8xl),
  altísimo contraste, un solo acento de color, servicios en lista editorial con
  filetes finos en vez de tarjetas (pensado para salones de belleza, spa, estudios
  de uñas — estilo verificado con `ui-ux-pro-max`, ver "Diseño distintivo por
  cliente" más abajo).

Si un rubro nuevo no calza bien con ninguno de estos cinco, la respuesta correcta
**no es forzarlo a `clasico`** — es crear un layout nuevo (un componente `Hero*`/
`Services*` en `components/layouts/<nombre>/`, wireado en `HomeContent.tsx` y el enum
de `config/schema.ts`, mismo patrón que los cinco existentes). Dos clientes de rubros
distintos con el mismo layout genérico es exactamente lo que este mecanismo existe
para evitar — ver "Diseño distintivo por cliente" más abajo.

Además `branding.logoIncludesName: true` oculta el nombre en texto del header cuando el
archivo del logo ya lo trae escrito — el logo va grande (es la marca del cliente).

### Asistente en WhatsApp (módulo "Asistente IA en tu WhatsApp")

El webhook `app/api/whatsapp/route.ts` conecta el MISMO asistente del sitio (mismo
system prompt config-driven, mismo inventario) al WhatsApp del negocio vía la
Cloud API de Meta. Con Coexistence el cliente sigue usando su app normal.

Setup por cliente (~1 hora + verificación de Meta Business):
1. Cliente necesita: número WhatsApp Business + Meta Business verificado.
2. En developers.facebook.com: app de HarayaDev → agregar producto WhatsApp →
   registrar el número del cliente (flujo Coexistence para conservar la app).
3. Crear System User token permanente con permisos whatsapp_business_messaging.
4. En Vercel (proyecto del cliente): WHATSAPP_VERIFY_TOKEN (inventado),
   WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID. **En producción, además
   WHATSAPP_APP_SECRET** (el App Secret de la app de Meta): valida la firma
   `X-Hub-Signature-256` y descarta payloads que no vengan de Meta. Sin él el
   webhook queda abierto y cualquiera con la URL puede gastar tu cuota.
5. En el panel de Meta, registrar el webhook: https://<sitio>/api/whatsapp con el
   verify token, y suscribir el campo "messages".
6. Probar: escribir al número → responde el asistente. Conversaciones de servicio:
   1.000/mes gratis de Meta.

### Asistente en Instagram (módulo "Asistente IA en Instagram Direct")

El webhook `app/api/instagram/route.ts` conecta el MISMO asistente (mismo system
prompt, mismas tools de agenda/tienda/leads, mismo `lib/chat-log.ts`) a los DM de
Instagram del negocio, vía Instagram Messaging API de Meta — mismo patrón que el
webhook de WhatsApp, pero el payload de Meta viene en otra forma
(`entry[].messaging[]`, no `entry[].changes[].value.messages[]`), así que es un
webhook aparte, no una rama del mismo. Cada canal guarda su propio historial corto
por conversación (`lib/ig-history.ts`, tabla `ig_threads` — igual que `wa_threads`
para WhatsApp) para poder completar un agendamiento en varios mensajes.

Setup por cliente (requiere que la cuenta de Instagram sea **profesional** y esté
**vinculada a una Página de Facebook** — sin eso Meta no expone el producto):
1. Cliente necesita: cuenta de Instagram profesional (Business o Creator) vinculada
   a una Página de Facebook.
2. En developers.facebook.com: la misma app de HarayaDev (puede ser la misma que
   WhatsApp) → agregar producto "Messenger" → en su configuración, generar un
   **Page Access Token** con permiso `instagram_manage_messages` para esa Página.
3. En Vercel (proyecto del cliente): `INSTAGRAM_VERIFY_TOKEN` (inventado),
   `INSTAGRAM_TOKEN` (el Page Access Token). **En producción, además
   `INSTAGRAM_APP_SECRET`** (mismo mecanismo que `WHATSAPP_APP_SECRET`) — sin él
   el webhook queda abierto.
4. En el panel de Meta, registrar el webhook: `https://<sitio>/api/instagram` con
   el verify token, y suscribir el campo `messages` del objeto Página (no del
   objeto WhatsApp Business Account).
5. Probar: escribir un DM a la cuenta de Instagram → responde el asistente.
   Ojo con la ventana de 24h de Meta: fuera de ella, solo se puede reabrir la
   conversación con plantillas aprobadas (no aplica al primer contacto del cliente).

### Asistente embebible multi-tenant (add-on sobre el sitio que el cliente YA tiene)

Un asistente que se instala en CUALQUIER sitio (WordPress, Wix, HTML, VTEX) con una
sola línea de `<script>`, servido desde el deploy central de HarayaDev. Es un camino
aparte del sitio single-tenant: el mismo despliegue atiende a varios negocios,
resueltos por `tenantId`, con su propio esquema Postgres (`embed_bookings`,
`embed_orders`) — no toca el código ni las demos single-tenant.

Qué hace, todo con verdad de servidor y aislado por tenant:
- **Conversa** con el conocimiento del negocio y deriva a WhatsApp.
- **Captura contacto/lead** y avisa al dueño (email + WhatsApp).
- **Agenda**: consulta disponibilidad real y reserva (nunca inventa horarios).
- **Tienda**: arma el pedido, resuelve precios en el servidor y entrega link de pago
  **Webpay con las credenciales del PROPIO cliente** (la plata va a su Transbank).
- **Panel del dueño** en `/embed/panel?t=<id>&clave=…`: ve y gestiona sus reservas y
  pedidos (confirmar/cancelar, marcar entregado).

Alta de un cliente nuevo (genera config + clave + env vars + snippet + link del panel):

```bash
npm run embed-tenant -- --id nails-color --name "Nails Color" \
  --rubro "salón de uñas" --whatsapp 56912345678 --email duena@correo.cl \
  --agenda --store --write
```

Luego: completar los `COMPLETAR` del bloque, `npm run typecheck`, commitear, y setear en
Vercel las variables que imprime — `EMBED_ADMIN_KEY_<ID>` (protege el panel) y, si el
cliente cobra de verdad, `TBK_ENV_<ID>` / `TBK_COMMERCE_CODE_<ID>` / `TBK_API_KEY_<ID>`
(sin ellas usa el ambiente de integración de Transbank, sin cobro real). Los secretos
viven SOLO en el entorno, nunca en el config. Modelo: usa `gemini-2.5-flash` para tenants
con agenda/tienda (el `-lite` es muy débil para las tools de escritura).

### Paleta desde el logo y variantes de diseño

- `npm run palette -- logo.png` extrae los colores dominantes del logo del cliente e
  imprime el bloque `palette` listo para pegar en `config/client.config.ts`, validando
  contraste WCAG AA (oscurece automáticamente lo que no cumple y avisa). También sugiere
  un bloque `themeVariants` con 2 alternativas (acento protagonista y modo oscuro).
- `themeVariants` en el config habilita **`/variantes`**: una página interna (noindex,
  fuera del sitemap) que muestra la misma home con cada paleta lado a lado, para que el
  cliente elija "A, B o C" — útil como parte del gancho de venta de la demo. Cada
  variante se puede abrir a pantalla completa en `/variantes/<id>`.

### Diseño distintivo por cliente (plugin `ui-ux-pro-max`)

Regla de fondo: **ninguna demo debería quedar en `clasico` + paleta genérica solo
porque el prospecto no mandó marca todavía.** Dos palancas, cada una para un
problema distinto — no son intercambiables:

- **Falta un asset real (logo, banner, ícono) → `ui-ux-pro-max`.** Es un plugin de
  Claude Code (`nextlevelbuilder/ui-ux-pro-max-skill`, sub-skills `design`/
  `ui-styling`/`brand`) orientado a *generar* assets con IA (Gemini "Nano Banana"),
  no a diseñar el layout del sitio (este starter-kit no usa shadcn/ui, que es lo que
  esas sub-skills asumen). Su uso concreto acá:
  - `npm run demo -- --generate-logo ...` (en vez de `--logo <url>`): genera un logo
    placeholder con IA cuando el prospecto no tiene uno, y lo pasa por el MISMO
    pipeline de paleta WCAG que un logo real (`applyLogoAndPalette` — ver arriba).
    Requiere el plugin instalado (`/plugin marketplace add
    nextlevelbuilder/ui-ux-pro-max-skill` + `/plugin install
    ui-ux-pro-max@ui-ux-pro-max-skill`) y `GEMINI_API_KEY` en el entorno — si falta
    cualquiera de los dos, la fábrica avisa y sigue sin logo (nunca bloquea la demo).
    Revisar el logo generado antes de enviar — es un placeholder de partida, no el
    logo final del cliente.
  - Para banners/íconos sueltos (redes sociales, favicons a medida), invocar el
    plugin directamente (`Skill({skill: "ui-ux-pro-max:design"})` desde una sesión
    de Claude Code) en vez de escribir HTML/CSS a mano para eso.
- **El layout/paleta/copy se sienten genéricos aunque haya marca real → el proceso
  de diseño, no el plugin.** Esto fue lo que pasó con la demo de Boutique Dental
  Montemar: tenía logo y colores reales, pero el layout `clasico` (compartido con
  cualquier rubro) no la distinguía de otro cliente cualquiera. La corrección fue
  la skill `frontend-design` (bundled, no el plugin) — su proceso de dos pasadas
  (token system de color/tipografía/layout → autocrítica contra los tres clusters
  de "diseño genérico de IA" → recién ahí construir) — aplicada sobre contenido
  REAL del negocio (fotos, horarios, servicios extraídos del sitio real del
  prospecto, nunca inventados), resultando en el layout `salud` nuevo. Antes de dar
  por buena una demo cuyo rubro ya tiene un layout dedicado (`inmobiliaria`,
  `corporativo`, `salud`, `belleza`), usarlo — y si el rubro no tiene uno, ese es el momento de
  crear uno nuevo (ver "Layouts por rubro" arriba), no de conformarse con `clasico`.
- **Un rubro nuevo necesita dirección de paleta/tipografía, no un layout nuevo →
  `ui-ux-pro-max --design-system`.** El comando raíz del plugin (no las sub-skills
  de arriba) trae una base curada de paletas/tipografías/patrones de UX por tipo de
  producto — sirve para no adivinar un token system a ojo. Ejemplo real: para
  "belleza" (peluquerías, spas, uñas) se corrió
  `python .../scripts/search.py "beauty salon hair services elegant" --design-system`,
  que devolvió Playfair Display + Inter y una paleta rosa/lavanda — de ahí salen el
  fontPairing `lujo` (`lib/fonts.ts`) y el preset `config/presets/belleza.config.ts`
  (separado de `barberia`, que es masculino a propósito: "Corte clásico", "Afeitado
  tradicional" no le calzan a un salón de belleza o spa). Antes de inventar una
  paleta/tipografía para un rubro sin preset, correr esto primero.

### Fábrica de demos (`npm run demo`)

Una demo de prospección (D0) en un solo comando, sin preguntas:

```bash
npm run demo -- --name "Corredora García" --rubro "corretaje de propiedades" \
  --logo https://sitio-del-prospecto.cl/logo.png --whatsapp 56912345678 --deploy
```

- Preset y layout sugeridos por rubro; logo local o **URL (se descarga solo)**;
  paleta WCAG + variantes A/B/C; **nombre real del negocio aplicado a TODO el
  copy del preset** (hero, nosotros, chat, mensajes de WhatsApp) + contacto + SEO.
- Crea el branch `demo/<slug>` con config + BRIEF y **vuelve al branch original**,
  lista para encadenar la siguiente demo (batching).
- `--deploy`: publica en Vercel como `demo-<slug>` con `SITE_NOINDEX=1` automático.
- Flags: `--name` (obligatorio), `--rubro`, `--logo`, `--generate-logo` (alternativa
  a `--logo` cuando el prospecto no tiene uno — ver "Diseño distintivo por cliente"
  arriba), `--whatsapp`, `--phone`, `--email`, `--address`, `--preset`, `--layout`,
  `--style`, `--deploy`, `--no-branch`.
- Objetivo de la fábrica: que el costo humano por D0 sea juntar los datos del
  prospecto (~5–10 min), no armar el sitio. Antes de enviar: mirar la home 30
  segundos y tocar 1 dato distintivo del prospecto (2 min máx., lo dice el BRIEF).
- El wizard `npm run new-client` sigue siendo el camino para clientes que
  compraron (preguntas de contexto, inspiración de competencia, branch `client/`);
  ambos comparten la misma lógica en `scripts/wizard-core.ts`.

### Abono de la agenda con Webpay (`booking.depositAmount`)

- Si el config define `booking.depositAmount` (CLP entero), al terminar una
  reserva aparece el botón "Pagar abono con Webpay"; el pago aprobado **confirma
  la reserva automáticamente** (sin pasar por el panel). Anulado/rechazado: la
  reserva sigue pendiente y el flujo actual por transferencia no cambia.
- Es el diferenciador directo contra los SaaS de agenda por suscripción: reserva
  con abono pagado, a pago único. Usa la misma integración `lib/webpay.ts` y las
  mismas variables `TBK_*` del módulo tienda (sin ellas: ambiente de integración).

### Tienda online con Webpay (módulo `tienda`)

- `/tienda` — catálogo desde `store.products` del config, carrito persistido en
  localStorage; `/tienda/carrito` — checkout con datos del comprador y pago
  **Webpay Plus** (API REST de Transbank, sin SDK: `lib/webpay.ts`); retorno en
  `/api/checkout/retorno` (aprobado / rechazado / anulado / timeout) y
  confirmación en `/tienda/pedido/<id>`; panel de pedidos en `/tienda/admin`.
- Sin variables de entorno corre contra el **ambiente de integración** de
  Transbank (credenciales públicas de prueba): el flujo completo funciona y no
  se cobra dinero real — perfecto para demos. Tarjeta de prueba: VISA
  4051 8856 0044 6623, CVV 123, cualquier fecha (RUT 11.111.111-1, clave 123).
- Los precios siempre se resuelven en el servidor desde el config; el cliente
  solo envía slugs y cantidades.
- Los pedidos se guardan en Postgres si hay `DATABASE_URL` (ver Persistencia);
  además la página de confirmación lee el resultado desde la URL de retorno, así
  que muestra el pago correcto aunque el servidor que responde sea otro.

### Feed de Instagram (automático si `contact.socials` trae un link)

- Apenas el config trae un link `{ platform: "instagram", url: "..." }` en
  `contact.socials`, la home muestra una sección "Síguenos en Instagram" —
  no requiere ningún módulo activado a mano.
- Sin configurar nada más, se ve un botón "Ver perfil en Instagram": cero
  setup, funciona con solo el link.
- Con `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` (cuenta Business/Creator
  conectada vía **Instagram Graph API**, en Meta for Developers), el botón se
  acompaña de una grilla con las últimas 6 fotos reales (`lib/instagram.ts`),
  cacheada 1h. Mismo patrón que el aviso por WhatsApp: gratis por defecto,
  con upgrade opcional a la API real cuando el cliente la conecta.

Variables de entorno (`.env.local`, ver `.env.example`):

- `GEMINI_API_KEY` — requerido para el chat IA (modelo `gemini-2.5-flash-lite`, tier gratuito en Google AI Studio).
- `RESEND_API_KEY` — opcional, requerido solo si el módulo `contactForm` debe enviar emails reales.
- `NEXT_PUBLIC_SITE_URL` — usado en metadata, sitemap.xml y robots.txt.
- `TBK_ENV=produccion` + `TBK_COMMERCE_CODE` + `TBK_API_KEY` — solo para cobrar de
  verdad con Webpay (requiere código de comercio validado por Transbank); sin
  ellas el módulo tienda usa el ambiente de integración.
- `CRON_SECRET` — protege el resumen diario (`/api/resumen`); lo manda Vercel Cron.
- `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_USER_ID` — opcional, solo para la grilla
  real del feed de Instagram; sin ellas la sección igual aparece como botón de
  seguir (si el config trae el link).
- `DATABASE_URL` — Postgres (Neon). Opcional en demos, **obligatoria en clientes
  reales**: ver abajo.

### Cómo nos encuentra alguien que ve un sitio de cliente

Tres capas, pensadas para que el crédito nunca contradiga el argumento de venta
("el sitio es tuyo"). Ojo con la diferencia: *"Powered by"* dice que el sitio
CORRE en una plataforma ajena — eso es lo que hacen Wix o Wasi y es justo lo que
criticamos. *"Sitio por"* dice autoría, como la firma de un arquitecto: no
implica que el sitio dependa de nosotros para funcionar.

| Quién mira | Dónde lo ve | Estado |
|---|---|---|
| Un dueño de pyme curioso | "Sitio por HarayaDev" en el pie | `branding.credit: true` — **apagado por defecto**, se enciende cuando el cliente lo aprueba |
| Cualquiera que use el chat | Le pregunta al asistente "¿quién hizo este sitio?" y responde con haraya.dev y el WhatsApp | Siempre |
| Un desarrollador | `<meta name="generator">` en el HTML | Siempre |

En las demos (`SITE_NOINDEX` activo) el crédito del pie se muestra siempre: son
nuestras. Cómo pedírselo al cliente: es una decisión suya y conviene ofrecer algo
a cambio (por ejemplo, descuento en la mantención). A muchos les acomoda, porque
un sitio firmado demuestra que hay una empresa real detrás y no alguien que
desaparece.

### Persistencia: demos en memoria, clientes en Postgres

El template funciona con o sin base de datos y elige solo según `DATABASE_URL`:

| | Sin `DATABASE_URL` | Con `DATABASE_URL` |
|---|---|---|
| Dónde viven reservas, pedidos, leads y conversaciones | Memoria del servidor | Postgres |
| Datos de ejemplo en el panel | Sí (la demo nunca se ve vacía) | No (jamás datos falsos en un negocio real) |
| Sobreviven a un reinicio | No | Sí |
| Los ve cualquier servidor | No | Sí |
| Para qué sirve | Demos D0 (cero configuración) | Cliente pagando |

**Por qué importa**: en Vercel cada request puede caer en un servidor distinto.
Sin base de datos, una reserva tomada por el asistente puede no aparecer en el
panel del dueño, el asistente de WhatsApp olvida la conversación a mitad de
camino, y el resumen diario no ve nada. Para una demo eso da lo mismo; para un
cliente real es inaceptable.

Sirve cualquier Postgres — **Neon y Supabase funcionan sin tocar código**, solo
cambia el connection string. Conectar (5 minutos, ambos tienen capa gratuita):

1. Crear el proyecto en [neon.tech](https://neon.tech) o
   [supabase.com](https://supabase.com), en la región más cercana al despliegue.
2. Copiar el connection string **pooled**: en Neon el que incluye `-pooler`; en
   Supabase el del puerto `6543` (Transaction pooler). El cliente detecta ambos
   y desactiva los prepared statements, que PgBouncer no soporta.
3. `vercel env add DATABASE_URL` en el proyecto del cliente y volver a desplegar.

Cuál conviene: **Supabase** si vas a necesitar además guardar imágenes (su
Storage sirve para que el dueño actualice fotos por WhatsApp) o login real para
el panel; ojo con que su capa gratuita **pausa los proyectos inactivos**, lo que
para un sitio con poco tráfico significa caídas. **Neon** si quieres solo la base
con ramas por cliente y que despierte sola tras la inactividad.

Las tablas se crean solas en el primer request: no hay paso de migración. Para
verificar la base antes de entregar el sitio:
`DATABASE_URL=... npx tsx scripts/test-db.ts` (12 comprobaciones, incluida que
dos personas no puedan tomar la misma hora).

### El asistente actúa, no solo responde (tools)

El asistente del sitio (y el de WhatsApp: mismo cerebro) no deriva a una página
— resuelve dentro de la conversación. Las herramientas se activan solas según
los módulos encendidos en el config:

| Módulo | Herramientas | Qué hace el asistente |
|---|---|---|
| `agenda` | `consultar_disponibilidad`, `crear_reserva` | Ofrece horarios reales y toma la hora; si hay `depositAmount`, indica el abono |
| `propiedades` | `registrar_lead` | Conversa, califica (operación, comuna, presupuesto, plazo) y avisa al dueño con link para escribirle al interesado |
| `tienda` | `crear_pedido` | Arma el pedido y entrega el link de pago Webpay |

Reglas del diseño (importantes al modificarlas):

- **La fuente de verdad es el servidor, nunca el modelo**: la disponibilidad la
  responde el motor de la agenda y los precios salen del catálogo del config.
  Si el modelo pide un horario tomado o un producto inexistente, la herramienta
  lo rechaza y le sugiere alternativas válidas.
- Las reservas creadas conversando pasan por el mismo camino que las del
  formulario (`lib/booking-actions.ts`), así que los avisos al dueño son iguales.
- Prueba las herramientas sin gastar cuota del modelo con
  `npx tsx scripts/test-tools.ts` (las ejecuta directamente contra el config activo).

### Resumen diario al dueño (`/api/resumen`)

Una vez al día, un cron le manda al dueño por WhatsApp y email un resumen de lo
que hizo el asistente: cuántas conversaciones atendió, los temas repetidos,
quiénes dejaron sus datos y las reservas nuevas. Sin paneles: el dueño se entera
en el mismo lugar donde ya trabaja.

- Lo dispara `vercel.json` (23:00 UTC). En una demo se puede llamar a mano con
  `/api/resumen?clave=<AGENDA_ADMIN_KEY>`.
- Sin actividad en las últimas 24 h no llama al modelo ni envía nada.
- Los destinos son los mismos de la agenda (`booking.ownerNotifyEmail` /
  `ownerNotifyWhatsapp`, o `BOOKINGS_NOTIFY_EMAIL`); el envío por Cloud API
  requiere `NOTIFY_WA_TOKEN` + `NOTIFY_WA_PHONE_ID`.

## Flujo de trabajo por cliente

**Premisa: ninguna demo genérica.** Cada cliente recibe un toque de personalización:
layout según su rubro, paleta desde su logo, y referencias de su competencia registradas
para rescatar 1-2 detalles distintivos al armar la demo.

1. `npm run new-client` — wizard interactivo que pregunta nombre, rubro, logo,
   sitios de inspiración/competencia y estilo; sugiere layout y preset según el rubro,
   extrae la paleta del logo (con variantes A/B/C para `/variantes`), y deja todo
   registrado en un `BRIEF.md` dentro del branch `client/<slug>` que crea.
   (Modo no interactivo: `npm run new-client -- --name "..." --preset <p> --logo <ruta>`.)
2. Completa los datos reales del cliente en `config/client.config.ts` (identidad,
   servicios, horarios, preguntas frecuentes del chat, etc.) y sube sus imágenes a
   `public/clients/<slug>/`.
3. Sube el branch (`git push -u origin client/<slug>`) y crea un proyecto en Vercel
   apuntando a ese branch, con **Root Directory = `starter-kit`** (este repo es un
   monorepo: la raíz aloja el sitio que vende estos servicios, ver README de la raíz).
4. Configura las variables de entorno del proyecto en Vercel y comparte el link de
   preview con el cliente para validar.
5. Ajusta lo que pida el cliente sobre el mismo branch/config.
6. Conecta su dominio propio en Vercel y promueve el deploy a producción.

## Arquitectura

- **Config-driven**: `config/schema.ts` define el schema zod (`ClientConfig`) que
  valida y tipa todo el contenido. `config/client.config.ts` es la config activa;
  `config/presets/*.config.ts` son configs completas de ejemplo (y punto de partida
  para clientes nuevos vía `new-client`).
- **Theming sin recompilar Tailwind**: `app/layout.tsx` inyecta la paleta del
  cliente como variables CSS (`lib/theme.ts`) directamente en el `<html>`, y
  `tailwind.config.ts` referencia esas variables (`bg-primary`, `text-accent`, etc.).
  Cambiar de cliente es solo cambiar el archivo de config, no el build.
- **Tipografías**: 4 pares precargados con `next/font/google` en `lib/fonts.ts`
  (`modern`, `elegante`, `amigable`, `lujo` — Playfair Display + Inter, para
  belleza/spa/lujo), elegidos por `branding.fontPairing` en el config.
- **Íconos**: `components/ui/IconResolver.tsx` resuelve cualquier ícono de
  `lucide-react` por nombre en runtime — no hay una lista fija, así que sirve para
  cualquier rubro.
- **Secciones** (`components/sections/*`) se renderizan u ocultan según
  `client.config.ts#modules` (flags) y si el cliente llenó el contenido correspondiente.
- **Chat IA** (`app/api/chat/route.ts`): streaming con Vercel AI SDK + Google Gemini
  (`gemini-2.5-flash-lite` por defecto, configurable en `client.config.ts#chat.model`). El
  system prompt se arma dinámicamente desde
  `client.config.ts#chat` (descripción del negocio + hasta 40 pares P/R), con
  instrucción de derivar a WhatsApp si no sabe la respuesta. Rate limiting básico
  por IP en `lib/rate-limit.ts` (en memoria, best-effort por isolate — suficiente
  para tráfico de una pyme; si un cliente crece mucho, reemplazar por Upstash sin
  tocar el resto del código).
- **Formulario de contacto** (`app/api/contact/route.ts`): envía el mensaje por la
  API de Resend al `contact.email` del cliente. Si falta `RESEND_API_KEY` o el
  cliente no configuró email, responde 501 explícito (no simula un envío exitoso).
- **SEO**: `lib/seo.ts` genera `Metadata` (Open Graph, Twitter card) y el JSON-LD
  `LocalBusiness` (o subtipo, vía `seo.businessType`) desde el config. `sitemap.ts`
  y `robots.ts` usan `NEXT_PUBLIC_SITE_URL`.

## Presets incluidos

- `restaurante` — food truck ficticio en Providencia.
- `barberia` — barbería ficticia en Ñuñoa (tono masculino a propósito).
- `belleza` — salón de belleza/spa ficticio en Providencia (paleta rosa/lavanda,
  fontPairing `lujo` — ver "Diseño distintivo por cliente"). Separado de `barberia`
  para que un salón de belleza, spa o estudio de uñas no herede copy de barbería.
- `profesional` — estudio jurídico/contable ficticio en Las Condes.
- `_template` — plantilla en blanco (placeholders `TODO`), usada por defecto en `new-client`.

Los rubros reales de tus clientes no están limitados a estos — `meta.rubro` es
texto libre. Los presets son solo puntos de partida para demos rápidas según a qué
se parezca más el prospecto.
