// Tiny hash router: '#/trees', '#/trees/abc'. Hash URLs need no server
// rewrite rules, so the app works from any static host (Nginx, Caddy, …).

import { useEffect, useState, type ReactNode, type MouseEvent } from 'react';

function current(): string {
  const h = location.hash.replace(/^#/, '');
  return h.startsWith('/') ? h.split('?')[0] : '/';
}

export function useRoute(): { path: string; parts: string[] } {
  const [path, setPath] = useState(current());
  useEffect(() => {
    const on = () => { setPath(current()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return { path, parts: path.split('/').filter(Boolean) };
}

export function navigate(to: string) {
  location.hash = to;
}

export function Link({ to, children, className, onClick, title }: {
  to: string; children: ReactNode; className?: string; onClick?: (e: MouseEvent) => void; title?: string;
}) {
  return <a href={'#' + to} className={className} onClick={onClick} title={title}>{children}</a>;
}
