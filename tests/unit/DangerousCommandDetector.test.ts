import { describe, it, expect } from 'vitest'
import { DangerousCommandDetector } from '../../src/main/security/DangerousCommandDetector'

describe('DangerousCommandDetector', () => {
  it('rm -rf / 변형을 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous('rm -rf /')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('rm -rf /*')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('sudo rm -rf /')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('rm -fr /')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('  rm -rf /  ')).toBe(true) // 앞뒤 공백
  })

  it('안전한 rm 명령은 허용한다', () => {
    expect(DangerousCommandDetector.isDangerous('rm -rf ./node_modules')).toBe(false)
    expect(DangerousCommandDetector.isDangerous('rm -rf /tmp/test')).toBe(false)
    expect(DangerousCommandDetector.isDangerous('rm file.txt')).toBe(false)
  })

  it('fork bomb을 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous(':(){ :|:& };:')).toBe(true)
  })

  it('format C: 를 감지한다 (명령어 시작인 경우만)', () => {
    expect(DangerousCommandDetector.isDangerous('format C:')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('format c:')).toBe(true)
    // echo 내부의 format C:는 차단하지 않아야 함
    expect(DangerousCommandDetector.isDangerous('echo format C:')).toBe(false)
  })

  it('del /s /q C:\\ 를 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous('del /s /q C:\\')).toBe(true)
  })

  it('shutdown/reboot/poweroff를 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous('shutdown now')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('shutdown -h now')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('reboot')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('poweroff')).toBe(true)
    // 안전한 명령
    expect(DangerousCommandDetector.isDangerous('echo reboot')).toBe(false)
  })

  it('mkfs를 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous('mkfs.ext4 /dev/sda1')).toBe(true)
    expect(DangerousCommandDetector.isDangerous('mkfs.vfat /dev/sdb')).toBe(true)
  })

  it('dd of=/dev/... 를 감지한다', () => {
    expect(DangerousCommandDetector.isDangerous('dd if=/dev/zero of=/dev/sda')).toBe(true)
  })
})
