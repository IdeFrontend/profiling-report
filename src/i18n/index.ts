export type LocaleCode = 'zh-CN' | 'en';

const messages = {
  'zh-CN': {
    searchPlaceholder: '搜索',
    searchLabel: '搜索',
    zoomIn: '放大',
    zoomOut: '缩小',
    zoomFit: '适应窗口',
    stats: '报告',
    timeUnit: '时间单位',
    summary: '报告统计',
    pipeOccupancy: 'PIPE 占用率',
    op: '算子',
    type: '类型',
    duration: '整体耗时',
    freq: '频率',
    noTimeline: '无时间线事件',
    start: 'Start',
    dur: 'Duration',
    end: 'End',
    name: 'Name',
    tabOp: 'OP算子',
    tabTimeline: '时间线',
    tabSource: '源码',
    tabDetail: '详情',
    tabCache: '缓存',
    kernel: 'Kernel',
    ratedFreq: '额定频率',
    pipeSide: 'PIPE 侧',
    measure: '度量',
    block: 'block',
    viewAll: '查看全部',
    modeSummary: '摘要',
    modePipe: 'PIPE',
    modeCompute: '计算负载',
    modeMemory: '内存负载',
    computeAnalysis: '计算负载分析',
    memoryAnalysis: '内存负载分析',
    more: '更多',
    coreCount: '核数',
    aicFreq: 'aic频率',
    npuArch: 'NPU ARCH',
    closePanel: '关闭',
    coreUnit: '核',
  },
  en: {
    searchPlaceholder: 'Search',
    searchLabel: 'Search',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomFit: 'Fit',
    stats: 'Report',
    timeUnit: 'Time unit',
    summary: 'Report statistics',
    pipeOccupancy: 'PIPE occupancy',
    op: 'Op',
    type: 'Type',
    duration: 'Total time',
    freq: 'Freq',
    noTimeline: 'No timeline events',
    start: 'Start',
    dur: 'Duration',
    end: 'End',
    name: 'Name',
    tabOp: 'OP',
    tabTimeline: 'Timeline',
    tabSource: 'Source',
    tabDetail: 'Details',
    tabCache: 'Cache',
    kernel: 'Kernel',
    ratedFreq: 'Rated freq',
    pipeSide: 'PIPE side',
    measure: 'Measure',
    block: 'block',
    viewAll: 'View all',
    modeSummary: 'Summary',
    modePipe: 'PIPE',
    modeCompute: 'Compute load',
    modeMemory: 'Memory load',
    computeAnalysis: 'Compute load analysis',
    memoryAnalysis: 'Memory load analysis',
    more: 'More',
    coreCount: 'Cores',
    aicFreq: 'AIC freq',
    npuArch: 'NPU ARCH',
    closePanel: 'Close',
    coreUnit: ' cores',
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
