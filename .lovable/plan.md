

## Plan: Reorganiser kodebasen til domænebaseret mappestruktur

### Hvorfor nu?
Den nuværende kode har flade filer i `src/components/` der blander domæner (auth, lunch, admin, profil). At rydde op nu gør den kommende modulære arkitektur langt nemmere, fordi grænser mellem domæner allerede er trukket.

### Ny mappestruktur

```text
src/
├── components/
│   ├── ui/                    (uændret - shadcn komponenter)
│   ├── auth/
│   │   ├── AuthForm.tsx
│   │   └── PasswordChange.tsx
│   ├── lunch/
│   │   └── LunchCalendar.tsx
│   ├── catering/              (eksisterer allerede)
│   │   ├── CateringOrderDialog.tsx  (flyttes ind)
│   │   ├── OutlookCalendar.tsx      (flyttes ind)
│   │   ├── RoomCalendarsView.tsx    (flyttes ind)
│   │   └── ... (eksisterende filer)
│   ├── kitchen/               (eksisterer allerede)
│   │   ├── KitchenView.tsx          (flyttes ind)
│   │   └── ... (eksisterende filer)
│   ├── admin/
│   │   ├── AdminPanel.tsx
│   │   ├── UserManagement.tsx
│   │   ├── InvitationManagement.tsx
│   │   ├── CompanySettings.tsx
│   │   ├── WebflowSyncSettings.tsx
│   │   └── settings/               (flyttes ind)
│   ├── profile/               (eksisterer allerede)
│   │   ├── ProfileSettings.tsx      (flyttes ind)
│   │   ├── AbsenceManager.tsx
│   │   └── ...
│   ├── statistics/            (uændret - allerede grupperet)
│   ├── notifications/
│   │   ├── UserNotifications.tsx
│   │   ├── PushSubscriptionButton.tsx
│   │   └── ReloadPrompt.tsx
│   └── shared/
│       ├── NavLink.tsx
│       └── ColorPicker.tsx
├── hooks/                     (uændret)
├── lib/                       (uændret)
├── pages/                     (uændret)
└── ...
```

### Trin

1. **Opret nye mapper** og flyt filer til deres domæne-mapper
2. **Opdater alle imports** i filer der refererer til de flyttede komponenter (`Index.tsx`, `AdminPanel.tsx`, `CompanySettings.tsx`, osv.)
3. **Ingen funktionel ændring** — kun fil-flytning og import-opdateringer

### Vigtige detaljer
- `Index.tsx` forbliver i `pages/` men får opdaterede imports
- `settings/`-undermappen flyttes under `admin/` da det er admin-indstillinger
- `statistics/` er allerede korrekt grupperet og forbliver uændret
- Alle eksisterende barrel-exports og relative imports opdateres

### Filer der ændres
| Handling | Filer |
|----------|-------|
| Flyt til `auth/` | `AuthForm.tsx`, `PasswordChange.tsx` |
| Flyt til `lunch/` | `LunchCalendar.tsx` |
| Flyt til `catering/` | `CateringOrderDialog.tsx`, `OutlookCalendar.tsx`, `RoomCalendarsView.tsx` |
| Flyt til `kitchen/` | `KitchenView.tsx` |
| Flyt til `admin/` | `AdminPanel.tsx`, `UserManagement.tsx`, `InvitationManagement.tsx`, `CompanySettings.tsx`, `WebflowSyncSettings.tsx` + `settings/` |
| Flyt til `profile/` | `ProfileSettings.tsx` |
| Flyt til `notifications/` | `UserNotifications.tsx`, `PushSubscriptionButton.tsx`, `ReloadPrompt.tsx` |
| Flyt til `shared/` | `NavLink.tsx`, `ColorPicker.tsx` |
| Opdater imports | `Index.tsx`, `AdminPanel.tsx`, `CompanySettings.tsx`, `App.tsx`, og alle filer der importerer flyttede komponenter |

