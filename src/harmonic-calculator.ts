/**
 * 潮汐調和計算機能
 * 主要4分潮（M2, S2, K1, O1）を使用した潮位計算
  M2: 主太陰半日周潮
  S2: 主太陽半日周潮
  K1: 日月合成日周潮
  O1: 主太陰日周潮
 */
export interface HarmonicConstants {
  stationCode: string;
  stationName: string;
  baseLevel: number; // 潮位表基準面の標高
  values: {
    type: 'M2' | 'S2' | 'K1' | 'O1'; // 分潮の種類
    amplitude: number; // 振幅 (cm)
    phase: number;     // 遅角 (度)
  }[],
}

export interface TideData {
  datetime: string;
  tide_level: number;
}

export interface TideResult {
  station: string;
  station_name: string;
  timezone: string; // タイムゾーン
  period: {
    start: string;
    end: string;
  };
  data: TideData[];
}

// 分潮の周期定数（角速度 degree/hour）
const ANGULAR_VELOCITIES = {
  M2: 28.9841042, // 主太陰半日周潮
  S2: 30.0000000, // 主太陽半日周潮
  K1: 15.0410686, // 日月合成日周潮
  O1: 13.9430356, // 主太陰日周潮
} as const;

/**
 * 度をラジアンに変換
 */
function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * 基準時からの経過時間を計算（時間単位）
 */
function getHoursSinceEpoch(date: Date): number {
  const epoch = new Date('1950-01-01T09:00:00.000Z');
  const diffMs = date.getTime() - epoch.getTime();
  return diffMs / (1000 * 60 * 60); // ミリ秒を時間に変換
}

/**
 * 指定時刻の潮位を計算
 */
export function calculateTideLevel(time: Date, harmonics: HarmonicConstants): number {
  const t = getHoursSinceEpoch(time);

  const tideLevel = harmonics.values.reduce((tideLevel, harmonic) => {
    const velocity = ANGULAR_VELOCITIES[harmonic.type];
    return tideLevel + harmonic.amplitude * Math.cos(degreesToRadians(t * velocity + harmonic.phase))
  }, harmonics.baseLevel)

  return tideLevel
}

/**
 * 指定期間の潮位データを1時間間隔で生成
 */
export function generateTideData(
  startDate: Date,
  endDate: Date,
  harmonics: HarmonicConstants
): TideResult {
  const data: TideData[] = [];

  // 1分間隔でループ
  const current = new Date(startDate);
  while (current <= endDate) {
    const tideLevel = calculateTideLevel(current, harmonics);
    const datetimeFormatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    data.push({
      datetime: datetimeFormatter.format(current),
      tide_level: tideLevel
    });

    // 1分進める
    current.setHours(current.getHours() + 1);
  }

  return {
    station: harmonics.stationCode,
    station_name: harmonics.stationName,
    timezone: 'Asia/Tokyo',
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    data
  };
}
