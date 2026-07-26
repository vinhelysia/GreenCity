import type { Metadata } from "next";
import Link from "next/link";
import { EcoBadge } from "@/components/eco-badge";
import { IconLeaf, IconShieldCheck, IconSparkles } from "@/components/eco-icons";
import { PageHeader } from "@/components/page-header";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = {
  title: "Đăng ký",
  description: "Tạo tài khoản GreenCity bằng email và mật khẩu.",
};

export default function DangKyPage() {
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7">
          <PageHeader
            eyebrow="Tạo tài khoản mới"
            title="Đăng ký"
            description={
              <p>
                Tạo tài khoản để tham gia mạng lưới tái chế sinh thái. Mật khẩu tối thiểu 8 ký tự. Đã có tài khoản?{" "}
                <Link
                  href="/dang-nhap"
                  className="font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Đăng nhập
                </Link>
                .
              </p>
            }
          />
          <div className="mt-6 rounded-2xl border border-edge bg-card p-6 shadow-eco sm:p-8">
            <RegisterForm />
          </div>
        </div>

        {/* Side Benefits Column */}
        <div className="lg:col-span-5 lg:pt-8">
          <div className="rounded-2xl border border-edge bg-mint-surface/40 p-6 shadow-eco-sm sm:p-8">
            <EcoBadge variant="primary" icon={<IconLeaf className="h-3.5 w-3.5" />}>
              Tại sao nên tham gia GreenCity?
            </EcoBadge>
            <h2 className="mt-4 font-display text-xl font-bold text-ink">
              Mỗi tài khoản là một hạt nhân xanh
            </h2>
            <ul className="mt-5 space-y-4 text-sm leading-relaxed text-muted">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconShieldCheck className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Minh bạch & an toàn:</strong> Mọi thông tin phế liệu và giá thu gom đều niêm yết rõ ràng.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconSparkles className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Sổ điểm thưởng cá nhân:</strong> Tự động ghi nhận điểm thưởng mỗi khi hoàn thành giao dịch hoặc báo cáo rác.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconLeaf className="h-4 w-4" />
                </span>
                <span>
                  <strong className="font-semibold text-ink">Bảo vệ môi trường thực chất:</strong> Kết nối trực tiếp người thu gom, người bán và chính quyền địa phương.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
