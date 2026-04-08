

## Plan: Flyt "Send påmindelse"-knappen ind i dagskortet

### Ændring
Fjerner knappen fra header-området (ved siden af tab-listen) og placerer den i dagsoversigten, integreret ved "Tilmeldte"-overskriften i højre kolonne.

### Teknisk tilgang

**Fil: `src/components/KitchenView.tsx`**

1. **Fjern knappen fra header** (linje 649-661) — fjern hele `<Button>` blokken ved tab-listen
2. **Tilføj knappen ved "Tilmeldte"-overskriften** (linje 778-779) — ændre header-linjen til et flex-layout med "Tilmeldte (X)" til venstre og påmindelsesknappen til højre, som en kompakt ikon-knap med badge

Layoutet bliver:
```text
Tilmeldte (12)                    [🔔 5]
```

Knappen vises kun i dag-fanen og kun når der er undecided brugere.

### Filer der ændres
| Fil | Ændring |
|-----|---------|
| `src/components/KitchenView.tsx` | Flyt knap fra header til dagskort |

