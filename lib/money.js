export const clamp0 = (n) => (Number.isFinite(n) ? Math.max(0, n) : 0);

export const yen = (n) => {
  const v = Math.round(clamp0(n));
  return v.toLocaleString("ja-JP");
};
