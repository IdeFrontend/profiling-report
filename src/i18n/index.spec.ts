import { describe, expect, it } from 'vitest';
import { laneCategoryLabel, resolveLocale, t } from './index';

describe('i18n', () => {
  it('defaults to zh-CN and accepts en / zh prefixes', () => {
    expect(resolveLocale()).toBe('zh-CN');
    expect(resolveLocale('en-US')).toBe('en');
    expect(resolveLocale('zh-TW')).toBe('zh-CN');
    expect(resolveLocale('fr')).toBe('zh-CN');
  });

  it('resolves chrome strings for both locales', () => {
    expect(t('searchPlaceholder', 'zh-CN')).toBe('搜索');
    expect(t('searchPlaceholder', 'en')).toBe('Search');
    expect(t('resizeLaneGutter', 'en')).toBe('Resize lane gutter');
    expect(t('memoryTopology', 'zh-CN')).toBe('内存拓扑');
    expect(t('hardwareInfoMissing', 'en')).toBe('Missing hardware info');
    expect(t('hardwareInfoMissing', 'zh-CN')).toBe('缺少 hardware info');
    expect(t('focusMeasureRange', 'en')).toBe('Focus measure range');
    expect(t('focusMeasureRange', 'zh-CN')).toBe('聚焦度量范围');
  });

  it('localizes lane category labels when categoryKey is set', () => {
    expect(laneCategoryLabel('comm', '通信', 'en')).toBe('Comm');
    expect(laneCategoryLabel('compute', '计算', 'en')).toBe('Compute');
    expect(laneCategoryLabel('hbm', '储存HBM', 'en')).toBe('HBM storage');
    expect(laneCategoryLabel('comm', '通信', 'zh-CN')).toBe('通信');
    expect(laneCategoryLabel(undefined, 'Core0.Cube', 'en')).toBe('Core0.Cube');
  });
});
