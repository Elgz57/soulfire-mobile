/**
 * Bounds a call's duration without sending a `Grpc-Timeout` header.
 *
 * The obvious way to do this is Connect's own `timeoutMs` call option — but on
 * gRPC-Web that sets a `Grpc-Timeout` request header, and the SoulFire server's
 * CORS policy allows only content-type, X-GRPC-WEB, X-User-Agent,
 * X-SoulFire-Control-Token and Authorization. A preflight asking for anything
 * else is rejected with 403, so adding a deadline that way does not slow the
 * call down — it stops it happening at all, and only when the server is on a
 * different origin, which is every request from the native app.
 *
 * Aborting client-side achieves the same bound with no header, so it works
 * against any CORS configuration.
 *
 * Deliberately built from AbortController rather than AbortSignal.timeout() and
 * AbortSignal.any(): those are recent additions, and this has to run in
 * whatever System WebView the device happens to ship.
 */
export function withDeadline(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const controller = new AbortController();

  const timer = setTimeout(() => {
    controller.abort(
      new DOMException(`Deadline of ${timeoutMs}ms exceeded`, "TimeoutError"),
    );
  }, timeoutMs);

  // Stop the timer once this signal is spent, however that happened, so a
  // completed call does not leave a pending timeout behind.
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timer);
    },
    { once: true },
  );

  // Forward an upstream abort (React Query cancelling the query, a route
  // unloading) so cancellation still propagates.
  if (signal !== undefined) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener(
        "abort",
        () => {
          controller.abort(signal.reason);
        },
        { once: true },
      );
    }
  }

  return controller.signal;
}
