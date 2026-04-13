

## Plan: Forbedret feedback ved Webflow-synkronisering + vis inaktive brugere

### Baggrund
Synkroniseringen deaktiverede `joj@pluskontoret.dk` og `twb@pluskontoret.dk` fordi de ikke længere er i Webflow-collectionen (eller er filtreret fra som drafts/arkiverede). Der er to problemer:
1. Toast-beskeden viser kun tal, ikke navne på fjernede brugere
2. Brugerlisten i admin viser ikke hvem der er inaktive

### Ændring 1: Vis navne på fjernede brugere i sync-feedback

**Fil: `src/components/admin/WebflowSyncSettings.tsx`**

Udvid toast-beskeden så den inkluderer navne/emails på fjernede brugere fra `data.details`:

```
Synkronisering fuldført
Tilføjet: 0, Opdateret: 48, Fjernet: 2
Deaktiveret: joj@pluskontoret.dk, twb@pluskontoret.dk
```

Parses fra `data.details.success`-arrayet ved at filtrere entries der starter med "Deactivated" / "Soft-deleted" / "Fully deleted".

### Ændring 2: Vis inaktiv-status i brugerlisten

**Fil: `src/components/admin/UserManagement.tsx`**

- Tilføj `is_active` til `UserProfile`-interfacet
- Vis en "Inaktiv"-badge (grå/rød) ved brugere hvor `is_active = false`
- Eventuelt tilføj et filter der lader admin skifte mellem "Alle" / "Aktive" / "Inaktive"

### Ændring 3: Vis fjernede brugere i synkhistorikken

**Fil: `src/components/admin/WebflowSyncSettings.tsx`**

I sync-log sektionen: Når der er fjernede brugere, vis en ekstra linje med de specifikke emails der blev påvirket (fra `log.details`).

### Filer der ændres
| Fil | Ændring |
|-----|---------|
| `src/components/admin/WebflowSyncSettings.tsx` | Detaljeret toast + sync-historik med navne |
| `src/components/admin/UserManagement.tsx` | Tilføj `is_active` felt + badge + filter |

