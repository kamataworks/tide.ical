/**
 * ICSファイル生成機能
 * RFC 5545準拠のカレンダー形式で潮まわり情報を出力する
 */

import type { TideName } from './tide-calculator.ts';

export interface TidePeriod {
  tideName: TideName;
  startDate: Date;
  startTime?: Date; // 時刻情報はオプション
  endDate: Date;
  endTime?: Date; // 時刻情報はオプション
  emoji?: string;
}

/**
 * 日付をICS形式の文字列に変換する
 * @param date 変換対象の日付
 * @returns ICS形式の日付文字列（YYYYMMDD）
 */
function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * 日付時刻をICS形式のUTC文字列に変換する
 * @param date 変換対象の日付時刻
 * @returns ICS形式の日付時刻文字列（YYYYMMDDTHHMMSSZ）
 */
function formatICSDateTime(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/**
 * ICS形式のテキストを折り返す（75文字制限）
 * @param text 折り返し対象のテキスト
 * @returns 折り返されたテキスト
 */
function foldICSText(text: string): string {
  if (text.length <= 75) return text;

  const lines: string[] = [];
  let currentLine = text.substring(0, 75);
  let remaining = text.substring(75);

  lines.push(currentLine);

  while (remaining.length > 0) {
    const nextChunk = remaining.substring(0, 74); // スペース分を考慮
    remaining = remaining.substring(74);
    lines.push(' ' + nextChunk);
  }

  return lines.join('\r\n');
}

/**
 * 潮まわり期間からICSイベントを生成する
 * @param tidePeriod 潮まわり期間
 * @param uid イベントのUID
 * @param wholeDay 終日イベントかどうか（デフォルトはtrue）
 * @returns ICSイベント文字列
 */
function generateICSEvent(tidePeriod: TidePeriod, uid: string, wholeDay = true): string {
  const start = wholeDay ?
    `DTSTART;VALUE=DATE:${formatICSDate(tidePeriod.startDate)}` :
    `DTSTART:${formatICSDateTime(tidePeriod.startDate)}`;

  const end = wholeDay ?
    `DTEND;VALUE=DATE:${formatICSDate(tidePeriod.endDate)}` :
    `DTEND:${formatICSDateTime(tidePeriod.endDate)}`;

  const summary = tidePeriod.emoji
    ? `${tidePeriod.emoji} ${tidePeriod.tideName}`
    : tidePeriod.tideName;

  const event = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    start,
    end,
    foldICSText(`SUMMARY:${summary}`),
    'END:VEVENT'
  ]
    .filter(Boolean)
    .join('\r\n');

  return event;
}


function encodeUniqueId(yyyymmdd: string) {
  // YYYYMMDD → 日付オブジェクト
  const year = parseInt(yyyymmdd.slice(0, 4), 10);
  const month = parseInt(yyyymmdd.slice(4, 6), 10) - 1; // 0-based month
  const day = parseInt(yyyymmdd.slice(6, 8), 10);
  const date = new Date(Date.UTC(year, month, day));

  // 1970-01-01 UTC からの経過日数
  const epochMs = date.getTime();
  const epochDays = Math.floor(epochMs / (1000 * 60 * 60 * 24));

  // Base36エンコード（小文字）
  const dateStr = epochDays.toString(36);

  return dateStr;
}

/**
 * 潮まわり期間の配列からICSファイルの内容を生成する
 * @param tidePeriods 潮まわり期間の配列
 * @param calendarName カレンダー名（オプション）
 * @returns ICSファイルの内容
 */
export function generateICSContent(
  tidePeriods: TidePeriod[],
  calendarName: string = '潮まわりカレンダー',
  caldesc: string,
  wholeDay: boolean = true,
): string {
  // ICSヘッダー
  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tide.ical//Tide Calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldICSText(`X-WR-CALNAME:${calendarName}`),
    'X-WR-TIMEZONE:Asia/Tokyo',
    `X-WR-CALDESC:${caldesc}`
  ].join('\r\n');

  // イベント生成
  const events = tidePeriods.map((period) => {
    const yyyymmdd = formatICSDate(period.startDate);
    const uid = wholeDay ? encodeUniqueId(yyyymmdd) : `${encodeUniqueId(yyyymmdd)}-${period.startDate.getHours()}${period.startDate.getMinutes()}`;
    return generateICSEvent(period, uid, wholeDay);
  }).join('\r\n');

  // ICSフッター
  const footer = 'END:VCALENDAR';

  return [header, events, footer].join('\r\n');
}

/**
 * ICSファイルをファイルシステムに保存する
 * @param content ICSファイルの内容
 * @param filePath 保存先のファイルパス
 */
export async function saveICSFile(content: string, filePath: string): Promise<void> {
  try {
    await Bun.write(filePath, content);
    console.log(`ICSファイルを生成しました: ${filePath}`);
  } catch (error) {
    console.error('ICSファイルの保存に失敗しました:', error);
    throw error;
  }
}

/**
 * 潮まわり期間の統計情報を生成する
 * @param tidePeriods 潮まわり期間の配列
 * @returns 統計情報
 */
export function generateTideStatistics(tidePeriods: TidePeriod[]): {
  totalPeriods: number;
  tideCount: Record<TideName, number>;
  dateRange: {
    start: Date;
    end: Date;
  };
} {
  if (tidePeriods.length === 0) {
    return {
      totalPeriods: 0,
      tideCount: { '大潮': 0, '中潮': 0, '小潮': 0, '長潮': 0, '若潮': 0 },
      dateRange: { start: new Date(), end: new Date() }
    };
  }

  const tideCount: Record<TideName, number> = {
    '大潮': 0,
    '中潮': 0,
    '小潮': 0,
    '長潮': 0,
    '若潮': 0
  };

  tidePeriods.forEach(period => {
    tideCount[period.tideName]++;
  });

  return {
    totalPeriods: tidePeriods.length,
    tideCount,
    dateRange: {
      start: new Date(tidePeriods[0].startDate),
      end: new Date(tidePeriods[tidePeriods.length - 1].endDate)
    }
  };
}
