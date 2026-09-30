export function newId(): string {
  return Bun.randomUUIDv7()
}

export function randomToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return Buffer.from(buffer).toString('base64url')
}

export function sha256(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

export function randomDigits(length: number): string {
  const buffer = new Uint32Array(length)
  crypto.getRandomValues(buffer)
  return Array.from(buffer, (n) => String(n % 10)).join('')
}
