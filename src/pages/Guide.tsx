import { CheckCircle2, Mail, Link2, UserPlus, LogIn, Calendar, UtensilsCrossed, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    icon: Mail,
    title: "1. Modtag invitation",
    description: "Du modtager en e-mail med en invitation til frokostordningen.",
    details: [
      "E-mailen indeholder et unikt invitationslink",
      "Linket er gyldigt i en begrænset periode",
      "Klik på linket i e-mailen for at komme videre"
    ]
  },
  {
    icon: Link2,
    title: "2. Klik på invitationslinket",
    description: "Linket logger dig automatisk ind — du skal ikke vælge en adgangskode.",
    details: [
      "Linket virker i 7 dage",
      "Du sendes direkte til frokostkalenderen",
      "Bed administratoren om et nyt link, hvis det er udløbet"
    ]
  },
  {
    icon: LogIn,
    title: "3. Log ind senere med en kode",
    description: "Næste gang du skal logge ind, bruger du en 8-cifret kode sendt til din e-mail.",
    details: [
      "Indtast din e-mail på forsiden",
      "Tjek din indbakke for koden",
      "Skriv koden ind for at logge ind"
    ]
  },
  {
    icon: Calendar,
    title: "5. Se frokostkalenderen",
    description: "Kalenderen viser alle kommende frokostdage.",
    details: [
      "Grønne dage: Du er tilmeldt",
      "Grå dage: Du er ikke tilmeldt",
      "Røde dage: Køkkenet er lukket",
      "Klik på en dag for at tilmelde dig"
    ]
  },
  {
    icon: UtensilsCrossed,
    title: "6. Tilmeld dig frokost",
    description: "Klik på en dag for at tilmelde eller afmelde dig.",
    details: [
      "Vælg om du tager gæster med",
      "Angiv eventuelle kostbehov (vegetar, laktosefri, glutenfri)",
      "Din tilmelding gemmes automatisk",
      "Du kan ændre din tilmelding indtil dagen før"
    ]
  }
];

const Guide = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">Brugervejledning</h1>
          <p className="text-muted-foreground mt-1">
            Sådan kommer du i gang med frokostordningen
          </p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              Velkommen til frokostordningen
            </CardTitle>
            <CardDescription>
              Denne guide viser dig trin-for-trin, hvordan du kommer i gang med at bruge 
              frokostsystemet – fra du modtager din invitation, til du er tilmeldt din første frokost.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={index} className="relative">
              <Card className="transition-all hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    {step.title}
                  </CardTitle>
                  <CardDescription className="ml-13 pl-[52px]">
                    {step.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pl-[76px]">
                  <ul className="space-y-2">
                    {step.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="h-4 w-4 mt-0.5 text-primary/60 shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              
              {index < steps.length - 1 && (
                <div className="absolute left-[39px] top-full h-6 w-0.5 bg-border" />
              )}
            </div>
          ))}
        </div>

        <Card className="mt-8 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">Har du brug for hjælp?</CardTitle>
            <CardDescription>
              Kontakt din administrator, hvis du oplever problemer med tilmelding eller 
              har spørgsmål til frokostordningen.
            </CardDescription>
          </CardHeader>
        </Card>
      </main>
    </div>
  );
};

export default Guide;
