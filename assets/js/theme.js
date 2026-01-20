document.addEventListener('DOMContentLoaded', () => {
  const modeToggle = document.getElementById('mode-toggle');
  const modePreference = localStorage.getItem('modePreference') || 'auto';
  const rootElement = document.documentElement;

  const resolveAutoMode = () => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'day' : 'night';
  };

  const applyModePreference = (value) => {
    const finalMode = value === 'day' || value === 'night' ? value : resolveAutoMode();
    document.documentElement.setAttribute('data-mode', finalMode);
  };

  const applyFestivalTheme = ({ festival, level }) => {
    rootElement.dataset.festivalTheme = festival;
    rootElement.dataset.festivalLevel = level;
    rootElement.setAttribute('data-festival', festival);
    rootElement.setAttribute('data-festival-level', level);
  };

  const parseLocalDate = (value) => {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return null;
    }
    return new Date(year, month - 1, day);
  };

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const addDays = (date, offset) => {
    const result = new Date(date);
    result.setDate(result.getDate() + offset);
    return result;
  };

  const resolveFestivalLevel = (importance) => {
    if (importance === 'religious_major' || importance === 'school') {
      return 'full';
    }
    return 'subtle';
  };

  const getBadgeMessage = (event) => {
    const parts = [`Theme: ${event.name || event.id}`];
    if (modePreference === 'auto') {
      parts.push('(Auto)');
    }
    return parts.join(' ');
  };

  const renderFestivalBadge = (event) => {
    if (!event) {
      return;
    }
    if (!event.themeId || event.themeId === 'none') {
      return;
    }

    const dismissedUntil = localStorage.getItem('badgeDismissedUntil');
    if (dismissedUntil === event.id) {
      return;
    }

    const existing = document.querySelector('.theme-badge');
    if (existing) {
      existing.remove();
    }

    const badge = document.createElement('div');
    badge.className = 'theme-badge';
    badge.setAttribute('role', 'status');
    badge.innerHTML = `
      <span class="theme-badge__text">${getBadgeMessage(event)}</span>
      <button type="button" class="theme-badge__dismiss" aria-label="Dismiss theme badge">×</button>
    `;

    const dismissButton = badge.querySelector('.theme-badge__dismiss');
    if (dismissButton) {
      dismissButton.addEventListener('click', () => {
        localStorage.setItem('badgeDismissedUntil', event.id);
        badge.remove();
      });
    }

    const header = document.querySelector('header');
    if (header?.parentElement) {
      header.parentElement.insertBefore(badge, header.nextSibling);
    } else {
      document.body.appendChild(badge);
    }
  };

  const loadFestivalTheme = async () => {
    const festivalPreference = localStorage.getItem('festivalEnabled');
    if (festivalPreference === 'false') {
      applyFestivalTheme({ festival: 'none', level: 'subtle' });
      return;
    }

    try {
      const response = await fetch('/assets/themes/festivals.generated.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Festival data unavailable: ${response.status}`);
      }
      const data = await response.json();
      const events = Array.isArray(data.resolvedEvents) ? data.resolvedEvents : [];
      const priorityOrder = Array.isArray(data.priorityOrder)
        ? data.priorityOrder
        : ['religious_major', 'religious_secondary', 'school', 'national'];
      const priorityRank = new Map(priorityOrder.map((importance, index) => [importance, index]));
      const today = startOfDay(new Date());

      const activeEvents = events
        .map((event) => {
          const startDate = parseLocalDate(event.startDate);
          const endDate = parseLocalDate(event.endDate);
          if (!startDate || !endDate) {
            return null;
          }
          const activeStart = addDays(startDate, -5);
          const activeEnd = addDays(endDate, 2);
          if (today < startOfDay(activeStart) || today > startOfDay(activeEnd)) {
            return null;
          }
          return { ...event, startDate, endDate };
        })
        .filter(Boolean);

      const winner = activeEvents.sort((a, b) => {
        const rankA = priorityRank.has(a.importance) ? priorityRank.get(a.importance) : Number.POSITIVE_INFINITY;
        const rankB = priorityRank.has(b.importance) ? priorityRank.get(b.importance) : Number.POSITIVE_INFINITY;
        if (rankA !== rankB) {
          return rankA - rankB;
        }
        const diffA = Math.abs(today - startOfDay(a.startDate));
        const diffB = Math.abs(today - startOfDay(b.startDate));
        if (diffA !== diffB) {
          return diffA - diffB;
        }
        return String(a.id).localeCompare(String(b.id));
      })[0];

      if (!winner) {
        applyFestivalTheme({ festival: 'none', level: 'subtle' });
        return;
      }

      applyFestivalTheme({
        festival: winner.themeId || 'none',
        level: resolveFestivalLevel(winner.importance),
      });
      renderFestivalBadge(winner);
    } catch (error) {
      applyFestivalTheme({ festival: 'none', level: 'subtle' });
    }
  };

  if (modeToggle) {
    modeToggle.value = modePreference;
    modeToggle.addEventListener('change', (event) => {
      const value = event.target.value;
      localStorage.setItem('modePreference', value);
      applyModePreference(value);
    });
  }

  applyModePreference(modePreference);
  void loadFestivalTheme();
});
