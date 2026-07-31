import type { Metadata } from "next";
import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconLeaf, IconShieldCheck } from "@/components/eco-icons";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập GreenCity bằng email và mật khẩu.",
  robots: { index: false, follow: false },
};

export default function DangNhapPage() {
  return (
    <div className="min-w-0 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 lg:col-span-7 space-y-6">
        <PageHeader
          eyebrow="Tài khoản GreenCity"
          title="Đăng nhập"
          description={
            <p>
              Dùng email và mật khẩu bạn đã đăng ký để quản lý yêu cầu phế liệu và điểm thưởng. Chưa có tài khoản?{" "}
              <Link
                href="/dang-ky"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Đăng ký ngay
              </Link>
              .
            </p>
          }
        />
        <LoginForm />
      </div>

      <div className="hidden lg:block lg:col-span-5 pt-10">
        <div className="rounded-2xl border border-primary/20 bg-mint-surface/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-eco-sm">
              <IconLeaf className="h-5 w-5" />
            </span>
            <p className="font-display text-lg font-bold text-ink">Quyền lợi thành viên</p>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Gửi yêu cầu bán phế liệu và nhận báo giá trực tiếp</span>
            </li>
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Báo cáo điểm rác tự phát và nhận 50 điểm thưởng / báo cáo xác minh</span>
            </li>
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Đặt giữ các lô phế liệu trên Chợ online (dành cho người mua)</span>
            </li>
          </ul>
          <div className="pt-2">
            <EcoBadge variant="primary" className="text-xs">
              Môi trường đô thị xanh
            </EcoBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
