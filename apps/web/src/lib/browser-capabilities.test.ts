/// <reference types="bun" />
import { expect, test } from 'bun:test'
import { featureAvailability } from './browser-capabilities'

test('distinguishes insecure pages from unsupported browsers and trusted localhost', () => {
  expect(featureAvailability(false, false)).toBe('https-required')
  expect(featureAvailability(false, true)).toBe('https-required')
  expect(featureAvailability(true, false)).toBe('unsupported')
  expect(featureAvailability(true, true)).toBe('available')
})
