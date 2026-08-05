import { create } from "@bufbuild/protobuf";
import { createClient, type Transport } from "@connectrpc/connect";
import { BotFleetSummarySchema } from "@soulfiremc/sdk/generated/soulfire/bot_pb";
import type { ClientDataResponse } from "@soulfiremc/sdk/generated/soulfire/client_pb";
import { ClientService } from "@soulfiremc/sdk/generated/soulfire/client_pb";
import { InstancePermission } from "@soulfiremc/sdk/generated/soulfire/common_pb";
import {
  type InstanceListResponse,
  InstanceListResponseSchema,
  InstancePermissionStateSchema,
  InstanceService,
} from "@soulfiremc/sdk/generated/soulfire/instance_pb";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { Suspense, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { CreateInstanceProvider } from "@/components/dialog/create-instance-dialog.tsx";
import { ErrorComponent } from "@/components/error-component.tsx";
import { TransportContext } from "@/components/providers/transport-context.tsx";
import { demoClientData } from "@/demo-data.ts";
import { diagnoseConnectionFailure } from "@/lib/connection-error.ts";
import { withDeadline } from "@/lib/deadline.ts";
import { desktop, isDesktopApp } from "@/lib/desktop.ts";
import { smartEntries } from "@/lib/utils.tsx";
import {
  createTransport,
  getServerAddress,
  isAuthenticated,
  isImpersonating,
  logOut,
} from "@/lib/web-rpc.ts";

/** Deadline for the two queries that gate the dashboard. */
const BOOTSTRAP_TIMEOUT_MS = 6_000;

export const Route = createFileRoute("/_dashboard")({
  beforeLoad: async (props) => {
    if (isAuthenticated()) {
      const instanceListQueryOptions = queryOptions({
        queryKey: ["instance-list"],
        queryFn: async (props): Promise<InstanceListResponse> => {
          const transport = createTransport();
          if (transport === null) {
            return create(InstanceListResponseSchema, {
              instances: [
                {
                  id: "demo",
                  friendlyName: "Demo",
                  icon: "pickaxe",
                  botSummary: create(BotFleetSummarySchema, {
                    totalBots: 1,
                    desiredBots: 1,
                    onlineBots: 1,
                  }),
                  instancePermissions: smartEntries(InstancePermission).map(
                    (permission) =>
                      create(InstancePermissionStateSchema, {
                        instancePermission: permission[1],
                        granted: true,
                      }),
                  ),
                },
              ],
            });
          }

          const instanceService = createClient(InstanceService, transport);
          const result = await instanceService.listInstances(
            {},
            {
              // Bounded so an address that black-holes fails instead of
              // hanging on the OS TCP timeout — this query gates the whole
              // dashboard, so hanging it means an endless spinner with no way
              // back to the connect screen.
              //
              // Via an abort signal, NOT Connect's timeoutMs: that sends a
              // Grpc-Timeout header, which the server's CORS policy does not
              // allow, so the preflight is refused with 403 and the call never
              // happens. See withDeadline.
              signal: withDeadline(props.signal, BOOTSTRAP_TIMEOUT_MS),
            },
          );

          return result;
        },
        // Polling stops once the query is failing. While it kept polling every
        // three seconds, a suspense query that had just errored was immediately
        // put back into a pending state, so the error boundary never got to
        // render: instead of an error screen with "Log out", the dashboard sat
        // on an empty shell spinning forever, with no route back to the connect
        // screen. Recovery is by the error screen's Reload, or a successful
        // refetch after a manual retry.
        refetchInterval: (query) =>
          query.state.error === null ? 3_000 : false,
      });
      props.abortController.signal.addEventListener("abort", () => {
        void props.context.queryClient.cancelQueries({
          queryKey: instanceListQueryOptions.queryKey,
        });
      });
      const clientDataQueryOptions = queryOptions({
        queryKey: ["client-data"],
        queryFn: async (props): Promise<ClientDataResponse> => {
          const transport = createTransport();
          if (transport === null) {
            return demoClientData;
          }

          const clientService = createClient(ClientService, transport);
          const result = await clientService.getClientData(
            {},
            {
              // Same reasoning as listInstances above: this gates the
              // dashboard, so it must fail rather than hang.
              signal: withDeadline(props.signal, BOOTSTRAP_TIMEOUT_MS),
            },
          );

          // console.log(JSON.stringify(result))
          return result;
        },
      });
      props.abortController.signal.addEventListener("abort", () => {
        void props.context.queryClient.cancelQueries({
          queryKey: clientDataQueryOptions.queryKey,
        });
      });
      return {
        instanceListQueryOptions,
        clientDataQueryOptions,
      };
    } else {
      if (isDesktopApp()) {
        await desktop.integratedServer.kill();
      }
      logOut();
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        to: "/",
        search: {
          redirect: props.location.href,
        },
      });
    }
  },
  loader: async (
    props,
  ): Promise<
    | {
        success: true;
        transport: Transport | null;
      }
    | {
        success: false;
        connectionError: object;
      }
  > => {
    const transport = createTransport();
    if (transport === null) {
      return {
        success: true,
        transport,
      };
    }

    try {
      // Awaited, and ensureQueryData rather than prefetchQuery.
      //
      // The success: false branch below — and the "connectionFailed" string it
      // renders — were unreachable: prefetchQuery swallows its own errors and
      // these calls were additionally fire-and-forget via void, so the catch
      // could never run and the loader always reported success. The dashboard
      // then mounted against a server it could not reach, its suspense queries
      // failed, were refetched from scratch, and the user sat on a spinner with
      // no way back to the connect screen.
      //
      // Awaiting here means an unreachable server surfaces as the connection
      // error screen, which carries "Log out" and "Reload page".
      await Promise.all([
        props.context.queryClient.ensureQueryData(
          props.context.instanceListQueryOptions,
        ),
        props.context.queryClient.ensureQueryData(
          props.context.clientDataQueryOptions,
        ),
      ]);

      // We need this as demo data
      // if (APP_ENVIRONMENT === 'development') {
      //   console.debug(JSON.stringify(configResult.response));
      // }

      return {
        success: true,
        transport,
      };
    } catch (e) {
      return {
        success: false,
        connectionError: e as object,
      };
    }
  },
  component: DashboardLayout,
  // Ensure we show the pending component when needed
  wrapInSuspense: true,
});

function InstanceSwitchKeybinds() {
  const navigate = useNavigate();
  const { instanceListQueryOptions } = Route.useRouteContext();
  const { data: instanceList } = useSuspenseQuery(instanceListQueryOptions);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        const numberKey = parseInt(e.key, 10);
        if (numberKey > 0 && numberKey <= instanceList.instances.length) {
          e.preventDefault();
          void navigate({
            to: "/instance/$instance",
            params: { instance: instanceList.instances[numberKey - 1].id },
          });
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [instanceList.instances, navigate]);

  return null;
}

function DashboardLayout() {
  const { t } = useTranslation("common");
  const loaderData = Route.useLoaderData();
  if (!loaderData.success) {
    // Say which address failed and why. The previous fixed string plus "check
    // the console" was unactionable on a phone, and threw the real error away —
    // wrong address, nothing listening, firewall and rejected token all looked
    // identical despite needing completely different fixes.
    const diagnosis = diagnoseConnectionFailure(
      loaderData.connectionError,
      getServerAddress(),
    );
    const lines = [
      t("error.connectionFailed"),
      t(diagnosis.reasonKey, diagnosis.values),
      ...(diagnosis.hintKey ? [t(diagnosis.hintKey, diagnosis.values)] : []),
    ];

    return <ErrorComponent error={new Error(lines.join("\n\n"))} />;
  }

  return (
    <TransportContext value={loaderData.transport}>
      <Suspense>
        <InstanceSwitchKeybinds />
      </Suspense>
      {isImpersonating() && (
        <div className="border-sidebar-primary pointer-events-none absolute top-0 right-0 bottom-0 left-0 z-30 overflow-hidden border-4" />
      )}
      <CreateInstanceProvider>
        <Outlet />
      </CreateInstanceProvider>
    </TransportContext>
  );
}
