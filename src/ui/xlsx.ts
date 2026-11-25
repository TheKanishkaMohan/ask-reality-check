import {
  ASSUMPTION_REFERENCES,
  SECTOR_MULTIPLE_BENCHMARKS,
  UNIT_METADATA,
  evaluateAsk,
  formatMultiple,
  formatPercent,
  solveGoalSeek,
  type CheckInput,
  type CurrencyUnit,
  type GoalSeekTarget,
} from '../engine';

const TEXT_ENCODER = new TextEncoder();

// Standard IEEE 802.3 CRC-32 lookup table
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZipStore(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  const dosTime = (12 << 11) | (0 << 5) | 0;
  const dosDate = ((2026 - 1980) << 9) | (11 << 5) | 24;

  for (const entry of entries) {
    const nameBytes = TEXT_ENCODER.encode(entry.name);
    const data = entry.data;
    const sum = crc32(data);

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true);
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, sum, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, data.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    localParts.push(local, data);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, sum, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + data.length;
  }

  let cdSize = 0;
  for (const part of centralParts) {
    cdSize += part.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + cdSize + eocd.length;
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    out.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    out.set(part, pos);
    pos += part.length;
  }
  out.set(eocd, pos);
  return out;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sanitizeText(str: string): string {
  const cleaned = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  if (/^[=+\-@\t\r]/.test(cleaned)) {
    return `'${cleaned}`;
  }
  return cleaned;
}

function colLetter(colIdx1: number): string {
  let n = colIdx1;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

type CellSpec =
  | { kind: 'str'; value: string; style?: number }
  | { kind: 'num'; value: number; style?: number }
  | { kind: 'formula'; formula: string; value: number; style?: number };

interface SheetRow {
  rowNum: number;
  cells: Array<{ col: number; spec: CellSpec }>;
}

function renderCellXml(ref: string, spec: CellSpec): string {
  const sAttr = spec.style !== undefined ? ` s="${spec.style}"` : '';
  if (spec.kind === 'str') {
    const safe = escapeXml(sanitizeText(spec.value));
    return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${safe}</t></is></c>`;
  }
  if (spec.kind === 'num') {
    const num = Number.isFinite(spec.value) ? spec.value : 0;
    return `<c r="${ref}"${sAttr}><v>${num}</v></c>`;
  }
  const cached = Number.isFinite(spec.value) ? spec.value : 0;
  return `<c r="${ref}"${sAttr}><f>${escapeXml(spec.formula)}</f><v>${cached}</v></c>`;
}

function renderWorksheetXml(rows: SheetRow[], colWidths: number[]): string {
  const colsXml = colWidths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const rowsXml = rows
    .slice()
    .sort((a, b) => a.rowNum - b.rowNum)
    .map((row) => {
      const cellsXml = row.cells
        .slice()
        .sort((a, b) => a.col - b.col)
        .map((c) => renderCellXml(`${colLetter(c.col)}${row.rowNum}`, c.spec))
        .join('');
      return `<row r="${row.rowNum}">${cellsXml}</row>`;
    })
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${colsXml}</cols>` +
    `<sheetData>${rowsXml}</sheetData>` +
    '</worksheet>'
  );
}

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets>' +
  '<sheet name="Valuation Check" sheetId="1" r:id="rId1"/>' +
  '<sheet name="Rules &amp; Benchmarks" sheetId="2" r:id="rId2"/>' +
  '</sheets>' +
  '</workbook>';

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

const STYLES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="5">' +
  '<numFmt numFmtId="164" formatCode="#,##0.00"/>' +
  '<numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>' +
  '<numFmt numFmtId="166" formatCode="0.0&quot;x&quot;"/>' +
  '<numFmt numFmtId="167" formatCode="0"/>' +
  '<numFmt numFmtId="168" formatCode="0.0%"/>' +
  '</numFmts>' +
  '<fonts count="5">' +
  '<font><sz val="11"/><color rgb="FF1C1C1C"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FF1C1C1C"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><color rgb="FF007AFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><i/><sz val="10"/><color rgb="FF6E6E73"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="5">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFF3F3F3"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1C1C1C"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFEAF3FF"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left/><right/><top/><bottom style="thin"><color rgb="FFD2D2D7"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="12">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"/>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>' +
  '</cellXfs>' +
  '</styleSheet>';

export function buildXlsxFilename(input: CheckInput, unit: CurrencyUnit): string {
  const unitSlug =
    unit === 'INR_CR' ? 'cr' : unit === 'INR_LAKH' ? 'lakh' : 'usd-m';
  const rawAsk = Number.isFinite(input.ask) && input.ask > 0 ? String(Number(input.ask.toFixed(2))) : 'scenario';
  const askSlug = rawAsk.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `valuation-check-${askSlug}-${unitSlug}.xlsx`;
}

export function generateXlsxBytes(
  input: CheckInput,
  unit: CurrencyUnit,
  goalSeekTarget: GoalSeekTarget = 'max_ask',
  goalSeekGrowth?: number
): Uint8Array {
  const out = evaluateAsk(input, unit);
  const effBands = out.effectiveVerdictBands;
  const seek = solveGoalSeek(
    input,
    goalSeekTarget,
    goalSeekGrowth ?? effBands.reachableMax,
    unit
  );
  const unitLabel = UNIT_METADATA[unit].shortUnit;
  const reachBase = input.verdictBands.reachableMax;
  const stretchBase = input.verdictBands.stretchMax;

  const cagrRatio =
    out.metrics.impliedCagrPct.value !== null ? out.metrics.impliedCagrPct.value / 100 : 0;
  const cmgrRatio =
    out.metrics.impliedCmgrPct.value !== null ? out.metrics.impliedCmgrPct.value / 100 : 0;

  const sheet1Rows: SheetRow[] = [
    {
      rowNum: 1,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Valuation Check: Financial Summary', style: 2 } },
        { col: 2, spec: { kind: 'str', value: `Monetary unit: ${unitLabel}`, style: 10 } },
      ],
    },
    {
      rowNum: 3,
      cells: [
        { col: 1, spec: { kind: 'str', value: '1. Inputs', style: 3 } },
        { col: 2, spec: { kind: 'str', value: 'Value', style: 3 } },
        { col: 3, spec: { kind: 'str', value: 'Notes', style: 3 } },
      ],
    },
    {
      rowNum: 4,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Ask (intended raise, ${unitLabel})`, style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.ask, style: 5 } },
        { col: 3, spec: { kind: 'str', value: `Monetary amount in ${unitLabel}`, style: 0 } },
      ],
    },
    {
      rowNum: 5,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Target dilution (%)', style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.dilutionPct, style: 6 } },
        { col: 3, spec: { kind: 'str', value: 'Typical early-stage band: 20%–25%', style: 0 } },
      ],
    },
    {
      rowNum: 6,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Current annualised revenue (ARR, ${unitLabel})`, style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.annualRevenue, style: 5 } },
        { col: 3, spec: { kind: 'str', value: '12 × monthly revenue', style: 0 } },
      ],
    },
    {
      rowNum: 7,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Current monthly revenue (MRR, ${unitLabel}/mo)`, style: 1 } },
        { col: 2, spec: { kind: 'formula', formula: 'B6/12', value: input.annualRevenue / 12, style: 5 } },
        { col: 3, spec: { kind: 'str', value: 'Synced ARR ÷ 12', style: 0 } },
      ],
    },
    {
      rowNum: 8,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Previous raise (${unitLabel})`, style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.priorRaise, style: 5 } },
        {
          col: 3,
          spec: {
            kind: 'str',
            value: input.priorRaiseWasPriced ? 'Priced equity round (3–4x rule applies)' : 'Unpriced / grant / convertible',
            style: 0,
          },
        },
      ],
    },
    {
      rowNum: 9,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Required valuation step-up (x)', style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.stepUpMultiple, style: 7 } },
        { col: 3, spec: { kind: 'str', value: 'Next pre-money ÷ this post-money (2.0x benchmark)', style: 0 } },
      ],
    },
    {
      rowNum: 10,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Next-round revenue multiple (x ARR)', style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.nextRoundMultiple, style: 7 } },
        { col: 3, spec: { kind: 'str', value: 'Sector comparable exit/next-round multiple', style: 0 } },
      ],
    },
    {
      rowNum: 11,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Months to next round', style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.monthsToNextRound, style: 8 } },
        { col: 3, spec: { kind: 'str', value: 'Standard seed horizon: 15–18 months', style: 0 } },
      ],
    },
    {
      rowNum: 12,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Cash needed from burn plan (${unitLabel})`, style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.cashNeeded, style: 5 } },
        { col: 3, spec: { kind: 'str', value: '0 if unset', style: 0 } },
      ],
    },
    {
      rowNum: 13,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Pre-money ESOP pool top-up (%)', style: 1 } },
        { col: 2, spec: { kind: 'num', value: input.esopTopUpPct, style: 6 } },
        { col: 3, spec: { kind: 'str', value: '% of post-money deducted from pre-money', style: 0 } },
      ],
    },
    {
      rowNum: 15,
      cells: [
        { col: 1, spec: { kind: 'str', value: '2. Valuation & Revenue Outputs', style: 3 } },
        { col: 2, spec: { kind: 'str', value: 'Output', style: 3 } },
        { col: 3, spec: { kind: 'str', value: 'Formula / Notes', style: 3 } },
      ],
    },
    {
      rowNum: 16,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Implied post-money valuation (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B4/(B5/100)',
            value: out.metrics.impliedPostMoney.value ?? 0,
            style: 9,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Ask ÷ (Dilution % ÷ 100)', style: 0 } },
      ],
    },
    {
      rowNum: 17,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Implied pre-money valuation (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B16-B4',
            value: out.metrics.impliedPreMoney.value ?? 0,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Implied Post-Money − Ask', style: 0 } },
      ],
    },
    {
      rowNum: 18,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Effective pre-money after ESOP (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B17-(B16*B13/100)',
            value: out.metrics.effectivePreMoneyAfterEsop.value ?? 0,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Pre-Money − (Post-Money × ESOP %)', style: 0 } },
      ],
    },
    {
      rowNum: 19,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Implied post-money revenue multiple', style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'IF(B6>0,B16/B6,0)',
            value: out.metrics.impliedPostRevenueMultiple.value ?? 0,
            style: 7,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Implied Post-Money ÷ Current ARR', style: 0 } },
      ],
    },
    {
      rowNum: 20,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Implied pre-money revenue multiple', style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'IF(B6>0,B17/B6,0)',
            value: out.metrics.impliedPreRevenueMultiple.value ?? 0,
            style: 7,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Implied Pre-Money ÷ Current ARR', style: 0 } },
      ],
    },
    {
      rowNum: 21,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Next-round target pre-money (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B16*B9',
            value: out.metrics.nextRoundPreMoney.value ?? 0,
            style: 9,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Implied Post-Money × Step-Up', style: 0 } },
      ],
    },
    {
      rowNum: 22,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Required next-round ARR (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B21/B10',
            value: out.metrics.requiredNextAnnualRevenue.value ?? 0,
            style: 9,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Next-Round Pre-Money ÷ Next-Round Multiple', style: 0 } },
      ],
    },
    {
      rowNum: 23,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Required next-round monthly revenue (${unitLabel}/mo)`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'B22/12',
            value: out.metrics.requiredNextMonthlyRevenue.value ?? 0,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Required Next ARR ÷ 12', style: 0 } },
      ],
    },
    {
      rowNum: 24,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Required revenue growth multiple', style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'IF(B6>0,B22/B6,0)',
            value: out.metrics.requiredGrowthMultiple.value ?? 0,
            style: 7,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'Required Next ARR ÷ Current ARR', style: 0 } },
      ],
    },
    {
      rowNum: 25,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Implied annual CAGR', style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'IF(B6>0,(B24^(12/B11))-1,0)',
            value: cagrRatio,
            style: 11,
          },
        },
        { col: 3, spec: { kind: 'str', value: '(Growth Multiple ^ (12 ÷ Months)) − 1', style: 0 } },
      ],
    },
    {
      rowNum: 26,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Implied monthly CMGR', style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'IF(B6>0,(B24^(1/B11))-1,0)',
            value: cmgrRatio,
            style: 11,
          },
        },
        { col: 3, spec: { kind: 'str', value: '(Growth Multiple ^ (1 ÷ Months)) − 1', style: 0 } },
      ],
    },
    {
      rowNum: 27,
      cells: [
        { col: 1, spec: { kind: 'str', value: `Milestone funding gap (${unitLabel})`, style: 1 } },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: 'MAX(0,B12-B4)',
            value: out.metrics.fundingGap.value ?? 0,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'MAX(0, Cash Needed − Ask)', style: 0 } },
      ],
    },
    {
      rowNum: 29,
      cells: [
        { col: 1, spec: { kind: 'str', value: '3. Verdict & Goal-Seek', style: 3 } },
        { col: 2, spec: { kind: 'str', value: 'Result', style: 3 } },
        { col: 3, spec: { kind: 'str', value: 'Notes', style: 3 } },
      ],
    },
    {
      rowNum: 30,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Verdict', style: 1 } },
        { col: 2, spec: { kind: 'str', value: out.verdict.headline, style: 1 } },
        {
          col: 3,
          spec: {
            kind: 'str',
            value: `Reachable ≤ ${formatPercent(effBands.reachableCagrPct, 0)}/yr / Stretch ≤ ${formatPercent(effBands.stretchCagrPct, 0)}/yr`,
            style: 0,
          },
        },
      ],
    },
    {
      rowNum: 31,
      cells: [
        {
          col: 1,
          spec: {
            kind: 'str',
            value: `Max reachable ask (≤${formatMultiple(effBands.reachableMax, 1)}, ${unitLabel})`,
            style: 1,
          },
        },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: `IF(B6>0,(B6*(${reachBase}^(B11/18))*B10/B9)*(B5/100),0)`,
            value: out.feasibleAskBand.reachableAsk,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'CAGR-normalised at current ARR and target dilution', style: 0 } },
      ],
    },
    {
      rowNum: 32,
      cells: [
        {
          col: 1,
          spec: {
            kind: 'str',
            value: `Max stretch ask (≤${formatMultiple(effBands.stretchMax, 1)}, ${unitLabel})`,
            style: 1,
          },
        },
        {
          col: 2,
          spec: {
            kind: 'formula',
            formula: `IF(B6>0,(B6*(${stretchBase}^(B11/18))*B10/B9)*(B5/100),0)`,
            value: out.feasibleAskBand.stretchAsk,
            style: 5,
          },
        },
        { col: 3, spec: { kind: 'str', value: 'CAGR-normalised at current ARR and target dilution', style: 0 } },
      ],
    },
    {
      rowNum: 33,
      cells: [
        {
          col: 1,
          spec: { kind: 'str', value: `Goal-seek (${seek.target.replace('_', ' ')})`, style: 1 },
        },
        { col: 2, spec: { kind: 'str', value: seek.formattedSolvedValue, style: 1 } },
        { col: 3, spec: { kind: 'str', value: seek.summary, style: 0 } },
      ],
    },
  ];

  let nextRow = 35;
  sheet1Rows.push({
    rowNum: nextRow++,
    cells: [
      { col: 1, spec: { kind: 'str', value: '4. Diagnostic Notes', style: 4 } },
      { col: 2, spec: { kind: 'str', value: 'Origin', style: 4 } },
      { col: 3, spec: { kind: 'str', value: 'Detail', style: 4 } },
    ],
  });
  for (const r of out.verdict.reasons) {
    sheet1Rows.push({
      rowNum: nextRow++,
      cells: [
        { col: 1, spec: { kind: 'str', value: r.id.replace(/_/g, ' '), style: 0 } },
        { col: 2, spec: { kind: 'str', value: r.origin, style: 0 } },
        { col: 3, spec: { kind: 'str', value: r.text, style: 0 } },
      ],
    });
  }

  nextRow += 1;
  sheet1Rows.push({
    rowNum: nextRow++,
    cells: [
      { col: 1, spec: { kind: 'str', value: '5. Dilution Sensitivity', style: 3 } },
      { col: 2, spec: { kind: 'str', value: `Post-Money (${unitLabel})`, style: 3 } },
      { col: 3, spec: { kind: 'str', value: `Pre-Money (${unitLabel})`, style: 3 } },
      { col: 4, spec: { kind: 'str', value: 'Pre Multiple', style: 3 } },
      { col: 5, spec: { kind: 'str', value: 'Post Multiple', style: 3 } },
      { col: 6, spec: { kind: 'str', value: `Next Pre (${unitLabel})`, style: 3 } },
      { col: 7, spec: { kind: 'str', value: 'Growth Needed', style: 3 } },
    ],
  });

  for (const row of out.sensitivity) {
    const rIdx = nextRow++;
    sheet1Rows.push({
      rowNum: rIdx,
      cells: [
        { col: 1, spec: { kind: 'num', value: row.dilutionPct, style: 6 } },
        {
          col: 2,
          spec: { kind: 'formula', formula: `$B$4/(A${rIdx}/100)`, value: row.postMoney, style: 5 },
        },
        {
          col: 3,
          spec: { kind: 'formula', formula: `B${rIdx}-$B$4`, value: row.preMoney, style: 5 },
        },
        {
          col: 4,
          spec: {
            kind: 'formula',
            formula: `IF($B$6>0,C${rIdx}/$B$6,0)`,
            value: row.impliedPreMultiple ?? 0,
            style: 7,
          },
        },
        {
          col: 5,
          spec: {
            kind: 'formula',
            formula: `IF($B$6>0,B${rIdx}/$B$6,0)`,
            value: row.impliedPostMultiple ?? 0,
            style: 7,
          },
        },
        {
          col: 6,
          spec: { kind: 'formula', formula: `B${rIdx}*$B$9`, value: row.nextPreMoney, style: 5 },
        },
        {
          col: 7,
          spec: {
            kind: 'formula',
            formula: `IF($B$6>0,(F${rIdx}/$B$10)/$B$6,0)`,
            value: row.requiredGrowthMultiple ?? 0,
            style: 7,
          },
        },
      ],
    });
  }

  nextRow += 1;
  sheet1Rows.push({
    rowNum: nextRow,
    cells: [
      {
        col: 1,
        spec: {
          kind: 'str',
          value: `Generated by Valuation Check (${formatPercent(input.dilutionPct, 1)} dilution scenario). Not financial or investment advice.`,
          style: 10,
        },
      },
    ],
  });

  const sheet2Rows: SheetRow[] = [
    {
      rowNum: 1,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'How VCs Do This Math: Rules of Thumb & Indicative Sector Multiples', style: 2 } },
      ],
    },
    {
      rowNum: 3,
      cells: [
        { col: 1, spec: { kind: 'str', value: 'Rule of Thumb', style: 3 } },
        { col: 2, spec: { kind: 'str', value: 'Benchmark', style: 3 } },
        { col: 3, spec: { kind: 'str', value: 'Origin', style: 3 } },
        { col: 4, spec: { kind: 'str', value: 'Plain-English Explanation', style: 3 } },
      ],
    },
  ];
  ASSUMPTION_REFERENCES.forEach((item, idx) => {
    sheet2Rows.push({
      rowNum: 4 + idx,
      cells: [
        { col: 1, spec: { kind: 'str', value: item.parameter, style: 1 } },
        { col: 2, spec: { kind: 'str', value: item.defaultValue, style: 0 } },
        { col: 3, spec: { kind: 'str', value: item.origin, style: 0 } },
        { col: 4, spec: { kind: 'str', value: item.explanation, style: 0 } },
      ],
    });
  });

  const sectorStart = 4 + ASSUMPTION_REFERENCES.length + 2;
  sheet2Rows.push({
    rowNum: sectorStart - 1,
    cells: [
      { col: 1, spec: { kind: 'str', value: 'Indicative Sector Revenue Multiples (Series A/B Next-Round)', style: 3 } },
      { col: 2, spec: { kind: 'str', value: 'P25', style: 3 } },
      { col: 3, spec: { kind: 'str', value: 'Median (P50)', style: 3 } },
      { col: 4, spec: { kind: 'str', value: 'P75', style: 3 } },
      { col: 5, spec: { kind: 'str', value: 'Why It Varies', style: 3 } },
    ],
  });
  SECTOR_MULTIPLE_BENCHMARKS.forEach((b, idx) => {
    sheet2Rows.push({
      rowNum: sectorStart + idx,
      cells: [
        { col: 1, spec: { kind: 'str', value: b.sector, style: 1 } },
        { col: 2, spec: { kind: 'num', value: b.p25, style: 7 } },
        { col: 3, spec: { kind: 'num', value: b.p50, style: 7 } },
        { col: 4, spec: { kind: 'num', value: b.p75, style: 7 } },
        { col: 5, spec: { kind: 'str', value: b.note, style: 0 } },
      ],
    });
  });

  const sheet1Xml = renderWorksheetXml(sheet1Rows, [44, 22, 56, 16, 16, 18, 16]);
  const sheet2Xml = renderWorksheetXml(sheet2Rows, [38, 22, 18, 48, 60]);

  return buildZipStore([
    { name: '[Content_Types].xml', data: TEXT_ENCODER.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels', data: TEXT_ENCODER.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml', data: TEXT_ENCODER.encode(WORKBOOK_XML) },
    { name: 'xl/_rels/workbook.xml.rels', data: TEXT_ENCODER.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/styles.xml', data: TEXT_ENCODER.encode(STYLES_XML) },
    { name: 'xl/worksheets/sheet1.xml', data: TEXT_ENCODER.encode(sheet1Xml) },
    { name: 'xl/worksheets/sheet2.xml', data: TEXT_ENCODER.encode(sheet2Xml) },
  ]);
}

export function downloadXlsxReport(
  input: CheckInput,
  unit: CurrencyUnit,
  goalSeekTarget: GoalSeekTarget = 'max_ask',
  goalSeekGrowth?: number
): string {
  const bytes = generateXlsxBytes(input, unit, goalSeekTarget, goalSeekGrowth);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const filename = buildXlsxFilename(input, unit);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}
