export function downloadSettingsBackup() {
  const data = {
    theme: localStorage.getItem('scholarx-theme') || 'dark',
    language: localStorage.getItem('scholarx-lang') || 'en',
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scholarx-settings-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importSettingsBackup(json: string) {
  try {
    const data = JSON.parse(json);
    if (data.theme) localStorage.setItem('scholarx-theme', data.theme);
    if (data.language) localStorage.setItem('scholarx-lang', data.language);
    return true;
  } catch {
    return false;
  }
}
