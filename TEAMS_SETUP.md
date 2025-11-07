# Microsoft Teams Integration Setup Guide

Your Office Lunch app is now configured for Microsoft Teams! Follow these steps to add it to Teams.

## 📋 Prerequisites

1. Access to a Microsoft 365 tenant with Teams
2. Permissions to upload custom apps (ask your Teams admin if unsure)
3. Your deployed app URL (e.g., `https://your-app.lovable.app`)

## 🔧 Configuration Steps

### Step 1: Update the Manifest File

1. Open `public/teams-manifest.json`
2. Replace the following placeholders with your actual values:
   - `"Your Company Name"` → Your organization name
   - `https://your-app-url.lovable.app` → Your deployed Lovable app URL (in ALL locations)
   - `"YOUR_AZURE_APP_CLIENT_ID"` → Your Azure AD app registration client ID (see Step 2)

### Step 2: Set Up Azure AD App Registration (for SSO)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - **Name**: Office Lunch App
   - **Supported account types**: Accounts in this organizational directory only
   - **Redirect URI**: Web → `https://your-app-url.lovable.app/auth/callback`
4. After creation, copy the **Application (client) ID**
5. Go to **API permissions** → **Add a permission**:
   - Microsoft Graph → Delegated permissions
   - Add: `User.Read`, `email`, `openid`, `profile`
6. Go to **Expose an API**:
   - Set Application ID URI: `api://your-app-url.lovable.app/{client-id}`
   - Add scope: `access_as_user`
7. Go to **Authentication**:
   - Enable "ID tokens" under Implicit grant
8. Update the `webApplicationInfo` section in `teams-manifest.json` with your client ID

### Step 3: Create the Teams App Package

1. Create a folder called `teams-app-package`
2. Copy these files into it:
   - `public/teams-manifest.json` → rename to `manifest.json`
   - `public/teams-color-icon.png`
   - `public/teams-outline-icon.png`
3. Create a ZIP file containing these 3 files (compress the files directly, not the folder)
4. Name it `OfficeLunch.zip`

### Step 4: Upload to Teams

#### For Personal Use:
1. Open Microsoft Teams
2. Click **Apps** in the left sidebar
3. Click **Manage your apps** (bottom left)
4. Click **Upload an app** → **Upload a custom app**
5. Select your `OfficeLunch.zip` file
6. Click **Add** to install

#### For Team/Channel:
1. Open Microsoft Teams
2. Navigate to your desired team
3. Click the **+** tab button at the top
4. Search for "Office Lunch" (if uploaded to org catalog)
5. Or use **Manage your apps** → **Upload a custom app** for the team

### Step 5: Configure Backend for Teams

The app already detects when it's running in Teams and adjusts the UI accordingly:
- Hides the header when in Teams (Teams provides its own header)
- Supports Teams theme detection
- Ready for Teams SSO (requires Azure AD setup)

## 🧪 Testing

1. After adding the app, click on it to open
2. You should see the Office Lunch interface
3. Sign in with your credentials (SSO can be added later)
4. Test all features: calendar view, guest management, kitchen view

## 🔒 Authentication Options

### Current: Standard Email/Password
The app currently uses standard authentication. Users will sign in normally.

### Optional: Teams SSO
To enable seamless Teams SSO:
1. Complete Azure AD app registration (Step 2)
2. Update the authentication flow in `src/components/AuthForm.tsx` to use Teams token
3. Configure Supabase to accept Azure AD tokens

## 📝 Important Notes

- **Valid Domains**: Ensure your Lovable app URL and Supabase URL are in the `validDomains` array
- **Icons**: The generated icons are 512x512. You may want to resize them:
  - Color icon: recommended 192x192
  - Outline icon: recommended 32x32
- **Privacy & Terms**: Create privacy policy and terms of use pages and update URLs in manifest

## 🐛 Troubleshooting

### App won't load in Teams
- Check that all URLs in manifest match your deployed app
- Verify valid domains include both app and Supabase URLs
- Check browser console for CORS errors

### Authentication issues
- Ensure Supabase redirect URLs include your Teams URLs
- Check Azure AD app registration permissions
- Verify the Teams context detection is working

### Upload fails
- Ensure ZIP contains only the 3 required files (not a folder)
- Validate manifest using [Teams App Validator](https://dev.teams.microsoft.com/appvalidation.html)
- Check that icon files are correctly named and sized

## 📚 Resources

- [Microsoft Teams App Documentation](https://docs.microsoft.com/en-us/microsoftteams/platform/)
- [Teams Manifest Schema](https://docs.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Teams App Validator](https://dev.teams.microsoft.com/appvalidation.html)

## 🚀 Next Steps

1. Deploy your Lovable app if you haven't already
2. Update the manifest with your real URLs
3. Create the app package ZIP
4. Upload to Teams and test!

For SSO integration, additional Azure AD configuration will be required. Let me know if you'd like help setting that up!
