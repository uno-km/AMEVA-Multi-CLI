export class DangerousCommandDetector {
  private static DANGEROUS_PATTERNS = [
    /^\s*rm\s+-rf\s+\/(\*|\s|$)/i,
    /^\s*sudo\s+rm\s+-rf\s+\/(\*|\s|$)/i,
    /^\s*dd\s+if=.*of=\/dev\/.*/i,
    /^\s*mkfs\..+/i,
    /:\(\)\{\s*:\|:&\s*\};:/i,
    /^\s*shutdown\s+(now|-h)/i,
    /^\s*reboot/i,
    /^\s*poweroff/i,
    /^\s*format\s+[C-Z]:/i,
    /^\s*del\s+\/s\s+\/q\s+[C-Z]:\\/i
  ]

  static isDangerous(command: string): boolean {
    const trimmed = command.trim()
    return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(trimmed))
  }
}
