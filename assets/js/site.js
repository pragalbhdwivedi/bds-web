document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const menu = document.getElementById('primary-navigation');
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileBreakpoint = 768;

  if (!toggle || !menu) {
    return;
  }

  const loadingBar = document.createElement('div');
  loadingBar.id = 'loading-bar';
  document.body.appendChild(loadingBar);

  const setReadyState = () => {
    document.body.classList.add('page-ready');
  };

  const closeMenu = () => {
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.querySelectorAll('li.submenu-open').forEach((item) => {
      item.classList.remove('submenu-open');
      const link = item.querySelector(':scope > a');
      if (link) {
        link.setAttribute('aria-expanded', 'false');
      }
    });
  };

  const openMenu = () => {
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
  };

  const isMobile = () => window.innerWidth <= mobileBreakpoint;

  const setActiveLink = () => {
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    const links = menu.querySelectorAll('a[href]');
    links.forEach((link) => {
      const linkPath = link.getAttribute('href')?.replace(/\/+$/, '') || '/';
      if (linkPath === currentPath) {
        link.classList.add('active');
        const parentItem = link.closest('li')?.parentElement?.closest('li');
        if (parentItem) {
          const parentLink = parentItem.querySelector(':scope > a');
          if (parentLink) {
            parentLink.classList.add('active-parent');
          }
        }
      }
    });
  };

  const enhanceDropdowns = () => {
    menu.querySelectorAll('li').forEach((item) => {
      const link = item.querySelector(':scope > a');
      const submenu = item.querySelector(':scope > .submenu');
      if (link && submenu) {
        link.setAttribute('aria-haspopup', 'true');
        link.setAttribute('aria-expanded', 'false');
      }
    });
  };

  const handleMobileToggle = (event) => {
    if (!isMobile()) {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const link = target.closest('a');
    if (!link || !menu.contains(link)) {
      return;
    }

    const parentItem = link.closest('li');
    const submenu = parentItem?.querySelector(':scope > .submenu');

    if (submenu) {
      event.preventDefault();
      const isOpen = parentItem.classList.toggle('submenu-open');
      link.setAttribute('aria-expanded', String(isOpen));
    } else {
      closeMenu();
    }
  };

  const handleNavigation = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const link = target.closest('a');
    if (!link || link.target === '_blank') {
      return;
    }

    const parentItem = link.closest('li');
    const hasSubmenu = parentItem?.querySelector(':scope > .submenu');
    if (isMobile() && hasSubmenu) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    const url = new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return;
    }

    if (prefersReducedMotion.matches) {
      return;
    }

    event.preventDefault();
    document.body.classList.add('page-exit', 'loading');
    window.setTimeout(() => {
      window.location.href = url.href;
    }, 260);
  };

  toggle.addEventListener('click', () => {
    const isOpen = document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.addEventListener('click', (event) => {
    handleMobileToggle(event);
  });

  window.addEventListener('pageshow', setReadyState);

  window.addEventListener('resize', () => {
    if (!isMobile()) {
      closeMenu();
    }
  });

  enhanceDropdowns();
  setActiveLink();
  setReadyState();

  if (document.body.classList.contains('nav-open') && !isMobile()) {
    closeMenu();
  }

  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener('click', handleNavigation);
  });
});
