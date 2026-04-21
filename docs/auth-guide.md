# Auth Guide (Supabase OAuth)

DeskteriorOnline는 **@supabase/ssr** 기반으로 쿠키 세션을 동기화합니다.
Google/Kakao OAuth는 `/auth/callback` 서버 라우트에서 세션을 교환합니다.

## 필수 환경 변수

`apps/web/.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
```

- 로컬 개발 기본값: `NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100`
- Vercel Production: `NEXT_PUBLIC_APP_URL=https://deskterioronline.vercel.app`
- Vercel Preview는 보통 **비워둡니다.**
  - 이유: preview마다 URL이 달라지므로 production canonical host로 강제하면 OAuth 시작/콜백 host가 어긋날 수 있습니다.

## Supabase 설정 순서

1) Supabase 프로젝트 생성
2) Authentication → URL Configuration
   - Site URL: **현재 실제 로그인 시작 도메인**으로 설정
     - 로컬 개발 기본값: `http://127.0.0.1:3100`
     - Vercel 운영 예시: `https://deskterioronline.vercel.app`
   - Redirect URLs:
     - `http://127.0.0.1:3100/auth/callback`
     - `https://<your-domain>/auth/callback`
     - (선택) `https://<your-domain>/*`
     - (선택) Vercel Preview를 쓸 경우 해당 Preview 도메인 `/auth/callback`도 추가
3) Authentication → Providers
   - Google / Kakao 활성화 후 Client ID/Secret 입력

### Vercel만 배포한 상태에서 localhost로 튀는 경우 (즉시 해결)

- 증상: Vercel 도메인에서 로그인했는데 `localhost:3000` 또는 로컬로 리다이렉트됨
- 원인: Supabase `Site URL` / `Redirect URLs`가 로컬 값으로 남아 fallback 발생
- 조치:
  1) `Site URL`을 운영 도메인으로 변경 (예: `https://deskterioronline.vercel.app`)
  2) `Redirect URLs`에 운영 콜백 추가
     - `https://deskterioronline.vercel.app/auth/callback`
  3) 저장 후 브라우저 쿠키 삭제 또는 시크릿 창에서 재로그인
  4) 로그인 시작한 도메인과 콜백 도메인이 일치하는지 확인

### "PKCE code verifier not found in storage"가 Production에서 반복될 때

- 가장 흔한 원인: **OAuth 시작 host와 callback host가 서로 다름**
  - 예: `deskterioronline.vercel.app`에서 로그인 시작 -> Supabase fallback/site URL 또는 다른 Vercel alias로 callback 복귀
- 확인 항목:
  1) Vercel Production 환경 변수 `NEXT_PUBLIC_APP_URL=https://deskterioronline.vercel.app`
  2) Supabase `Site URL=https://deskterioronline.vercel.app`
  3) Supabase `Redirect URLs`에 `https://deskterioronline.vercel.app/auth/callback` 추가
  4) 실제 로그인도 반드시 `https://deskterioronline.vercel.app`에서 시작
  5) 예전 `sb-*` 쿠키가 남아 있으면 삭제 후 재시도

## Google OAuth 설정

- Google Cloud Console에서 OAuth Client 생성
- **Authorized redirect URI**는 Supabase 콜백을 사용:
  - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- **Authorized JavaScript origins**:
  - `http://127.0.0.1:3100`
  - `https://<your-domain>`

### Google만 실패하고 Kakao는 성공할 때

- 가장 흔한 원인: **로컬 origin 불일치**
  - 앱은 `http://127.0.0.1:3100` 기준으로 실행/문서화돼 있는데, 브라우저에서 `http://localhost:3100`으로 열면 Google OAuth origin 검증에 실패할 수 있습니다.
  - Kakao는 Supabase 콜백 기준으로 동작해서 이 문제가 덜 드러날 수 있습니다.
- 확인 항목:
  1) 브라우저 주소가 `http://127.0.0.1:3100`인지 확인
  2) `apps/web/.env.local`의 `NEXT_PUBLIC_APP_URL`이 `http://127.0.0.1:3100`인지 확인
  3) Google Cloud Console `Authorized JavaScript origins`에 `http://127.0.0.1:3100`와 필요 시 `http://localhost:3100` 둘 다 등록
  4) Supabase Auth `Site URL` / `Redirect URLs`에도 실제 로그인 시작 도메인을 맞춤

- 현재 앱 동작:
  - 로컬에서 `localhost`로 진입해도 `NEXT_PUBLIC_APP_URL`이 loopback canonical origin(`127.0.0.1`)으로 설정돼 있으면 그 주소로 정규화한 뒤 OAuth를 시작합니다.
  - 콜백 실패 시 provider 에러 설명을 `auth_message`로 전달해 토스트에 노출합니다.

## Kakao OAuth 설정

- Kakao Developers에서 앱 생성
- Redirect URI:
  - `https://<your-supabase-project>.supabase.co/auth/v1/callback`
- Kakao에서 받은 Client ID/Secret을 Supabase Provider 설정에 입력
- Kakao Redirect URI에는 `localhost`가 아니라 **Supabase 콜백 URL**을 사용합니다.

## 콜백 라우트

- 서버 라우트: `apps/web/src/app/auth/callback/route.ts`
- 처리 흐름:
  1) `code` 수신
  2) `exchangeCodeForSession` 실행
  3) 쿠키 동기화 후 `?auth=success` 리다이렉트
  4) `Providers`에서 토스트 표시
  5) 콜백 실패 시 기존 `sb-*` 인증 쿠키를 정리하고 `?auth=error`로 복귀

## 흔한 오류 & 해결

### "PKCE code verifier not found"

- `@supabase/ssr` 사용 여부 확인
- OAuth 시작/콜백 모두 동일 도메인인지 확인
- `/auth/callback` 라우트 존재 확인
- 브라우저 쿠키 차단 여부 확인
- 캐시 정리 후 재시작:

```bash
rm -rf apps/web/.next
npm run dev:web
```

### "Invalid Refresh Token: Refresh Token Not Found"

- 증상:
  - 콘솔에 `AuthApiError: Invalid Refresh Token`
  - 로그인 후에도 세션이 올라오지 않음
- 원인:
  - 브라우저에 남아 있는 오래된 `sb-*` 세션 쿠키/스토리지가 현재 Supabase 세션과 불일치
- 현재 동작:
  - 클라이언트 초기화 시 recoverable refresh-token 오류를 감지하면 로컬 세션을 자동 정리
  - `/auth/callback`에서 세션 교환 실패 시 기존 `sb-*` 쿠키를 즉시 삭제
- 수동 확인 방법:
  1) 시크릿 창에서 재로그인
  2) 일반 창이라면 `Application/Storage`의 Supabase 관련 쿠키와 스토리지를 삭제 후 재시도
  3) 동일 증상이 반복되면 Supabase Auth URL 설정과 provider redirect URI를 다시 확인
