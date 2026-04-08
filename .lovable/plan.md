

## Plan: Manuel "send påmindelse"-knap til køkkenpersonalet

### Hvad det gør
Tilføjer en knap i køkkenvisningen, der lader køkken-/adminpersonale manuelt sende en påmindelse til alle aktive brugere, som endnu ikke har taget et valg (hverken tilmeldt eller frameldt) for den aktuelle eller kommende uge. Knappen viser antal brugere uden valg, og efter klik sendes påmindelsen.

### Teknisk tilgang

**1. Ny edge function: `send-manual-reminder/index.ts`**
- Verificerer at den kaldende bruger er admin eller kitchen (via JWT + `has_role` RPC)
- Beregner den aktuelle uge (man-fre) — hvis det er mandag eller senere bruges indeværende uge, ellers kommende uge (samme logik som den eksisterende reminder)
- Henter aktive profiler med `reminder_enabled = true`
- Henter signups og optouts for ugen
- Finder brugere uden valg
- Sender reminder-mail via Resend til hver (med 500ms delay)
- Returnerer antal sendte mails

**2. Frontend: `src/components/KitchenView.tsx`**
- Tilføjer en knap i header-området for den aktuelle uge (f.eks. ved siden af ugenummer)
- Knappen henter antal brugere uden valg via et simpelt count og viser det (f.eks. "Send påmindelse (5)")
- Ved klik kalder `supabase.functions.invoke('send-manual-reminder')`
- Viser loading-state og succes/fejl toast
- Kun synlig for admin/kitchen brugere (de er allerede i KitchenView)

**3. Beregning af "brugere uden valg" i frontend**
- Henter `profiles` med `is_active = true` og `reminder_enabled = true`
- Sammenligner med eksisterende signups + optouts for indeværende uge
- Viser differencen som badge på knappen

### Filer der ændres
| Fil | Ændring |
|-----|---------|
| `supabase/functions/send-manual-reminder/index.ts` | **Ny** — auth + send mails |
| `src/components/KitchenView.tsx` | Tilføj knap med count + invoke-logik |

### Sikkerhed
- Edge function kræver gyldig JWT og admin/kitchen rolle
- Ingen CRON_SECRET nødvendig — bruger direkte auth i stedet

