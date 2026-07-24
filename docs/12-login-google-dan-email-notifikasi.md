# Panduan Konfigurasi Login Google OAuth & Email Notifikasi

Dokumen ini menjelaskan cara mengkonfigurasi dan menggunakan fitur Login dengan Google OAuth dan Email Notifikasi (SMTP) di platform Utero Academy.

---

## 1. Login dengan Google OAuth

### 1.1 Persiapan Google Cloud Console

1. **Buat Project di Google Cloud Console:**
   - Kunjungi [Google Cloud Console](https://console.cloud.google.com/)
   - Klik **Create Project** atau pilih project yang sudah ada
   - Beri nama project (contoh: "Utero Academy")

2. **Aktifkan Google OAuth API:**
   - Di sidebar, pilih **APIs & Services** > **OAuth consent screen**
   - Pilih **External** (untuk aplikasi publik) atau **Internal** (untuk organisasi)
   - Isi informasi aplikasi:
     - App name: `Utero Academy`
     - User support email: Email admin Anda
     - Developer contact email: Email developer Anda
   - Klik **Save and Continue**

3. **Tambahkan Scopes:**
   - Di halaman Scopes, klik **Add or Remove Scopes**
   - Pilih minimal scopes berikut:
     - `userinfo.email`
     - `userinfo.profile`
   - Klik **Update** dan **Save and Continue**

4. **Buat OAuth 2.0 Credentials:**
   - Di sidebar, pilih **APIs & Services** > **Credentials**
   - Klik **Create Credentials** > **OAuth client ID**
   - Application type: **Web application**
   - Name: `Utero Academy Web Client`
   - **Authorized JavaScript origins:**
     ```
     http://localhost:3000
     https://your-production-domain.com
     ```
   - **Authorized redirect URIs:**
     ```
     http://localhost:54321/auth/v1/callback
     https://your-supabase-url.supabase.co/auth/v1/callback
     ```
   - Klik **Create**
   - **Simpan Client ID dan Client Secret** yang muncul

### 1.2 Konfigurasi di Supabase Dashboard

1. **Login ke Supabase Dashboard:**
   - Buka [https://supabase.carubra.com](https://supabase.carubra.com) (atau URL Supabase self-hosted Anda)
   - Login sebagai admin

2. **Aktifkan Google Provider:**
   - Di sidebar, pilih **Authentication** > **Providers**
   - Scroll ke bagian **Google**
   - Toggle **Enable Sign in with Google** menjadi **ON**

3. **Masukkan Credentials:**
   - **Client ID (for OAuth):** Paste Client ID dari Google Cloud Console
   - **Client Secret (for OAuth):** Paste Client Secret dari Google Cloud Console
   - **Authorized Client IDs:** (opsional, kosongkan jika tidak diperlukan)
   - Klik **Save**

4. **Verifikasi Redirect URL:**
   - Pastikan Redirect URL di Supabase sama dengan yang didaftarkan di Google Cloud Console:
     ```
     https://your-supabase-url.supabase.co/auth/v1/callback
     ```

### 1.3 Implementasi di Aplikasi Next.js

#### A. Update LoginForm Component

Edit file `features/auth/LoginForm.tsx`:

```tsx
"use client";

import { loginAction, loginWithGoogleAction } from "@/features/auth/actions";
import { LogIn } from "lucide-react";
import { useActionState } from "react";

const initialState = {
  ok: true,
  message: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <div className="space-y-4">
      {/* Login dengan Email/Password */}
      <form action={formAction} className="surface grid gap-4 p-6">
        {!state.ok ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {state.message}
          </p>
        ) : null}

        <label className="form-field">
          <span className="form-label">Email</span>
          <input className="form-input" name="email" placeholder="admin@utero.academy" type="email" required />
        </label>

        <label className="form-field">
          <span className="form-label">Password</span>
          <input className="form-input" name="password" placeholder="Password" type="password" required />
        </label>

        <button className="button-primary" disabled={pending} type="submit">
          <LogIn size={18} />
          {pending ? "Memproses..." : "Masuk"}
        </button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-slate-500 font-semibold">atau</span>
        </div>
      </div>

      {/* Login dengan Google */}
      <form action={loginWithGoogleAction} className="surface p-6">
        <button 
          type="submit" 
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 rounded-lg shadow-sm bg-white hover:bg-slate-50 transition-colors font-semibold text-slate-700"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Masuk dengan Google
        </button>
      </form>
    </div>
  );
}
```

#### B. Tambahkan Server Action untuk Google OAuth

Edit file `features/auth/actions.ts`, tambahkan function baru:

```typescript
export async function loginWithGoogleAction() {
  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return {
      ok: false,
      message: "Gagal menginisialisasi login Google.",
    };
  }

  if (data.url) {
    redirect(data.url);
  }
}
```

#### C. Buat OAuth Callback Handler

Buat file baru `app/auth/callback/route.ts`:

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getPrimaryDashboardPath } from "@/features/auth/roles";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    // Get user and redirect to appropriate dashboard
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const dashboardPath = await getPrimaryDashboardPath(user.id);
      if (dashboardPath) {
        return NextResponse.redirect(`${origin}${dashboardPath}`);
      }
    }
  }

  // Fallback redirect
  return NextResponse.redirect(`${origin}/login`);
}
```

### 1.4 Testing Login Google

1. **Development (localhost):**
   - Jalankan aplikasi: `npm run dev`
   - Buka browser: `http://localhost:3000/login`
   - Klik tombol **Masuk dengan Google**
   - Pilih akun Google Anda
   - Verifikasi redirect ke dashboard sesuai role

2. **Production:**
   - Deploy aplikasi ke server production
   - Update **Authorized redirect URIs** di Google Cloud Console dengan URL production
   - Test login menggunakan domain production

### 1.5 Troubleshooting Google OAuth

**Error: "redirect_uri_mismatch"**
- Pastikan redirect URI di Google Cloud Console sama persis dengan yang digunakan Supabase
- Format: `https://your-supabase-url.supabase.co/auth/v1/callback`

**Error: "Access blocked: This app's request is invalid"**
- Pastikan OAuth consent screen sudah diisi lengkap
- Untuk testing, tambahkan email tester di **Test users**

**User login sukses tapi tidak punya role:**
- Setelah login Google pertama kali, user otomatis terdaftar di tabel `auth.users`
- Super Admin harus assign role manual di halaman **User & Role**

---

## 2. Email Notifikasi (SMTP)

### 2.1 Persiapan SMTP Provider

Platform Utero Academy mendukung berbagai provider SMTP. Berikut beberapa pilihan populer:

#### A. Gmail SMTP (Untuk Testing/Development)

1. **Aktifkan 2-Step Verification:**
   - Buka [Google Account Security](https://myaccount.google.com/security)
   - Aktifkan **2-Step Verification**

2. **Generate App Password:**
   - Buka [App Passwords](https://myaccount.google.com/apppasswords)
   - Pilih **App**: Mail
   - Pilih **Device**: Other (Custom name) → ketik "Utero Academy"
   - Klik **Generate**
   - **Simpan password 16 digit** yang muncul

3. **Konfigurasi SMTP:**
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-digit-app-password
   ```

#### B. SendGrid (Recommended untuk Production)

1. **Daftar SendGrid:**
   - Kunjungi [SendGrid](https://sendgrid.com/)
   - Buat akun gratis (100 email/hari)

2. **Buat API Key:**
   - Di dashboard, pilih **Settings** > **API Keys**
   - Klik **Create API Key**
   - Name: `Utero Academy SMTP`
   - Permissions: **Full Access** (atau minimal **Mail Send**)
   - Klik **Create & View**
   - **Simpan API Key**

3. **Konfigurasi SMTP:**
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASSWORD=your-sendgrid-api-key
   ```

#### C. Mailgun

1. **Daftar Mailgun:**
   - Kunjungi [Mailgun](https://www.mailgun.com/)
   - Buat akun (5,000 email gratis per bulan)

2. **Verifikasi Domain:**
   - Di dashboard, pilih **Sending** > **Domains**
   - Tambahkan domain Anda atau gunakan sandbox domain untuk testing

3. **Dapatkan SMTP Credentials:**
   - Pilih domain Anda
   - Klik tab **SMTP**
   - Salin **SMTP hostname**, **Port**, **Username**, dan **Password**

4. **Konfigurasi SMTP:**
   ```
   SMTP_HOST=smtp.mailgun.org
   SMTP_PORT=587
   SMTP_USER=postmaster@your-domain.mailgun.org
   SMTP_PASSWORD=your-mailgun-smtp-password
   ```

### 2.2 Konfigurasi Environment Variables

1. **Edit file `.env`:**
   ```bash
   # Notification - Email SMTP
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-app-password-or-api-key
   ```

2. **Restart aplikasi:**
   ```bash
   # Development
   npm run dev

   # Docker Production
   docker compose down
   docker compose up -d --build
   ```

### 2.3 Fitur Email Notifikasi yang Tersedia

Platform Utero Academy sudah mengimplementasikan notifikasi email untuk berbagai event:

#### A. Notifikasi Revisi Laporan Harian

**Trigger:** Mentor meminta revisi pada daily report peserta

**Fungsi:** `notifyDailyReportRevisionRequested()`

**Konten Email:**
- Subject: `Revisi Laporan Harian - Utero Academy - [Tanggal]`
- Isi: Nama peserta, tanggal laporan, catatan pembimbing, link ke dashboard

**Implementasi:**
```typescript
// Di file features/daily-reports/actions.ts
await notifyDailyReportRevisionRequested(
  internEmail,
  internPhone,
  internName,
  reportDate,
  revisionNote
);
```

#### B. Notifikasi Tugas Baru (LMS)

**Trigger:** Mentor mempublikasikan assignment baru

**Fungsi:** `notifyNewAssignmentCreated()`

**Konten Email:**
- Subject: `Tugas Baru: [Judul Assignment]`
- Isi: Nama peserta, judul course, judul tugas, link ke LMS

**Implementasi:**
```typescript
// Di file features/lms/actions.ts
await notifyNewAssignmentCreated(
  enrolledInterns,
  courseTitle,
  assignmentTitle
);
```

#### C. Menambahkan Notifikasi Custom

Untuk menambahkan notifikasi baru, gunakan fungsi `sendEmailNotification()`:

```typescript
import { sendEmailNotification } from "@/lib/notification";

// Contoh: Notifikasi approval pendaftaran
export async function notifyApplicationApproved(
  email: string,
  name: string,
  startDate: string
) {
  const subject = "Selamat! Pendaftaran Magang Anda Disetujui";
  const message = `Halo ${name},\n\nSelamat! Pendaftaran magang Anda telah disetujui oleh admin.\n\nTanggal Mulai: ${startDate}\n\nSilakan login ke dashboard untuk informasi lebih lanjut:\n${process.env.NEXT_PUBLIC_APP_URL}/login\n\nSalam,\nUtero Academy`;
  
  await sendEmailNotification(email, subject, message);
}
```

### 2.4 Template Email HTML (Advanced)

Untuk email yang lebih menarik dengan HTML template:

```typescript
import { sendEmailNotification } from "@/lib/notification";

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #0f766e 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
    .button { display: inline-block; background: #14b8a6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎓 Utero Academy</h1>
      <p>Platform Manajemen Magang Terpadu</p>
    </div>
    <div class="content">
      <h2>Halo {{name}},</h2>
      <p>{{message}}</p>
      <p style="text-align: center; margin: 30px 0;">
        <a href="{{link}}" class="button">Buka Dashboard</a>
      </p>
    </div>
    <div class="footer">
      <p>Email ini dikirim otomatis oleh sistem Utero Academy.</p>
      <p>&copy; 2026 Utero Academy. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Gunakan template
const html = htmlTemplate
  .replace('{{name}}', userName)
  .replace('{{message}}', messageContent)
  .replace('{{link}}', dashboardLink);

await sendEmailNotification(userEmail, subject, plainText, html);
```

### 2.5 Testing Email Notifikasi

#### A. Test Manual via Node.js Console

Buat file test `test-email.js` di root project:

```javascript
const nodemailer = require('nodemailer');

async function testEmail() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `"Utero Academy Test" <${process.env.SMTP_USER}>`,
    to: "test@example.com", // Ganti dengan email test Anda
    subject: "Test Email Utero Academy",
    text: "Ini adalah test email dari Utero Academy.",
    html: "<b>Ini adalah test email dari Utero Academy.</b>",
  });

  console.log("Email terkirim:", info.messageId);
}

testEmail().catch(console.error);
```

Jalankan:
```bash
node test-email.js
```

#### B. Test via Aplikasi

1. Login sebagai mentor/admin
2. Buat daily report untuk intern, lalu minta revisi
3. Cek inbox email intern untuk menerima notifikasi
4. Atau publikasikan assignment baru di LMS
5. Cek inbox semua peserta yang enrolled

### 2.6 Monitoring & Logging

Email notifikasi di Utero Academy sudah dilengkapi logging:

**Success:**
```
Email berhasil dikirim: <message-id@smtp.provider.com>
```

**Warning (SMTP tidak dikonfigurasi):**
```
Konfigurasi SMTP tidak lengkap. Email tidak terkirim: { to: 'user@example.com', subject: 'Test' }
```

**Error:**
```
Gagal mengirim email: Error: Invalid login: 535-5.7.8 Username and Password not accepted
```

**Cara melihat log:**
```bash
# Docker
docker compose logs -f app

# Development
# Lihat terminal console tempat npm run dev berjalan
```

### 2.7 Troubleshooting Email

**Error: "Invalid login" / "Authentication failed"**
- Periksa kembali SMTP_USER dan SMTP_PASSWORD
- Untuk Gmail, pastikan menggunakan App Password, bukan password akun biasa
- Periksa 2FA sudah aktif (untuk Gmail)

**Email tidak terkirim tapi tidak ada error:**
- Periksa spam folder penerima
- Verifikasi SMTP_HOST dan SMTP_PORT benar
- Cek firewall tidak memblok port 587 atau 465

**Error: "Connection timeout"**
- Provider SMTP mungkin memblok IP server Anda
- Coba gunakan provider SMTP lain (SendGrid, Mailgun)
- Periksa network connectivity dari server

**Email terkirim tapi masuk spam:**
- Setup SPF, DKIM, dan DMARC record di DNS domain Anda
- Gunakan dedicated SMTP provider (SendGrid/Mailgun) yang sudah punya reputasi baik
- Hindari kata-kata spam dalam subject dan body email

---

## 3. WhatsApp Notifikasi (Bonus)

Platform ini juga mendukung notifikasi WhatsApp via WAHA API (opsional):

```env
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=your-waha-api-key
```

Fungsi yang tersedia:
- `sendWahaNotification(phone, message)` - Kirim pesan WhatsApp
- Auto-normalisasi nomor telepon Indonesia (0812 → 62812)

Detail setup WAHA API dapat dilihat di [dokumentasi WAHA](https://waha.devlike.pro/).

---

## 4. Ringkasan Checklist

### ✅ Login Google OAuth
- [ ] Buat project di Google Cloud Console
- [ ] Konfigurasi OAuth consent screen
- [ ] Buat OAuth 2.0 credentials
- [ ] Simpan Client ID dan Client Secret
- [ ] Aktifkan Google provider di Supabase Dashboard
- [ ] Masukkan credentials ke Supabase
- [ ] Update LoginForm.tsx dengan tombol Google
- [ ] Tambahkan loginWithGoogleAction di actions.ts
- [ ] Buat callback handler di app/auth/callback/route.ts
- [ ] Test login Google di development dan production

### ✅ Email Notifikasi SMTP
- [ ] Pilih SMTP provider (Gmail/SendGrid/Mailgun)
- [ ] Dapatkan SMTP credentials
- [ ] Konfigurasi environment variables (.env)
- [ ] Restart aplikasi
- [ ] Test kirim email manual
- [ ] Test notifikasi dari aplikasi (revisi daily report)
- [ ] Monitor log untuk error
- [ ] Setup SPF/DKIM untuk production (opsional)

---

**Dokumentasi dibuat:** 24 Juli 2026  
**Versi Platform:** 1.0.0  
**Status:** Production Ready
