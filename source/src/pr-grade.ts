// WoWS Numbers Personal Rating scale: https://wows-numbers.com/personal/rating/
export const PR_GRADES = [
  { min: 2450, label: "超凡", color: "#a00dc5" },
  { min: 2100, label: "高手", color: "#d042f3" },
  { min: 1750, label: "优秀", color: "#02c9b3" },
  { min: 1550, label: "很好", color: "#318000" },
  { min: 1350, label: "良好", color: "#44b300" },
  { min: 1100, label: "平均", color: "#ffc71f" },
  { min: 750, label: "低于平均", color: "#fe7903" },
  { min: 0, label: "较弱", color: "#fe0e00" },
];
export function prGrade(value?: number | null) {
  if (value == null || !Number.isFinite(value) || value < 0) return { min: null, label: "暂无评分", color: "var(--muted-strong)" };
  const score = Math.round(value);
  return PR_GRADES.find(grade => score >= grade.min)!;
}
