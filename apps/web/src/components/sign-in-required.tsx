import Link from "next/link";
import { EmptyState } from "@/components/empty-state";

type SignInRequiredProps = {
  testId?: string;
  /** What the visitor was trying to do, e.g. "gửi báo cáo điểm rác". */
  action?: string;
};

/**
 * Shown when a signed-out visitor reaches something that needs an account.
 *
 * Five screens used to hand-roll this block, and every one of them offered
 * only a login link. Someone without an account was told to sign in and given
 * nowhere to go, so registering is offered here as well.
 */
export function SignInRequired({ testId, action }: SignInRequiredProps) {
  return (
    <EmptyState
      testId={testId}
      title={action ? `Bạn cần tài khoản để ${action}` : "Bạn cần tài khoản"}
      description={
        <div className="space-y-3">
          <p>
            Phần lớn chức năng của GreenCity cần đăng nhập: bán phế liệu, đặt
            giữ tin đăng, gửi báo cáo điểm rác và xem điểm thưởng. Chỉ có trang
            chủ và danh sách trên chợ là xem được khi chưa đăng nhập.
          </p>
          <p>
            Chưa có tài khoản thì đăng ký cũng được, chỉ cần email, mật khẩu và
            tên hiển thị.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <Link
              href="/dang-nhap"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Đăng nhập
            </Link>
            <Link
              href="/dang-ky"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Tạo tài khoản mới
            </Link>
          </p>
        </div>
      }
    />
  );
}
