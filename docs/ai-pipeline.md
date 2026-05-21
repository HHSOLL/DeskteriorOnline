# AI Pipeline (Deskterior)

이 문서는 현재 제품에서 사용하는 AI 경계를 정의합니다.

## 현재 운영 경계
- 메인 제품 파이프라인은 **room builder -> deskterior 편집 -> 공유/커뮤니티 조회**입니다.
- 구조 인식 기반 floorplan 분석은 제품 경계에서 제거되었습니다.

## 활성 AI 경로
1. `POST /api/v1/assets/generate`로 이미지 기반 3D 자산 생성 job enqueue
2. worker가 `ASSET_GENERATION` job 처리
3. 생성된 GLB를 Supabase storage에 저장하고 자산 레코드 생성
4. 에디터에서 커스텀 자산으로 배치 가능
5. `POST /api/v1/product-assets/generate`로 상품 URL 기반 private asset 생성 job enqueue
6. worker가 `PRODUCT_ASSET_GENERATION` job에서 URL reference pack, reference image 후보, provider 후보 GLB, Blender finalizer, candidate evaluator, private asset metadata를 묶어 처리

## 품질 규칙
- 생성 자산은 GLB 단일 포맷으로 저장한다.
- 생성 실패는 `retrying -> failed/dead_letter` 상태로 명확히 노출한다.
- 생성형 결과는 운영 카탈로그를 대체하지 않고 보조 입력으로 취급한다.
- 상품 URL generated asset은 provider 원본 GLB를 그대로 등록하지 않고, 가능하면 Blender finalizer로 pivot/scale/thumbnail/QA report를 만든 뒤 evaluator 점수와 함께 등록한다.
- 운영 카탈로그로 승격할 때는 물리 메타데이터(`dimensionsMm`, `finishColor`, `finishMaterial`, `detailNotes`, `scaleLocked`)를 채운다.
- 실제 브랜드/SKU 제품 최종본에는 이미지 생성 모델 산출물을 사용하지 않는다. 실제 SKU는 제조사 URL, 공식 치수, 정면/측면/상면/디테일 reference, 마감 출처, 라이선스가 있는 `referencePack`을 통과해야 한다.
- 이미지 생성 모델은 비브랜드 generic texture 후보, wall/floor mood exploration, 내부 draft asset 탐색에만 사용한다.
- AI 생성 1K wall/floor texture는 `generic_ai_candidate`로 분류하고, 상용 preset은 2K source + runtime KTX2 + constrained 1K fallback 구조로 승격한다.

## 향후 확장(연구 트랙)
- 텍스트/무드 기반 데스크 배치 추천
- 커뮤니티 장면 임베딩 기반 유사 장면 추천
- Blender 자동 리토폴로지/LOD 제안

## 2026-04-14 변경 동기화 (Floorplan AI Retirement)
Added:
- 자산 생성 중심 AI 경로(`assets/generate` + worker)를 공식 계약으로 명시.

Updated:
- AI 문서를 deskterior 제품 맥락으로 재정의.

Removed/Deprecated:
- semantic parsing -> 2D correction -> procedural 3D floorplan 파이프라인.
- floorplan provider rollout/eval/blind gate 운영 기준.

## 2026-05-01 변경 동기화 (Commercial AI Boundary)
Added:
- 실제 SKU asset 승격 조건을 `referencePack + commercialReadiness + material QA`로 고정한다.
- 생성형 이미지는 운영 카탈로그 확정본이 아니라 candidate texture/draft exploration으로만 기록한다.

Updated:
- 운영 카탈로그 승격 기준을 기본 물리 메타데이터에서 visual fidelity score, dimension tolerance, material QA, release eligibility까지 확장한다.

Removed/Deprecated:
- AI 생성 이미지/텍스처가 실제 제품 동일성의 증거가 될 수 있다는 가정.

## 2026-05-02 변경 동기화 (Commercial Texture Boundary Closure)
Added:
- `verify:commercial-qa`는 commercial wall/floor preset에 AI candidate texture가 0개인지 확인한다.

Updated:
- AI 생성 wall/floor texture는 내부 탐색 후보로만 남고, 기본 commercial preset에는 연결하지 않는다.

Removed/Deprecated:
- AI 1K texture 후보를 paid-beta commercial PBR library에 포함하는 방식.

## 2026-05-11 변경 동기화 (Product URL Reference Pipeline)
Added:
- `asset:analyze-url`을 prototype-only 실제 SKU reference 수집 entrypoint로 추가한다. 제품 URL에서 JSON-LD, Open Graph image, 상세 이미지, option/SKU/manufacturer/price field를 수집하고 `assets/references/product-pages/<assetKey>/reference-pack.json`을 생성한다.
- `verify:product-url-reference`는 FURSYS `ZDQ012J` fixture를 기준으로 SKU/manufacturer/options/dimensions/reference image/material hint/prototype-only legal boundary를 검증한다.

Updated:
- 제품 URL 분석 결과는 실제 제품 동일성의 시작점일 뿐이며, 운영 승격에는 제조사 CAD 또는 사용 허가, 공식 finish swatch, slot-level material QA가 계속 필요하다.
- URL에서 추론한 material hint는 `qaStatus=pending`, `releaseEligible=false`로만 발행한다.

Removed/Deprecated:
- 공개 제품 페이지 이미지 또는 OCR 결과만으로 실제 SKU asset을 release eligible로 보는 방식.

## 2026-05-12 변경 동기화 (Private Product Asset Factory)
Added:
- `asset:factory`를 private/prototype SKU asset production loop의 entrypoint로 추가한다. 입력은 `asset:analyze-url`이 만든 `reference-pack.json`이며, 출력은 `asset-plan.json`, `factory-qa-report.json`, `repair-instructions.json`, `private-catalog-entry.json`, Blender rebuild scaffold다.
- `verify:product-asset-factory`는 FURSYS `ZDQ012J` fixture를 기준으로 reference pack, runtime GLB/proxy, thumbnail, collider/support/material sidecars, private visibility, release blocking, repair loop를 검증한다.

Updated:
- AI/API가 제품 상세 페이지를 분석해도 상용 승격 판단은 자동 통과가 아니라 factory QA report의 `privateUseOnly=true`, `releaseEligible=false`, `commercialStatus`와 repair instruction을 기준으로 한다.
- factory는 개인/테스트용 prototype asset을 빠르게 만들기 위한 반복 루프다. public catalog 또는 paid-beta hero SKU 승격은 별도 licensing/CAD/material QA gate를 통과해야 한다.

Removed/Deprecated:
- 제품 링크 하나를 분석했다는 이유만으로 runtime asset을 상용 노출 가능한 catalog asset으로 취급하는 방식.

## 2026-05-12 변경 동기화 (Private Reference Fidelity Report)
Added:
- Creator/video reference pack factory는 GLB 생성 후 `visual-fidelity-report.json`을 남겨 hero asset별 required signature fragments, matched fragments, object count, model size, prototype status를 기록한다.
- So Ong reference pack의 hero 제품은 monitor screen/card/light bar, HYTE glass/fan/GPU/tube, Epic 5 baffle/driver/LED/spike, AM HATSU split body/key/palm rest, SYNCHRONIZE mat weave/wordmark, Times Gate five-screen body, Stream Deck Neo key/infobar/cable 같은 제품별 signature를 통과해야 한다.

Updated:
- “상품 상세 페이지 분석 -> 에셋 생성” 루프는 링크 요약만으로 종료하지 않고, reference still에서 사용자가 식별하는 제품 고유 실루엣이 GLB object 이름과 preview render에 남는지 확인한다.
- private/prototype asset은 visual signature pass를 통과해도 상용 승격이 아니며, CAD/라이선스/material QA가 붙기 전까지 `releaseEligible=false`와 prototype-only license를 유지한다.

Removed/Deprecated:
- 제품별 고유 요소 없이 generic monitor/keyboard/speaker/box를 배치하고, 파일 존재만으로 reference pack QA를 통과시키는 방식.

## 2026-05-12 변경 동기화 (Runtime Product URL Private Asset Jobs)
Added:
- `POST /api/v1/product-assets/generate`와 API `/v1/product-assets/generate`를 상품 상세 링크 기반 private generated asset entrypoint로 추가한다.
- `PRODUCT_ASSET_GENERATION` job은 `productUrl -> referencePack -> selectedImages -> provider candidates -> private assets row` 순서로 처리한다.
- 에디터 catalog fetch는 static manifest 외에 `GET /api/v1/assets`의 owner-scoped private generated assets를 함께 읽는다.
- `verify:product-asset-generation`는 private visibility, owner-scoped asset listing, worker job routing, URL reference reuse, provider candidate generation, `releaseEligible=false` 메타데이터를 검증한다.

Updated:
- URL 기반 generated asset은 `apps/web/public/assets/catalog/manifest.json`에 쓰지 않고 Supabase `assets` row + `assets-glb` storage path로만 등록한다.
- worker output metadata는 `source.kind=product_url`, `referencePack`, `runtimeAsset.dimensionsMm`, `generation.qualityScore`, `legalUse.mode=private_reference_only`를 유지해야 한다.
- 실제 provider GLB 생성에는 Meshy 또는 TripoSR 환경 변수가 필요하며, provider output은 자동 상용 승인 대신 `auto_approved` 또는 `needs_review` private QA 상태로만 기록한다.

Removed/Deprecated:
- 상품 URL 생성 결과를 curated/static manifest에 직접 추가하는 방식.
- 제품 상세 페이지와 provider output만으로 `releaseEligible=true`를 자동 부여하는 방식.

## 2026-05-12 변경 동기화 (Runtime Candidate Finalizer/Evaluator)
Added:
- `PRODUCT_ASSET_GENERATION` job에 category profile, Blender finalizer, thumbnail generation, dimension QA report, candidate evaluator 단계를 추가한다.
- finalizer는 `BLENDER_BIN`이 설정된 worker에서 `scripts/blender/finalize-product-asset.py`를 실행해 GLB pivot/floor contact/official dimension scale/material names/thumbnail을 정리한다.
- evaluator는 reference image score, model byte size, finalizer status, dimension fit, thumbnail color similarity를 합산해 `qualityScore`와 component evidence를 남긴다.
- monitor/speaker/keyboard/mouse/desk mat/PC case/audio interface/lighting/plant/furniture/decor category profile을 둬 placement metadata와 repair directive를 private asset meta에 저장한다.

Updated:
- Runtime job 순서는 `productUrl -> referencePack -> selectedImages -> provider candidates -> Blender finalizer -> candidate evaluator -> private assets row`로 확장한다.
- provider 입력 이미지는 reference evidence 순서를 그대로 쓰지 않고, 제품 단독 `front`/hero view를 긴 상세 시트나 material/detail 이미지보다 우선한다.
- finalizer가 없거나 실패해도 silent success가 아니라 `BLENDER_BIN_NOT_CONFIGURED` 또는 `BLENDER_FINALIZER_FAILED` warning을 job/asset QA에 기록한다.
- generated asset thumbnail은 Supabase `thumbnail_path`에 저장되어 editor catalog에서 이미지로 확인할 수 있어야 한다.
- provider candidate 요청은 429/5xx/network/timeout 계열 transient 오류에 대해 `ASSET_GENERATION_PROVIDER_MAX_ATTEMPTS`와 exponential backoff를 적용하고, 후보가 모두 실패했을 때만 job-level retry/dead-letter로 넘어간다.

Removed/Deprecated:
- provider output GLB 파일 크기만 보고 best candidate를 선택하는 방식.
- product URL reference pack의 첫 이미지가 상세 시트라는 이유만으로 provider 입력 1순위에 두는 방식.
- finalizer/evaluator 증거 없이 `qualityScore`를 단일 heuristic으로 기록하는 방식.
- provider transient failure 한 번으로 해당 product URL job 전체를 즉시 실패시키는 방식.

## 2026-05-16 변경 동기화 (Meshy Budget Guard)
Added:
- Meshy provider 호출은 기본 `MESHY_BUDGET_MODE=required`에서 `MESHY_BUDGET_REMAINING`과 `MESHY_BUDGET_COST_PER_TASK`가 없으면 외부 POST 전에 차단한다.
- `MESHY_BUDGET_RESERVE`, `MESHY_MAX_BUDGET_PER_JOB`, `MESHY_SCENE_BUDGET_*`로 worker와 standalone scene asset generation의 token/credit 지출 상한을 보수적으로 계산한다.

Updated:
- Meshy retry는 후보 품질 개선용으로 유지하되, budget guard는 retry worst case를 먼저 예약해 잔여 token/credit 초과를 막는다.

Removed/Deprecated:
- Meshy API key와 URL만 설정되면 잔여 token/credit 확인 없이 생성 요청을 보내는 방식.

## 2026-05-16 변경 동기화 (Meshy Text-to-3D Room Decor)
Added:
- `scripts/generate-meshy-room-decor-asset.ts`를 standalone Meshy text-to-3D room decor 생성 entrypoint로 추가한다.
- 이 스크립트는 `MESHY_SCENE_BUDGET_REMAINING`이 없을 때 Meshy balance API로 잔여 credit을 읽고, preview/refine 2단계에 대해 보수적 `reservedEstimate=60` guard를 적용한 뒤에만 provider POST를 보낸다.
- 생성 report는 `assets/references/meshy-room-decor/meshy-room-decor-report.json`에 prompt, task id, output path, finalizer status, budget source를 기록한다.

Updated:
- standalone scene/decor Meshy 생성은 worker product URL job과 동일하게 Blender finalizer와 glTF validation evidence를 통과한 뒤 catalog에 연결해야 한다.
- Meshy text-to-3D 결과는 internal prototype catalog asset으로만 취급하며, commercial promotion은 별도 human visual QA/license/release gate를 통과해야 한다.

Removed/Deprecated:
- one-off Meshy 호출로 받은 GLB를 provenance/budget/finalizer report 없이 catalog에 직접 붙이는 방식.

## 2026-05-16 변경 동기화 (Generated Asset Review Badges)
Added:
- generated asset catalog metadata는 `source`, `license`, `textureSet.authored=image_based`, `qualityScore`를 기반으로 provider/review badge를 계산해야 한다.
- Meshy text-to-3D prototype은 provider label `Meshy`, review label `검수 필요`, tone `review`로 노출되며, human visual QA 전까지 release-ready item으로 보이면 안 된다.
- standalone Blender finalizer thumbnail은 generated asset review UI에 그대로 쓰일 수 있도록 opaque background와 낮춘 exposure로 렌더한다.
- room styling bundle preview는 generated catalog item을 `workspace-flex` seed에서 계산하고, 적용 전 provider label과 review-required 상태를 UI에 노출해야 한다.
- builder style step의 workspace preset/cluster preview도 같은 `workspace-flex` seed 계산을 사용해 생성형 소품 포함 여부를 프로젝트 생성 전에 표시해야 한다.

Updated:
- Meshy/TripoSR 등 provider 결과는 생성 성공 이후에도 catalog UI에서 provenance와 검수 상태가 보이는 review loop의 입력으로 취급한다.
- 생성형 decor는 library card, replacement card, selected inspector뿐 아니라 “방을 한 번에 꾸미는” bundle apply affordance에서도 review loop의 입력으로 취급한다.
- room-first builder와 post-create editor는 generated provider/review disclosure 기준을 공유해야 하며, 어느 한쪽만 표시하는 것은 QA 미완료로 본다.
- generated GLB review loop는 badge 노출에서 끝나지 않고, replacement live preview registry, hidden cutaway top-view editor scene GLB load registry, browser canvas smoke에서 provider/review/source report provenance와 실제 loaded mesh/material evidence가 유지되는지 확인해야 한다.

Removed/Deprecated:
- generated asset을 static catalog에 병합하면서 provider와 review 상태를 UI에서 잃어버리는 방식.
- AI 생성 asset이 room preset/bundle 안에 숨어 들어가 사용자가 prototype 상태를 인지하지 못한 채 적용하는 방식.
- 생성형 GLB가 catalog에 등록됐다는 사실만으로 editor/replacement preview 렌더 QA까지 통과했다고 보는 방식.

## 2026-05-17 변경 동기화 (PC Part Asset Generation Boundary)
Added:
- PC assembly용 case, motherboard, RAM, CPU, GPU, cooler, PSU, cable asset은 Meshy text-to-3D 또는 image-to-3D로 prototype 생성할 수 있다.
- Compuzone product `1336041`처럼 사용자 제공 견적을 기반으로 할 때는 `scripts/generate-meshy-compuzone-pc-build-kit.ts`처럼 하나의 private prototype build-kit output과 provenance report를 먼저 만들고, 상용 조립용 개별 부품 GLB 분리는 후속 asset QA 단계로 둔다.
- PC part generated asset은 일반 decor보다 더 엄격한 `slotMetadata`가 필요하다: compatible socket/slot type, insertion axis, snap point, clearance, collision proxy, installed/loose state scale을 기록해야 한다.
- PC assembly audio cue는 generated GLB 산출물이 아니라 interaction contract다. RAM click, socket latch, M.2 screw, cable plug, thermal apply, fan snap, panel close, boot chime, BIOS POST cue는 UI/audio registry와 accessibility preference로 관리한다.
- PC assembly result가 deskterior scene으로 이어질 때는 selected case, completed assembly state, completed room setup state, PC desk placement, room lighting/provenance를 payload에 함께 보존한다. Generated PC part GLB만으로 desk-room integration이 완료됐다고 보지 않는다.
- Generated PC/decor GLB가 최종 room preview에 쓰이는 경우, route는 실제 GLB load path와 procedural fallback path를 구분해야 하며 screenshot QA에서 GLB가 장면 안에 보이는지 확인해야 한다.

Updated:
- PC part provider output은 생성 성공만으로 curated catalog에 승격하지 않는다. reference pack/license, dimension fit, Blender finalizer, thumbnail, material QA, slot metadata, human visual QA를 통과하기 전까지 private/prototype 상태를 유지한다.
- Meshy budget guard와 report provenance는 PC part generation에도 동일하게 적용한다. 잔여 credit/token이 확인되지 않으면 provider POST를 보내지 않는다. 긴 견적 prompt는 Meshy text-to-3D prompt limit(800자 이하)에 맞게 축약하고, 원문 부품 목록은 별도 report/payload에 보존한다.
- Bruno-quality asset goal은 provider output만으로 종료하지 않고, room-scale placement, lighting response, silhouette readability, fallback disclosure, and human screenshot review를 통과한 경우에만 다음 단계로 넘긴다.

Removed/Deprecated:
- PC 부품 provider GLB를 slot/collision metadata 없이 일반 object asset처럼 editor에 노출하는 방식.
- Meshy/image-to-3D 결과를 실제 조립 가능한 RAM/CPU/GPU 부품으로 자동 승인하는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Room Asset Evidence)
Added:
- PC assembly final room QA는 Meshy-generated/prototype GLB가 final room screenshot에 실제로 배치되는지 확인하는 asset evidence 단계로 취급한다.
- Compuzone PC build kit 외 room preview 보강용 Meshy monitor, studio speaker, ivy planter proxy GLB도 verifier의 파일 존재/byte size 검사 대상에 포함한다.

Updated:
- Generated PC/decor GLB는 파일 생성, catalog badge, static thumbnail만으로 충분하지 않다. final cinematic screenshot에서 room-scale placement, silhouette readability, material response, fallback 구분이 확인되어야 다음 QA 단계로 넘긴다.
- PC assembly room preview용 additional Meshy GLB는 prototype/review-required 상태를 유지하며, commercial release-ready catalog item으로 자동 승격하지 않는다.

Removed/Deprecated:
- provider output이 존재하면 final room integration도 완료됐다고 보는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Room Prototype Asset Evidence II)
Added:
- PC assembly final room QA는 Meshy/prototype desk accessory GLB까지 evidence 범위를 확장한다: keyboard, mouse, lamp, ceramic mug, book stack, charging reel cable, pixel display.
- Verifier는 small proxy GLB도 정상 prototype evidence로 취급할 수 있도록 room preview asset byte-size threshold를 1KB 초과로 조정한다.

Updated:
- Generated/prototype room accessory는 final screenshot composition을 풍부하게 만드는 용도로 사용할 수 있지만, provider/review-required 상태와 상용 검수 필요 조건은 유지한다.
- PC build kit material toning과 scene exposure는 generated white plastic/metal asset의 silhouette readability를 보존하기 위해 조정할 수 있다.

Removed/Deprecated:
- 작은 proxy GLB가 4KB 이하라는 이유만으로 visual prototype evidence에서 무조건 제외하는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Room Prototype Asset Evidence III)
Added:
- PC assembly final room QA는 generated/prototype GLB 자체뿐 아니라 room-scale integration polish를 evidence로 본다: PC build kit visibility, desk contact shadow, wall dressing, cable dressing, sofa/detail density, cinematic screenshot review.

Updated:
- Meshy/prototype output을 final room에 배치할 때는 occlusion을 조정해 사람이 screenshot에서 해당 asset을 식별할 수 있어야 한다. 파일 존재나 hidden load만으로는 integration evidence가 부족하다.
- Cinematic DOM overlay는 visual review 보조 수단이며, provider output quality 또는 commercial readiness evidence로 간주하지 않는다.

Removed/Deprecated:
- generated PC kit이 scene graph에 존재하지만 final screenshot에서 작게 묻히거나 가려져도 asset evidence가 충분하다고 보는 기준.

## 2026-05-17 변경 동기화 (PC Assembly Room Prototype Asset Evidence IV)
Added:
- PC assembly final room QA는 quote-derived Compuzone Meshy build kit과 separate prototype white showcase shell GLB를 구분해 기록한다. Build kit은 조립 provenance evidence, shell은 final-room visual readability overlay다.
- Verifier는 `p2s_video_so_ong_hyte_y70_snow_white.proxy.glb` 존재를 room preview prototype evidence에 포함한다.

Updated:
- Prototype shell이 final screenshot을 개선하더라도 exact Compuzone/Lian-Li commercial case asset으로 자동 승인하지 않는다. SKU exactness는 별도 Meshy/image-to-3D or Blender rebuild, dimension fit, license/reference review, material QA, human art approval이 필요하다.
- Bruno-quality asset goal은 generated output existence보다 screenshot-visible silhouette, scale, lighting response, and room placement review를 우선한다.

Removed/Deprecated:
- visual shell overlay를 quote-exact PC part generation 완료로 해석하는 방식.

## 2026-05-17 변경 동기화 (PC Assembly Room Prototype Asset Evidence V)
Added:
- PC assembly final room QA may use curated non-provider PBR decor GLTFs as composition polish evidence, but these assets are not Meshy output and must not be recorded as generated PC part provenance.
- Asset evidence now distinguishes three classes: quote-derived Meshy PC build kit, visual prototype shell overlay, and decorative PBR/renderer polish assets.

Updated:
- Provider-generated PC assets still require reference/license review, dimension fit, Blender finalizer or equivalent QA, slot metadata, and human art approval before commercial catalog use.
- If a generated or imported model visually clashes with Bruno-inspired style, the pipeline should prefer removal/fallback over forcing the asset into the final screenshot.

Removed/Deprecated:
- Treating decorative PBR room assets as proof that exact PC quote assets or Meshy PC part generation are complete.

## 2026-05-17 변경 동기화 (Meshy PC Asset Execution Boundary)
Added:
- PC assembly visual QA may use existing Meshy/prototype PC build-kit GLBs plus renderer-only detail overlays when Meshy credentials or budget signals are absent.
- The pipeline must explicitly record when no new Meshy text-to-3D/image-to-3D POST was sent because `MESHY_API_KEY` and Meshy budget env are unavailable.

Updated:
- Existing Compuzone PC build-kit GLB remains private/prototype evidence. It is not equivalent to exact commercial per-part assets until each part has dimensions, pivot/snap metadata, material review, license/reference approval, and human art QA.
- Visual polish overlays can improve final screenshots but must not be written as provider output provenance.

Removed/Deprecated:
- Claiming that a new Meshy asset generation run happened when the environment only loaded an already committed/proxy GLB.

## 2026-05-19 변경 동기화 (Meshy Community Existing-Asset Boundary)
Added:
- Meshy community public model ingestion is separate from Meshy text-to-3D/image-to-3D generation. Existing public CC0 GLBs may move through source staging -> Blender normalization -> runtime candidate QA without claiming a new provider generation run.
- Runtime candidate evidence for public community models is stored in `assets/references/meshy-community/normalization-report-2026-05-19.json` and `assets/references/meshy-community/optimization-report-2026-05-19.json`.

Updated:
- Public community candidate promotion still requires visual QA and package metadata. It is not governed by Meshy budget guards because no new Meshy POST is sent.
- Meshy-generated private PC parts remain stricter than community room/decor candidates: slot metadata, collision, snap axes, and compatibility are still required before commercial PC assembly use.

Removed/Deprecated:
- Recording public community GLB normalization as a Meshy generation job.
- Treating community GLB availability as approval for branded/exact SKU asset use.

## 2026-05-19 변경 동기화 (Blender Authored Asset Boundary)
Added:
- Blender-authored furniture kits are not Meshy text-to-3D/image-to-3D jobs. They should be recorded as local authored candidates with script/source/review artifacts, not provider-generated assets.
- The current `p2s_bruno_furniture_hero_kit` pass used no new Meshy POST and therefore does not require Meshy prompt/reference preapproval for this specific artifact.

Updated:
- If a future pass uses Meshy image-to-3D or text-to-3D for exact furniture, decor, or PC parts, the prompt/reference images must still be reviewed before generation.
- Existing Meshy community/public assets, Meshy-generated private assets, and Blender-authored local assets remain separate provenance lanes with separate promotion requirements.

Removed/Deprecated:
- Backfilling Blender-authored GLBs into Meshy provenance records.
- Claiming provider-quality learning or Meshy generation evidence from a locally scripted Blender candidate.

## 2026-05-19 변경 동기화 (Blender PBR Helper Map Boundary)
Added:
- Blender-authored candidates may generate local procedural PBR helper maps and still remain outside Meshy generation provenance. Record them under Blender-authored asset review, not provider job records.
- `p2s_bruno_furniture_hero_kit` now records local `baseColor`, `normal`, `roughness`, and `ambientOcclusion` helper maps in its review JSON.

Updated:
- PBR helper map generation does not remove the user's Meshy preapproval requirement. Any future Meshy text-to-3D/image-to-3D run still needs prompt/reference review before POST.
- Local Blender review should explicitly say `ktx2Ready=false` until texture transcoding/package artifacts exist.

Removed/Deprecated:
- Treating local PBR helper map generation as evidence that Meshy was used or that Meshy-quality provider output was produced.

## 2026-05-19 변경 동기화 (Benchmark Board Provenance Boundary)
Added:
- Bruno asset benchmark board generation is a local QA/evidence process, not a Meshy provider-generation process.
- The current benchmark ledger must record `comparisonPolicy.noUnlicensedCommercialImagesEmbedded=true` and `meshyProviderGeneration=not-used-in-this-pass`.
- Local contact sheets may include project-authored, open/community, or already-approved local evidence. Any future Meshy text-to-3D/image-to-3D run still requires prompt/reference preapproval before POST.

Updated:
- Blender-authored foreground furniture topology improvements are recorded under the furniture hero kit review and benchmark ledger, not provider job metadata.
- Commercial/open references can shape the rubric, but unlicensed commercial images must not be embedded as QA artifacts.

Removed/Deprecated:
- Treating a benchmark board or local Blender iteration as a Meshy generation job.
- Using commercial-reference screenshots in repo evidence without license/provenance approval.

## 2026-05-19 변경 동기화 (Cinematic Metric Provenance Boundary)
Added:
- `brightPixelRatio` and `clippedHighlightRatio` are local browser/canvas QA metrics. They are not Meshy provider output and must not be written as generation evidence.
- The `RoomCinematicContactOcclusionPass` is a renderer-authored visual QA layer, not a generated asset package.

Updated:
- Benchmark ledger highlight metrics can support a lighting/glare claim only together with screenshot review. They do not prove commercial-grade baked lighting, physical GI, or asset material approval.
- Future Meshy text-to-3D/image-to-3D runs still need prompt/reference preapproval even if local cinematic metrics pass.

Removed/Deprecated:
- Treating local browser metrics as proof that an external asset generation or provider-quality learning cycle occurred.

## 2026-05-19 변경 동기화 (Furniture Detail Regeneration Boundary)
Added:
- The foreground furniture detail second pass is a local Blender-authored regeneration. It did not call Meshy text-to-3D or image-to-3D.
- Updated furniture metrics and benchmark evidence must remain under Blender-authored asset provenance, not provider-generation provenance.

Updated:
- Future Meshy generation for furniture/decor/PC parts still requires prompt or reference-image review before POST. Local Blender iteration does not waive that user-review rule.

Removed/Deprecated:
- Recording Blender headless GLB regeneration as Meshy generation evidence.

## 2026-05-19 변경 동기화 (Surface Helper Map Provenance Boundary)
Added:
- The surface PBR/contact-lightmap pass is a local Blender-authored regeneration. It did not call Meshy text-to-3D, image-to-3D, or any external provider POST.
- `contactShadowLightmap`, normal, roughness, and AO helper maps generated by Blender must remain under Blender-authored provenance until a separate provider job is explicitly approved.

Updated:
- Future Meshy generation for room surfaces, furniture, decor, or PC parts still requires prompt/reference-image review before POST.
- Local helper-map generation can support QA evidence, but it cannot be described as Meshy provider quality, Meshy learning, or external asset-generation output.

Removed/Deprecated:
- Recording local procedural texture/lightmap creation as Meshy generation evidence.

## 2026-05-19 변경 동기화 (Foreground Curvature Provenance Boundary)
Added:
- The foreground sofa/coffee-table curvature pass is a local Blender-authored regeneration. It did not call Meshy text-to-3D, image-to-3D, or any external provider POST.
- `asset.bespokeCurvaturePass` belongs to the Blender-authored furniture review lane, not Meshy provider metadata.

Updated:
- Future Meshy generation for exact furniture, decor, room shell, or PC parts still requires prompt/reference-image review before POST.
- Local rounded mesh generation can support QA evidence, but it cannot be described as Meshy provider learning, provider-generation quality, or release-ready commercial asset evidence.

Removed/Deprecated:
- Backfilling local curvature mesh work into Meshy task reports.
- Claiming commercial readiness from a locally generated topology pass without license/provenance, UV/material, optimization, and human art review gates.

## 2026-05-19 변경 동기화 (Wall Reveal Cleanup Provenance Boundary)
Added:
- The wall reveal cleanup and floor/ceiling line de-emphasis pass is local Blender/runtime authoring. It did not call Meshy text-to-3D, image-to-3D, community download, or any external provider POST.
- `asset.wallRevealCleanupPass` belongs to the Blender-authored surface review lane and must not be recorded as Meshy provider generation evidence.

Updated:
- Future Meshy generation for wall systems, room shells, furniture, decor, or PC parts still requires prompt/reference-image review before POST.
- Local wall-wash/contact-lightmap helper textures can support QA evidence, but they cannot be described as provider-quality learning, final baked GI, or release-ready material work.

Removed/Deprecated:
- Recording local wall-wash texture creation as Meshy generation.
- Treating a local visual cleanup pass as license/provenance approval for commercial room-surface assets.

## 2026-05-19 변경 동기화 (Art-Directed Bounce Provenance Boundary)
Added:
- The `artDirectedBounceLightmap` and `asset.artDirectedGiPass` surface pass is local Blender-authored asset work. It did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- Bounce floor/wall zone metadata is provenance for a QA candidate GLB only. It is not provider-learning evidence, not a Meshy task result, and not a commercial license signal.

Updated:
- Future Meshy generation for room/furniture/decor/PC assets still requires user review of the exact prompt or reference image before any POST.
- Local bounce-card evidence can support the lighting/bake QA ledger, but it must keep `physicallyBaked=false` and `stillRequiresPathTracedBake=true` until a real bake or approved equivalent exists.

Removed/Deprecated:
- Recording hand-authored bounce cards as Meshy generation.
- Treating a local art-directed lightmap as release-ready physical GI or commercial material approval.

## 2026-05-19 변경 동기화 (Cycles AO Bake Provenance Boundary)
Added:
- The `cyclesAoBakeLightmap` and `asset.cyclesAoBakePass` surface pass is local Blender-authored bake work. It did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- The bake uses temporary room/furniture blocker proxies and a temporary floor receiver, so provenance is “Blender Cycles AO probe,” not exact product CAD, exact furniture collision, or provider-generated asset evidence.

Updated:
- Future Meshy generation for room/furniture/decor/PC assets still requires user review of the exact prompt or reference image before any POST.
- Local Cycles AO evidence can support the lighting/bake QA ledger only when it keeps `pathTracedGi=false`, `stillRequiresPathTracedGi=true`, and `stillRequiresFinalUvBake=true` until final UV-authored bake work exists.

Removed/Deprecated:
- Recording local Cycles bake output as Meshy generation or provider-learning evidence.
- Treating a floor-only AO probe as commercial material approval, license/provenance approval, or final path-traced GI.

## 2026-05-19 변경 동기화 (Packed ORM Sidecar Provenance Boundary)
Added:
- The packed ORM sidecar pass is local Blender-authored packaging work. It did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- The generated sidecars are procedural PNG package evidence for QA only. They are not Meshy provider outputs, not commercial-license signals, and not final UV-authored material bakes.

Updated:
- Future Meshy generation for room/furniture/decor/PC assets still requires user review of the exact prompt or reference image before any POST.
- Local packed ORM evidence can support the material-package QA ledger only when it keeps `ktx2Ready=false`, `stillRequiresRuntimeKtx2Transcode=true`, and `stillRequiresFinalUvBake=true` until a real KTX2/final bake path exists.

Removed/Deprecated:
- Recording local ORM packing as Meshy generation or provider-learning evidence.
- Treating PNG sidecars as release-ready KTX2 textures, commercial material approval, or final product asset provenance.

## 2026-05-19 변경 동기화 (Runtime Sidecar Provenance Boundary)
Added:
- Publishing the Bruno room surface kit sidecars into the public runtime package catalog is local packaging work. It did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- Runtime descriptors may reference local Blender-authored sidecar packages only when they keep `ktx2Ready=false`, `stillRequiresRuntimeKtx2Transcode=true`, and `releaseEligible=false` until a real encoder/package promotion pass exists.
- Render-only clarity tuning in the PC assembly workbench is not asset generation evidence and must not be recorded as Meshy/provider output.

Updated:
- Future Meshy generation for room, furniture, decor, or PC assets still requires review of the exact prompt or reference image before POST.
- Local runtime sidecar indexing can support QA and integration evidence, but it cannot be described as commercial license/provenance approval or provider-created asset quality.

Removed/Deprecated:
- Treating public runtime package presence as proof that the asset was externally sourced, Meshy-generated, or commercially licensed.
- Treating DPR/MSAA/tone-mapping improvements as a substitute for approved GLB asset acquisition or generation.

## 2026-05-19 변경 동기화 (Bruno Surface KTX2 Provenance Boundary)
Added:
- The Bruno surface ORM KTX2 promotion is local packaging/transcoding work. It used `basisu` from Homebrew `basis_universal`; it did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- KTX2 sidecars may be recorded as runtime delivery evidence for local Blender-authored maps, not as provider-generation quality or commercial license evidence.

Updated:
- Future Meshy generation for room, furniture, decor, or PC assets still requires user review of exact prompts/reference images before POST.
- Local KTX2 packaging can clear `stillRequiresRuntimeKtx2Transcode`, but it must keep `stillRequiresFinalUvBake=true` and `releaseEligible=false` until visual/material approval is real.

Removed/Deprecated:
- Recording `basisu` KTX2 transcoding as Meshy learning or external asset acquisition.
- Treating KTX2 sidecar readiness as final material provenance, final UV bake, or Bruno Simon-level commercial quality.

## 2026-05-19 변경 동기화 (Runtime Material Binding Provenance Boundary)
Added:
- Runtime binding of the Bruno surface KTX2 ORM package is local integration work. It did not call Meshy text-to-3D, Meshy image-to-3D, community downloads, or any external provider POST.
- Source second-UV repair for `p2s_bruno_room_surface_kit.glb` is local Blender asset-authoring work and must be recorded separately from provider asset generation.

Updated:
- Future Meshy generation for room, furniture, decor, or PC parts still requires user review of exact prompts/reference images before POST.
- Runtime material binding can prove that local package metadata affects the browser render, but it cannot prove commercial art quality, license approval, or final UV/GI bake completion.

Removed/Deprecated:
- Recording browser material wiring as Meshy learning or external asset acquisition.
- Treating `brunoSurfaceOrmConsumed=true` as final asset provenance, final material approval, or Bruno Simon-level completion.

## 2026-05-19 변경 동기화 (Furniture Curvature Provenance Boundary)
Added:
- The authored furniture overlap and curvature expansion pass is local Blender/runtime authoring. It did not call Meshy text-to-3D, Meshy image-to-3D, Meshy community download, or any external provider POST.
- The generated furniture GLB may be used as project-owned QA candidate evidence only while `stillRequiresHumanArtReview=true` and the benchmark ledger remains `not-commercial-ready`.

Updated:
- Future Meshy generation for sofa, desk, media console, PC parts, room props, or exact product variants still requires user review of the exact prompt/reference image before POST.
- Local rounded topology improvements can reduce primitive-box readability, but they cannot prove external asset acquisition, Meshy learning, commercial license coverage, final UV bake, or final catalog quality.

Removed/Deprecated:
- Recording local Blender curvature work as Meshy provider output or community asset acquisition.
- Treating overlap-control runtime wiring as asset-generation quality evidence.

## 2026-05-19 변경 동기화 (Foreground Sofa Rear Provenance Boundary)
Added:
- The foreground sofa rear continuous-shell pass is local Blender-authored asset work. It did not call Meshy text-to-3D, Meshy image-to-3D, Meshy community download, or any external provider POST.
- `soft_rear_upholstery_shell` evidence belongs to the Blender-authored furniture review lane and remains a QA candidate while `stillRequiresHumanArtReview=true` and the benchmark ledger remains `not-commercial-ready`.
- The furniture KTX2 review-metadata sync is local packaging/integration work, not provider generation, provider learning, or commercial license evidence.

Updated:
- Future Meshy generation for sofa, desk, media console, PC parts, room props, or exact product variants still requires user review of the exact prompt/reference image before POST.
- Local source-mesh improvements can reduce primitive readability, but they cannot prove external asset acquisition, Meshy community approval, commercial license coverage, final UV bake, or final catalog quality.

Removed/Deprecated:
- Recording local Blender upholstery-shell work as Meshy provider output or community asset acquisition.
- Treating KTX2 metadata synchronization as proof of commercial material approval or Bruno Simon-level completion.
