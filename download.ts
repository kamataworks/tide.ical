import * as cheerio from 'cheerio';
import fs from 'node:fs/promises'

async function downloadChoihyo() {

  const landingUrl = 'https://www.data.jma.go.jp/kaiyou/db/tide/suisan/index.php'

  const htmlResp = await fetch(landingUrl)
  const html = await htmlResp.text()
  const $ = cheerio.load(html);
  const years: string[] = [];
  const formAction = $('#choihyolist').attr('action')


  const headerMap: Record<string, { type: 'string' | 'degreeAndMinute' | 'number' | 'linkText', normalizedName: string }> = {
      "番号": { type: "string", normalizedName: "number" },
      "地点記号": { type: "string", normalizedName: "stationCode" },
      "掲載地点名": { type: "linkText", normalizedName: "station" },
      "緯度": { type: "degreeAndMinute", normalizedName: "latitude" },
      "経度": { type: "degreeAndMinute", normalizedName: "longitude" },
      "MSL-潮位表基準面": { type: "number", normalizedName: "MSLTideStandardSurface" },
      "MSLの標高": { type: "number", normalizedName: "MSLAltitude" },
      "潮位表基準面の標高": { type: "number", normalizedName: "tideStandardSurfaceAltitude" },
      "主要4分潮/M2/M2の振幅": { type: "number", normalizedName: "M2Amplitude" },
      "主要4分潮/M2/M2の遅角": { type: "number", normalizedName: "M2Phase" },
      "主要4分潮/S2/S2の振幅": { type: "number", normalizedName: "S2Amplitude" },
      "主要4分潮/S2/S2の遅角": { type: "number", normalizedName: "S2Phase" },
      "主要4分潮/K1/K1の振幅": { type: "number", normalizedName: "K1Amplitude" },
      "主要4分潮/K1/K1の遅角": { type: "number", normalizedName: "K1Phase" },
      "主要4分潮/O1/O1の振幅": { type: "number", normalizedName: "O1Amplitude" },
      "主要4分潮/O1/O1の遅角": { type: "number", normalizedName: "O1Phase" },
      "分潮一覧表": { type: "linkText", normalizedName: "harmonic60Constants" },
      "備考": { type: "string", normalizedName: "remarks" },
  }

  $('#choihyolist > select[name="ys"] option').each((_, option) => {
    const year = $(option).attr('value');
    if (year) {
      years.push(year)
    };
  });

  if(!formAction) {
    throw new Error('スクレイピングが失敗しました。')
  }
  const postUrl = new URL(formAction, landingUrl).toString();

  await fs.mkdir('./choihyo', { recursive: true })

  // 年ごとに潮汐調和定数表をダウンロード
  for (const year of years) {
    const choihyoResp = await fetch(postUrl, { method: 'POST' })
    const choihyoHtml = await choihyoResp.text()

    const $ = cheerio.load(choihyoHtml)

    // ヘッダー構築
    const rows: { abbr: string, colspan: number, rowspan: number }[][] = [];
    $('table.data2 thead tr, table.data2 tbody tr').slice(0, 3).each((_, tr) => {
      const row: { abbr: string, colspan: number, rowspan: number }[] = [];
      $(tr).children('th').each((_, th) => {
        const $th = $(th);
        const abbr = $th.attr('abbr') || $th.text().replace(/\s+/g, ' ').trim();
        const colspan = parseInt($th.attr('colspan') || '1');
        const rowspan = parseInt($th.attr('rowspan') || '1');
        row.push({ abbr, colspan, rowspan });
      });
      rows.push(row);
    });

    const maxDepth = rows.length;
    const table: string[][] = Array.from({ length: maxDepth }, () => []);

    rows.forEach((row, rowIndex) => {
      let colIndex = 0;
      row.forEach(cell => {
        while (table[rowIndex][colIndex]) colIndex++;
        for (let i = 0; i < cell.rowspan; i++) {
          for (let j = 0; j < cell.colspan; j++) {
            table[rowIndex + i][colIndex + j] = cell.abbr;
          }
        }
        colIndex += cell.colspan;
      });
    });

    // フラットな列名を構築
    const colCount = table[0].length;
    const headers: string[] = [];
    for (let col = 0; col < colCount; col++) {
      const parts: string[] = [];
      for (let row = 0; row < maxDepth; row++) {
        const val = table[row][col];
        if (val && (parts.length === 0 || parts[parts.length - 1] !== val)) {
          parts.push(val);
        }
      }
      headers.push(parts.join('/'));
    }

    // データ行を抽出
    const dataRows: any[] = [];
    $('table.data2 tbody tr.mtx').each((_, tr) => {
      const tds = $(tr).find('td');
      if (tds.length !== headers.length) return; // 備考行など無視
      const rowData = {};
      tds.each((i, td) => {
        const cell = $(td);
        const name = cell.text().trim().replace(/\s+/g, ' ');
        const relative_href = cell.find('a').attr('href')
        const href = relative_href ? new URL(relative_href, postUrl).toString() : null;

        if(href) {
          // @ts-ignore
          rowData[headers[i]] = { name, href };
        } else {
          // @ts-ignore
          rowData[headers[i]] = name;
        }
      });
      dataRows.push(rowData);
    });

    const jsonArray = dataRows.map(row => {
      const jsonRow: Record<string, string | { degree: number, minute: number } | number | { name: string, href: string }> = {};
      for (const [key, value] of Object.entries(row)) {
        switch(headerMap[key].type){
          case 'string':
            jsonRow[headerMap[key].normalizedName] = value as string;
            break;
          case 'degreeAndMinute':
            const degreeAndMinute = value as string; // 例: 139゜33'
            const match = degreeAndMinute.match(/^(\d+)゜(\d+)'$/);
            if (match) {
              const degree = parseInt(match[1], 10);
              const minute = parseInt(match[2], 10);
              jsonRow[headerMap[key].normalizedName] = { degree, minute };
            } else {
              jsonRow[headerMap[key].normalizedName] = 0; // 無効な値の場合は0
            }
            break;
          case 'number':
            jsonRow[headerMap[key].normalizedName] = parseFloat(value as string) || 0;
            break;
          case 'linkText':
            jsonRow[headerMap[key].normalizedName] = value as any;
            break;
        }
      }
      return jsonRow;
    })

    await fs.writeFile(`./choihyo/${year}.json`, JSON.stringify(jsonArray, null, 2), 'utf-8')

    await new Promise((resolve => setTimeout(resolve, 2000)))
  }
}

function tideLevelParser (year: number, month:number, day: number) {
  return (tide: string) => {
    const hour = parseInt(tide.slice(0, 2), 10);
    const minute = parseInt(tide.slice(2, 4), 10);
    const level = parseInt(tide.slice(4, 7), 10);
    return {
      time: (hour === 99 || minute === 99) ? null : new Date(year, month - 1, day, hour, minute),
      level: level === 999 ? null : level,
    };
  }
}

async function downloadCalculatedChoiData() {
  // 前後3年間の潮位データをダウンロードしてパース
  const thisYear = new Date().getFullYear();
  const targetYears = [thisYear - 1, thisYear, thisYear + 1];

  await fs.mkdir('./choi', { recursive: true });

  type TideData = {
    stationName: string,
    years: number[],
    levels: {
      time: Date,
      level: number,
    }[],
    extrema: {
      time: Date,
      level: number,
      type: 'high' | 'low',
    }[],
  }

  const result: Record<string, TideData> = {};

  let count = 0;

  for (const year of targetYears) {
    const choihyo = JSON.parse(await fs.readFile(`./choihyo/${year}.json`, 'utf-8'))
    const stationCodes = choihyo.map((row: any) => row.stationCode);

    for (const stationCode of stationCodes) {

      // TODO: テキストファイルは一旦キャッシュするべき

      const txtUrl = `https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/${year}/${stationCode}.txt`;
      const txtResp = await fetch(txtUrl);
      if (!txtResp.ok) {
        console.error(`❌ ${year}年の地点記号 '${stationCode}' の潮位データが見つかりません。`);
        continue;
      }

      const txtData = await txtResp.text();
      const lines = txtData.split('\n').filter(line => line.trim() !== '');

      for(const line of lines) {
        // 　毎時潮位データ	：	　１～　７２カラム	　３桁×２４時間（０時から２３時）
        // 　年月日	：	７３～　７８カラム	　２桁×３
        // 　地点記号	：	７９～　８０カラム	　２桁英数字記号
        // 　満潮時刻・潮位	：	８１～１０８カラム	　時刻４桁（時分）、潮位３桁（ｃｍ）
        // 　干潮時刻・潮位	：	１０９～１３６カラム	　時刻４桁（時分）、潮位３桁（ｃｍ）
        // ※ 満（干）潮が予測されない場合、満（干）潮時刻を「9999」、潮位を「999」としています。
        const tideLevels = (line.slice(0, 72).match(/.{1,3}/g) || []).map(val => parseInt(val, 10));
        const _year = parseInt(line.slice(72, 74).trim(), 10) + 2000;
        const month = parseInt(line.slice(74, 76).trim(), 10);
        const day = parseInt(line.slice(76, 78).trim(), 10);
        const _stationCode = line.slice(78, 80).trim();
        const highTides = (line.slice(80, 108).match(/.{1,7}/g) || []).map(tideLevelParser(year, month, day)).filter(x => x.time !== null && x.level !== null) as TideData['extrema'];
        const lowTides = (line.slice(108, 136).match(/.{1,7}/g) || []).map(tideLevelParser(year, month, day)).filter(x => x.time !== null && x.level !== null) as TideData['extrema'];

        if(_year !== year || _stationCode !== stationCode) {
          console.warn(`⚠️ 年または地点記号が一致しません: ${_year}-${month}-${day} ${_stationCode} (期待: ${year}-${month}-${day} ${stationCode})`);
        }

        if (!result[stationCode]) {
          result[stationCode] = {
            years: targetYears,
            stationName: choihyo.find((row: any) => row.stationCode === stationCode)?.station || '不明',
            levels: [],
            extrema: [],
          };
        }

        result[stationCode].levels.push(
          ...tideLevels.map((level, hour) => ({
            level,
            time: new Date(year, month - 1, day, hour, 0)
          }))
        )
        result[stationCode].extrema.push(
          ...highTides.map(tide => ({
            time: tide.time,
            level: tide.level,
            type: 'high' as const,
          })),
          ...lowTides.map(tide => ({
            time: tide.time,
            level: tide.level,
            type: 'low' as const,
          }))
        )

      } // line

      await new Promise((resolve => setTimeout(resolve, 2000 + Math.random() * 2000))); // 2秒〜4秒待機して、サーバーへの負荷を軽減
      const totalCount = targetYears.length * stationCodes.length;
      count++
      console.error(`[${count}/${totalCount}] ${year}年の地点記号 '${stationCode}' の潮位データを取得しました。`);
    } // station

  } // year

  const stationCodes = Object.keys(result);
  for (const stationCode of stationCodes) {
    const data = result[stationCode];
    data.levels.sort((a, b) => a.time.getTime() - b.time.getTime());
    data.extrema.sort((a, b) => a.time.getTime() - b.time.getTime());
    const outputPath = `./choi/${stationCode}.json`;
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  }
}

await downloadChoihyo()
await downloadCalculatedChoiData()
