import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập GreenCity bằng email và mật khẩu.",
};

export default function DangNhapPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        title="Đăng nhập"
        description={
          <p>
            Dùng email và mật khẩu đã đăng ký. Phiên được lưu bằng cookie bảo mật
            (HttpOnly) — trình duyệt gửi kèm mỗi lần gọi API. Chưa có tài khoản?{" "}
            <Link
              href="/dang-ky"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Đăng ký
            </Link>
            .
          </p>
        }
      />
      <LoginForm />
    </div>
  );
}
