import { Code, ConnectError } from "@connectrpc/connect";
import {
  createBrowserHistory,
  createRouter,
  deepEqual,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "@/lib/i18n";
import { broadcastQueryClient } from "@tanstack/query-broadcast-client-experimental";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorComponent } from "@/components/error-component.tsx";
import { LoadingComponent } from "@/components/loading-component.tsx";
import { NotFoundComponent } from "@/components/not-found-component.tsx";
import { initMobile } from "@/lib/mobile.ts";
import {
  hydrateNativeStorage,
  installNativeStorageMirror,
} from "@/lib/mobile-storage.ts";
import { routeTree } from "./routeTree.gen";

window.addEventListener("vite:preloadError", () => {
  window.location.reload();
});

// Mirror auth/theme writes into native storage, then pull anything already
// persisted there back into localStorage. This has to finish before the
// isAuthenticated() check further down, otherwise a signed-in user would be
// sent to the connect screen on every cold start.
installNativeStorageMirror();
await hydrateNativeStorage();

// Status bar, splash, keyboard and hardware back wiring. Not awaited: none of
// it gates rendering, and the splash screen stays up until it resolves.
void initMobile();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retries on an initial load failure
      retry: (failureCount, error) => {
        const code = ConnectError.from(error).code;
        if (
          code === Code.Unauthenticated ||
          code === Code.PermissionDenied ||
          code === Code.FailedPrecondition ||
          code === Code.NotFound ||
          code === Code.AlreadyExists ||
          code === Code.InvalidArgument ||
          code === Code.Unimplemented ||
          code === Code.OutOfRange ||
          code === Code.DataLoss
        ) {
          return false;
        }
        // An aborted call is not a failure to retry.
        if (code === Code.Canceled) {
          return false;
        }
        // Connection-level failures: the server could not be reached at all —
        // wrong address, or a LAN server while the phone is on mobile data.
        // That is the most likely failure on a phone and it will not fix
        // itself. Retrying five times with exponential backoff only buys a
        // minute of spinner before the error screen — which is where the
        // "log out / change server" button lives — finally appears, and the
        // user cannot reach the connect screen until it does. One retry still
        // covers a server that is genuinely mid-restart.
        //
        // All three codes matter here, and assuming Unavailable alone was
        // enough is why a dead address still hung: connect-es reports a
        // rejected fetch as Unknown, and a call that exceeds its timeoutMs as
        // DeadlineExceeded. Unavailable is the least likely of the three.
        if (
          code === Code.Unavailable ||
          code === Code.Unknown ||
          code === Code.DeadlineExceeded
        ) {
          return failureCount < 1;
        }
        return failureCount < 5;
      },
      structuralSharing: (prev: unknown, next: unknown) =>
        deepEqual(prev, next) ? prev : next,
    },
  },
});

broadcastQueryClient({
  queryClient: queryClient,
  broadcastChannel: "soulfire",
});

// noinspection JSUnusedGlobalSymbols
const router = createRouter({
  routeTree,
  history: createBrowserHistory(),
  defaultPreload: "intent",
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  scrollRestorationBehavior: "auto",
  defaultErrorComponent: ErrorComponent,
  defaultPendingComponent: LoadingComponent,
  defaultNotFoundComponent: NotFoundComponent,
  defaultStructuralSharing: true,
  context: { queryClient },
  Wrap: ({ children }) => {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  },
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  // noinspection JSUnusedGlobalSymbols
  interface Register {
    router: typeof router;
  }
}

// Upstream resumed a saved session here, but the condition it used
// (window.location.pathname === "") can never be true in a browser — the path
// is "/" at minimum — so it never ran, and on mobile every cold start landed
// back on the connect form. The "/" route's beforeLoad guard now handles this,
// which also avoids the full page reload that assigning to location.pathname
// would cause.

// Render the app
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}
