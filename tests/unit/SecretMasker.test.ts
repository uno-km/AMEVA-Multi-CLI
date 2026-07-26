import { describe, it, expect } from 'vitest'
import { SecretMasker } from '../../src/main/security/SecretMasker'

describe('SecretMasker', () => {
  it('should mask passwords', () => {
    expect(SecretMasker.mask('mysql -u root --password mysecret')).toBe('mysql -u root --password ****')
    expect(SecretMasker.mask('export password=supersecret')).toBe('export password=****')
  })

  it('should mask tokens', () => {
    expect(SecretMasker.mask('curl -H "Authorization: Bearer mytoken" http://api')).toBe('curl -H "Authorization: Bearer ****" http://api')
    expect(SecretMasker.mask('export GITHUB_TOKEN=abc1234')).toBe('export GITHUB_TOKEN=****')
  })

  it('should not mask safe commands', () => {
    expect(SecretMasker.mask('echo hello world')).toBe('echo hello world')
  })
})
