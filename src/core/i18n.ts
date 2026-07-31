export type LocaleCode = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    searchPlaceholder: '搜索事件',
    searchLabel: '搜索',
    zoomIn: '放大',
    zoomOut: '缩小',
    zoomFit: '适应',
    stats: '统计',
    timeUnit: '时间单位',
    summary: '报告摘要',
    pipeOccupancy: 'PIPE 占用',
    op: '算子',
    type: '类型',
    duration: '耗时',
    freq: '频率',
    noTimeline: '无时间线事件',
    start: '开始',
    dur: '持续',
    end: '结束',
  },
  en: {
    searchPlaceholder: 'Search events',
    searchLabel: 'Search',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomFit: 'Fit',
    stats: 'Stats',
    timeUnit: 'Time unit',
    summary: 'Report summary',
    pipeOccupancy: 'PIPE occupancy',
    op: 'Op',
    type: 'Type',
    duration: 'Duration',
    freq: 'Freq',
    noTimeline: 'No timeline events',
    start: 'start',
    dur: 'dur',
    end: 'end',
  },
} as const;

export type MessageKey = keyof (typeof messages)['en'];

/** Resolve locale; default zh-CN per packaging interim Q17. */
export function resolveLocale(locale?: string): LocaleCode {
  if (!locale) return 'zh-CN';
  const lower = locale.toLowerCase();
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('zh')) return 'zh-CN';
  return 'zh-CN';
}

export function t(key: MessageKey, locale?: string): string {
  const code = resolveLocale(locale);
  return messages[code][key] ?? messages.en[key] ?? key;
}
