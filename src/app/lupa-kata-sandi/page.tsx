import { ForgotPassword } from "@/components/account-recovery";
import { Card } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return <main className="grid min-h-dvh place-items-center p-4 sm:p-6">
    <Card className="w-full max-w-lg gap-6 p-6 sm:p-8">
      <p className="title-4">Tech<span className="text-primary">Kasir</span></p>
      <ForgotPassword />
    </Card>
  </main>;
}
