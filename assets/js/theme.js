document.addEventListener('DOMContentLoaded', () => {
  const modeToggle = document.getElementById('mode-toggle');
  const modePreference = localStorage.getItem('modePreference') || 'auto';
  const festivalPreference = localStorage.getItem('festivalEnabled') !== 'false';
  const rootElement = document.documentElement;

  const resolveAutoMode = () => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'day' : 'night';
  };

  const applyModePreference = (value) => {
    const finalMode = value === 'day' || value === 'night' ? value : resolveAutoMode();
    document.documentElement.setAttribute('data-mode', finalMode);
  };

  const applyFestivalTheme = ({ festival, level, force = false }) => {
    rootElement.dataset.festivalTheme = festival;
    rootElement.dataset.festivalLevel = level;
    if (!festivalPreference && !force) {
      rootElement.setAttribute('data-festival', 'none');
      rootElement.setAttribute('data-festival-level', 'subtle');
      return;
    }
    rootElement.setAttribute('data-festival', festival);
    rootElement.setAttribute('data-festival-level', level);
  };

  const resolveFestivalLevel = (event) => {
    if (!event) {
      return 'subtle';
    }
    if (event.level === 'full' || event.level === 'subtle') {
      return event.level;
    }
    return event.importance === 'religious_major' ? 'full' : 'subtle';
  };

  const loadFestivalTheme = async () => {
    try {
      const response = await fetch('/assets/themes/festivals.generated.json', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Festival data unavailable: ${response.status}`);
      }
      const data = await response.json();
      const event = Array.isArray(data.resolvedEvents) ? data.resolvedEvents[0] : null;
      const festival = event?.themeId || 'none';
      const level = festival === 'none' ? 'subtle' : resolveFestivalLevel(event);
      applyFestivalTheme({ festival, level });
    } catch (error) {
      applyFestivalTheme({ festival: 'none', level: 'subtle', force: true });
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
