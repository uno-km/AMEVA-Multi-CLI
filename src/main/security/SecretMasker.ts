export class SecretMasker {
  private static MASK = '****'
  private static SECRET_PATTERNS = [
    /(password\s*=\s*)([a-zA-Z0-9_\-]+)/gi,
    /(--password\s+)([a-zA-Z0-9_\-]+)/gi,
    /(-p\s+)([a-zA-Z0-9_\-]+)/gi,
    /(token\s*=\s*)([a-zA-Z0-9_\-]+)/gi,
    /(api_key\s*=\s*)([a-zA-Z0-9_\-]+)/gi,
    /(Authorization:\s*Bearer\s+)([a-zA-Z0-9_\-]+)/gi,
    /(AWS_SECRET_ACCESS_KEY\s*=\s*)([a-zA-Z0-9_\-]+)/gi,
    /(GITHUB_TOKEN\s*=\s*)([a-zA-Z0-9_\-]+)/gi
  ]

  static mask(command: string): string {
    let masked = command
    for (const pattern of this.SECRET_PATTERNS) {
      masked = masked.replace(pattern, `$1${this.MASK}`)
    }
    return masked
  }
}
