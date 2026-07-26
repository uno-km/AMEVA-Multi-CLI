# AMEVA-Multi-CLI Security Guidelines

## 핵심 원칙
- **목데이터 사용 금지**: 모든 작업은 실제 Shell 기반입니다. 따라서 보안은 매우 중요합니다.

## 보호 메커니즘
1. **위험 명령 감지기 (Dangerous Command Detector)**
   - `rm -rf /`, `mkfs` 등 시스템 파괴적 명령을 감지하여 경고 또는 차단합니다.
2. **민감 정보 마스킹 (Secret Masking)**
   - API 토큰, 비밀번호 등의 민감한 정보가 History DB에 저장되지 않도록 전처리 마스킹(`****`)을 수행합니다.
3. **Electron 샌드박스**
   - 사용자 웹 콘텐츠를 로드하지 않지만, Renderer 내 XSS 방지를 위해 엄격한 보안을 유지합니다.
4. **로컬 우선**
   - 모든 데이터는 로컬 SQLite에 저장되며 사용자 명시적 동의 없이 외부로 전송되지 않습니다.
