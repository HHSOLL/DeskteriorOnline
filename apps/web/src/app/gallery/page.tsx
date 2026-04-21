import Link from "next/link";
import { Sparkles } from "lucide-react";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";
import {
  buildPageHref,
  parseTotalHint,
  readSearchParam,
  ShowcaseFilterRail,
  type ShowcaseSearchParams
} from "../../components/showcase/ShowcaseFilterRail";
import {
  normalizeShowcaseFilters,
  type ShowcaseFilters,
  type ShowcaseSnapshotItem
} from "../../lib/api/showcase";
import { fetchShowcaseArchiveSummary, fetchShowcaseSnapshotFeed } from "../../lib/server/showcase";

export const revalidate = 0;

type ShowcaseArchiveResult = {
  items: ShowcaseSnapshotItem[];
  total: number;
  nextCursor: string | null;
  hasMore: boolean;
  error: string | null;
};

const PAGE_SIZE = 24;

async function fetchShowcaseArchivePage(
  cursor: string | null,
  totalHint: number | null,
  filters: ShowcaseFilters
): Promise<ShowcaseArchiveResult> {
  try {
    const feed = await fetchShowcaseSnapshotFeed({
      limit: PAGE_SIZE,
      cursor,
      totalHint,
      room: filters.room,
      tone: filters.tone,
      density: filters.density
    });

    return {
      items: feed.items,
      total: feed.total,
      nextCursor: feed.nextCursor,
      hasMore: feed.hasMore,
      error: null
    };
  } catch {
    return {
      items: [],
      total: 0,
      nextCursor: null,
      hasMore: false,
      error: "발행 장면 목록을 불러오지 못했습니다."
    };
  }
}

export default async function GalleryPage({ searchParams }: { searchParams?: ShowcaseSearchParams }) {
  const filters = normalizeShowcaseFilters({
    room: readSearchParam(searchParams?.room),
    tone: readSearchParam(searchParams?.tone),
    density: readSearchParam(searchParams?.density)
  });
  const currentCursor = readSearchParam(searchParams?.cursor) ?? null;
  const totalHint = parseTotalHint(readSearchParam(searchParams?.total) ?? null);
  const archiveSummary = await fetchShowcaseArchiveSummary(filters).catch(() => null);
  const resolvedTotalHint = totalHint ?? archiveSummary?.matchingTotal ?? null;

  const {
    items: snapshots,
    total: feedTotal,
    nextCursor,
    hasMore,
    error: showcaseError
  } = await fetchShowcaseArchivePage(currentCursor, resolvedTotalHint, filters);

  const activeFilterCount =
    Number(filters.room !== "all") + Number(filters.tone !== "all") + Number(filters.density !== "all");
  const loadedCount = snapshots.length;
  const matchingTotal = archiveSummary?.matchingTotal ?? feedTotal;
  const archiveTotal = archiveSummary?.archiveTotal ?? matchingTotal;
  const loadMoreHref = nextCursor ? buildPageHref("/gallery", filters, nextCursor, matchingTotal) : null;
  const statusLabel = showcaseError
    ? "목록을 확인할 수 없음"
    : activeFilterCount === 0
      ? hasMore
        ? `현재 페이지 ${loadedCount}개 / 전체 ${matchingTotal}개`
        : `발행 장면 ${matchingTotal}개`
      : hasMore
        ? `현재 페이지 ${loadedCount}개 / 조건 전체 ${matchingTotal}개`
        : `조건 결과 ${matchingTotal}개 / 공개 전체 ${archiveTotal}개`;

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 pb-20 pt-10 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a8177]">
                <Sparkles className="h-4 w-4" />
                <span>갤러리</span>
              </div>
              <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-[#171411] sm:text-[44px]">
                가구가 비치된 공간
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/gallery"
                className="rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-bold text-[#171411]"
              >
                가구 완비
              </Link>
              <Link
                href="/community"
                className="rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-bold text-[#625a51] transition hover:border-black/20 hover:bg-[#f8f7f4]"
              >
                커뮤니티
              </Link>
            </div>
          </div>
          <div className="mt-4 text-sm leading-6 text-[#625a51]">{statusLabel}</div>
          <ShowcaseFilterRail pathname="/gallery" filters={filters} activeFilterCount={activeFilterCount} />
        </header>

        <section className="mt-6">
          {showcaseError ? (
            <div className="rounded-[18px] border border-[#c06e3d]/18 bg-[#fff8f3] p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.06)]">
              <div className="text-[10px] font-semibold tracking-[0.22em] text-[#b56a3e]">갤러리를 불러올 수 없습니다</div>
              <h2 className="mt-4 text-3xl font-semibold">발행 장면 목록을 확인하지 못했습니다.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">{showcaseError}</p>
            </div>
          ) : snapshots.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {snapshots.map((snapshot) => (
                <PublishedSnapshotCard
                  key={snapshot.id}
                  token={snapshot.token}
                  thumbnail={snapshot.thumbnail}
                  previewMeta={snapshot.previewMeta}
                  publishedAt={snapshot.published_at}
                />
              ))}
            </div>
          ) : hasMore ? (
            <div className="rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건에 맞는 장면을 아직 찾지 못했습니다</div>
              <h2 className="mt-4 text-3xl font-semibold">현재 불러온 범위에서는 결과가 없습니다.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                더 많은 장면을 불러오거나 필터를 줄여서 확인해 주세요.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {loadMoreHref ? (
                  <Link
                    href={loadMoreHref}
                    className="inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
                  >
                    더 보기
                  </Link>
                ) : null}
                <Link
                  href="/gallery"
                  className="inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
                >
                  필터 초기화
                </Link>
              </div>
            </div>
          ) : activeFilterCount > 0 ? (
            <div className="rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건과 일치하는 장면이 없습니다</div>
              <h2 className="mt-4 text-3xl font-semibold">필터 조합을 다시 선택해 주세요.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                공간 유형, 톤, 밀도 조건을 조정하면 다른 발행 장면을 확인할 수 있습니다.
              </p>
              <Link
                href="/gallery"
                className="mt-6 inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                필터 초기화
              </Link>
            </div>
          ) : (
            <div className="rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
              <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">아직 발행된 장면이 없습니다</div>
              <h2 className="mt-4 text-3xl font-semibold">첫 번째 발행 장면을 기다리고 있습니다.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
                에디터에서 장면을 발행하면 이 아카이브에 읽기 전용 뷰어 진입 카드가 추가됩니다.
              </p>
            </div>
          )}

          {!showcaseError && snapshots.length > 0 && hasMore && Boolean(loadMoreHref) ? (
            <div className="mt-8 flex justify-center">
              {loadMoreHref ? (
                <Link
                  href={loadMoreHref}
                  className="inline-flex items-center rounded-full border border-black/10 bg-white/88 px-6 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-white"
                >
                  다음 장면 더 보기
                </Link>
              ) : null}
            </div>
          ) : null}

          {!showcaseError && snapshots.length > 0 && !hasMore ? (
            <p className="mt-8 text-center text-[10px] font-semibold tracking-[0.2em] text-[#8a7c70]">
              모든 발행 장면을 확인했습니다
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
