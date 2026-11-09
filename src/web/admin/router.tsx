/**
 * Minimal client-side router for the handful of admin screens.
 */
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { parseRoute, type Route } from './lib/routes';

/**
 * Goes to another screen without reloading the page.
 *
 * @param path - Destination path.
 */
export function navigate(path: string): void {
  history.pushState(null, '', path);
  dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * Follows the browser's address.
 *
 * @returns The current route.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.pathname));

  useEffect(() => {
    /** Updates the route after a navigation. */
    const onChange = () => setRoute(parseRoute(location.pathname));
    addEventListener('popstate', onChange);
    return () => removeEventListener('popstate', onChange);
  }, []);

  return route;
}

/**
 * Link that navigates inside the application. Clicks with a modifier key
 * keep their usual browser meaning, such as opening a new tab.
 *
 * @param props - Destination, optional class and content.
 * @returns The anchor element.
 */
export function Link({
  href,
  class: className,
  children,
}: {
  href: string;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <a
      href={href}
      class={className}
      onClick={(event) => {
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
