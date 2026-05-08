/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as invitation } from './invitation.tsx'
import { template as manualReminder } from './manual-reminder.tsx'
import { template as weeklyReminder } from './weekly-reminder.tsx'
import { template as passwordReset } from './password-reset.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'invitation': invitation,
  'manual-reminder': manualReminder,
  'weekly-reminder': weeklyReminder,
  'password-reset': passwordReset,
}
