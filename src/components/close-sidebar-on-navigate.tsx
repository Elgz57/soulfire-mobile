import { useLocation } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar.tsx";

/**
 * Closes the mobile sidebar whenever the route changes.
 *
 * On desktop the sidebar is a persistent column, so upstream never needed to
 * dismiss it. On mobile it is an overlay sheet covering most of the screen,
 * and tapping a nav entry navigated the page underneath while leaving the
 * sheet open on top of it — so the user had to dismiss it by hand to see the
 * screen they just opened.
 *
 * Keyed on the pathname rather than on nav item clicks so that every route
 * change closes it, including breadcrumbs, in-page links and the Android back
 * gesture.
 */
export function CloseSidebarOnNavigate() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    // Comparing against the previous value keeps `pathname` a real input to
    // the effect rather than a bare trigger in the dependency array, which
    // `useExhaustiveDependencies` would otherwise strip out — silently
    // stopping the sidebar from ever closing.
    if (previousPathname.current === pathname) {
      return;
    }

    previousPathname.current = pathname;

    if (isMobile) {
      setOpenMobile(false);
    }
  }, [pathname, isMobile, setOpenMobile]);

  return null;
}
