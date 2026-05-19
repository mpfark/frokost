/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  token?: string
  confirmationUrl?: string
}

export const MagicLinkEmail = ({ token }: MagicLinkEmailProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Din login-kode til Plusfrokost</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🍽 Plusfrokost</Text>
        <Heading style={h1}>Din login-kode</Heading>
        <Text style={text}>
          Indtast koden herunder i login-skærmen for at logge ind på Plusfrokost.
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Koden udløber kort efter. Hvis du ikke har anmodet om dette, kan du roligt ignorere denne e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { padding: '20px 25px' }
const brand = {
  fontSize: '18px',
  fontWeight: 'bold' as const,
  color: '#b84f05',
  margin: '0 0 24px',
}
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#2c2421',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#7c716a',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const codeStyle = {
  fontFamily: 'Courier, monospace',
  fontSize: '32px',
  fontWeight: 'bold' as const,
  color: '#b84f05',
  margin: '0 0 30px',
  letterSpacing: '6px',
  textAlign: 'center' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
