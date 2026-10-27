import { useMemo } from "react";
import { navigate, useLocation } from "./router";

// Stand-in for "next/navigation" in the single-page build: the same calls the screens make.

export function useRouter() {
  return useMemo(
    () => ({
      push: (href: string) => navigate(href, "push"),
      replace: (href: string) => navigate(href, "replace"),
      back: () => history.back(),
      refresh: () => {},
      prefetch: () => {},
    }),
    [],
  );
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function usePathname(): string {
  return useLocation().pathname;
}
