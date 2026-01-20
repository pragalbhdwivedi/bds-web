document.addEventListener('DOMContentLoaded', () => {
  const modeToggle = document.getElementById('mode-toggle');
  const modePreference = localStorage.getItem('modePreference') || 'auto';

  const resolveAutoMode = () => {
    const hour = new Date().getHours();
    return hour >= 7 && hour < 19 ? 'day' : 'night';
  };

  const applyModePreference = (value) => {
    const finalMode = value === 'day' || value === 'night' ? value : resolveAutoMode();
    document.documentElement.setAttribute('data-mode', finalMode);
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
});
