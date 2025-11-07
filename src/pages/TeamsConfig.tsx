import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Teams Tab Configuration Page
 * This page is shown when a user adds the app as a tab in Teams
 */
const TeamsConfig = () => {
  useEffect(() => {
    // Initialize Teams SDK
    if (typeof window !== 'undefined' && (window as any).microsoftTeams) {
      const teamsSDK = (window as any).microsoftTeams;
      
      teamsSDK.app.initialize().then(() => {
        teamsSDK.pages.config.registerOnSaveHandler((saveEvent: any) => {
          teamsSDK.pages.config.setConfig({
            entityId: 'lunch-calendar',
            contentUrl: `${window.location.origin}?context=teams`,
            suggestedDisplayName: 'Office Lunch',
            websiteUrl: window.location.origin,
          });
          saveEvent.notifySuccess();
        });

        // Enable the Save button
        teamsSDK.pages.config.setValidityState(true);
      });
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Configure Office Lunch Tab</CardTitle>
          <CardDescription>
            This will add the Office Lunch calendar to your Teams channel
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            Click the "Save" button below to add the Office Lunch tab to your Teams channel.
            Team members will be able to view and manage lunch signups directly from Teams.
          </p>
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              Features available in Teams:
            </p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• View 3-week lunch calendar</li>
              <li>• Sign up for lunch with guests</li>
              <li>• Manage dietary restrictions</li>
              <li>• Kitchen dashboard view</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamsConfig;