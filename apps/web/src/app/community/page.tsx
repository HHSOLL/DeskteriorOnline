import Link from "next/link";
import { Flame, MessageSquareMore, Sparkles, Users } from "lucide-react";
import { PublishedSnapshotCard } from "../../components/project/PublishedSnapshotCard";
import {
  buildPageHref,
  parseTotalHint,
  readSearchParam,
  ShowcaseFilterRail,
  type ShowcaseSearchParams
} from "../../components/showcase/ShowcaseFilterRail";
import {
  getShowcaseSnapshotProfileFromPreviewMeta,
  normalizeShowcaseFilters,
  type ShowcaseFilters,
  type ShowcaseSnapshotItem
} from "../../lib/api/showcase";
import { buildShowcaseActivityMetrics, compareShowcaseActivityRank } from "../../lib/showcase/activity";
import { buildShowcaseViewerHref } from "../../lib/viewer/presentation";
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

function formatDate(value: string | null) {
  if (!value) return "없음";
  return new Date(value).toLocaleDateString("ko-KR");
}

function buildConversationTone(room: string) {
  if (room === "workspace") return "집중도와 책상 배치";
  if (room === "bedroom") return "수면 존과 수납 밸런스";
  if (room === "living") return "동선과 라운지 밀도";
  return "멀티룸 레이아웃";
}

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
      error: "커뮤니티 장면 목록을 불러오지 못했습니다."
    };
  }
}

export default async function CommunityPage({ searchParams }: { searchParams?: ShowcaseSearchParams }) {
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
  const matchingTotal = archiveSummary?.matchingTotal ?? feedTotal;
  const archiveTotal = archiveSummary?.archiveTotal ?? matchingTotal;
  const collectionFallback = Array.from(
    snapshots
      .flatMap((snapshot) => snapshot.previewMeta?.assetSummary?.collections ?? [])
      .reduce<Map<string, number>>((map, collection) => {
        map.set(collection.label, (map.get(collection.label) ?? 0) + collection.count);
        return map;
      }, new Map())
      .entries()
  )
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))[0] ?? null;
  const latestPublish = archiveSummary?.latestPublishedAt ?? snapshots[0]?.published_at ?? null;
  const loadMoreHref = nextCursor ? buildPageHref("/community", filters, nextCursor, matchingTotal) : null;
  const featuredSnapshot = archiveSummary?.featuredItem ?? snapshots[0] ?? null;
  const topCollection = archiveSummary?.topCollection ?? collectionFallback;
  const rankedSnapshots = [...snapshots].sort((left, right) =>
    compareShowcaseActivityRank(
      {
        id: left.id,
        published_at: left.published_at,
        previewMeta: left.previewMeta,
        activity: left.activity
      },
      {
        id: right.id,
        published_at: right.published_at,
        previewMeta: right.previewMeta,
        activity: right.activity
      }
    )
  );
  const conversationCards = rankedSnapshots.slice(0, 3).map((snapshot) => {
    const profile = getShowcaseSnapshotProfileFromPreviewMeta(snapshot.previewMeta);
    const activity = buildShowcaseActivityMetrics({
      previewMeta: snapshot.previewMeta,
      publishedAt: snapshot.published_at,
      persistedActivity: snapshot.activity
    });
    return {
      id: snapshot.id,
      href: buildShowcaseViewerHref(snapshot.token),
      title: `${snapshot.previewMeta?.projectName ?? "공유 공간"} 배치 피드백`,
      excerpt:
        snapshot.previewMeta?.projectDescription ??
        `${buildConversationTone(profile.room)}에 대한 의견을 나누는 스레드입니다.`,
      focusCount: activity.productFocusCount,
      viewCount: activity.viewCount,
      toneLabel: buildConversationTone(profile.room)
    };
  });
  const boardCards = [
    {
      title: "배치 피드백",
      description: "공유한 장면 위에서 동선, 밀도, 포인트 아이템에 대한 의견을 나눕니다."
    },
    {
      title: "질문과 답변",
      description: "책상 배치, 조명, 수납, 컬러 매칭 질문을 빠르게 올리고 답변받습니다."
    },
    {
      title: "주간 챌린지",
      description: "같은 room 타입을 주제로 서로 다른 데스크테리어 결과를 비교합니다."
    }
  ];
  const statusDescription = showcaseError
    ? "커뮤니티 목록을 확인할 수 없습니다."
    : activeFilterCount > 0
      ? `현재 조건 결과 ${matchingTotal}개 / 공개 전체 ${archiveTotal}개를 탐색할 수 있습니다.`
      : `현재 공개된 발행 장면 ${archiveTotal}개를 탐색할 수 있습니다.`;

  return (
    <div className="min-h-screen bg-[#f6f5f1] px-4 pb-20 pt-6 text-[#171411] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <header>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
            <div className="rounded-[28px] border border-black/10 bg-white/78 p-7 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a8177]">
                <Users className="h-4 w-4" />
                <span>커뮤니티</span>
              </div>
              <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-[#171411] sm:text-[44px]">
                장면을 공유하고, 실제 대화를 이어가는 공간
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[#625a51]">
                갤러리가 완성된 장면 아카이브라면, 커뮤니티는 질문과 피드백이 오가는 공간입니다. 발행된 씬을
                바탕으로 동선, 배치, 스타일링 의견을 주고받을 수 있도록 구조를 분리했습니다.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3 text-sm leading-6 text-[#625a51]">
                <span>{statusDescription}</span>
                {!showcaseError ? (
                  <span className="rounded-full border border-black/10 bg-[#f6f2ea] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                    대화 보드 {boardCards.length}개
                  </span>
                ) : null}
                {!showcaseError && latestPublish ? (
                  <span className="rounded-full border border-black/10 bg-[#f6f2ea] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
                    최근 게시 {formatDate(latestPublish)}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
              <div className="rounded-[24px] border border-black/10 bg-[#191512] p-5 text-[#f9f4ec] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-[#cdb79c]">이번 주 챌린지</div>
                <div className="mt-3 text-xl font-semibold">작업실 한 칸, 수납 레이어드</div>
                <p className="mt-3 text-sm leading-6 text-[#e1d7cd]">
                  같은 room 타입 안에서 수납 밀도와 책상 조합을 비교하는 주간 피드입니다.
                </p>
              </div>
              <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">활동 지표</div>
                <div className="mt-4 text-3xl font-semibold text-[#171411]">{archiveTotal}</div>
                <p className="mt-2 text-sm leading-6 text-[#625a51]">지금 공개된 커뮤니티 장면 수</p>
              </div>
              <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
                <div className="text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">주요 컬렉션</div>
                <div className="mt-4 text-sm font-semibold text-[#171411]">{topCollection?.label ?? "가구 레이어"}</div>
                <p className="mt-2 text-sm leading-6 text-[#625a51]">
                  {topCollection?.count ?? 0}회 등장한 대표 컬렉션입니다.
                </p>
              </div>
            </div>
          </div>
          <ShowcaseFilterRail pathname="/community" filters={filters} activeFilterCount={activeFilterCount} />
        </header>

        {!showcaseError ? (
          <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="rounded-[24px] border border-black/10 bg-white/80 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
              <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
                <MessageSquareMore className="h-4 w-4" />
                <span>진행 중인 대화</span>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {conversationCards.map((card) => (
                  <Link
                    key={card.id}
                    href={card.href}
                    className="rounded-[20px] border border-black/10 bg-[#fbf8f2] p-5 transition hover:-translate-y-0.5 hover:border-black/20"
                  >
                    <div className="text-[10px] font-semibold tracking-[0.16em] text-[#8a8177]">{card.toneLabel}</div>
                    <div className="mt-3 text-lg font-semibold leading-7 text-[#171411]">{card.title}</div>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#625a51]">{card.excerpt}</p>
                    <div className="mt-5 flex items-center gap-3 text-[11px] text-[#625a51]">
                      <span>포커스 {card.focusCount}</span>
                      <span>조회 {card.viewCount}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
                <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
                  <Flame className="h-4 w-4" />
                  <span>커뮤니티 보드</span>
                </div>
                <div className="mt-4 space-y-3">
                  {boardCards.map((board) => (
                    <div key={board.title} className="rounded-[18px] border border-black/8 bg-[#faf7f1] p-4">
                      <div className="text-sm font-semibold text-[#171411]">{board.title}</div>
                      <p className="mt-2 text-sm leading-6 text-[#625a51]">{board.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {featuredSnapshot ? (
                <div className="rounded-[24px] border border-black/10 bg-[#191512] p-6 text-[#f8f1e8] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
                  <div className="text-[10px] font-semibold tracking-[0.2em] text-[#ccb59b]">에디터에서 바로 이어보기</div>
                  <div className="mt-3 text-xl font-semibold">
                    {featuredSnapshot.previewMeta?.projectName ?? "가장 최근 공개된 장면"}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#e1d7cd]">
                    최근성과 구성 밀도를 함께 반영한 추천 장면을 열고 같은 공간을 보며 바로 피드백을 남길 수 있습니다.
                  </p>
                  <Link
                    href={buildShowcaseViewerHref(featuredSnapshot.token)}
                    className="mt-5 inline-flex rounded-full border border-white/15 px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-white/10"
                  >
                    추천 장면 열기
                  </Link>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {showcaseError ? (
          <section className="mt-6 rounded-[18px] border border-[#c06e3d]/18 bg-[#fff8f3] p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.06)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#b56a3e]">커뮤니티를 불러올 수 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">공개 장면 목록을 확인하지 못했습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">{showcaseError}</p>
          </section>
        ) : snapshots.length === 0 && hasMore ? (
          <section className="mt-6 rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건에 맞는 장면을 아직 찾지 못했습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">현재 불러온 범위에서는 결과가 없습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              더 많은 장면을 불러오거나 필터를 줄여서 다시 확인해 주세요.
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
                href="/community"
                className="inline-flex rounded-full border border-black/10 bg-white px-5 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
              >
                필터 초기화
              </Link>
            </div>
          </section>
        ) : snapshots.length === 0 && activeFilterCount > 0 ? (
          <section className="mt-6 rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">조건과 일치하는 장면이 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">필터 조합을 다시 선택해 주세요.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              공간 유형, 톤, 밀도 조건을 조정하면 다른 커뮤니티 장면을 볼 수 있습니다.
            </p>
            <Link
              href="/community"
              className="mt-6 inline-flex rounded-md border border-black/10 bg-white px-4 py-3 text-[11px] font-semibold text-[#52483f] transition hover:border-black/20 hover:bg-[#faf7f2]"
            >
              필터 초기화
            </Link>
          </section>
        ) : snapshots.length === 0 ? (
          <section className="mt-6 rounded-[18px] border border-dashed border-black/12 bg-white/72 p-10 text-center shadow-[0_14px_40px_rgba(68,52,34,0.05)]">
            <div className="text-[10px] font-semibold tracking-[0.22em] text-[#8a7c70]">아직 공개된 장면이 없습니다</div>
            <h2 className="mt-4 text-3xl font-semibold">커뮤니티에 노출된 장면이 없습니다.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[#61574e]">
              장면이 발행되면 이 페이지에서 동일한 읽기 전용 뷰어로 탐색할 수 있습니다.
            </p>
          </section>
        ) : (
          <section className="mt-6">
            <div className="mb-4 flex items-center gap-3 text-[10px] font-semibold tracking-[0.24em] text-[#8a7c70]">
              <Sparkles className="h-4 w-4" />
              <span>최신 커뮤니티 게시물</span>
            </div>
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
          </section>
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
            현재 공개된 장면을 모두 확인했습니다
          </p>
        ) : null}
      </div>
    </div>
  );
}
