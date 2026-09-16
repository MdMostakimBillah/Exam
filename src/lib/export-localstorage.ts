const PREFIX = 'scholarx_';
const KEYS = [
  'institutions',
  'students',
  'exams',
  'registrations',
  'results',
  'certificates',
  'payments',
  'exam-centers',
  'marks',
  'admit-cards',
  'classes',
  'notifications',
  'audit-logs',
  'system-settings',
  'users',
];

export function exportLocalStorageToJson(): string {
  const data: Record<string, any[]> = {};
  
  for (const key of KEYS) {
    try {
      const stored = localStorage.getItem(PREFIX + key);
      data[key] = stored ? JSON.parse(stored) : [];
    } catch {
      data[key] = [];
    }
  }
  
  return JSON.stringify(data, null, 2);
}

export function downloadLocalStorageBackup() {
  const json = exportLocalStorageToJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scholarx-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function saveLocalStorageToFile() {
  if (typeof window === 'undefined') return;
  
  const json = exportLocalStorageToJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '.localStorage.json';
  a.click();
  URL.revokeObjectURL(url);
  console.log('localStorage backup saved as .localStorage.json');
}