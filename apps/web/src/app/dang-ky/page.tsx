import type { Metadata } from "next";
import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconLeaf, IconShieldCheck } from "@/components/eco-icons";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký",
  description: "Tạo tài khoản GreenCity bằng email và mật khẩu.",
  robots: { index: false, follow: false },
};

export default function DangKyPage() {
  return (
    <div className="min-w-0 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
      <div className="min-w-0 lg:col-span-7 space-y-6">
        <PageHeader
          eyebrow="Gia nhập cộng đồng GreenCity"
          title="Đăng ký"
          description={
            <p>
              Tạo tài khoản để tham gia thu gom phế liệu, báo điểm rác và tích lũy điểm thưởng. Mật khẩu tối thiểu 8 ký tự. Đã có tài khoản?{" "}
              <Link
                href="/dang-nhap"
                className="font-semibold text-primary underline-offset-4 hover:underline"
              >
                Đăng nhập ngay
              </Link>
              .
            </p>
          }
        />
        <RegisterForm />
      </div>

      <div className="hidden lg:block lg:col-span-5 pt-10">
        <div className="rounded-2xl border border-primary/20 bg-mint-surface/50 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-eco-sm">
              <IconLeaf className="h-5 w-5" />
            </span>
            <p className="font-display text-lg font-bold text-ink">Lợi ích tài khoản GreenCity</p>
          </div>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Bán phế liệu minh bạch theo khung giá công khai</span>
            </li>
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Được cộng điểm thưởng tự động sau mỗi giao dịch hoàn tất</span>
            </li>
            <li className="flex items-start gap-2">
              <IconShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Đăng ký Gói người mua để đặt giữ phế liệu trên Chợ online</span>
            </li>
          </ul>
          <div className="pt-2">
            <EcoBadge variant="mint" className="text-xs">
              Mô hình kinh tế tuần hoàn
            </EcoBadge>
          </div>
        </div>
      </div>
    </div>
  );
}
