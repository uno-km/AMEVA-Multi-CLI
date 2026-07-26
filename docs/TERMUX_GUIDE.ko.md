# Termux 접속 가이드

안드로이드(Termux) 환경에 PC에서 원격 접속하고 북마크로 관리하는 방법입니다.

## 1. 안드로이드 기기 준비 (Termux 설치 및 SSH 서버 기동)
1. F-Droid나 구글 플레이스토어에서 `Termux`를 설치하고 실행합니다.
2. 다음 명령어로 패키지를 업데이트하고 SSH를 설치합니다:
   ```bash
   pkg update
   pkg install openssh
   ```
3. 비밀번호를 설정합니다:
   ```bash
   passwd
   ```
4. SSH 서버를 백그라운드에서 기동합니다:
   ```bash
   sshd
   ```
5. 기기의 사용자 이름과 IP 주소를 확인합니다:
   ```bash
   whoami
   ifconfig
   ```

## 2. AMEVA-Multi-CLI에서 북마크 등록
1. 사이드바에서 `새 북마크` 버튼을 누릅니다.
2. 타입: `SSH` 선택
3. 커맨드(또는 접속정보): `ssh -p 8022 사용자명@IP주소`
   *(Termux의 기본 SSH 포트는 8022입니다)*
4. 저장 후 더블클릭하여 접속합니다.

## 3. 한글 입력 및 붙여넣기 테스트
정상적으로 접속되었다면 다음을 테스트해보세요.
- 터미널에서 `echo 안녕하세요` 입력
- 복사(`Ctrl+Shift+C`) 후 붙여넣기(`Ctrl+Shift+V`) 동작 확인
