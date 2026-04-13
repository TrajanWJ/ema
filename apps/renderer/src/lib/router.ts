export function getCurrentRoute(): string {
  const fromHash = window.location.hash.replace(/^#\/?/, "").trim();
  if (fromHash) {
    return fromHash;
  }

  const pathName = window.location.pathname.replace(/^\/+/, "").trim();
  if (!pathName || pathName.endsWith("index.html")) {
    return "launchpad";
  }

  return pathName;
}

export function isStandaloneWindow(): boolean {
  return new URLSearchParams(window.location.search).has("standalone");
}

export function navigateToRoute(
  route: string,
  options: {
    standalone?: boolean;
    searchParams?: Record<string, string | number | boolean | null | undefined>;
  } = {},
): void {
  const url = new URL(window.location.href);
  const nextParams = new URLSearchParams();

  if (options.standalone) {
    nextParams.set("standalone", "1");
  }

  for (const [key, value] of Object.entries(options.searchParams ?? {})) {
    if (value === undefined || value === null || value === false) {
      continue;
    }
    nextParams.set(key, String(value));
  }

  url.search = nextParams.toString();
  url.hash = route ? `#${route}` : "#launchpad";
  window.location.assign(url.toString());
}
