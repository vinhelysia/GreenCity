/** Vietnamese-locale currency formatting, shared by every marketplace screen. */
export function formatVnd(amountVnd: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amountVnd)}đ`;
}
