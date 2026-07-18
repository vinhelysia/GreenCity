import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "@/components/register-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đăng ký",
  description: "Tạo tài khoản GreenCity bằng email và mật khẩu.",
};

export default function DangKyPage() {
  return (
    <div className="min-w-0">
      <PageHeader
        title="Đăng ký"
        description={
          <p>
            Tạo tài khoản để dùng các tính năng sắp tới. Mật khẩu tối thiểu 8 ký
            tự. Đã có tài khoản?{" "}
            <Link
              href="/dang-nhap"
              className="font-medium text-accent underline-offset-4 hover:underline"
            >
              Đăng nhập
            </Link>
            .
          </p>
        }
      />
      <RegisterForm />
    </div>
  );
}
