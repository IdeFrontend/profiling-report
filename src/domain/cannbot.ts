import type { CsvTableModel, ReportViewModel } from './types';

/**
 * Designed scope enum (cannbot contract): `roofline | sol | pipeline | compute | memory | communication | summary`.
 * The 930 release implements only `summary / compute / memory` (the three report-section
 * entries with data mappings in the view model); the remaining values are reserved for
 * future releases — enabling one requires a new UI entry, a data mapping, and a spec
 * update (specs/core/cannbot-payload.spec.md).
 */
export type CannbotScope = 'summary' | 'compute' | 'memory';

export interface CannbotReportMeta {
  name?: string;
  path?: string;
  id?: string;
  collectedAt?: string;
}

export interface CannbotPayload {
  version: '1.0';
  scope: CannbotScope;
  report_name: string;
  report_id: string;
  report_path: string;
  op_name: string;
  collected_at: string;
  data: Record<string, unknown>;
  prompt: string;
}

export const CANNBOT_PROMPT = `【你能看到的数据边界（必须严格遵守）】
除 payload JSON 外，你看不到任何报告数据、
CSV原始文件、算子源码全文、其他报告或历史基线。
这是只读快照，不是实时查询接口，无法在本轮
对话里被补充或刷新。
【没有写权限，也没有跨报告数据访问能力】
如果问题满足以下任一条件，明确告知超出当前问答
模式的能力，需要更完整的工具访问能力（MCP通道）：

涉及"和上次/历史/基线比"这类跨报告对比
涉及"帮我改/优化/执行"这类写操作
涉及 payload.data 里明确没覆盖的细粒度数据
不要猜测、不要用近似值代替，也不要说
"我帮你查一下"之类暗示自己能查到的话。`;

function pickCsvTexts(
  csvTexts: Record<string, string>,
  tables: CsvTableModel[],
): Record<string, string> | undefined {
  const names = new Set(tables.map((t) => t.fileName));
  const kept = Object.fromEntries(
    Object.entries(csvTexts).filter(([fileName]) => names.has(fileName)),
  );
  return Object.keys(kept).length > 0 ? kept : undefined;
}

export function buildCannbotPayload(
  scope: CannbotScope,
  report?: ReportViewModel | null,
  meta?: CannbotReportMeta,
): CannbotPayload {
  const data: Record<string, unknown> = {};
  if (report) {
    const put = (key: string, value: unknown) => {
      if (value !== undefined) data[key] = value;
    };
    if (scope === 'summary') {
      data.summary = report.summary;
      put('bandwidthCards', report.bandwidthCards);
      put('computeCard', report.computeCard);
      put('roofline', report.roofline);
      data.pipeOccupancy = report.pipeOccupancy;
      put('memoryTopology', report.memoryTopology);
      put('hardwareDetails', report.hardwareDetails);
    } else if (scope === 'compute') {
      data.pipeOccupancy = report.pipeOccupancy;
      data.computeTables = report.computeTables;
      put('csvTexts', pickCsvTexts(report.csvTexts, report.computeTables));
    } else {
      data.memoryTables = report.memoryTables;
      put('memoryTopology', report.memoryTopology);
      put('bandwidthCards', report.bandwidthCards);
      put('csvTexts', pickCsvTexts(report.csvTexts, report.memoryTables));
    }
  }
  return {
    version: '1.0',
    scope,
    report_name: meta?.name ?? '',
    report_id: meta?.id ?? meta?.name ?? '',
    report_path: meta?.path ?? '',
    op_name: report?.summary.opName ?? '',
    collected_at: meta?.collectedAt ?? '',
    data,
    prompt: CANNBOT_PROMPT,
  };
}
