/**
 * 冷却式防抖（leading-edge debounce）。
 *
 * 非经典尾部防抖：首次调用立即执行 fn（透传参数），之后 waitMs 窗口内的调用被
 * 静默吞掉，窗口结束后的下一次调用再次立即执行。窗口锚定在上一次“执行”而非
 * 上一次“尝试”，连点不会续期冷却。适合“首击立即响应、误操作连点只算一次”的
 * 按钮防护（如 cannbot 图标的 emit 冷却，PR-ROOT-008）。
 */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number,
): (...args: A) => void {
  let lastFiredAt = -Infinity;
  return (...args: A) => {
    const now = Date.now();
    if (now - lastFiredAt < waitMs) return;
    lastFiredAt = now;
    fn(...args);
  };
}
