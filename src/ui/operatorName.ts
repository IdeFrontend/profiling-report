/** Display symbol: drop the return type, template arguments, and parameter list. */
export function shortOperatorName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  let symbol = trimmed;
  const template = symbol.indexOf('<');
  if (template >= 0) symbol = symbol.slice(0, template);
  const params = symbol.indexOf('(');
  if (params >= 0) symbol = symbol.slice(0, params);
  const tokens = symbol.trim().split(/\s+/);
  return tokens[tokens.length - 1] || undefined;
}
