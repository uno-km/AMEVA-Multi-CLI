import { test, expect, _electron as electron } from '@playwright/test'
import { join } from 'path'

/**
 * E2E 테스트 - Electron 앱을 직접 실행하여 검증.
 *
 * 실행 방법: npm run test:e2e
 * 사전 조건: npm run build (out 디렉토리 빌드 필요)
 *
 * 참고: CI 환경에서는 XVFB 가상 디스플레이가 필요할 수 있음.
 */

test.describe('AMEVA-Multi-CLI E2E', () => {
  test('앱이 실행되고 탭 바가 보인다', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // 탭 바에 "+" 버튼이 있어야 함
    const newTabBtn = page.locator('button[title="새 탭"]')
    await expect(newTabBtn).toBeVisible({ timeout: 10000 })

    await app.close()
  })

  test('새 탭 버튼 클릭 시 탭이 추가된다', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000) // 터미널 초기화 대기

    const newTabBtn = page.locator('button[title="새 탭"]')
    await newTabBtn.click()

    // 탭이 2개 이상 있어야 함 (닫기 버튼으로 카운트)
    const closeBtns = page.locator('button[title="탭 닫기"]')
    await expect(closeBtns).toHaveCount(2, { timeout: 5000 })

    await app.close()
  })

  test('탭 닫기 시 탭이 제거된다', async () => {
    const app = await electron.launch({
      args: [join(__dirname, '../../out/main/index.js')]
    })

    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // 탭 추가
    await page.locator('button[title="새 탭"]').click()
    await page.waitForTimeout(500)

    // 첫 번째 탭 닫기
    const closeBtns = page.locator('button[title="탭 닫기"]')
    await closeBtns.first().click()

    // 탭이 1개로 돌아와야 함
    await expect(closeBtns).toHaveCount(1, { timeout: 5000 })

    await app.close()
  })
})
