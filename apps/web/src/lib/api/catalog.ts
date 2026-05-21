"use client";

import { normalizeCatalog, type LibraryCatalogItem } from "../builder/catalog";

type CatalogPayload = {
  items?: unknown;
  catalog?: unknown;
  nextCursor?: unknown;
};

const PAGE_LIMIT = 240;
const MAX_PAGES = 10;

function extractCatalogInput(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as CatalogPayload;

  if (Array.isArray(record.items)) {
    return record.items;
  }

  if (Array.isArray(record.catalog)) {
    return record.catalog;
  }

  return [];
}

function extractNextCursor(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as CatalogPayload;
  return typeof record.nextCursor === "string" && record.nextCursor.length > 0 ? record.nextCursor : null;
}

async function fetchCatalogPage(offset: number) {
  const searchParams = new URLSearchParams({
    limit: String(PAGE_LIMIT),
    offset: String(offset)
  });

  const response = await fetch(`/api/v1/catalog?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    credentials: "include"
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(`Catalog request failed (${response.status})`);
  }

  return {
    items: normalizeCatalog(extractCatalogInput(payload)),
    nextCursor: extractNextCursor(payload)
  };
}

async function fetchGeneratedAssetCatalog() {
  const response = await fetch("/api/v1/assets", {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store",
    credentials: "include"
  });

  if (response.status === 401) {
    return [];
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return [];
  }

  return normalizeCatalog(extractCatalogInput(payload));
}

export async function fetchAssetCatalog(): Promise<LibraryCatalogItem[]> {
  const merged: LibraryCatalogItem[] = [];
  const seenItemIds = new Set<string>();
  let offset = 0;

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await fetchCatalogPage(offset);

    page.items.forEach((item) => {
      if (seenItemIds.has(item.id)) return;
      seenItemIds.add(item.id);
      merged.push(item);
    });

    if (!page.nextCursor) {
      break;
    }

    const nextOffset = Number(page.nextCursor);
    if (!Number.isInteger(nextOffset) || nextOffset <= offset) {
      break;
    }
    offset = nextOffset;
  }

  const generatedItems = await fetchGeneratedAssetCatalog();
  generatedItems.forEach((item) => {
    if (seenItemIds.has(item.id)) return;
    seenItemIds.add(item.id);
    merged.push(item);
  });

  return normalizeCatalog(merged);
}
