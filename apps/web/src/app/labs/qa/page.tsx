import { Activity, BadgeCheck, MonitorCog, ShieldAlert, TableProperties, TriangleAlert } from "lucide-react";
import { loadCommercialQaSnapshot } from "../../../lib/qa/commercial-qa";

function gateClasses(status: "pass" | "warning" | "fail") {
  switch (status) {
    case "pass":
      return "border-emerald-500/25 bg-emerald-50 text-emerald-800";
    case "warning":
      return "border-amber-500/25 bg-amber-50 text-[#7a4d17]";
    default:
      return "border-rose-500/25 bg-rose-50 text-rose-800";
  }
}

export default function CommercialQaPage() {
  const snapshot = loadCommercialQaSnapshot();

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 pb-20 pt-12 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="rounded-[28px] border border-black/10 bg-white/82 p-7 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a8177]">
            <ShieldAlert className="h-4 w-4" />
            <span>LABS / COMMERCIAL QA</span>
          </div>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-[#171411] sm:text-[40px]">
            release gate / compatibility / integrity readout
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625a51]">
            Phase 9 commercial QA는 product surface에 링크하지 않는 숨겨진 검증 영역이다. runtime asset publish 상태,
            benchmark baseline, browser/device matrix, scene integrity detector를 한 번에 확인한다.
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[#8a8177]">
            generated {new Date(snapshot.generatedAt).toLocaleString("ko-KR")}
          </p>
        </header>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_320px]">
          <div className="rounded-[24px] border border-black/10 bg-white/78 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
              <BadgeCheck className="h-4 w-4" />
              <span>Release Gates</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {snapshot.releaseGates.map((gate) => (
                <div key={gate.id} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                  <div className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${gateClasses(gate.status)}`}>
                    {gate.status}
                  </div>
                  <h2 className="mt-3 text-sm font-semibold text-[#171411]">{gate.label}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5a5148]">{gate.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-black/10 bg-[#191512] p-5 text-[#f9f4ec] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#ccb59b]">
                <TriangleAlert className="h-4 w-4" />
                <span>Asset Status</span>
              </div>
              <dl className="mt-4 space-y-3 text-sm text-[#e1d7cd]">
                <div className="flex items-center justify-between gap-4">
                  <dt>Total assets</dt>
                  <dd>{snapshot.assetStatus.totalAssets}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>QA passed</dt>
                  <dd>{snapshot.assetStatus.passedAssets}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Support surfaces</dt>
                  <dd>{snapshot.assetStatus.assetsWithSupportSurfaces}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Attachment points</dt>
                  <dd>{snapshot.assetStatus.assetsWithAttachmentPoints}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Missing required files</dt>
                  <dd>{snapshot.assetStatus.missingRequiredFiles}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt>Verified compatibility</dt>
                  <dd>
                    {snapshot.compatibilitySummary.verifiedProfiles}/{snapshot.compatibilitySummary.requiredProfiles}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">
                <MonitorCog className="h-4 w-4" />
                <span>Integrity Detector</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#52483f]">
                sample corrupt scene status: <strong>{snapshot.sceneIntegrity.sampleStatus}</strong>
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-[#52483f]">
                <div className="rounded-[16px] border border-black/8 bg-[#faf7f1] p-3">
                  <dt>Missing support refs</dt>
                  <dd className="mt-1 text-base font-semibold text-[#171411]">
                    {snapshot.sceneIntegrity.sampleRecoverySnapshot.missingSupportReferenceCount}
                  </dd>
                </div>
                <div className="rounded-[16px] border border-black/8 bg-[#faf7f1] p-3">
                  <dt>Invalid surface placements</dt>
                  <dd className="mt-1 text-base font-semibold text-[#171411]">
                    {snapshot.sceneIntegrity.sampleRecoverySnapshot.invalidSurfacePlacementCount}
                  </dd>
                </div>
                <div className="rounded-[16px] border border-black/8 bg-[#faf7f1] p-3">
                  <dt>Duplicate ids</dt>
                  <dd className="mt-1 text-base font-semibold text-[#171411]">
                    {snapshot.sceneIntegrity.sampleRecoverySnapshot.duplicateNodeIdCount}
                  </dd>
                </div>
                <div className="rounded-[16px] border border-black/8 bg-[#faf7f1] p-3">
                  <dt>Self-support refs</dt>
                  <dd className="mt-1 text-base font-semibold text-[#171411]">
                    {snapshot.sceneIntegrity.sampleRecoverySnapshot.selfSupportReferenceCount}
                  </dd>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[#52483f]">
                {snapshot.sceneIntegrity.ruleSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-[18px] border border-black/8 bg-[#faf7f1] p-4 text-sm leading-6 text-[#52483f]">
                <p className="font-semibold text-[#171411]">Suggested recovery actions</p>
                <p className="mt-2">{snapshot.sceneIntegrity.sampleSuggestedActions.join(" / ")}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
              <Activity className="h-4 w-4" />
              <span>Benchmark Baseline</span>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.performanceBaseline.scenarios.map((scenario) => (
                <div key={scenario.scenario} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-[#171411]">{scenario.title}</h2>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-[#8a8177]">{scenario.scenario}</span>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-[#5a5148]">
                    <div>
                      <dt>Objects</dt>
                      <dd>{scenario.objects}</dd>
                    </div>
                    <div>
                      <dt>Runtime assets</dt>
                      <dd>{scenario.runtimeAssetCount}</dd>
                    </div>
                    <div>
                      <dt>Draw-call budget</dt>
                      <dd>{scenario.budgetHints.drawCallsBudget}</dd>
                    </div>
                    <div>
                      <dt>Triangle budget</dt>
                      <dd>{scenario.budgetHints.triangleBudget}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
                <BadgeCheck className="h-4 w-4" />
                <span>Placement Regression Suites</span>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.placementRegression.suites.map((suite) => (
                  <div key={suite.id} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-[#171411]">{suite.label}</h2>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${gateClasses(suite.status)}`}>
                        {suite.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#5a5148]">{suite.script}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5a5148]">{suite.detail}</p>
                    <p className="mt-2 text-sm text-[#5a5148]">target: {suite.target}</p>
                    <p className="mt-2 text-sm text-[#5a5148]">coverage: {suite.coverage.join(" / ")}</p>
                    <p className="mt-2 text-sm text-[#5a5148]">
                      verified: {suite.lastVerifiedAt ? new Date(suite.lastVerifiedAt).toLocaleString("ko-KR") : "untracked"}
                    </p>
                    <p className="mt-2 text-sm text-[#5a5148]">method: {suite.verificationMethod}</p>
                    <p className="mt-2 text-sm text-[#5a5148]">evidence: {suite.evidence.join(" / ") || "none"}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
                <TableProperties className="h-4 w-4" />
                <span>Compatibility Matrix</span>
              </div>
              <div className="mt-5 space-y-3">
                {snapshot.compatibilityMatrix.map((row) => (
                  <div key={row.profile + row.browser} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold text-[#171411]">{row.profile}</h2>
                      <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${gateClasses(row.status === "fallback" ? "warning" : "pass")}`}>
                        {row.status} / {row.verificationStatus}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#5a5148]">
                      {row.browser} / {row.deviceClass}
                    </p>
                    <p className="mt-2 text-sm text-[#5a5148]">
                      {row.requiredForRelease ? "release required" : "fallback profile"} /{" "}
                      {row.lastVerifiedAt ? new Date(row.lastVerifiedAt).toLocaleString("ko-KR") : "untracked"}
                    </p>
                    <p className="mt-2 text-sm text-[#5a5148]">method: {row.verificationMethod}</p>
                    <p className="mt-2 text-sm text-[#5a5148]">evidence: {row.evidence.join(" / ")}</p>
                    <p className="mt-2 text-sm leading-6 text-[#5a5148]">{row.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
              <TableProperties className="h-4 w-4" />
              <span>Asset Package Inventory</span>
            </div>
            <div className="mt-5 overflow-hidden rounded-[18px] border border-black/8">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-[#f4efe7] text-[#625a51]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Asset</th>
                    <th className="px-4 py-3 font-medium">QA</th>
                    <th className="px-4 py-3 font-medium">Surface / Attach</th>
                    <th className="px-4 py-3 font-medium">Variants</th>
                    <th className="px-4 py-3 font-medium">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6 bg-white">
                  {snapshot.assetStatus.rows.map((row) => (
                    <tr key={row.key} className="align-top">
                      <td className="px-4 py-3 text-[#171411]">
                        <div className="font-medium">{row.label}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.12em] text-[#8a8177]">
                          {row.key} / {row.scaleLocked ? "scale-locked" : "flex"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#5a5148]">
                        {row.qaStatus}
                        {row.warningCount > 0 ? ` (${row.warningCount} warnings)` : ""}
                      </td>
                      <td className="px-4 py-3 text-[#5a5148]">
                        {row.supportSurfaceCount} / {row.attachmentPointCount}
                      </td>
                      <td className="px-4 py-3 text-[#5a5148]">{row.materialVariantCount}</td>
                      <td className="px-4 py-3 text-[#5a5148]">
                        {row.missingRequiredFiles === 0 ? "0" : row.missingRequiredFileNames.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
              <TriangleAlert className="h-4 w-4" />
              <span>Focus Placement Benchmarks</span>
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.focusPlacementTasks.map((task) => (
                <div key={task.task} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                  <h2 className="text-sm font-semibold text-[#171411]">{task.task}</h2>
                  <p className="mt-2 text-sm text-[#5a5148]">metric: {task.metric}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5a5148]">target: {task.target}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[18px] border border-black/8 bg-[#faf7f1] p-4 text-sm leading-6 text-[#5a5148]">
              <p className="font-semibold text-[#171411]">Sample integrity issues</p>
              <ul className="mt-3 space-y-2">
                {snapshot.sceneIntegrity.sampleIssues.map((issue) => (
                  <li key={issue.code + issue.message}>
                    <span className="font-medium text-[#171411]">{issue.code}</span>
                    {` / ${issue.severity} / ${issue.message}`}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
