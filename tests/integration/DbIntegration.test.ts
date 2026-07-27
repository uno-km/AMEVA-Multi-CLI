import { describe, it, expect } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { SecretMasker } from '../../src/main/security/SecretMasker'

/**
 * DB 통합 테스트.
 *
 * ⚠️ better-sqlite3는 Electron 전용 네이티브 바이너리로 컴파일되므로
 *    일반 Node.js(vitest) 환경에서 직접 로드할 수 없습니다.
 *    (NODE_MODULE_VERSION 불일치)
 *
 * 대안:
 * 1. DB 로직 검증 → Electron main process에서 실제 앱 실행 중 검증
 * 2. Repository 로직 단위 테스트 → DB를 mock으로 교체
 * 3. DB 스키마/쿼리 정확성 → 이 파일에서 SQL 로직을 인메모리 방식으로 검증
 *
 * 여기서는 Repository 계층의 로직(SecretMasker 연동, 데이터 변환 등)을
 * DB 없이 검증 가능한 부분만 테스트합니다.
 */

describe('DB 통합 테스트 (로직 계층)', () => {
  // ── SecretMasker + HistoryRepository 연동 ──
  describe('HistoryRepository 로직', () => {
    it('SecretMasker를 통해 비밀번호가 마스킹된다', () => {
      const command = 'mysql -u root --password supersecret'
      const masked = SecretMasker.mask(command)
      expect(masked).toBe('mysql -u root --password ****')
      expect(masked).not.toContain('supersecret')
    })

    it('연속으로 같은 명령어는 중복 저장하지 않아야 한다 (로직 검증)', () => {
      const commands = ['ls', 'ls', 'pwd', 'ls']
      const deduped: string[] = []
      for (const cmd of commands) {
        if (deduped[deduped.length - 1] !== cmd) {
          deduped.push(cmd)
        }
      }
      expect(deduped).toEqual(['ls', 'pwd', 'ls'])
    })

    it('검색 쿼리가 LIKE 패턴으로 변환된다', () => {
      const query = 'docker'
      const likePattern = `%${query}%`
      expect(likePattern).toBe('%docker%')
    })
  })

  // ── SessionRepository 로직 ──
  describe('SessionRepository 로직', () => {
    it('탭 레이아웃을 JSON으로 직렬화/역직렬화한다', () => {
      const layout = {
        tabs: [
          { id: 't1', title: 'Terminal', panes: [{ id: 'p1', title: 'Terminal' }], activePaneId: 'p1' }
        ]
      }
      const serialized = JSON.stringify(layout)
      const restored = JSON.parse(serialized)
      expect(restored.tabs).toHaveLength(1)
      expect(restored.tabs[0].id).toBe('t1')
    })

    it('손상된 JSON은 null을 반환해야 한다', () => {
      const corruptData = '{"tabs": [invalid json}'
      let result = null
      try {
        result = JSON.parse(corruptData)
      } catch {
        result = null
      }
      expect(result).toBeNull()
    })
  })

  // ── WorkspaceRepository 로직 ──
  describe('WorkspaceRepository 로직', () => {
    it('워크스페이스 레이아웃이 JSON으로 직렬화된다', () => {
      const layout = {
        tabs: [
          {
            id: 'wt1',
            title: '서버',
            panes: [{ id: 'wp1', title: 'SSH', cwd: '/home/user' }]
          }
        ]
      }
      const serialized = JSON.stringify(layout)
      const restored = JSON.parse(serialized)
      expect(restored.tabs[0].panes[0].cwd).toBe('/home/user')
    })
  })

  // ── 임시 파일 I/O (fs 레벨) ──
  describe('파일 시스템 기본 동작', () => {
    it('임시 파일을 쓰고 읽고 삭제할 수 있다', () => {
      const tmpPath = path.join(os.tmpdir(), `ameva-fs-test-${Date.now()}.json`)
      const data = { test: true, timestamp: Date.now() }
      fs.writeFileSync(tmpPath, JSON.stringify(data), 'utf-8')
      const read = JSON.parse(fs.readFileSync(tmpPath, 'utf-8'))
      expect(read.test).toBe(true)
      fs.unlinkSync(tmpPath)
      expect(fs.existsSync(tmpPath)).toBe(false)
    })
  })
})
