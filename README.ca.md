# Ingress MD Kit

Idiomes: [English](README.md) · **Català** · [Español](README.es.md)

Planifica un **Mission Day d'Ingress** des de la idea fins a la sol·licitud: missions candidates i rutes, propostes a les entitats col·laboradores, imatges de les missions amb la capa del col·laborador, i les exportacions que necessites per a la sol·licitud a Niantic i per a la Mission Authoring Tool.

Autoallotjat a **Cloudflare** (Workers + D1 + R2 + Access). Tot cap dins del nivell gratuït. Clona'l, desplega'l al teu (sub)domini i planifica la teva ciutat.

> Eina comunitària no oficial. Sense cap vincle ni aval de Niantic Spatial.
> Les regles d'aquest document provenen de l'**Ingress Mission Day Handbook 2026** (última edició: setembre de 2025). Consulta sempre la guia vigent i https://ingress.com/news abans de presentar la sol·licitud: els terminis i les regles canvien.

---

## Què fa

Una sola instància pot allotjar **diversos Mission Days** (p. ex. `/example-2027`, `/sample-town-2028`), cadascun amb el seu equip d'organitzadors. Altres comunitats poden fer servir la teva instància o desplegar-ne una de pròpia.

### Adreces

| Camí | Què és |
|---|---|
| `/` | Pàgina d'inici: què fa l'eina, els Mission Days publicats i un contacte per demanar-ne l'accés |
| `/<md-slug>` | Pàgina del Mission Day (vista per als participants, un cop publicada) |
| `/<md-slug>/proposta-<token>` | Proposta per a un col·laborador candidat (no llistada). La paraula segueix l'idioma de la carta: `proposta`, `propuesta`, `proposal`; totes tres funcionen |
| `/<md-slug>/sample` | L'única imatge de logotip o medalla enllaçada a la sol·licitud de Niantic, generada des d'Exportacions. Només mostra el logotip d'un col·laborador amb el seu permís signat |
| `/admin` | Àrea privada (Cloudflare Access) |

### Part pública (sense accés amb usuari)
- **Pàgina d'inici**: explica què és un Mission Day i què fa l'eina, amb les mateixes paraules neutres per a qualsevol comunitat, i enllaça tots els Mission Days amb la vista per als participants publicada: primer els propers i després els anteriors. Acaba amb un contacte, que fixen els administradors de la instància, per a qui vulgui fer servir l'eina. Mai no hi surten els col·laboradors.
- **Propostes a les entitats col·laboradores**: una pàgina per a cada entitat col·laboradora candidata (ajuntament, universitat, ens de turisme, museu…), accessible només amb un enllaç impossible d'endevinar. Conté:
  - una carta de presentació: qui som, què és Ingress, què és un Mission Day, per què aquesta ciutat, per què aquest col·laborador;
  - la proposta completa de missions: cada missió amb nom, descripció, foto i ruta;
  - un **mosaic de 6 columnes** amb les 18 o 24 imatges de les missions, amb el logotip del col·laborador ja aplicat com a exemple;
  - el mapa de totes les missions i la ruta de cadascuna, amb línies rectes entre els seus portals i mai entre missions (mapa interactiu + imatge estàtica + enllaç al Google My Maps compartit);
  - la petició de permís per fer servir el logotip i les fotos del col·laborador: un text per defecte que hereta cada col·laborador nou i que es pot adaptar a cadascun.
  - Un full d'estil d'impressió perquè la pàgina es pugui desar com a PDF i adjuntar a un correu.
- **Vista per als participants** (quan un propietari la publica, normalment després de l'aprovació): el que els agents necessiten per jugar, pensat per al mòbil. Hi ha una presentació amb les paraules dels organitzadors (un text per idioma, a la Configuració, on `{missions}` i `{medal}` es canvien pel nombre de missions i pel mínim per a la medalla; en un idioma que es deixi buit, surt una frase per defecte), les missions seleccionades en l'ordre recomanat, el mosaic, el mapa amb cada ruta, l'enllaç a My Maps i, de cada missió, la descripció en l'idioma del visitant, el portal d'inici i els portals amb enllaços a Intel. Mentre no es publica, la seva adreça només diu que el Mission Day encara no s'ha publicat. Les imatges porten la capa per defecte o la d'un col·laborador que triï un propietari entre els que han acceptat amb el permís signat; si aquest permís decau, la capa per defecte torna sola.

Totes les pàgines públiques, menys la d'inici, són `noindex`. Les de proposta, a més, no estan llistades, perquè mostren logotips que encara no tens permís per fer servir; la vista per als participants està pensada per compartir-la on vulguis, com els canals dels teus agents.

### Part privada (administració, darrere de Cloudflare Access)
- **Mission Days**: en pots crear diversos; cadascun té la seva adreça, ciutat, any, data, format (18 / 24, o 6 per a Lite), equip (els punts de contacte d'ENL i RES), capa per defecte (sense col·laborador) i textos compartits de la carta.
- **Configuració de la instància**: el contacte que surt a la pàgina d'inici (un text com `@codename` i l'enllaç on porta, `https:` o `mailto:`), editable pels administradors de la instància.
- **Textos per defecte de la carta**: textos de tota la instància (qui som, què és Ingress…) que cada Mission Day nou copia en crear-se i després pot adaptar.
- **Organitzadors**: cada Mission Day té el seu equip, que es gestiona a la pestanya Organitzadors. Els propietaris hi afegeixen gent pel correu amb què entrarà, en canvien el rol i la treuen; els editors poden canviar tota la resta, però no gestionar l'equip ni esborrar res. Un Mission Day sempre conserva com a mínim un propietari, i qualsevol pot sortir d'un equip. Cada organitzador només veu els Mission Days dels quals forma part, tret que els administradors de la instància poden gestionar l'equip de qualsevol. Cada organitzador té un perfil (nom d'agent i facció) que es mostra a la llista de l'equip i a l'historial dels col·laboradors.
- **Gestor de missions**: crea *totes les missions candidates que vulguis* (més de 24): nom, descripció, punt d'interès o tema, foto, portals i ruta.
- **Selecció i ordre**: tria quines 18 o 24 candidates formen el conjunt final, arrossega-les per fixar l'ordre recomanat i mira el mosaic de 6 columnes en directe.
- **Gestor de col·laboradors**: col·laboradors candidats amb dades de contacte, logotip, PNG de la capa, el text «per què vosaltres», estat (sense contactar → contactat → en converses → acceptat / rebutjat) i el document de permís signat.
- **Compositor d'imatges**: construeix cada PNG de 512×512: la foto de la missió (512×512) amb una capa PNG al damunt (512×512, transparent on s'ha de veure la foto). La capa es prepara fora de l'eina a partir de la plantilla oficial del Mission Day: una per col·laborador, més una per defecte sense col·laborador. Pots previsualitzar-ho per a cada col·laborador abans de demanar-los res.
- **Validació**: comprova el conjunt amb les regles de la guia (vegeu més avall) i assenyala els problemes abans d'exportar.
- **Exportacions**
  - ZIP amb el PNG final de 512×512 de cada missió seleccionada, per al col·laborador triat;
  - **fitxer UMM** per preomplir cada missió a la Mission Authoring Tool amb el connector Ultimate Mission Maker;
  - full de missions (CSV): noms, descripcions, portals amb coordenades i enllaços d'Intel, com a llista de comprovació;
  - KML per importar a Google My Maps;
  - ajudant de sol·licitud: els textos i les llistes que demana el formulari de Niantic.
- **Selecció de portals a IITC**: amb Ultimate Mission Maker: exporta les candidates com a fitxer UMM, dibuixa o corregeix les rutes a IITC, exporta des d'UMM i torna a importar el fitxer.

---

## Regles del Mission Day que comprova l'eina

| Regla | Valor |
|---|---|
| Missions del conjunt final | 18 o 24 (Mission Day Lite: 6, poblacions ≤ 2.500 habitants) |
| Tipus de missió | ANY ORDER (mai seqüencial) |
| Nom de la missió | `MD <ANY>: <Ciutat>, <Punt d'interès o tema>`, màxim 50 caràcters |
| Descripció de la missió | màxim 200 caràcters (idioma local + anglès si hi cap) |
| Portals per missió | de 6 a 10 |
| Accions | Només piratejar portals: sense contrasenyes ni marcadors de Field Trip |
| Imatge | 512×512 px, PNG, fotos que es puguin fer servir comercialment |
| Disseny | La mateixa capa de Mission Day a totes les missions; **mai dissenyada com a conjunt de bàner** |
| Recorregut | Les missions no han de portar a la següent; qualsevol grup de 6 s'hauria de poder fer en menys de 2 hores |
| Sol·licitud | Punts de contacte d'ENL + RES, llista d'atraccions, enllaç al mapa, **un sol** disseny de logotip/medalla |
| Logotip del col·laborador | Cal una prova escrita de l'aprovació del col·laborador |

Notes:
- L'**ordre recomanat** només és un suggeriment per als agents que vulguin encadenar missions. Mai apareix dins de les missions.
- El **mosaic** és només una manera de mostrar el conjunt tal com el veuen els agents a l'escàner: la primera missió és a baix a la dreta. Cada imatge ha de funcionar per si sola: l'eina t'avisa si les imatges semblen formar una sola imatge.
- Per a la sol·licitud, Niantic demana **només un** logotip/medalla acabat. L'eina els genera tots perquè la proposta a les entitats col·laboradores els mostra, però presenta'n només un fins que s'aprovi la capa.

---

## Arquitectura

```
Navegador (públic + SPA d'administració)  ─┬─►  Cloudflare Worker (API + fitxers estàtics)
                                           │       ├─ D1  (missions, portals, col·laboradors, textos)
                                           │       └─ R2  (fotos, capes, PNG generats, documents)
Cloudflare Access ─────────────────────────┘  protegeix /admin i /api/admin
```

- **Worker**: TypeScript + Hono, serveix l'API i el frontal compilat.
- **Frontal**: Vite + TypeScript + Preact, Leaflet + OpenStreetMap per als mapes.
- **Imatges**: es componen al navegador amb `<canvas>` (no cal cap servei d'imatges) i es pugen a R2.
- **Traduccions**: català, castellà i anglès per a la interfície; les cartes es poden escriure en qualsevol idioma per a cada col·laborador.

---

## Desplega la teva

Requisits: Node.js 20+, un compte de Cloudflare, un domini a Cloudflare i `wrangler` amb la sessió iniciada.

```bash
git clone https://github.com/<tu>/ingress-md-kit.git
cd ingress-md-kit
npm install

# Crea l'emmagatzematge
npx wrangler d1 create ingress-md-kit
npx wrangler r2 bucket create ingress-md-kit

# Configura
cp wrangler.example.toml wrangler.toml   # omple l'id de D1, el bucket i la ruta

# Base de dades
npm run db:migrate          # remot
npm run db:migrate:local    # desenvolupament local

# Executa i desplega
npm run dev
npm run deploy
```

Després, al tauler de Cloudflare:
1. **Domini personalitzat**: associa el Worker al teu subdomini (p. ex. `md.example.org`).
2. **Zero Trust → Settings → Authentication**: afegeix el mètode d'entrada **One-time PIN**. Qui entra escriu el seu correu i Cloudflare li envia un codi; no cal cap servidor de correu ni contrasenya.
3. **Zero Trust → Access → Applications**: crea una aplicació *self-hosted* per a `md.example.org/admin*` i `md.example.org/api/admin*`, amb una política *Allow* que inclogui **Everyone**. Així Access només comprova qui és cadascú, i l'eina decideix què veu: qui no forma part de cap Mission Day veu una llista buida, i els propietaris poden afegir organitzadors sense tocar Cloudflare. Si prefereixes revisar cada persona tu mateix, inclou-hi només els seus correus i afegeix-hi també cada organitzador nou.
4. Tota la resta (pàgines dels Mission Days i propostes) queda fora d'Access.

El pla gratuït de Zero Trust cobreix fins a 50 persones, comptades a mesura que entren; pots treure les inactives a Zero Trust → Users.

`wrangler.toml` està ignorat per git: el teu domini, els identificadors i les dades mai acaben al repositori.

Abans del primer desplegament, defineix `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` i `INSTANCE_ADMINS` (correus separats per comes de qui pot crear Mission Days) a `wrangler.toml`. L'àrea d'administració rebutja tothom fins que no estiguin definits.

### Desenvolupament local

```bash
cp wrangler.example.toml wrangler.toml
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run seed:local          # Mission Day de demostració fictici
npm run dev                 # després obre /admin
```

`.dev.vars` defineix `ENVIRONMENT=dev`, l'únic mode en què l'àrea d'administració no passa per Cloudflare Access. En aquest mode, la pàgina de perfil (el nom de dalt a la dreta) també permet canviar a una altra identitat de prova, per veure què veuen els propietaris i els editors.

---

## Flux de treball habitual

1. Crea el Mission Day (ciutat, any, format 18/24) i els textos compartits de la carta, i afegeix els altres organitzadors a la pestanya Organitzadors.
2. Esbossa les missions candidates; tria els portals a IITC amb Ultimate Mission Maker; puja una foto per a cadascuna.
3. Afegeix els col·laboradors candidats amb el seu logotip i el PNG de la capa.
4. Selecciona les 18 o 24 missions finals i el seu ordre recomanat. Corregeix els avisos de validació.
5. Exporta el KML, importa'l a Google My Maps, enganxa l'enllaç i puja una captura.
6. Envia a cada col·laborador l'enllaç de la seva proposta (o el PDF). Fes el seguiment de les respostes.
7. Quan un col·laborador digui que sí: puja la seva aprovació escrita, genera els PNG finals i el full de missions, i omple la sol·licitud de Niantic amb l'ajudant de sol·licitud.
8. Després de l'aprovació: crea les missions a la Mission Authoring Tool amb el fitxer UMM i el ZIP de PNG, publica la vista per als participants a Configuració i comparteix-ne l'adreça amb els agents.

---

## Triar portals a IITC

Ingress MD Kit no inclou (de moment) cap connector propi per a IITC; funciona amb **Ultimate Mission Maker**:

1. **Admin → Exportacions → Fitxer UMM per editar a IITC**: totes les missions candidates (o només les seleccionades) en un sol fitxer UMM.
2. A IITC amb UMM: *UMM Opt → Import*, i després dibuixa o edita les rutes («mission mode», missió següent/anterior, desfer).
3. *UMM Opt → Export* i puja el fitxer a **Admin → Exportacions → Importa d'UMM**. L'eina mostra els canvis per missió (portals afegits, eliminats o reordenats) abans de desar.

Consells:
- Les missions es fan coincidir per posició al fitxer, i sempre manen els noms i descripcions desats a l'eina, de manera que no importa si UMM reescriu els títols quan edites els seus «banner details».
- UMM avisa quan la «banner length» no és múltiple de 6: aquí no té cap importància.

Més endavant pot arribar un connector propi (sincronització en directe, comptador de 6–10) si el viatge d'anada i tornada resulta pesat.

---

## Google My Maps

Google no ofereix cap API per crear My Maps, així que l'eina exporta un **KML** que s'importa a mà (My Maps → Crea un mapa → Importa). My Maps permet **10 capes** per mapa, de manera que el KML fa servir una capa per als portals i una per a les rutes (una línia per missió, sense res que uneixi missions), amb un color per missió. Enganxa l'enllaç resultant i una captura a l'administració; tots dos apareixen a les propostes.

---

## Mission Authoring Tool (amb Ultimate Mission Maker)

La Mission Authoring Tool (missions.ingress.com) no té importació pròpia, però el connector comunitari **[Ultimate Mission Maker](https://umm.vashiru.tech/)** (UMM) n'hi afegeix una: instal·la'l a Tampermonkey, obre MAT, carrega un fitxer JSON d'UMM i, per a cada missió nova, tria-la de la llista: el títol, la descripció i els portals queden preomplerts. Encara has de pujar la imatge i acabar cada missió a mà.

Ingress MD Kit exporta les missions seleccionades com a **fitxer UMM (versió de format 2)**, en l'ordre recomanat, amb els noms finals `MD <ANY>: <Ciutat>, <Punt d'interès>` i les descripcions. Si l'idioma triat no és l'anglès, cada descripció va seguida d'una línia en blanc i del text en anglès, sempre que hi càpiga dins els 200 caràcters a totes les missions; si en una missió no és possible, totes queden només en l'idioma triat. Després, a MAT, per a cada missió:
1. Missió nova → tria-la de la llista d'UMM → Import;
2. posa el tipus a **ANY ORDER** (comprova-ho cada vegada);
3. puja el seu PNG del ZIP (els fitxers estan numerats en el mateix ordre);
4. revisa els portals (tots «Hack portal») i envia-la.

El full de missions (CSV) continua disponible com a llista de comprovació imprimible.

---

## Full de ruta

- [x] v0.1 — Configuració del Mission Day, gestor de missions, mapa, selecció i ordre, mosaic
- [x] v0.2 — Col·laboradors, compositor de capes, pàgina pública de proposta, impressió a PDF
- [x] v0.3 — Importació/exportació UMM, altres exportacions (ZIP de PNG, full de missions, KML, ajudant de sol·licitud)
- [ ] v0.4 — (opcional) connector propi per a IITC amb sincronització en directe
- [x] v0.5 — Vista per als participants, diversos organitzadors per Mission Day

## Llicència

MIT. Ingress, els seus logotips i les plantilles de Mission Day pertanyen a Niantic Spatial; els logotips dels col·laboradors pertanyen als seus propietaris.
