import { Code, ConnectError } from "@connectrpc/connect";

/**
 * Turns a failed connection into something a phone user can act on.
 *
 * The dashboard's error screen previously showed a fixed "Connection to the
 * SoulFire server failed." and told the user to check the console — advice that
 * is useless on a phone, and it discarded the actual error. It could not
 * distinguish "wrong address", "server not running", "firewall", "token
 * rejected" or "TLS problem", which are the failures that actually happen and
 * which have completely different fixes.
 *
 * Returns i18n keys rather than text so the caller keeps translation in the
 * view layer.
 */
export type ConnectionDiagnosis = {
  /** Key for the one-line reason. */
  reasonKey: string;
  /** Optional key for a follow-up suggestion. */
  hintKey?: string;
  /** Interpolation values for both. */
  values: {
    address: string;
    code: string;
    message: string;
    port: string;
  };
};

function parseAddress(address: string | null): {
  host: string | null;
  port: string;
} {
  if (address === null) {
    return { host: null, port: "38765" };
  }

  try {
    const url = new URL(address);
    return {
      host: url.hostname.toLowerCase(),
      // SoulFire's default, from PortHelper.SF_DEFAULT_PORT.
      port: url.port === "" ? "38765" : url.port,
    };
  } catch {
    return { host: null, port: "38765" };
  }
}

/**
 * True when the failure is the connection rather than the request's contents.
 *
 * Lets callers avoid blaming the user for something the network did — the login
 * code step reported "Code is invalid" for a server that had simply stopped
 * answering, which sends people retyping a perfectly good code.
 */
export function isConnectionFailure(error: unknown): boolean {
  const { code } = ConnectError.from(error);
  return (
    code === Code.DeadlineExceeded ||
    code === Code.Unavailable ||
    code === Code.Unknown ||
    // Our own deadlines are enforced by aborting the call (see withDeadline),
    // which surfaces as Canceled rather than DeadlineExceeded. Without this a
    // timed-out login would be reported as a bad code.
    code === Code.Canceled
  );
}

export function diagnoseConnectionFailure(
  error: unknown,
  address: string | null,
): ConnectionDiagnosis {
  const connectError = ConnectError.from(error);
  const { host, port } = parseAddress(address);

  // The single most common mistake, and invisible from the message alone: on a
  // phone "localhost" is the phone, not the machine running the server.
  const isLoopback =
    host === "localhost" || host === "127.0.0.1" || host === "::1";

  const values = {
    address: address ?? "-",
    code: Code[connectError.code] ?? String(connectError.code),
    message: connectError.rawMessage || connectError.message,
    port,
  };

  switch (connectError.code) {
    case Code.Canceled:
    case Code.DeadlineExceeded:
      // Reached something, got no answer in time: a wrong host that silently
      // drops packets, or a server too busy to reply. Canceled lands here
      // because withDeadline enforces deadlines by aborting.
      return {
        reasonKey: "error.connection.timedOut",
        hintKey: isLoopback
          ? "error.connection.loopbackHint"
          : "error.connection.firewallHint",
        values,
      };
    case Code.Unavailable:
    case Code.Unknown:
      // Nothing answered at all: nothing listening, no route, or the request
      // never left the device.
      return {
        reasonKey: "error.connection.unreachable",
        hintKey: isLoopback
          ? "error.connection.loopbackHint"
          : "error.connection.firewallHint",
        values,
      };
    case Code.Unauthenticated:
    case Code.PermissionDenied:
      // The server answered and refused us — the address is fine.
      return { reasonKey: "error.connection.rejected", values };
    default:
      return { reasonKey: "error.connection.other", values };
  }
}
