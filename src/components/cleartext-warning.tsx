import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { isNativeApp } from "@/lib/mobile.ts";

/**
 * Warns when a server address uses plain HTTP.
 *
 * The mobile build deliberately permits cleartext traffic, because most
 * self-hosted SoulFire servers are reachable only over http:// on a LAN. That
 * convenience is worth an explicit warning: the JWT is sent on every request,
 * so anyone on the same network can read it.
 *
 * Only shown in the native shell — a browser already surfaces the "Not secure"
 * indicator in its address bar.
 */
export function CleartextAddressWarning({ address }: { address: string }) {
  const { t } = useTranslation("login");

  if (!isNativeApp()) {
    return null;
  }

  if (!/^http:\/\//i.test(address.trim())) {
    return null;
  }

  return (
    <div
      role="status"
      className="flex flex-row items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-amber-700 text-xs dark:text-amber-400"
    >
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
      <span>{t("dedicated.form.address.cleartextWarning")}</span>
    </div>
  );
}
