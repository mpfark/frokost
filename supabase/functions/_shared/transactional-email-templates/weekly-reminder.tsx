/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Plusfrokost'
const SITE_URL = 'https://frokost.pluskontoret.dk'

interface WeeklyReminderProps {
  userName?: string
  weekNumber?: number
}

const WeeklyReminderEmail = ({ userName = 'kollega', weekNumber }: WeeklyReminderProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Tilmeld dig den kommende uges frokost{weekNumber ? ` (uge ${weekNumber})` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🍽 {SITE_NAME}</Text>
        <Heading style={h1}>Frokost næste uge</Heading>
        <Text style={text}>Hej {userName},</Text>
        <Text style={text}>
          Husk at skriv dig op til den kommende uges frokost{weekNumber ? ` (uge ${weekNumber})` : ''}.
        </Text>
        <Button style={button} href={SITE_URL}>
          Tilmeld dig frokost
        </Button>
        <Text style={footer}>
          Dette er en automatisk påmindelse.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyReminderEmail,
  subject: (data: Record<string, any>) => `Påmindelse: Tilmeld dig frokost${data.weekNumber ? ` (uge ${data.weekNumber})` : ''}`,
  displayName: 'Ugentlig påmindelse',
  previewData: { userName: 'Anders', weekNumber: 42 },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '20px 25px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: 'hsl(25, 95%, 37%)', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(20, 14%, 15%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(25, 8%, 45%)', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: 'hsl(25, 95%, 37%)', color: '#ffffff', fontSize: '14px', borderRadius: '0.75rem', padding: '12px 20px', textDecoration: 'none', margin: '8px 0 24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
