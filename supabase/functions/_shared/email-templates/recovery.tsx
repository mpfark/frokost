/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Nulstil din adgangskode til Plusfrokost</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🍽 Plusfrokost</Text>
        <Heading style={h1}>Nulstil din adgangskode</Heading>
        <Text style={text}>
          Vi har modtaget en anmodning om at nulstille din adgangskode til Plusfrokost.
          Klik på knappen herunder for at vælge en ny adgangskode.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Nulstil adgangskode
        </Button>
        <Text style={footer}>
          Hvis du ikke har anmodet om nulstilling, kan du roligt ignorere denne e-mail.
          Din adgangskode bliver ikke ændret.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

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
const button = {
  backgroundColor: '#b84f05',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
