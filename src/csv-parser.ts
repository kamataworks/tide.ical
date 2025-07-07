/**
 * 潮位表CSVファイルの読み込み・解析機能
 */

import { exit } from 'process';
import type { HarmonicConstants } from './harmonic-calculator.ts';

type Choi = {
    number: string,
    stationCode: string,
    station: {
      name: string,
      href: string,
    },
    latitude: {
      degree: number,
      minute: number,
    },
    longitude: {
      degree: number,
      minute: number,
    },
    mSLTideStandardSurface: number,
    MSLAltitude: number,
    tideStandardSurfaceAltitude: number,
    M2Amplitude: number,
    M2Phase: number,
    S2Amplitude: number,
    S2Phase: number,
    K1Amplitude: number,
    K1Phase: number,
    O1Amplitude: number,
    O1Phase: number,
    harmonic60Constants: {
      name: string,
      href: string,
    },
    remarks: string,
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
  const jsonPath = `./choihyo/${dataYear}.json`;

  try {
    const choiItems: Choi[] = await Bun.file(jsonPath).json();

    const choi = choiItems.find(item => item.stationCode === stationCode);

    if(!choi) {
      throw new Error(`指定された地点記号 ${stationCode} は見つかりませんでした。`);
    }


    const harmonics: HarmonicConstants = {
      stationCode,
      stationName: choi.station.name,
      baseLevel: choi.mSLTideStandardSurface, // 潮位表基準面の標高 // toDO: これを使って良いのか？
      values: [
        {
          type: 'M2',
          phase_direction: 1, // 正の遅角
          amplitude: choi.M2Amplitude,
          phase:     choi.M2Phase,
        },
        {
          type: 'S2',
          phase_direction: 1, // 正の遅角
          amplitude: choi.S2Amplitude,
          phase:     choi.S2Phase,
        },
        {
          type: 'K1',
          phase_direction: -1, // 負の遅角
          amplitude: choi.K1Amplitude,
          phase:     choi.K1Phase,
        },
        {
          type: 'O1',
          phase_direction: -1, // 負の遅角
          amplitude: choi.O1Amplitude,
          phase:     choi.O1Phase,
        },
      ]
    };

    return harmonics;

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
  const jsonPath = `./choihyo/${dataYear}.json`;

  try {
    const choiItems = (await Bun.file(jsonPath).json()) as Choi[];
    const stations = choiItems.map(item => item.stationCode).filter((value, index, self) => self.indexOf(value) === index);
    return stations;
  } catch (error) {
    console.error(`CSVファイルの読み込みエラー: ${error}`);
    return [];
  }
}
