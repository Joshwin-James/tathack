import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Sentinel · 404</p>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">Signal lost</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This route is not part of the Kochi command surface.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-destructive">Sentinel · error</p>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">This surface failed to render</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try re-running the last action or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CityTwin AI — AI Urban Digital Twin for Kochi" },
      {
        name: "description",
        content:
          "CityTwin AI is an AI-powered urban digital twin for Kochi. Predict, prevent, protect — a command center for traffic, floods, emergencies and city intelligence.",
      },
      { name: "author", content: "CityTwin AI" },
      { property: "og:title", content: "CityTwin AI — AI Urban Digital Twin for Kochi" },
      {
        property: "og:description",
        content: "CityTwin AI is an AI-powered urban digital twin for Kochi. Predict, prevent, protect — a command center for traffic, floods, emergencies and city intelligence.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CityTwin AI — AI Urban Digital Twin for Kochi" },
      { name: "twitter:description", content: "CityTwin AI is an AI-powered urban digital twin for Kochi. Predict, prevent, protect — a command center for traffic, floods, emergencies and city intelligence." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86f83a82-ed14-4876-abfd-13560a5531a6/id-preview-c241a4c3--2e4d5b90-06f8-4e83-969f-ce7c379e6cd6.lovable.app-1784356234157.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/86f83a82-ed14-4876-abfd-13560a5531a6/id-preview-c241a4c3--2e4d5b90-06f8-4e83-969f-ce7c379e6cd6.lovable.app-1784356234157.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700;800;900&family=Geist+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

import { SentinelProvider } from "../lib/store";

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SentinelProvider>
        <Outlet />
      </SentinelProvider>
    </QueryClientProvider>
  );
}
