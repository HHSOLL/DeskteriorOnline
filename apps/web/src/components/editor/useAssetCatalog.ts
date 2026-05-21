"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAssetCatalog } from "../../lib/api/catalog";
import {
  DEFAULT_CATALOG,
  filterCatalogItems,
  getCatalogSpotlight,
  getFeaturedCatalogItems,
  getLibraryCategories,
  type LibraryCatalogCategoryId,
  type LibraryCatalogItem
} from "../../lib/builder/catalog";

export function useAssetCatalog() {
  const [catalog, setCatalog] = useState<LibraryCatalogItem[]>(DEFAULT_CATALOG);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<LibraryCatalogCategoryId>("all");

  const refreshCatalog = useCallback(async () => {
    const items = await fetchAssetCatalog();
    setCatalog(items);
    return items;
  }, []);

  useEffect(() => {
    let active = true;

    fetchAssetCatalog()
      .then((items) => {
        if (!active) return;
        setCatalog(items);
      })
      .catch(() => {
        if (active) {
          setCatalog(DEFAULT_CATALOG);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(() => getLibraryCategories(catalog), [catalog]);
  const filteredItems = useMemo(
    () =>
      filterCatalogItems(catalog, {
        query,
        categoryId: activeCategory
      }),
    [activeCategory, catalog, query]
  );
  const featuredItems = useMemo(() => getFeaturedCatalogItems(catalog), [catalog]);
  const spotlightItem = useMemo(
    () => getCatalogSpotlight(filteredItems, featuredItems),
    [featuredItems, filteredItems]
  );

  return {
    catalog,
    categories,
    query,
    setQuery,
    activeCategory,
    setActiveCategory,
    filteredItems,
    featuredItems,
    spotlightItem,
    hasActiveFilters: activeCategory !== "all" || query.trim().length > 0,
    refreshCatalog
  };
}
