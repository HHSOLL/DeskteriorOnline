import type { ReactNode } from "react";
import type { BuilderTemplateOption } from "../types";

type BuilderShapeStepProps = {
  templateOptions: BuilderTemplateOption[];
  templateId: BuilderTemplateOption["id"];
  onSelectTemplate: (templateId: BuilderTemplateOption["id"]) => void;
};

function ShapePreview({
  templateId,
  selected
}: {
  templateId: BuilderTemplateOption["id"];
  selected: boolean;
}) {
  const fill = "#dddddd";
  const stroke = selected ? "#161616" : "transparent";
  const strokeWidth = selected ? 3.5 : 0;

  const shapes: Record<BuilderTemplateOption["id"], ReactNode> = {
    "rect-studio": <rect x="18" y="18" width="64" height="64" rx="2" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />,
    "l-shape": (
      <path
        d="M18 82V46H46V18H82V82Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "cut-shape": (
      <path
        d="M18 82V18H82V54L64 82Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "t-shape": (
      <path
        d="M18 18H82V46H62V82H38V46H18Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "u-shape": (
      <path
        d="M18 18H82V82H58V50H42V82H18Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "slanted-shape": (
      <path
        d="M18 34L34 18H66L82 34V82H18Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "offset-studio": (
      <path
        d="M18 18H82V50H58V82H18Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    ),
    "gallery-bay": (
      <path
        d="M18 82V18H36V8H64V18H82V82Z"
        fill={fill}
        stroke={stroke}
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    )
  };

  const selectedNodes =
    selected && templateId === "rect-studio"
      ? [
          [18, 18],
          [82, 18],
          [18, 82],
          [82, 82]
        ]
      : null;

  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28" aria-hidden>
      {shapes[templateId]}
      {selectedNodes?.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <circle cx={x} cy={y} r="4.2" fill="#ffffff" stroke="#161616" strokeWidth="2" />
        </g>
      ))}
    </svg>
  );
}

export function BuilderShapeStep({
  templateOptions,
  templateId,
  onSelectTemplate
}: BuilderShapeStepProps) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10 pt-3">
      {templateOptions.map((template) => {
        const selected = templateId === template.id;

        return (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template.id)}
            className="flex flex-col items-center justify-center text-center transition hover:opacity-90"
          >
            <ShapePreview templateId={template.id} selected={selected} />
            <span className="mt-3 text-sm font-semibold text-[#3a342d]">{template.name}</span>
          </button>
        );
      })}
    </div>
  );
}
