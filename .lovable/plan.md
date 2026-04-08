

## Plan: Juster alignment af navnekort i køkkenvisningen

### Problem
Kortene i "Tilmeldte"-sektionen (højre kolonne) har en `pr-4` padding inde i `ScrollArea`, som skaber uens højre kant sammenlignet med de øvrige elementer på siden.

### Ændring

**Fil: `src/components/KitchenView.tsx`**

Fjern `pr-4` fra den indre `div` i `ScrollArea` (linje 784) og brug i stedet `pr-4` direkte på `ScrollArea`-komponenten, så scrollbar og indhold aligner korrekt med resten af layoutet. Alternativt, hvis scrollbar ikke er synlig på mobil, kan `pr-4` fjernes helt.

På mobil (390px viewport, `grid-cols-1`) vises begge kolonner i én kolonne, så alignment skal matche de øvrige kort (summary stats, kostrestriktioner). Løsningen er at fjerne `pr-4` fra linje 784, da det skubber indholdet indad og skaber mismatch.

| Fil | Ændring |
|-----|---------|
| `src/components/KitchenView.tsx` | Fjern `pr-4` fra ScrollArea inner div (linje 784) |

