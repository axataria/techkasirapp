"use client";

import { useState } from "react";
import { RecordForm, text, type FormSpec } from "@/components/record-form";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { api, roleName, type User } from "@/lib/api";

export type RecoveryKit = { username: string; recoveryCode: string; store?: string };

export function RecoveryCodeNotice({ kit, title, onDone }: {
  kit: RecoveryKit;
  title: string;
  onDone: () => void;
}) {
  return <>
    <CardTitle>{title}</CardTitle>
    <CardDescription>{kit.store ? `${kit.store} · ` : ""}Username: {kit.username}</CardDescription>
    <p className="body-6">Salin atau catat kode ini dan simpan di tempat aman. Kode ditampilkan sekali dan hanya bisa dipakai untuk satu kali reset kata sandi.</p>
    <code className="block select-all break-words rounded-lg border bg-popover p-4 text-sm font-medium tracking-wide">{kit.recoveryCode}</code>
    <Button onClick={onDone}>Saya sudah menyimpan kode</Button>
  </>;
}

export function ForgotPassword() {
  const [emailMode, setEmailMode] = useState(false);
  const [kit, setKit] = useState<RecoveryKit | null>(null);
  const [finished, setFinished] = useState(false);
  if (kit) return <RecoveryCodeNotice kit={kit} title="Kata sandi berhasil diubah" onDone={() => { setKit(null); setFinished(true); }} />;
  if (finished) return <>
    <CardTitle>Kata sandi berhasil diubah</CardTitle>
    <CardDescription>Gunakan kata sandi baru untuk masuk kembali.</CardDescription>
    <Button asChild><a href="/">Kembali ke login</a></Button>
  </>;
  if (emailMode) return <AccountRecovery onClose={() => setEmailMode(false)} />;
  return <>
    <div className="space-y-2">
      <CardTitle>Lupa kata sandi</CardTitle>
      <CardDescription>Gunakan kode pemulihan yang Anda simpan saat membuat toko atau dari Profil akun.</CardDescription>
    </div>
    <RecordForm singleColumn spec={{
      title: "Gunakan kode pemulihan",
      fields: [
        { ...text("recoveryCode", "Kode pemulihan simpanan"), maxLength: 64, autoComplete: "off" },
        { ...text("password", "Kata sandi baru"), type: "password", hint: "Minimal 10 karakter." },
        { ...text("confirmPassword", "Ulangi kata sandi baru"), type: "password" },
      ],
      submit: "Ubah kata sandi",
      save: async values => {
        if (values.password !== values.confirmPassword) throw new Error("Kedua kata sandi harus sama.");
        setKit(await api("/recovery/saved/reset", { recoveryCode: values.recoveryCode, password: values.password }));
      },
    }} onDone={() => {}} />
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="ghost"><a href="/">Kembali ke login</a></Button>
      <Button variant="outline" onClick={() => setEmailMode(true)}>Gunakan email pemulihan</Button>
    </div>
  </>;
}

export function AccountRecovery({ enrollment = false, onClose, onVerified }: {
  enrollment?: boolean;
  onClose: () => void;
  onVerified?: () => void;
}) {
  const [step, setStep] = useState<"request" | "verify" | "done">("request");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [username, setUsername] = useState("");
  const [kit, setKit] = useState<RecoveryKit | null>(null);

  if (kit) return <RecoveryCodeNotice kit={kit} title="Kata sandi berhasil diubah" onDone={() => setKit(null)} />;
  if (step === "done") return <>
    <CardTitle>{enrollment ? "Email pemulihan terverifikasi" : "Kata sandi berhasil diubah"}</CardTitle>
    <p role="status" className="body-6 text-muted-foreground">{enrollment ? "Email ini dapat digunakan untuk memulihkan akun Anda." : <>Masuk sebagai <strong>{username}</strong> dengan kata sandi baru Anda.</>}</p>
    <Button variant="outline" onClick={onClose}>{enrollment ? "Selesai" : "Kembali ke login"}</Button>
  </>;

  const title = enrollment ? "Verifikasi email pemulihan" : "Lupa kata sandi";
  const spec: FormSpec = step === "request" ? {
    title,
    fields: [
      { ...text("email", "Email pemulihan", email), type: "email", autoComplete: "email", maxLength: 254 },
      ...(enrollment ? [{ ...text("currentPassword", "Kata sandi saat ini"), type: "password", autoComplete: "current-password", minLength: 1 }] : []),
    ],
    submit: "Kirim kode",
    save: async values => {
      await api(`/recovery/${enrollment ? "email" : "reset"}/request`, values);
      setEmail(String(values.email).trim());
      setStep("verify");
    },
  } : {
    title,
    fields: [
      { ...text("code", "Kode verifikasi"), inputMode: "numeric", autoComplete: "one-time-code", pattern: "[0-9]{8}", maxLength: 8, hint: "Masukkan 8 digit dari email. Kode berlaku 10 menit." },
      ...(!enrollment ? [
        { ...text("password", "Kata sandi baru"), type: "password", hint: "Minimal 10 karakter." },
        { ...text("confirmPassword", "Ulangi kata sandi baru"), type: "password" },
      ] : []),
    ],
    submit: enrollment ? "Verifikasi email" : "Ubah kata sandi",
    save: async values => {
      if (!enrollment && values.password !== values.confirmPassword) throw new Error("Kedua kata sandi harus sama.");
      const result = await api(`/recovery/${enrollment ? "email/verify" : "reset/complete"}`, {
        email, code: values.code, ...(enrollment ? {} : { password: values.password }),
      });
      if (!enrollment) setUsername(result.username);
      if (result.recoveryCode) setKit(result);
      setStep("done");
      onVerified?.();
    },
  };

  return <>
    <div className="space-y-2">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{step === "request"
        ? (enrollment ? "Masukkan email yang dapat Anda akses dan konfirmasi kata sandi saat ini." : "Gunakan email pemulihan yang sudah Anda verifikasi di Pengaturan.")
        : (enrollment ? "Periksa kotak masuk email Anda." : "Jika email terdaftar, kode akan dikirim. Periksa kotak masuk atau folder spam.")}</CardDescription>
    </div>
    <RecordForm key={step} singleColumn spec={spec} onBusy={setBusy} onDone={() => {}} />
    <div className="flex flex-wrap gap-2">
      <Button variant="ghost" disabled={busy} onClick={onClose}>{enrollment ? "Batal" : "Kembali ke login"}</Button>
      {step === "verify" && <Button variant="ghost" disabled={busy} onClick={() => setStep("request")}>Minta kode baru</Button>}
    </div>
  </>;
}

export function AccountProfile({ user, status, onSaved, onVerified }: {
  user: User;
  status?: { enabled: boolean; email: string | null; hasSavedCode: boolean };
  onSaved: (user: User) => void;
  onVerified: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(0);
  const [replacing, setReplacing] = useState(false);
  const [replacingBusy, setReplacingBusy] = useState(false);
  const [kit, setKit] = useState<RecoveryKit | null>(null);
  const identity: FormSpec = {
    title: "Profil akun",
    fields: [
      { ...text("name", "Nama lengkap", user.name), autoComplete: "name", maxLength: 160 },
      { ...text("username", "Username", user.username), autoComplete: "username", maxLength: 80, hint: "Username digunakan saat masuk." },
      { ...text("currentPassword", "Kata sandi saat ini"), type: "password", autoComplete: "current-password", minLength: 1 },
    ],
    submit: "Simpan profil",
    save: async values => {
      const updated = await api("/me", values, "PATCH");
      setSaved(count => count + 1);
      onSaved(updated);
    },
  };
  return <Card className="gap-4">
    <div className="space-y-2">
      <CardTitle>Profil akun</CardTitle>
      <CardDescription>Kelola identitas yang digunakan di TechKasir.</CardDescription>
      <p className="caption-2">{roleName(user.role)} · {user.store}</p>
    </div>
    <RecordForm key={saved} spec={identity} onDone={() => {}} />
    {saved > 0 && <p role="status" className="text-sm text-primary">Profil akun tersimpan.</p>}
    {user.role === "owner" && <section className="grid gap-4 border-t pt-4" aria-label="Kode pemulihan simpanan">
      {kit ? <RecoveryCodeNotice kit={kit} title="Kode pemulihan baru" onDone={() => setKit(null)} /> : <>
        <CardTitle>Kode pemulihan simpanan</CardTitle>
        <CardDescription>{status?.hasSavedCode ? "Kode aktif. Membuat kode baru akan membatalkan kode sebelumnya." : "Buat kode cadangan untuk mengatur ulang kata sandi tanpa email."}</CardDescription>
        {replacing ? <>
          <RecordForm singleColumn spec={{
            title: "Buat kode pemulihan", submit: "Buat kode",
            fields: [{ ...text("currentPassword", "Kata sandi saat ini"), type: "password", autoComplete: "current-password", minLength: 1 }],
            save: async values => {
              const result = await api("/recovery/saved/replace", values);
              setKit({ ...result, store: user.store });
              setReplacing(false);
              onVerified();
            },
          }} onBusy={setReplacingBusy} onDone={() => {}} />
          <Button className="justify-self-start" variant="ghost" disabled={replacingBusy} onClick={() => setReplacing(false)}>Batal</Button>
        </> : <Button className="justify-self-start" variant="outline" onClick={() => setReplacing(true)}>{status?.hasSavedCode ? "Ganti kode" : "Buat kode pemulihan"}</Button>}
      </>}
    </section>}
    <section className="grid gap-4 border-t pt-4" aria-label="Email pemulihan">
    {editing && status?.enabled
      ? <AccountRecovery enrollment onClose={() => setEditing(false)} onVerified={onVerified} />
      : <>
        <CardTitle>Email pemulihan</CardTitle>
        <CardDescription className="break-words">{status?.email ? `Terverifikasi: ${status.email}` : "Belum terverifikasi. Tambahkan Gmail atau alamat email lain untuk pemulihan akun."}</CardDescription>
        {status?.enabled
          ? <Button className="self-start" variant="outline" onClick={() => setEditing(true)}>{status.email ? "Ubah email" : "Tambahkan email"}</Button>
          : <p className="caption-2">Pengiriman kode belum dikonfigurasi oleh pengelola aplikasi.</p>}
      </>}
    </section>
  </Card>;
}
