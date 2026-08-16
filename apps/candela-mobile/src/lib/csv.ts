import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import type { SessionResultData } from '@candela/shared/rn';

export async function shareSessionCsv(data: SessionResultData): Promise<void> {
  const headers = Object.keys(data).join(',');
  const values = Object.values(data)
    .map((value) => {
      const text = String(value ?? '');
      return text.includes(',') ? `"${text.replace(/"/g, '""')}"` : text;
    })
    .join(',');
  const csv = `${headers}\n${values}`;
  const slug = data.gameName ? data.gameName.toLowerCase().replace(/\s+/g, '-') : 'results';
  const path = `${FileSystem.cacheDirectory}game-session-completed-${slug}.csv`;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Export session CSV' });
  }
}
