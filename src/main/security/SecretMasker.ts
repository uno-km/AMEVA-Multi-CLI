export class SecretMasker {
  private static readonly MASK = '****'

  /**
   * 민감 정보 패턴 목록.
   * 각 패턴은 (prefix)(secret_value) 구조로 캡처 그룹을 사용.
   * 두 번째 캡처 그룹($2)을 ****로 교체.
   *
   * 개선 사항:
   * - 토큰/비밀번호 값이 "/" 및 특수문자를 포함할 수 있도록 문자 범위 확장
   * - Authorization Bearer 토큰은 공백 이후 전체를 마스킹
   * - 환경변수 export VARNAME=VALUE 패턴 지원
   */
  private static readonly SECRET_PATTERNS: [RegExp, string][] = [
    // --password VALUE  /  -p VALUE
    [/(--password\s+)([^\s]+)/gi, '$1****'],
    [/(-p\s+)([^\s]+)/gi, '$1****'],
    // password=VALUE  (환경변수, 설정 등)
    [/(password\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    // token=VALUE
    [/(token\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    // api_key=VALUE
    [/(api[_-]?key\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    // Authorization: Bearer TOKEN  (공백, /, - 등 포함 가능)
    [/(Authorization:\s*Bearer\s+)([^\s"']+)/gi, '$1****'],
    // AWS_SECRET_ACCESS_KEY=VALUE
    [/(AWS_SECRET_ACCESS_KEY\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    [/(AWS_ACCESS_KEY_ID\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    // GITHUB_TOKEN=VALUE
    [/(GITHUB_TOKEN\s*=\s*)([^\s&;|]+)/gi, '$1****'],
    // export VARNAME=VALUE (위 패턴으로 잡히지 않는 일반 secret 변수명)
    [/(export\s+(?:SECRET|PRIVATE_KEY|ACCESS_TOKEN|API_TOKEN)\s*=\s*)([^\s&;|]+)/gi, '$1****']
  ]

  static mask(command: string): string {
    let result = command
    for (const [pattern, replacement] of this.SECRET_PATTERNS) {
      // 각 패턴은 stateful regex이므로 lastIndex 초기화 필요
      pattern.lastIndex = 0
      result = result.replace(pattern, replacement)
    }
    return result
  }
}
