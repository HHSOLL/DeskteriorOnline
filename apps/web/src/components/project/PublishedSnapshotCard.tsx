import Link from "next/link";
import { Layers3 } from "lucide-react";
import { getCatalogPreviewClasses } from "../../lib/builder/catalog";
import type { SharePreviewMeta } from "../../lib/share/preview";
import {
  buildPublishedSnapshotCardHref,
  buildPublishedSnapshotCardModel
} from "../../lib/showcase/published-snapshot-card";

type PublishedSnapshotCardProps = {
  token: string;
  thumbnail?: string;
  previewMeta: SharePreviewMeta | null;
  publishedAt: string;
};

export function PublishedSnapshotCard({
  token,
  thumbnail,
  previewMeta,
  publishedAt
}: PublishedSnapshotCardProps) {
  const cardModel = buildPublishedSnapshotCardModel({ previewMeta, publishedAt });
  const href = buildPublishedSnapshotCardHref(token);
  const previewTheme = getCatalogPreviewClasses(cardModel.primaryTone);

  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-[0_10px_26px_rgba(38,24,14,0.08)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_18px_42px_rgba(38,24,14,0.12)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-[#ebe5db]">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={cardModel.projectName}
            className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
          />
        ) : (
          <div className={`absolute inset-0 flex flex-col justify-end p-5 ${previewTheme.surface}`}>
            <div className="text-lg font-medium">{cardModel.projectName}</div>
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/32 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white backdrop-blur">
          <Layers3 className="h-3.5 w-3.5" />
          {cardModel.versionBadgeLabel}
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="text-[16px] font-semibold leading-6 text-[#171411]">{cardModel.projectName}</h3>
          <div className="mt-1 text-[13px] text-[#8a8177]">{cardModel.secondaryLabel}</div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-[#625a51]">
          <span>{cardModel.primaryCollection}</span>
          <span>{cardModel.publishedAtLabel}</span>
        </div>
      </div>
    </Link>
  );
}
