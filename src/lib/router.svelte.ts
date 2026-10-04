/** Router hash minimal: #/login, #/, #/board/:id, #/board/:id/card/:cardId, #/card/:cardId */
export type Route =
  | { name: 'login' }
  | { name: 'boards' }
  | { name: 'board'; boardId: string; cardId?: string }
  | { name: 'card'; cardId: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'login') return { name: 'login' };
  if (parts[0] === 'board' && parts[1]) {
    return parts[2] === 'card' && parts[3]
      ? { name: 'board', boardId: parts[1], cardId: parts[3] }
      : { name: 'board', boardId: parts[1] };
  }
  if (parts[0] === 'card' && parts[1]) return { name: 'card', cardId: parts[1] };
  return { name: 'boards' };
}

class Router {
  route = $state<Route>(parseHash(typeof location !== 'undefined' ? location.hash : ''));

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('hashchange', () => {
        this.route = parseHash(location.hash);
      });
    }
  }

  go(path: string, replace = false) {
    const hash = `#${path}`;
    if (replace) {
      history.replaceState(null, '', hash);
      this.route = parseHash(hash);
    } else {
      location.hash = path;
    }
  }
}

export const router = new Router();
