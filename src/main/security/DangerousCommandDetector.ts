export class DangerousCommandDetector {
  /**
   * 패턴 설명:
   * - rm -rf /  또는  rm -rf /*  → 루트 삭제. "/tmp/xxx" 등은 허용
   * - dd if=... of=/dev/... → 디스크 직접 쓰기
   * - mkfs.* → 파일시스템 포맷
   * - fork bomb :(){ :|:& };:
   * - shutdown / reboot / poweroff → 명령어로 시작하는 경우만
   * - format C: → 명령어로 시작하는 경우만 (echo format C: 는 허용)
   * - del /s /q C:\ → Windows 루트 삭제
   *
   * ⚠️ 중요: 경로가 정확히 "/" 또는 "/*" 인 경우만 rm 차단.
   *    "/tmp/test" 등 하위 경로는 허용.
   */
  private static DANGEROUS_PATTERNS = [
    // rm -rf / 또는 rm -fr / (정확히 루트만, 뒤에 더 이상 경로 없음)
    /^\s*(?:sudo\s+)?rm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*\s+\/\s*(?:\*\s*)?(?:;|&&|\|\||$)/i,
    /^\s*(?:sudo\s+)?rm\s+(?:-[a-zA-Z]*\s+)*-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*\s+\/\s*(?:\*\s*)?(?:;|&&|\|\||$)/i,
    // dd of=/dev/...
    /^\s*dd\s+if=.*of=\/dev\/.*/i,
    // mkfs
    /^\s*mkfs\.[a-zA-Z0-9]+/i,
    // fork bomb
    /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;:/,
    // shutdown/reboot/poweroff (명령어 앞에만)
    /^\s*shutdown\s+(?:now|-h|-r)/i,
    /^\s*reboot(?:\s|$)/i,
    /^\s*poweroff(?:\s|$)/i,
    // Windows: format C: (명령어 앞에만)
    /^\s*format\s+[C-Zc-z]:/i,
    // Windows: del /s /q C:\
    /^\s*del\s+\/s\s+\/q\s+[C-Zc-z]:\\/i
  ]

  static isDangerous(command: string): boolean {
    const trimmed = command.trim()
    return this.DANGEROUS_PATTERNS.some((pattern) => pattern.test(trimmed))
  }
}
