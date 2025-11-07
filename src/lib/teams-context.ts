/**
 * Microsoft Teams context detection and SSO utilities
 */

export interface TeamsContext {
  isInTeams: boolean;
  theme?: 'default' | 'dark' | 'contrast';
  userObjectId?: string;
  userPrincipalName?: string;
  tid?: string;
}

/**
 * Detect if the app is running inside Microsoft Teams
 */
export const detectTeamsContext = (): boolean => {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('context') === 'teams' || 
         window.name === 'embedded-page-container' ||
         window.parent !== window;
};

/**
 * Initialize Microsoft Teams SDK if available
 */
export const initializeTeams = async (): Promise<TeamsContext> => {
  const isInTeams = detectTeamsContext();
  
  if (!isInTeams) {
    return { isInTeams: false };
  }

  // Check if Teams SDK is loaded
  if (typeof window !== 'undefined' && (window as any).microsoftTeams) {
    return new Promise((resolve) => {
      const teamsSDK = (window as any).microsoftTeams;
      
      teamsSDK.app.initialize().then(() => {
        teamsSDK.app.getContext().then((context: any) => {
          resolve({
            isInTeams: true,
            theme: context.app.theme,
            userObjectId: context.user?.id,
            userPrincipalName: context.user?.userPrincipalName,
            tid: context.user?.tenant?.id,
          });
        });
      });
    });
  }

  return { isInTeams: true };
};

/**
 * Get Teams SSO token
 */
export const getTeamsAuthToken = async (): Promise<string | null> => {
  if (typeof window === 'undefined' || !(window as any).microsoftTeams) {
    return null;
  }

  try {
    const teamsSDK = (window as any).microsoftTeams;
    await teamsSDK.app.initialize();
    
    const token = await teamsSDK.authentication.getAuthToken({
      resources: ['https://graph.microsoft.com'],
      silent: false,
    });
    
    return token;
  } catch (error) {
    console.error('Failed to get Teams auth token:', error);
    return null;
  }
};

/**
 * Validate Teams token with backend and get Supabase session
 */
export const validateTeamsToken = async (token: string): Promise<any> => {
  const response = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-teams-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ token }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to validate Teams token');
  }

  return response.json();
};