# 배포 가이드 (Room-First Deskterior)

## 1) 운영 토폴로지

- Web: Vercel (`apps/web`)
- API: Railway (`apps/api`)
- Worker: Railway (`apps/worker`)
- DB/Auth/Storage: Supabase

메인 제품 경로는 `빌더 -> 에디터 -> 발행 -> 읽기 전용 뷰어`입니다.

## 2) 서비스 책임

### Web (`apps/web`)
- 룸 빌더/에디터/뷰어/갤러리/커뮤니티 렌더링
- 프로젝트/버전/공유 데이터 API 처리 (`/api/v1/*`)

### API (`apps/api`)
- 자산 생성 작업 enqueue (`POST /v1/assets/generate`)
- 헬스체크 (`GET /v1/health`)

### Worker (`apps/worker`)
- `ASSET_GENERATION` 작업 처리
- 생성 GLB 저장 + asset 레코드 생성

## 3) 배포 환경 변수 최소 세트

### Vercel (`apps/web`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (`sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`, server-only)
- `RAILWAY_API_URL`
- `NEXT_PUBLIC_APP_URL`
- `PROJECT_MEDIA_BUCKET` (선택)

운영 규칙:
- `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_URL`는 Production뿐 아니라 Preview에도 넣어 server route parity를 유지한다.
- Vercel Preview/Production의 `SUPABASE_SERVICE_ROLE_KEY`, `RAILWAY_API_URL`는 반드시 `Sensitive` 환경 변수로 저장한다.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`는 더 이상 legacy JWT `anon` 키를 쓰지 않고 `sb_publishable_...`를 사용한다.
- 호환성을 위해 변수 이름 `SUPABASE_SERVICE_ROLE_KEY`는 유지하지만, 실제 값은 legacy JWT `service_role`가 아니라 `sb_secret_...`를 넣는다.
- `autoExposeSystemEnvs`는 기본값을 `false`로 유지한다. Skew Protection이 꼭 필요한 경우에만 예외적으로 다시 켠다.
- Deployment Protection bypass secret은 최대 1개만 유지하고, 회전 시 즉시 redeploy해서 이전 배포의 bypass 값을 무효화한다.

### Railway API (`apps/api`)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (`sb_publishable_...`)
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`)
- `CORS_ORIGINS`

### Railway Worker (`apps/worker`)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (`sb_secret_...`)
- `ASSET_STORAGE_BUCKET`
- `WORKER_CONCURRENCY`
- `WORKER_POLL_INTERVAL_MS`
- `ASSET_GENERATION_POLL_INTERVAL_MS`
- `ASSET_GENERATION_MAX_POLLS`
- `TRIPOSR_*` 또는 `MESHY_*` provider 키

## 4) 배포 후 검증

```bash
npm --workspace apps/web run qa:primary
E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict
```

Supabase 환경 변수가 있는 환경에서는:

```bash
npm --workspace apps/web run primary:e2e:room-flow:full
```

## 5) Supabase 마이그레이션 실행 런북 (Legacy Cleanup)

대상:
- `supabase/migrations/20260414123000_remove_legacy_floorplan_intake.sql`
- `supabase/migrations/20260414130000_remove_project_versions_floor_plan.sql`

운영 경계:
- Control plane: Web 저장/발행 경로의 `public.create_project_version`, Worker claim 경로의 `public.claim_jobs`
- Data plane: `public.jobs`, `public.project_versions`, `public.projects`, `public.floorplans`, `public.floorplan_results`, `public.floorplan_match_events`, `public.intake_sessions`
- Repo evidence: `apps/web`, `apps/api`, `apps/worker`에는 더 이상 `floorplan`/`intake` 런타임 참조가 없고, 저장 경로는 `customization.sceneDocument` + 4-arg `create_project_version`를 사용하며, worker는 `ASSET_GENERATION`만 claim한다.

사전 조건:
- DB PITR(또는 스냅샷) 복구 가능 상태 확인, restore point 시각 기록
- 운영 트래픽 저점 시간대 확보
- `SUPABASE_DB_URL`(direct Postgres connection) 준비
- 외부 배치/운영 스크립트가 5-arg `create_project_version` 또는 legacy floorplan/intake 테이블을 호출하지 않는지 운영자 확인

### 5.1 사전 점검

1. Worker를 잠시 정지하거나 claim loop를 멈춘다.
2. 에디터 `저장/발행` 경로를 5~10분 maintenance window로 묶는다.
3. 아래 preflight를 실행한다.

```bash
psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_preflight.sql
```

데이터 영향도 확인 SQL:
```sql
do $$
declare
  v_count bigint;
begin
  if to_regclass('public.floorplans') is not null then
    execute 'select count(*) from public.floorplans' into v_count;
    raise notice '[impact] floorplans rows = %', v_count;
  end if;

  if to_regclass('public.floorplan_results') is not null then
    execute 'select count(*) from public.floorplan_results' into v_count;
    raise notice '[impact] floorplan_results rows = %', v_count;
  end if;

  if to_regclass('public.intake_sessions') is not null then
    execute 'select count(*) from public.intake_sessions' into v_count;
    raise notice '[impact] intake_sessions rows = %', v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'jobs'
      and column_name = 'floorplan_id'
  ) then
    execute 'select count(*) from public.jobs where floorplan_id is not null' into v_count;
    raise notice '[impact] jobs.floorplan_id not null rows = %', v_count;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'project_versions'
      and column_name = 'floor_plan'
  ) then
    execute 'select count(*) from public.project_versions where floor_plan is not null and floor_plan <> ''{}''::jsonb' into v_count;
    raise notice '[impact] non-empty project_versions.floor_plan rows = %', v_count;
  end if;
end
$$;
```

선택 백업(권장, step 2 전에만 실행):
```sql
create table if not exists public.backup_project_versions_floor_plan_20260414 as
select id, project_id, version, floor_plan, now() as backed_up_at
from public.project_versions
where floor_plan is not null and floor_plan <> '{}'::jsonb;
```

롤백:
- PITR/snapshot 또는 backup table 준비가 안 되면 여기서 중단
- worker 또는 저장 경로를 drain하지 못하면 여기서 중단

### 5.2 적용 순서 (고정)
1. `20260414123000_remove_legacy_floorplan_intake.sql` 적용
2. step 1 결과 확인
3. `20260414130000_remove_project_versions_floor_plan.sql` 적용
4. 포스트체크 + smoke check
5. worker와 저장/발행 트래픽 재개

적용 이유:
- step 1은 legacy floorplan/intake 객체 제거와 함께 `claim_jobs` 기본값/RLS를 현재 worker 계약으로 맞춘다.
- step 2는 `project_versions.floor_plan`와 구형 5-arg RPC를 제거하므로, 현재 앱이 기대하는 4-arg 저장 경로를 마지막에 고정한다.

예시:
```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414123000_remove_legacy_floorplan_intake.sql
psql "$SUPABASE_DB_URL" -c "select to_regclass('public.floorplans') is null as floorplans_removed, to_regclass('public.intake_sessions') is null as intake_sessions_removed;"
psql "$SUPABASE_DB_URL" -c "select p.proname, pg_get_function_identity_arguments(p.oid) as args from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'claim_jobs';"
psql "$SUPABASE_DB_URL" -f supabase/migrations/20260414130000_remove_project_versions_floor_plan.sql
psql "$SUPABASE_DB_URL" -f supabase/checks/legacy_cleanup_postcheck.sql
```

### 5.3 롤백 전략
- step 1 실패 전:
  - preflight/backup/quiesce 중 하나라도 실패하면 DB 변경 없이 종료
- step 1 부분 실패:
  - `jobs.floorplan_id` 또는 legacy tables가 일부만 제거된 상태라면 즉시 write traffic을 열지 말고 현재 상태를 확인
  - 결정은 둘 중 하나만 허용:
    - 같은 migration file을 재실행해 step 1을 끝까지 맞춘다
    - restore point로 PITR 복구한다
  - drop된 legacy table 데이터는 repo SQL만으로 안전 복원할 수 없으므로 수동 재생성은 금지
- step 1 완료 후 step 2 보류:
  - 현재 runtime은 legacy floorplan/intake 경로를 사용하지 않으므로, step 1 clean 상태에서 종료 후 step 2를 별도 창에 이어갈 수 있다
- step 2 부분 실패:
  - `floor_plan`이 이미 drop되었거나 4-arg RPC만 남은 상태일 수 있으므로 traffic은 계속 차단
  - 같은 migration file 1회 재실행으로 정상화 시도
  - 재실행 후에도 저장/발행 smoke check가 실패하면 PITR 복구
- step 2 완료 후 장애:
  - optional backup table은 `floor_plan` 데이터 확인용일 뿐, 컬럼/RPC/권한 전체 롤백 수단이 아니다
  - production save/publish failure가 나면 DB PITR + 앱 릴리스 동시 롤백을 같은 변경 창에서 수행
- 복구 후 확인:
  - rollback 시 `create_project_version` 호출자와 worker release도 restore point 시점과 맞춰야 한다

### 5.4 완료 기준
- `legacy_cleanup_postcheck.sql`에서 legacy 테이블/컬럼 미존재 확인
- `claim_jobs` 기본 타입이 `ASSET_GENERATION`으로 확인
- `jobs` RLS 정책이 `Jobs are viewable by owner payload`로만 유지
- 웹에서 project save 1회 성공 확인
- worker가 `ASSET_GENERATION` job을 최소 1회 정상 claim 또는 처리 확인
- 웹 품질 게이트(`type-check`, `lint`, `build`) 및 `qa:primary` 재확인
