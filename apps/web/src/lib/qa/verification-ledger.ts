export type QaVerificationStatus = "verified" | "pending" | "fallback";

export type CompatibilityVerificationRecord = {
  profile: string;
  browser: string;
  deviceClass: string;
  requiredForRelease: boolean;
  status: QaVerificationStatus;
  lastVerifiedAt: string | null;
  verificationMethod: string;
  evidence: string[];
  notes: string;
};

export type PlacementRegressionEvidenceRecord = {
  id: string;
  script: string;
  requiredForRelease: boolean;
  status: QaVerificationStatus;
  lastVerifiedAt: string | null;
  verificationMethod: string;
  evidence: string[];
};

export const compatibilityVerificationLedger: CompatibilityVerificationRecord[] = [
  {
    profile: "Desktop Balanced",
    browser: "Chrome latest",
    deviceClass: "desktop dGPU / modern iGPU",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T20:55:00+09:00",
    verificationMethod: "manual-release-check",
    evidence: ["qa:primary:perf", "verify:focus-placement", "verify:commercial-qa"],
    notes: "Primary release browser for the editor and hidden QA surface."
  },
  {
    profile: "Desktop Balanced",
    browser: "Edge latest",
    deviceClass: "desktop / laptop",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:05:00+09:00",
    verificationMethod: "manual-release-check",
    evidence: ["verify:focus-placement", "verify:advanced-attachments", "verify:commercial-qa"],
    notes: "Enterprise Windows verification path for room/builder/editor shell."
  },
  {
    profile: "Desktop Fallback",
    browser: "Safari latest",
    deviceClass: "MacBook class",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:12:00+09:00",
    verificationMethod: "manual-readiness-check",
    evidence: ["build", "verify:commercial-qa"],
    notes: "WebGL fallback readiness confirmed; memory telemetry remains partial."
  },
  {
    profile: "Low-spec Laptop",
    browser: "Chrome latest",
    deviceClass: "integrated GPU",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:18:00+09:00",
    verificationMethod: "budget-regression-check",
    evidence: ["qa:primary:perf", "verify:performance-budget", "verify:benchmark-baseline"],
    notes: "Balanced tier fallback confirmed against performance budget gate."
  },
  {
    profile: "Mobile Viewer Fallback",
    browser: "Safari iOS / Chrome Android",
    deviceClass: "mobile",
    requiredForRelease: false,
    status: "fallback",
    lastVerifiedAt: null,
    verificationMethod: "viewer-only-policy",
    evidence: ["product-policy"],
    notes: "Viewer/read-only posture only; editor is not part of the commercial commitment."
  }
];

export const placementRegressionEvidenceLedger: PlacementRegressionEvidenceRecord[] = [
  {
    id: "placement-kernel",
    script: "verify:placement-kernel",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:22:00+09:00",
    verificationMethod: "local-smoke",
    evidence: ["surface_local", "mounted compatibility", "collision guard"]
  },
  {
    id: "focus-placement",
    script: "verify:focus-placement",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:27:00+09:00",
    verificationMethod: "local-smoke",
    evidence: ["candidate cycle", "walkthrough session", "snapped HUD"]
  },
  {
    id: "advanced-attachments",
    script: "verify:advanced-attachments",
    requiredForRelease: true,
    status: "verified",
    lastVerifiedAt: "2026-04-23T21:33:00+09:00",
    verificationMethod: "local-smoke",
    evidence: ["vesa mount", "monitor arm", "articulation reachability"]
  }
];
