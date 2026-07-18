import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description:
    "Giao diện đăng nhập GreenCity — chỉ là vỏ form, chưa kết nối xác thực.",
};

export default function DangNhapPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        title="Đăng nhập"
        description={
          <p>
            Form dưới đây chỉ để kiểm tra giao diện và khả năng truy cập. Chưa
            có phiên đăng nhập, cookie hay gọi API xác thực.
          </p>
        }
      />
      <LoginForm />
    </div>
  );
}
