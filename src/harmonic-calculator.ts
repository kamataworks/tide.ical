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
    phase_direction: 1 | -1; // 遅角の符号（1: 正, -1: 負）
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

// 分潮の周期定数（時間）
const TIDAL_PERIODS = {
  M2: 12.4206012, // 主太陰半日周潮
  S2: 12.0000000, // 主太陽半日周潮
  K1: 23.9344696, // 太陰太陽日周潮
  O1: 25.8193417  // 主太陰日周潮
} as const;

/**
 * 度をラジアンに変換
 */
function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

/**
 * 基準時からの経過時間を計算（時間単位）
 * 基準時: 2000年1月1日 00:00:00 UTC
 */
function getHoursSinceEpoch(date: Date): number {
  const epoch = new Date('2000-01-01T00:00:00Z');
  const diffMs = date.getTime() - epoch.getTime();
  return diffMs / (1000 * 60 * 60); // ミリ秒を時間に変換
}

/**
 * 指定時刻の潮位を計算
 */
export function calculateTideLevel(time: Date, harmonics: HarmonicConstants): number {
  const t = getHoursSinceEpoch(time);

  const tideLevel = harmonics.values.reduce((tideLevel, harmonic) => {
    const period = TIDAL_PERIODS[harmonic.type];
    const phase_direction = harmonic.phase_direction;
    const angular = (2 * Math.PI / period) * t;
    // NOTE: おそらく、phase の反映のさせ方？M2, S2, K1, O1 で+- が異なるとか？
    return tideLevel + harmonic.amplitude * Math.cos(angular - phase_direction * degreesToRadians(harmonic.phase))
  }, harmonics.baseLevel)

  return tideLevel
}

/**
 * 指定期間の潮位データを1分間隔で生成
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
    current.setMinutes(current.getMinutes() + 1);
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
