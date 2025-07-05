/**
 * 潮位表CSVファイルの読み込み・解析機能
 */

import type { HarmonicConstants } from './harmonic-calculator.ts';

export interface StationData {
  番号: string;
  地点記号: string;
  掲載地点名: string;
  緯度: string;
  経度: string;
  'MSL-潮位表基準面': string;
  MSLの標高: string;
  潮位表基準面の標高: string;
  'M2の振幅': string;
  'M2の遅角': string;
  'S2の振幅': string;
  'S2の遅角': string;
  'K1の振幅': string;
  'K1の遅角': string;
  'O1の振幅': string;
  'O1の遅角': string;
  分潮一覧表: string;
  備考: string;
}

/**
 * JSON文字列から地点名を抽出
 */
function extractStationName(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString);
    return parsed.text || '';
  } catch {
    // JSON解析に失敗した場合は元の文字列を返す
    return jsonString;
  }
}

/**
 * 数値文字列を安全にパース
 */
function parseNumber(value: string): number {
  if (!value || value === '-') {
    return 0;
  }
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
}

/**
 * CSVファイルから指定された地点記号の調和定数を取得
 */
export async function loadHarmonicConstants(
  stationCode: string,
  year: number
): Promise<HarmonicConstants | null> {
  // 2026年以降は2026年のデータを使用
  const dataYear = year >= 2026 ? 2026 : year;
  const csvPath = `./cyoihyo/${dataYear}.csv`;

  try {
    const csvContent = await Bun.file(csvPath).text();
    const lines = csvContent.split('\n');

    if (lines.length < 2) {
      throw new Error('CSVファイルが空または不正です');
    }

    // ヘッダー行を解析
    const headers = lines[0].split(',');

    // データ行を検索
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      if (values.length < headers.length) continue;

      // 地点記号をチェック
      const currentStationCode = values[1]; // 2番目のカラムが地点記号
      if (currentStationCode === stationCode) {
        // 調和定数を抽出
        const stationName = extractStationName(values[2]);
        const baseLevel = parseNumber(values[7]); // 潮位表基準面の標高

        const harmonics: HarmonicConstants = {
          stationCode,
          stationName,
          baseLevel,
          M2: {
            amplitude: parseNumber(values[8]),  // M2の振幅
            phase: parseNumber(values[9])       // M2の遅角
          },
          S2: {
            amplitude: parseNumber(values[10]), // S2の振幅
            phase: parseNumber(values[11])      // S2の遅角
          },
          K1: {
            amplitude: parseNumber(values[12]), // K1の振幅
            phase: parseNumber(values[13])      // K1の遅角
          },
          O1: {
            amplitude: parseNumber(values[14]), // O1の振幅
            phase: parseNumber(values[15])      // O1の遅角
          }
        };

        return harmonics;
      }
    }

    return null; // 地点が見つからない
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error}`);
    return null;
  }
}

/**
 * 利用可能な全地点記号を取得
 */
export async function getAvailableStations(year: number = 2026): Promise<string[]> {
  const dataYear = year >= 2026 ? 2026 : year;
  const csvPath = `./cyoihyo/${dataYear}.csv`;

  try {
    const csvContent = await Bun.file(csvPath).text();
    const lines = csvContent.split('\n');

    const stations: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(',');
      if (values.length >= 2) {
        const stationCode = values[1];
        if (stationCode && stationCode !== '地点記号') {
          stations.push(stationCode);
        }
      }
    }

    return stations;
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error}`);
    return [];
  }
}
