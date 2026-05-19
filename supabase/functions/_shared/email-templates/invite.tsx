/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="da" dir="ltr">
    <Head />
    <Preview>Du er inviteret til Plusfrokost</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🍽 Plusfrokost</Text>
        <Heading style={h1}>Du er inviteret</Heading>
        <Text style={text}>
          Du er blevet inviteret til{' '}
          <Link href={siteUrl} style={link}>
            <strong>Plusfrokost</strong>
          </Link>{' '}
          — vores frokost tilmeldingssystem. Klik på knappen herunder for at
          acceptere invitationen og oprette din konto.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Acceptér invitation
        </Button>
        <Text style={footer}>
          Hvis du ikke forventede denne invitation, kan du roligt ignorere denne e-mail.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

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
const link = { color: '#b84f05', textDecoration: 'underline' }
const button = {
  backgroundColor: '#b84f05',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '12px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
