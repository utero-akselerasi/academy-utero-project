import nodemailer from "nodemailer";

function normalizePhoneNumber(phone: string): string {
  // Menghapus karakter non-digit
  let cleaned = phone.replace(/\D/g, "");
  
  // Jika dimulai dengan 0, ganti dengan 62 (Kode negara Indonesia)
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  }
  
  // Jika tidak dimulai dengan 62, tambahkan 62 jika panjangnya masuk akal
  if (cleaned.length > 0 && !cleaned.startsWith("62")) {
    cleaned = "62" + cleaned;
  }
  
  return cleaned;
}

export async function sendEmailNotification(to: string, subject: string, text: string, html?: string) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !port || !user || !pass) {
    console.warn("Konfigurasi SMTP tidak lengkap. Email tidak terkirim:", { to, subject });
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true untuk 465, false untuk lainnya
      auth: { user, pass },
    });

    const info = await transporter.sendMail({
      from: `"Utero Academy" <${user}>`,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, "<br>"),
    });

    console.log("Email berhasil dikirim:", info.messageId);
    return true;
  } catch (err) {
    console.error("Gagal mengirim email:", err);
    return false;
  }
}

export async function sendWahaNotification(phone: string, message: string) {
  const baseUrl = process.env.WAHA_BASE_URL;
  const apiKey = process.env.WAHA_API_KEY;

  if (!baseUrl) {
    console.warn("Konfigurasi WAHA_BASE_URL tidak ada. Pesan WhatsApp tidak terkirim:", { phone });
    return false;
  }

  const normalizedPhone = normalizePhoneNumber(phone);
  if (!normalizedPhone) {
    console.warn("Nomor telepon tidak valid untuk WAHA:", phone);
    return false;
  }

  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/sendText`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chatId: `${normalizedPhone}@c.us`,
        text: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("WAHA API merespon dengan error:", response.status, errorText);
      return false;
    }

    console.log("WhatsApp berhasil dikirim ke:", normalizedPhone);
    return true;
  } catch (err) {
    console.error("Gagal mengirim pesan WhatsApp via WAHA:", err);
    return false;
  }
}

export async function notifyDailyReportRevisionRequested(
  internEmail: string | null,
  internPhone: string | null,
  internName: string,
  reportDate: string,
  note: string
) {
  const subject = `Revisi Laporan Harian - Utero Academy - ${reportDate}`;
  const message = `Halo ${internName},\n\nLaporan harian Anda untuk tanggal ${reportDate} membutuhkan revisi dari pembimbing.\n\nCatatan Pembimbing:\n"${note}"\n\nSilakan masuk ke Dashboard Peserta untuk merevisi laporan Anda di:\n${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/intern/daily-reports\n\nSalam,\nUtero Academy`;

  if (internEmail) {
    await sendEmailNotification(internEmail, subject, message);
  }

  if (internPhone) {
    await sendWahaNotification(internPhone, message);
  }
}

export async function notifyNewAssignmentCreated(
  interns: { email: string | null; phone: string | null; name: string }[],
  courseTitle: string,
  assignmentTitle: string
) {
  const subject = `Tugas Baru: ${assignmentTitle}`;
  
  for (const intern of interns) {
    const message = `Halo ${intern.name},\n\nTugas baru telah dipublikasikan pada materi kelas "${courseTitle}".\n\nJudul Tugas: "${assignmentTitle}"\n\nSilakan cek materi dan kumpulkan tugas Anda di Dashboard Peserta:\n${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/intern/lms\n\nSalam,\nUtero Academy`;

    if (intern.email) {
      await sendEmailNotification(intern.email, subject, message);
    }
    if (intern.phone) {
      await sendWahaNotification(intern.phone, message);
    }
  }
}
