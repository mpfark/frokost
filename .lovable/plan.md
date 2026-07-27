## Hvad der skete

Loggen fra sidste synk viser præcis årsagen:

```
Validation failed for item 68ee40fc48913abd5aee0438:
  { validation: "regex", message: "Name contains invalid characters", path: ["name"] }
```

Det item-ID er Majas post (hendes profil i databasen har `webflow_id = 68ee40fc48913abd5aee0438`). Et andet item, `68ee4313bb15da9c1d753625`, fejlede på samme måde.

Kæden af hændelser:

1. Navnet i Webflow valideres mod et strengt mønster, der kun tillader a–z, æøå, mellemrum, bindestreg, apostrof og punktum.
2. Hendes ændrede navn indeholder et tegn udenfor det (fx et hårdt mellemrum, komma, parentes, tal eller en accent som é/ö).
3. Ved valideringsfejl springes hele item'et over — og hendes e-mail bliver derfor **ikke** lagt i listen over "findes i Webflow".
4. Til sidst deaktiverer synken alle Webflow-synkede profiler, der ikke er på den liste → hun blev sat inaktiv, selvom hun er published i CMS'et.

Så det er ikke publish-status, men navneændringen, der udløste det — præcis som du gættede.

## Plan

**1. Gør navnevalidering realistisk (`supabase/functions/webflow-sync/index.ts`)**
- Normalisér navnet før validering: erstat hårde mellemrum (`\u00A0`, `\u202F`) med almindelige, og kollaps dobbelte mellemrum.
- Udvid mønsteret til at tillade alle Unicode-bogstaver og tal (`\p{L}\p{N}`) plus mellemrum, bindestreg, apostrof, punktum, komma, `&`, `/` og parenteser. Det dækker titler, mellemnavne og udenlandske tegn.
- Behold længdegrænserne (1–100 tegn) og e-mailvalideringen uændret.

**2. Sikkerhedsnet: valideringsfejl må aldrig deaktivere en bruger**
- Opsaml e-mails fra items, der fejler validering (men hvor e-mailen kan læses), i et separat `skippedEmails`-sæt.
- Ekskludér disse fra deaktiverings-/sletningsloopet, så en fremtidig valideringsfejl kun logges — aldrig fører til at en aktiv medarbejder fjernes.
- Hvis en e-mail slet ikke kan læses fra item'et, logges fejlen som i dag.

**3. Bedre synlighed i admin-UI'et**
- I `WebflowSyncSettings.tsx`: vis antal sprungne items tydeligt i toasten efter synk (i dag vises kun tilføjet/opdateret/fjernet), så en valideringsfejl ikke går ubemærket hen.

**4. Genoprettelse af data**
- Majas profil står allerede som aktiv igen i databasen, så der er intet at rette der. Den anden fejlende post (`68ee4313bb15da9c1d753625`) tjekkes efter kodeændringen ved en ny synk.

## Teknisk note

Regex-ændringen kræver `u`-flaget for at `\p{L}` virker i Deno/V8. Ingen databaseændringer er nødvendige; edge-funktionen deployes automatisk.
