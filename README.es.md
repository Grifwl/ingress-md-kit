# Ingress MD Kit

Idiomas: [English](README.md) · [Català](README.ca.md) · **Español**

Planifica un **Mission Day de Ingress** desde la idea hasta la solicitud: misiones candidatas y rutas, propuestas a las entidades colaboradoras, imágenes de las misiones con la capa del colaborador, y las exportaciones que necesitas para la solicitud a Niantic y para la Mission Authoring Tool.

Autoalojado en **Cloudflare** (Workers + D1 + R2 + Access). Todo cabe dentro del nivel gratuito. Clónalo, despliégalo en tu (sub)dominio y planifica tu ciudad.

> Herramienta comunitaria no oficial. Sin vínculo ni aval de Niantic Spatial.
> Las reglas de este documento provienen del **Ingress Mission Day Handbook 2026** (última edición: septiembre de 2025). Consulta siempre la guía vigente y https://ingress.com/news antes de presentar la solicitud: los plazos y las reglas cambian.

---

## Qué hace

Una sola instancia puede alojar **varios Mission Days** (p. ej. `/example-2027`, `/sample-town-2028`), cada uno con su equipo de organizadores. Otras comunidades pueden usar tu instancia o desplegar una propia.

### Direcciones

| Ruta | Qué es |
|---|---|
| `/` | Página de inicio: qué hace la herramienta, los Mission Days publicados y un contacto para pedir acceso |
| `/<md-slug>` | Página del Mission Day (vista para participantes, una vez publicada) |
| `/<md-slug>/proposta-<token>` | Propuesta para un colaborador candidato (no listada). La palabra sigue el idioma de la carta: `proposta`, `propuesta`, `proposal`; las tres funcionan |
| `/<md-slug>/sample` | La única imagen de logotipo o medalla enlazada en la solicitud de Niantic, generada desde Exportaciones. Solo muestra el logotipo de un colaborador con su permiso firmado |
| `/admin` | Área privada (Cloudflare Access) |

### Parte pública (sin inicio de sesión)
- **Página de inicio**: explica qué es un Mission Day y qué hace la herramienta, con las mismas palabras neutras para cualquier comunidad, y enlaza todos los Mission Days con la vista para participantes publicada: primero los próximos y después los anteriores. Termina con un contacto, que fijan los administradores de la instancia, para quien quiera usar la herramienta. Nunca aparecen los colaboradores.
- **Propuestas a las entidades colaboradoras**: una página para cada entidad colaboradora candidata (ayuntamiento, universidad, ente de turismo, museo…), accesible solo con un enlace imposible de adivinar. Contiene:
  - una carta de presentación: quiénes somos, qué es Ingress, qué es un Mission Day, por qué esta ciudad, por qué este colaborador;
  - la propuesta completa de misiones: cada misión con nombre, descripción, foto y ruta;
  - un **mosaico de 6 columnas** con las 18 o 24 imágenes de las misiones, con el logotipo del colaborador ya aplicado como ejemplo;
  - el mapa de todas las misiones y la ruta de cada una, con líneas rectas entre sus portales y nunca entre misiones (mapa interactivo + imagen estática + enlace al Google My Maps compartido);
  - la petición de permiso para usar el logotipo y las fotos del colaborador: un texto por defecto que hereda cada colaborador nuevo y que se puede adaptar a cada uno.
  - Una hoja de estilo de impresión para que la página se pueda guardar como PDF y adjuntar a un correo.
- **Vista para participantes** (cuando un propietario la publica, normalmente después de la aprobación): lo que los agentes necesitan para jugar, pensado para el móvil. Incluye las misiones seleccionadas en el orden recomendado, el mosaico, el mapa con cada ruta, el enlace a My Maps y, de cada misión, la descripción en el idioma del visitante, el portal de inicio y los portales con enlaces a Intel. Mientras no se publica, su dirección solo dice que el Mission Day aún no se ha publicado. Las imágenes llevan la capa predeterminada o la de un colaborador que elija un propietario entre los que han aceptado con el permiso firmado; si ese permiso decae, la capa predeterminada vuelve sola.

Todas las páginas públicas, salvo la de inicio, son `noindex`. Las de propuesta, además, no están listadas, porque muestran logotipos que todavía no tienes permiso para usar; la vista para participantes está pensada para compartirla donde quieras, como los canales de tus agentes.

### Parte privada (administración, detrás de Cloudflare Access)
- **Mission Days**: puedes crear varios; cada uno tiene su dirección, ciudad, año, fecha, formato (18 / 24, o 6 para Lite), equipo (los puntos de contacto de ENL y RES), capa por defecto (sin colaborador) y textos compartidos de la carta.
- **Configuración de la instancia**: el contacto que aparece en la página de inicio (un texto como `@codename` y el enlace al que lleva, `https:` o `mailto:`), editable por los administradores de la instancia.
- **Textos por defecto de la carta**: textos de toda la instancia (quiénes somos, qué es Ingress…) que cada Mission Day nuevo copia al crearse y después puede adaptar.
- **Organizadores**: cada Mission Day tiene su equipo, que se gestiona en la pestaña Organizadores. Los propietarios añaden personas por el correo con el que entrarán, cambian su rol y las quitan; los editores pueden cambiar todo lo demás, pero no gestionar el equipo ni borrar nada. Un Mission Day siempre conserva al menos un propietario, y cualquiera puede salir de un equipo. Cada organizador solo ve los Mission Days de los que forma parte, salvo que los administradores de la instancia pueden gestionar el equipo de cualquiera. Cada organizador tiene un perfil (nombre de agente y facción) que se muestra en la lista del equipo y en el historial de los colaboradores.
- **Gestor de misiones**: crea *todas las misiones candidatas que quieras* (más de 24): nombre, descripción, punto de interés o tema, foto, portales y ruta.
- **Selección y orden**: elige qué 18 o 24 candidatas forman el conjunto final, arrástralas para fijar el orden recomendado y mira el mosaico de 6 columnas en directo.
- **Gestor de colaboradores**: colaboradores candidatos con datos de contacto, logotipo, PNG de la capa, el texto «por qué vosotros», estado (sin contactar → contactado → en conversaciones → aceptado / rechazado) y el documento de permiso firmado.
- **Compositor de imágenes**: construye cada PNG de 512×512: la foto de la misión (512×512) con una capa PNG encima (512×512, transparente donde debe verse la foto). La capa se prepara fuera de la herramienta a partir de la plantilla oficial del Mission Day: una por colaborador, más una por defecto sin colaborador. Puedes previsualizarlo para cada colaborador antes de pedirles nada.
- **Validación**: comprueba el conjunto con las reglas de la guía (ver más abajo) y señala los problemas antes de exportar.
- **Exportaciones**
  - ZIP con el PNG final de 512×512 de cada misión seleccionada, para el colaborador elegido;
  - **archivo UMM** para rellenar previamente cada misión en la Mission Authoring Tool con el complemento Ultimate Mission Maker;
  - hoja de misiones (CSV): nombres, descripciones, portales con coordenadas y enlaces de Intel, como lista de comprobación;
  - KML para importar en Google My Maps;
  - ayudante de solicitud: los textos y las listas que pide el formulario de Niantic.
- **Selección de portales en IITC**: con Ultimate Mission Maker: exporta las candidatas como archivo UMM, dibuja o corrige las rutas en IITC, exporta desde UMM y vuelve a importar el archivo.

---

## Reglas del Mission Day que comprueba la herramienta

| Regla | Valor |
|---|---|
| Misiones del conjunto final | 18 o 24 (Mission Day Lite: 6, poblaciones ≤ 2.500 habitantes) |
| Tipo de misión | ANY ORDER (nunca secuencial) |
| Nombre de la misión | `MD <AÑO>: <Ciudad>, <Punto de interés o tema>`, máximo 50 caracteres |
| Descripción de la misión | máximo 200 caracteres (idioma local + inglés si cabe) |
| Portales por misión | de 6 a 10 |
| Acciones | Solo hackear portales: sin contraseñas ni marcadores de Field Trip |
| Imagen | 512×512 px, PNG, fotos que se puedan usar comercialmente |
| Diseño | La misma capa de Mission Day en todas las misiones; **nunca diseñada como conjunto de banner** |
| Recorrido | Las misiones no deben llevar a la siguiente; cualquier grupo de 6 debería poder hacerse en menos de 2 horas |
| Solicitud | Puntos de contacto de ENL + RES, lista de atracciones, enlace al mapa, **un solo** diseño de logotipo/medalla |
| Logotipo del colaborador | Se requiere una prueba escrita de la aprobación del colaborador |

Notas:
- El **orden recomendado** es solo una sugerencia para los agentes que quieran encadenar misiones. Nunca aparece dentro de las misiones.
- El **mosaico** es solo una forma de mostrar el conjunto tal como lo ven los agentes en el escáner: la primera misión está abajo a la derecha. Cada imagen debe funcionar por sí sola: la herramienta te avisa si las imágenes parecen formar una sola imagen.
- Para la solicitud, Niantic pide **solo un** logotipo/medalla terminado. La herramienta los genera todos porque la propuesta a las entidades colaboradoras los muestra, pero presenta solo uno hasta que se apruebe la capa.

---

## Arquitectura

```
Navegador (público + SPA de administración)  ─┬─►  Cloudflare Worker (API + archivos estáticos)
                                              │       ├─ D1  (misiones, portales, colaboradores, textos)
                                              │       └─ R2  (fotos, capas, PNG generados, documentos)
Cloudflare Access ────────────────────────────┘  protege /admin y /api/admin
```

- **Worker**: TypeScript + Hono, sirve la API y el frontal compilado.
- **Frontal**: Vite + TypeScript + Preact, Leaflet + OpenStreetMap para los mapas.
- **Imágenes**: se componen en el navegador con `<canvas>` (no hace falta ningún servicio de imágenes) y se suben a R2.
- **Traducciones**: catalán, castellano e inglés para la interfaz; las cartas se pueden escribir en cualquier idioma para cada colaborador.

---

## Despliega la tuya

Requisitos: Node.js 20+, una cuenta de Cloudflare, un dominio en Cloudflare y `wrangler` con la sesión iniciada.

```bash
git clone https://github.com/<tú>/ingress-md-kit.git
cd ingress-md-kit
npm install

# Crea el almacenamiento
npx wrangler d1 create ingress-md-kit
npx wrangler r2 bucket create ingress-md-kit

# Configura
cp wrangler.example.toml wrangler.toml   # rellena el id de D1, el bucket y la ruta

# Base de datos
npm run db:migrate          # remoto
npm run db:migrate:local    # desarrollo local

# Ejecuta y despliega
npm run dev
npm run deploy
```

Después, en el panel de Cloudflare:
1. **Dominio personalizado**: asocia el Worker a tu subdominio (p. ej. `md.example.org`).
2. **Zero Trust → Settings → Authentication**: añade el método de entrada **One-time PIN**. Quien entra escribe su correo y Cloudflare le envía un código; no hace falta servidor de correo ni contraseña.
3. **Zero Trust → Access → Applications**: crea una aplicación *self-hosted* para `md.example.org/admin*` y `md.example.org/api/admin*`, con una política *Allow* que incluya **Everyone**. Así Access solo comprueba quién es cada persona, y la herramienta decide qué ve: quien no forma parte de ningún Mission Day ve una lista vacía, y los propietarios pueden añadir organizadores sin tocar Cloudflare. Si prefieres revisar a cada persona tú mismo, incluye solo sus correos y añade también ahí a cada organizador nuevo.
4. Todo lo demás (páginas de los Mission Days y propuestas) queda fuera de Access.

El plan gratuito de Zero Trust cubre hasta 50 personas, contadas a medida que entran; puedes quitar las inactivas en Zero Trust → Users.

`wrangler.toml` está ignorado por git: tu dominio, los identificadores y los datos nunca acaban en el repositorio.

Antes del primer despliegue, define `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` e `INSTANCE_ADMINS` (correos separados por comas de quien puede crear Mission Days) en `wrangler.toml`. El área de administración rechaza a todo el mundo hasta que estén definidos.

### Desarrollo local

```bash
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run seed:local          # Mission Day de demostración ficticio
npm run dev                 # después abre /admin
```

`.dev.vars` define `ENVIRONMENT=dev`, el único modo en que el área de administración no pasa por Cloudflare Access. En ese modo, la página de perfil (el nombre de arriba a la derecha) también permite cambiar a otra identidad de prueba, para ver qué ven los propietarios y los editores.

---

## Flujo de trabajo habitual

1. Crea el Mission Day (ciudad, año, formato 18/24) y los textos compartidos de la carta, y añade a los demás organizadores en la pestaña Organizadores.
2. Esboza las misiones candidatas; elige los portales en IITC con Ultimate Mission Maker; sube una foto para cada una.
3. Añade los colaboradores candidatos con su logotipo y el PNG de la capa.
4. Selecciona las 18 o 24 misiones finales y su orden recomendado. Corrige los avisos de validación.
5. Exporta el KML, impórtalo en Google My Maps, pega el enlace y sube una captura.
6. Envía a cada colaborador el enlace de su propuesta (o el PDF). Haz el seguimiento de las respuestas.
7. Cuando un colaborador diga que sí: sube su aprobación escrita, genera los PNG finales y la hoja de misiones, y rellena la solicitud de Niantic con el ayudante de solicitud.
8. Después de la aprobación: crea las misiones en la Mission Authoring Tool con el archivo UMM y el ZIP de PNG, publica la vista para participantes en Configuración y comparte su dirección con los agentes.

---

## Elegir portales en IITC

Ingress MD Kit no incluye (de momento) ningún complemento propio para IITC; funciona con **Ultimate Mission Maker**:

1. **Admin → Exportaciones → Archivo UMM para editar en IITC**: todas las misiones candidatas (o solo las seleccionadas) en un solo archivo UMM.
2. En IITC con UMM: *UMM Opt → Import*, y después dibuja o edita las rutas («mission mode», misión siguiente/anterior, deshacer).
3. *UMM Opt → Export* y sube el archivo en **Admin → Exportaciones → Importar desde UMM**. La herramienta muestra los cambios por misión (portales añadidos, eliminados o reordenados) antes de guardar.

Consejos:
- Las misiones se emparejan por posición en el archivo, y siempre mandan los nombres y descripciones guardados en la herramienta, de modo que no importa si UMM reescribe los títulos cuando editas sus «banner details».
- UMM avisa cuando la «banner length» no es múltiplo de 6: aquí no tiene importancia.

Más adelante puede llegar un complemento propio (sincronización en directo, contador de 6–10) si el viaje de ida y vuelta resulta pesado.

---

## Google My Maps

Google no ofrece ninguna API para crear My Maps, así que la herramienta exporta un **KML** que se importa a mano (My Maps → Crear un mapa → Importar). My Maps permite **10 capas** por mapa, de modo que el KML usa una capa para los portales y una para las rutas (una línea por misión, sin nada que una misiones), con un color por misión. Pega el enlace resultante y una captura en la administración; ambos aparecen en las propuestas.

---

## Mission Authoring Tool (con Ultimate Mission Maker)

La Mission Authoring Tool (missions.ingress.com) no tiene importación propia, pero el complemento comunitario **[Ultimate Mission Maker](https://umm.vashiru.tech/)** (UMM) añade una: instálalo en Tampermonkey, abre MAT, carga un archivo JSON de UMM y, para cada misión nueva, elígela de la lista: el título, la descripción y los portales quedan rellenados. Todavía tienes que subir la imagen y terminar cada misión a mano.

Ingress MD Kit exporta las misiones seleccionadas como **archivo UMM (versión de formato 2)**, en el orden recomendado, con los nombres finales `MD <AÑO>: <Ciudad>, <Punto de interés>` y las descripciones. Si el idioma elegido no es el inglés, cada descripción va seguida de una línea en blanco y del texto en inglés, siempre que quepa dentro de los 200 caracteres en todas las misiones; si en una misión no es posible, todas quedan solo en el idioma elegido. Después, en MAT, para cada misión:
1. Misión nueva → elígela de la lista de UMM → Import;
2. pon el tipo en **ANY ORDER** (compruébalo cada vez);
3. sube su PNG del ZIP (los archivos están numerados en el mismo orden);
4. revisa los portales (todos «Hack portal») y envíala.

La hoja de misiones (CSV) sigue disponible como lista de comprobación imprimible.

---

## Hoja de ruta

- [x] v0.1 — Configuración del Mission Day, gestor de misiones, mapa, selección y orden, mosaico
- [x] v0.2 — Colaboradores, compositor de capas, página pública de propuesta, impresión a PDF
- [x] v0.3 — Importación/exportación UMM, otras exportaciones (ZIP de PNG, hoja de misiones, KML, ayudante de solicitud)
- [ ] v0.4 — (opcional) complemento propio para IITC con sincronización en directo
- [x] v0.5 — Vista para participantes, varios organizadores por Mission Day

## Licencia

MIT. Ingress, sus logotipos y las plantillas de Mission Day pertenecen a Niantic Spatial; los logotipos de los colaboradores pertenecen a sus propietarios.
