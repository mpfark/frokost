import { ArrowLeft, Share, Plus, MoreVertical, Download, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Install = () => {
  return (
    <div className="bg-background">
      <main className="app-content">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />
          Tilbage til appen
        </Link>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Installer Plusfrokost</h1>
          <p className="text-muted-foreground">
            Installer appen på din telefon for nem adgang
          </p>
        </div>

        <Tabs defaultValue="iphone" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="iphone">iPhone</TabsTrigger>
            <TabsTrigger value="android">Android</TabsTrigger>
          </TabsList>

          <TabsContent value="iphone">
            <Card>
              <CardHeader>
                <CardTitle>Installer på iPhone</CardTitle>
                <CardDescription>
                  Følg disse trin i Safari-browseren
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Åbn Safari</h3>
                    <p className="text-sm text-muted-foreground">
                      Appen skal åbnes i Safari-browseren. Hvis du bruger en anden browser, kopier linket og åbn det i Safari.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Tryk på Del-knappen</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Find del-ikonet nederst i Safari (en firkant med en pil der peger opad).
                    </p>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-muted">
                      <Share className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Vælg &quot;Føj til hjemmeskærm&quot;</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Scroll ned i menuen og find muligheden &quot;Føj til hjemmeskærm&quot;.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground">
                      <Plus className="h-5 w-5" />
                      <span className="text-sm">Føj til hjemmeskærm</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Bekræft installationen</h3>
                    <p className="text-sm text-muted-foreground">
                      Tryk &quot;Tilføj&quot; øverst til højre. Appen vil nu blive vist på din hjemmeskærm!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="android">
            <Card>
              <CardHeader>
                <CardTitle>Installer på Android</CardTitle>
                <CardDescription>
                  Følg disse trin i Chrome-browseren
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Åbn Chrome</h3>
                    <p className="text-sm text-muted-foreground">
                      Appen fungerer bedst i Chrome-browseren. Åbn denne side i Chrome, hvis du bruger en anden browser.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Tryk på menuknappen</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Find de tre prikker øverst til højre i Chrome.
                    </p>
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-muted">
                      <MoreVertical className="h-6 w-6 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Vælg &quot;Installer app&quot; eller &quot;Føj til startskærm&quot;</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Find muligheden i menuen. Den kan også vises som en popup nederst på skærmen.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground">
                      <Download className="h-5 w-5" />
                      <span className="text-sm">Installer app</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">Bekræft installationen</h3>
                    <p className="text-sm text-muted-foreground">
                      Tryk &quot;Installer&quot; i dialogen der vises. Appen vil nu være tilgængelig i din app-skuffe!
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link to="/">Tilbage til appen</Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Install;