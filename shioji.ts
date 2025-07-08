#!/usr/bin/env bun

/**
 * 満ち潮・引き潮ICSファイル生成メインスクリプト
 * choi/{stationCode}.json から潮位データを読み込み、
 * 満ち潮・引き潮の期間を計算してICSファイルを生成する
 *
 * タイムゾーンは常にAsia/Tokyoに固定されます
 */

// タイムゾーンをAsia/Tokyoに固定
process.env.TZ = 'Asia/Tokyo';

import { generateICSContent, saveICSFile, type TidePeriod } from './src/ics-generator.ts';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 満ち潮・引き潮の型定義
 */
type ShiojiTideName = '満ち潮' | '引き潮';

/**
 * 潮位データの型定義（download.tsより）
 */
interface TideData {
  stationName: string;
  years: number[];
  levels: {
    time: Date;
    level: number;
  }[];
  extrema: {
    time: Date;
    level: number;
    type: 'high' | 'low';
  }[];
}

/**
 * 満ち潮・引き潮イベントの型定義
 */
interface TideEvent {
  type: 'rising' | 'falling'; // 満ち潮 | 引き潮
  startTime: Date;
  endTime: Date;
  startLevel: number;
  endLevel: number;
}

/**
 * extremaデータから満ち潮・引き潮期間を計算する
 * @param extrema 満潮・干潮の極値データ
 * @returns 満ち潮・引き潮イベントの配列
 */
function calculateTideEvents(extrema: TideData['extrema']): TideEvent[] {
  if (extrema.length < 2) {
    return [];
  }

  const events: TideEvent[] = [];

  for (let i = 0; i < extrema.length - 1; i++) {
    const current = extrema[i];
    const next = extrema[i + 1];

    // low -> high = 満ち潮 (rising)
    if (current.type === 'low' && next.type === 'high') {
      events.push({
        type: 'rising',
        startTime: current.time,
        endTime: next.time,
        startLevel: current.level,
        endLevel: next.level
      });
    }
    // high -> low = 引き潮 (falling)
    else if (current.type === 'high' && next.type === 'low') {
      events.push({
        type: 'falling',
        startTime: current.time,
        endTime: next.time,
        startLevel: current.level,
        endLevel: next.level
      });
    }
  }

  return events;
}

/**
 * TideEventをTidePeriod形式に変換する（ICS生成用）
 * @param events 満ち潮・引き潮イベントの配列
 * @returns TidePeriodの配列
 */
function convertToTidePeriods(events: TideEvent[]): TidePeriod[] {
  return events.map(event => {
    const emoji = event.type === 'rising' ? '↗️' : '↘️';
    const displayName = event.type === 'rising' ? '満ち潮' : '引き潮';
    const startLevel = Math.round(event.startLevel);
    const endLevel = Math.round(event.endLevel);
    const tideNameWithLevels = `${emoji} ${displayName} (${startLevel} → ${endLevel}cm)`;

    return {
      tideName: tideNameWithLevels as any,
      startDate: event.startTime,
      startTime: event.startTime,
      endDate: event.endTime,
      endTime: event.endTime,
    };
  });
}

/**
 * 満ち潮・引き潮イベントから表示用の名前を取得する
 * @param event 満ち潮・引き潮イベント
 * @returns 表示用の名前
 */
function getTideEventDisplayName(event: TideEvent): string {
  return event.type === 'rising' ? '満ち潮' : '引き潮';
}

/**
 * 日付を日本語形式でフォーマットする
 * @param date フォーマット対象の日付
 * @returns 日本語形式の日付文字列
 */
function formatDateJapanese(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

/**
 * 単一ステーションの満ち潮・引き潮ICSファイルを生成する
 * @param stationCode ステーションコード
 * @param tideData 潮位データ
 */
async function generateStationICS(stationCode: string, tideData: TideData): Promise<void> {
  try {
    // extremaデータをソート（時刻順）
    const sortedExtrema = [...tideData.extrema].sort((a, b) =>
      new Date(a.time).getTime() - new Date(b.time).getTime()
    );

    // 満ち潮・引き潮期間を計算
    const tideEvents = calculateTideEvents(sortedExtrema);

    if (tideEvents.length === 0) {
      console.warn(`⚠️ ${stationCode} (${tideData.stationName}): 満ち潮・引き潮データが見つかりません`);
      return;
    }

    // TidePeriod形式に変換
    const tidePeriods = convertToTidePeriods(tideEvents);

    // ICSファイル内容を生成
    const calendarName = `${tideData.stationName} 満ち潮・引き潮カレンダー`;
    const icsContent = generateICSContent(tidePeriods, calendarName, `${tideData.stationName} の別の満ち潮・引き潮情報`, false);

    // 出力ディレクトリを作成
    const outputDir = './build/shioji';
    await fs.mkdir(outputDir, { recursive: true });

    // ファイルを保存
    const outputPath = path.join(outputDir, `${stationCode}.ics`);
    await saveICSFile(icsContent, outputPath);

    // 統計情報を表示
    const risingCount = tideEvents.filter(e => e.type === 'rising').length;
    const fallingCount = tideEvents.filter(e => e.type === 'falling').length;

    console.log(`✅ ${stationCode} (${tideData.stationName}): 満ち潮 ${risingCount}回、引き潮 ${fallingCount}回`);

  } catch (error) {
    console.error(`❌ ${stationCode} (${tideData.stationName}): エラーが発生しました:`, error);
  }
}

/**
 * メイン処理
 */
async function main(): Promise<void> {
  try {
    console.log('🌊 満ち潮・引き潮ICSファイル生成を開始します...\n');

    // 実行時刻を取得（Asia/Tokyoタイムゾーンで統一）
    const now = new Date();
    console.log(`実行日時: ${formatDateJapanese(now)} ${now.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
    console.log(`タイムゾーン: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (固定: Asia/Tokyo)\n`);

    // choi/ ディレクトリから潮位データファイルを読み込み
    console.log('📂 choi/ ディレクトリから潮位データを読み込み中...');
    const choiDir = './choi';
    const files = await fs.readdir(choiDir);
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    console.log(`発見されたステーション: ${jsonFiles.length}件\n`);

    if (jsonFiles.length === 0) {
      console.warn('⚠️ choi/ ディレクトリにJSONファイルが見つかりません');
      return;
    }

    // 各ステーションのICSファイルを生成
    console.log('🌊 各ステーションの満ち潮・引き潮期間を計算中...');

    let processedCount = 0;
    let totalRisingEvents = 0;
    let totalFallingEvents = 0;
    const stationNameMap: Record<string, string> = {};

    for (const file of jsonFiles) {
      const stationCode = path.basename(file, '.json');
      const filePath = path.join(choiDir, file);

      try {
        // JSONファイルを読み込み
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const tideData: TideData = JSON.parse(fileContent);

        // NOTE: ここ型がおかしいのでそのうち直す
        // @ts-ignore
        stationNameMap[stationCode] = tideData.stationName.name || '(Unknown Station)';

        // 日付文字列をDateオブジェクトに変換
        tideData.extrema = tideData.extrema.map(item => ({
          ...item,
          time: new Date(item.time)
        }));

        // stationNameがオブジェクトの場合、nameプロパティを取得
        if (typeof tideData.stationName === 'object' && tideData.stationName !== null) {
          tideData.stationName = (tideData.stationName as any).name || 'Unknown Station';
        }

        // ICSファイルを生成
        await generateStationICS(stationCode, tideData);

        // 統計用カウント
        const sortedExtrema = [...tideData.extrema].sort((a, b) =>
          new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        const events = calculateTideEvents(sortedExtrema);
        totalRisingEvents += events.filter(e => e.type === 'rising').length;
        totalFallingEvents += events.filter(e => e.type === 'falling').length;

        processedCount++;

      } catch (error) {
        console.error(`❌ ${stationCode}: ファイル処理エラー:`, error);
      }
    }

    fs.writeFile('./build/shioji.json', JSON.stringify(stationNameMap, null, 2), 'utf-8')

    console.log('\n=== 処理完了統計 ===');
    console.log(`処理済みステーション: ${processedCount}/${jsonFiles.length}件`);
    console.log(`総満ち潮イベント: ${totalRisingEvents}回`);
    console.log(`総引き潮イベント: ${totalFallingEvents}回`);
    console.log(`総イベント数: ${totalRisingEvents + totalFallingEvents}回`);

    console.log('\n✅ 満ち潮・引き潮ICSファイルの生成が完了しました！');
    console.log(`出力ディレクトリ: build/shioji/`);
    console.log(`生成ファイル数: ${processedCount}件`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみメイン処理を実行
if (import.meta.main) {
  main();
}
