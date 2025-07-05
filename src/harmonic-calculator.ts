/**
 * 潮汐調和計算機能
 * 主要4分潮（M2, S2, K1, O1）を使用した潮位計算
 */

export interface HarmonicConstants {
  stationCode: string;
  stationName: string;
  baseLevel: number; // 潮位表基準面の標高
  M2: {
    amplitude: number; // 振幅 (cm)
    phase: number;     // 遅角 (度)
  };
  S2: {
    amplitude: number;
    phase: number;
  };
  K1: {
    amplitude: number;
    phase: number;
  };
  O1: {
    amplitude: number;
    phase: number;
  };
}

export interface TideData {
  datetime: string;
  tide_level: number;
}

export interface TideResult {
  station: string;
  station_name: string;
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

  let tideLevel = harmonics.baseLevel;

  // M2分潮
  const m2Angular = (2 * Math.PI / TIDAL_PERIODS.M2) * t;
  tideLevel += harmonics.M2.amplitude * Math.cos(m2Angular + degreesToRadians(harmonics.M2.phase));

  // S2分潮
  const s2Angular = (2 * Math.PI / TIDAL_PERIODS.S2) * t;
  tideLevel += harmonics.S2.amplitude * Math.cos(s2Angular + degreesToRadians(harmonics.S2.phase));

  // K1分潮
  const k1Angular = (2 * Math.PI / TIDAL_PERIODS.K1) * t;
  tideLevel += harmonics.K1.amplitude * Math.cos(k1Angular + degreesToRadians(harmonics.K1.phase));

  // O1分潮
  const o1Angular = (2 * Math.PI / TIDAL_PERIODS.O1) * t;
  tideLevel += harmonics.O1.amplitude * Math.cos(o1Angular + degreesToRadians(harmonics.O1.phase));

  return Math.round(tideLevel * 100) / 100; // 小数点以下2桁で四捨五入
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

    data.push({
      datetime: current.toISOString(),
      tide_level: tideLevel
    });

    // 1分進める
    current.setMinutes(current.getMinutes() + 1);
  }

  return {
    station: harmonics.stationCode,
    station_name: harmonics.stationName,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    },
    data
  };
}
