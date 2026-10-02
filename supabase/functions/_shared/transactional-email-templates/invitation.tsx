/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Plusfrokost'

interface InvitationProps {
  adminName?: string
  inviteLink?: string
}

const InvitationEmail = ({ adminName = 'En administrator', inviteLink = '#' }: InvitationProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Du er inviteret til {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Text style={brand}>🍽 {SITE_NAME}</Text>
        </Section>
        <Heading style={h1}>Du er inviteret!</Heading>
        <Text style={text}>Hej!</Text>
        <Text style={text}>
          {adminName} har inviteret dig til at bruge <strong>{SITE_NAME}</strong> — vores frokost tilmeldingssystem.
        </Text>
        <Text style={text}>
          Åbn Plusfrokost og vælg Microsoft-login. Brug din Microsoft-arbejdskonto med samme e-mailadresse som denne invitation:
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '30px 0' }}>
          <Button style={button} href={inviteLink}>
            Åbn Microsoft-login
          </Button>
        </Section>
        <Text style={note}>
          <strong>Bemærk:</strong> Invitationen er gyldig i 7 dage. Linket åbner login-siden og logger dig ikke automatisk ind. Kontakt en administrator, hvis du mangler adgang.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          Hvis knappen ikke virker, kan du kopiere dette link og indsætte det i din browser:{' '}
          <Link href={inviteLink} style={link}>{inviteLink}</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvitationEmail,
  subject: `Du er inviteret til ${SITE_NAME}`,
  displayName: 'Invitation',
  previewData: { adminName: 'Anders Hansen', inviteLink: 'https://frokost.pluskontoret.dk/accept-invitation/test-id' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '20px 25px' }
const headerSection = { backgroundColor: 'hsl(25, 95%, 37%)', padding: '24px 30px', borderRadius: '10px 10px 0 0', textAlign: 'center' as const, marginBottom: '0' }
const brand = { fontSize: '22px', fontWeight: 'bold' as const, color: '#ffffff', margin: '0' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(20, 14%, 15%)', margin: '20px 0' }
const text = { fontSize: '14px', color: 'hsl(25, 8%, 45%)', lineHeight: '1.6', margin: '0 0 16px' }
const note = { fontSize: '13px', color: 'hsl(25, 8%, 55%)', lineHeight: '1.5', margin: '0 0 16px' }
const link = { color: 'hsl(25, 95%, 37%)', textDecoration: 'underline', wordBreak: 'break-all' as const }
const button = { backgroundColor: 'hsl(20, 90%, 48%)', color: '#ffffff', fontSize: '14px', fontWeight: '600' as const, borderRadius: '0.75rem', padding: '14px 28px', textDecoration: 'none' }
const hr = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '30px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
