# Frokost: fælles top og navigation

Kontrolleret 2. oktober 2026. Reference: den aktuelle top i IT-hjælps src/components/helpdesk-app.tsx. IT-hjælp er ikke ændret.

## Ændringer

- AppHeader bruger samme cirkelikon, navne-/undertitelhierarki, 1400 px bredde, responsive sideafstande, diskrete skillelinjer og separat navigation som IT-hjælp. Navn: Pluskontoret Frokost; undertitel: Frokost og forplejning.
- Profil, rollenavn, notifikationer og fungerende logout ligger i brugerområdet. Notifikationsknapper har fået tilgængelige navne og popovers en mobilvenlig maksimalbredde.
- Frokosts eksisterende menupunkter og rollegrænser er bevaret. Menupunkterne bruger nu links til den eksisterende /-route med tab-parameter. Det gør også Microsoft-kalenderens eksisterende returadresse /?tab=profile virksom; den blev før ignoreret.
- AppLayout med React Router Outlet bevarer toppen, sessionen og rolleabonnementet under navigation. Alle routes ligger under samme layout, inklusive vejledning, installation, 404, kalendercallback og afmelding. Sidetitel på vejledningen ligger i indholdet, så der kun er én app-top.
- Farvede elementer bruger de eksisterende primary-tokens. useCompanyColors og farveadministrationen er bevaret.
- På mobil er brugerområdet en separat række. Lange navne afkortes visuelt; det fulde navn findes i title. Navigationen har én vandret scrollbarfri række, der kan scrolles med touch og tastatur. Den skubber ikke resten af siden ud over viewporten.

## Stabilitet og fejlrettelser

Den tidligere top placerede logo, alle menuer og profil i én række. Profilknappen indeholdt enten Profil eller det asynkront indlæste navn og kunne derfor ændre bredde. Vejledning og installation brugte desuden forskellige topsystemer og indholdsbredder.

Nu har toppen fælles bredde og samme rækkehøjder ved samme viewport. Brugerfelt og ikonpladser er reserveret fra starten. Alle navigationslinks har samme fontvægt, padding og kant uanset aktiv tilstand; kun farver ændres. Top og navigation står sammen i en sticky beholder med dækkende baggrund. html har scrollbar-gutter: stable; eksisterende skjulte scrollbars er bevaret. Der blev ikke reproduceret en scrollbarforårsaget forskydning.

Forsinkede profil- og rollesvar ignoreres efter bruger-/komponentskift. En tidligere brugers rolle kan ikke vises eller bruges til at rendre en privilegeret side for næste bruger. Et gammelt getSession-svar kan ikke overskrive en nyere auth-hændelse. Logout viser fejl ved mislykket kald i stedet for en falsk succes.

Loginmodel, databaseskema, RLS og backendfunktioner er ikke ændret af denne opgave. De lokale Microsoft-loginændringer, som allerede fandtes ved opgavens start, er bevaret.

## Checks

- Typecheck: node node_modules/typescript/bin/tsc -p tsconfig.app.json --noEmit — bestået.
- Lint af layout, Index, Guide, Install, NotFound og useUserRole — bestået uden fejl eller advarsler.
- Node-test: tests/app-navigation.test.mjs, microsoft-login.test.mjs, microsoft-email-queue.test.mjs og microsoft-only-auth.test.ts — 17/17 bestået. Otte nye tests dækker rollebaseret navigation, direkte privilegerede faner, profil, loading og logoutknappens tilstande.
- Fuld lint med lokal QA-mappe udeladt — 100 fejl og 27 advarsler i eksisterende kode, bl.a. any-typer og hook-afhængigheder. De berørte notifikationskomponenter har eksisterende lintproblemer; den fulde kodebase er ikke lint-ren.
- Produktionsbuild inklusive PWA-serviceworker — bestået. Vite advarer om en stor eksisterende JavaScript-bundle.

## Browserkontrol

Isoleret lokal kontrol med de rigtige AppHeader-, AppLayout-, Index-, rollehook-, Guide-, Install- og NotFound-komponenter. Supabase og de fem domæneskærmes indhold blev erstattet med testdata/testindhold, så ingen produktionsdata blev læst eller ændret. Notifikationer blev erstattet med en testknap.

Ved 1440×900 og 390×844 blev top og navigation målt før/efter navigation gennem Min plan, Forplejning, Køkken, Admin, Profil, Vejledning, Installation og 404. Målingerne viser identiske positioner og dimensioner ved samme viewport. Menuernes bredder ændrede sig ikke ved aktivering. Kort indhold, 1600 px højt indhold og navigation efter scrolling blev kontrolleret. Ingen vandret overflow på dokumentet.

| Viewport | Top: x, y, bredde, højde | Navigation: x, y, bredde, højde |
| --- | --- | --- |
| 1440×900 | 0, 0, 1440, 64,667 | 20, 64,667, 1400, 64,667 |
| 390×844 | 0, 0, 390, 112,667 | 0, 112,667, 390, 64,667 |

Desuden visuel kontrol/måling ved 320 og 640 px bredde. Lange navne, alle adminmenuer, synligt Tab-fokus, Enter-navigation, runtimeændring til blåt primary-token, medarbejder-/køkken-/administratornavigation, rollefratagelse, direkte adminlink uden rolle, succesfuldt logout og fejlet logout blev kontrolleret med testdata.

Screenshots og rå bounding boxes ligger i docs/qa/header.

## Begrænsninger og publicering

Microsoft-login mod Entra, rigtige brugeres sessioner, de fulde frokost-/forplejnings-/adminflows, live notifikationer, profilgemning, kalendercallback og tokenbaseret e-mailafmelding er ikke afprøvet end-to-end mod backend. Callback og afmelding er gennemgået i kode og bygget, men ikke visuelt afprøvet. De fulde domæneskærmes indhold blev ikke visuelt verificeret med produktionsdata.

Denne topændring kræver ingen migrationer eller deploy af backendfunktioner. For at få den i Lovable skal koden committes og pushes til den branch, Lovable er forbundet med; derefter kontrolleres previewet og Publish bruges, hvis den offentlige app skal opdateres. Den lokale branch hedder fix/microsoft-only-login og indeholder også tidligere ændringer; deres publiceringskrav er beskrevet separat i docs/microsoft-only-login.md. Denne opgave har hverken pushet, publiceret eller ændret produktionsdata.

## Efterfølgende rettelse: ens indholdsbredde

Toppen var bredere end kalenderkortene, fordi toppen brugte 1400 px ramme, mens Index havde en indlejret 1280 px container. Profil, vejledning og installation brugte yderligere forskellige maksimalbredder. Disse sideafhængige rammer er nu erstattet med app-container og app-content i src/index.css: én maksimal ramme på 1344 px inklusive 32 px gutters på hver side, altså 1280 px indhold på desktop. På mobil bruges 16 px gutters og på mellemstore skærme 24 px. Toppen er rykket ind til kalenderens eksisterende kanter. Profil, vejledning, installation og øvrige routes deler nu samme ramme. Centrering og maksimalbredde på administrationsområdets undernavigation er også fjernet. Dialoger og feltbegrænsninger er bevaret.

Typecheck, målrettet lint, de eksisterende 17 tests og produktionsbuild inklusive PWA passerer. Build har fortsat advarsel om stor bundle. Ingen nye stylingtests er tilføjet.

Browserkontrol bruger samme isolerede testopsætning og begrænsninger som ovenfor. Domæneindhold er testindhold; de rigtige fælles layouts samt vejledning og installation er renderet. Ved 1440 px viewport blev kanterne målt til x=80 og x=1360 for top, navigation og indhold på Min plan, Forplejning, Køkken, Admin, Profil, Installation og Vejledning. Ved 390 px viewport blev kanterne målt til x=16 og x=374 for de samme sider plus 404. Ingen vandret dokument-overflow. Rå målinger og nye screenshots findes i docs/qa/width. De tidligere målinger ovenfor dokumenterer versionen før denne bredderettelse.

Ingen ændringer i adgangskontrol, forretningslogik, database eller backend. Publicering kræver opdatering af Lovable fra den relevante GitHub-branch og efterfølgende Publish. Denne bredderettelse kræver ingen migrationer eller backenddeploy.
