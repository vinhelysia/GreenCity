import type { Metadata } from "next";
import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconLeaf, IconShieldCheck, IconSparkles } from "@/components/eco-icons";
import { LoginForm } from "@/components/login-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Đăng nhập",
  description: "Đăng nhập GreenCity bằng email và mật khẩu.",
};

export default function DangNhapPage() {
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <PageHeader
            eyebrow="Tài khoản thành viên"
            title="Đăng nhập"
            description={
              <p>
                Dùng email và mật khẩu bạn đã đăng ký. Chưa có tài khoản?{" "}
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
          <div className="mt-6 rounded-2xl border border-edge bg-card p-6 shadow-eco sm:p-8">
            <LoginForm />
          </div>
        </div>

        {/* Side Benefits Column */}
        <div className="lg:col-span-5 lg:pt-8">
          <div className="rounded-2xl border border-edge bg-mint-surface/40 p-6 shadow-eco-sm sm:p-8">
            <EcoBadge variant="primary" icon={<IconLeaf className="h-3.5 w-3.5" />}>
              Quyền lợi thành viên GreenCity
            </EcoBadge>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              Tham gia mạng lưới tái chế văn minh
            </h2>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Giá phế liệu chuẩn:</strong> Niêm yết công khai, bảo vệ quyền lợi người bán.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconSparkles className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Chợ vật liệu tái chế:</strong> Dành riêng cho người mua có đăng ký gói quyền lợi.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconLeaf className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Đóng góp cộng đồng:</strong> Báo điểm rác nhận điểm thưởng và ghi nhận thành tích xanh.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
