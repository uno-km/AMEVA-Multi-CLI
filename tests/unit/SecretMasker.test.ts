import { describe, it, expect } from 'vitest'
import { SecretMasker } from '../../src/main/security/SecretMasker'

describe('SecretMasker', () => {
  it('--password 플래그를 마스킹한다', () => {
    expect(SecretMasker.mask('mysql -u root --password mysecret')).toBe(
      'mysql -u root --password ****'
    )
    // --password=VALUE 형식도 마스킹 (password= 패턴에 의해)
    expect(SecretMasker.mask('mysql --password=mysecret')).toBe('mysql --password=****')
  })

  it('password=VALUE 형식을 마스킹한다', () => {
    expect(SecretMasker.mask('export password=supersecret')).toBe('export password=****')
    expect(SecretMasker.mask('DB_PASSWORD=abc123 node server.js')).not.toContain('abc123')
  })

  it('Authorization Bearer 토큰을 마스킹한다', () => {
    expect(
      SecretMasker.mask('curl -H "Authorization: Bearer mytoken123" http://api')
    ).toBe('curl -H "Authorization: Bearer ****" http://api')
    // 슬래시 포함 토큰
    expect(
      SecretMasker.mask('Authorization: Bearer abc.def/ghi+jkl')
    ).toBe('Authorization: Bearer ****')
  })

  it('GITHUB_TOKEN을 마스킹한다', () => {
    expect(SecretMasker.mask('export GITHUB_TOKEN=ghp_abc1234xyz')).toBe(
      'export GITHUB_TOKEN=****'
    )
  })

  it('AWS 자격증명을 마스킹한다', () => {
    expect(SecretMasker.mask('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG')).toBe(
      'AWS_SECRET_ACCESS_KEY=****'
    )
    expect(SecretMasker.mask('AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE')).toBe(
      'AWS_ACCESS_KEY_ID=****'
    )
  })

  it('동일한 명령에 여러 패턴이 중복 마스킹되지 않는다 (stateful regex 버그 없음)', () => {
    const cmd = 'token=abc123 password=xyz789'
    const masked = SecretMasker.mask(cmd)
    expect(masked).toContain('token=****')
    expect(masked).toContain('password=****')
    expect(masked).not.toContain('abc123')
    expect(masked).not.toContain('xyz789')
  })

  it('안전한 명령은 변경하지 않는다', () => {
    expect(SecretMasker.mask('echo hello world')).toBe('echo hello world')
    expect(SecretMasker.mask('ls -la /home/user')).toBe('ls -la /home/user')
    expect(SecretMasker.mask('git status')).toBe('git status')
    expect(SecretMasker.mask('npm install')).toBe('npm install')
  })
})
