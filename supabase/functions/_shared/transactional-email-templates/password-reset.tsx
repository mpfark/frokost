/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Plusfrokost'

interface PasswordResetProps {
  userName?: string
}

const PasswordResetEmail = ({ userName = 'bruger' }: PasswordResetProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Din adgangskode er blevet nulstillet</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🍽 {SITE_NAME}</Text>
        <Heading style={h1}>Adgangskode nulstillet</Heading>
        <Text style={text}>Hej {userName},</Text>
        <Text style={text}>
          En administrator har nulstillet din adgangskode. Du vil modtage en separat e-mail med et link til at oprette en ny adgangskode.
        </Text>
        <Text style={text}>
          Hvis du ikke har anmodet om dette, kan du kontakte en administrator.
        </Text>
        <Text style={footer}>
          Denne e-mail blev sendt automatisk fra {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordResetEmail,
  subject: 'Din adgangskode er blevet nulstillet',
  displayName: 'Adgangskode nulstillet',
  previewData: { userName: 'Anders Hansen' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '20px 25px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#b84f05', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2c2421', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#7c716a', lineHeight: '1.6', margin: '0 0 16px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
