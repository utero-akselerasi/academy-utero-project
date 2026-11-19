function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function verificationEmailContent(verificationUrl) {
  const safeUrl = escapeHtml(verificationUrl);
  return {
    text: [
      "Halo,",
      "",
      "Terima kasih telah mendaftar di Utero Academy. Verifikasi alamat email Anda untuk mengaktifkan akun.",
      "",
      "Verifikasi email: " + verificationUrl,
      "",
      "Tautan ini berlaku selama 1 jam dan hanya dapat digunakan satu kali.",
      "Jika Anda tidak merasa mendaftar, abaikan email ini. Akun tidak akan diaktifkan.",
      "",
      "Utero Academy",
    ].join("\n"),
    html: `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <title>Verifikasi email | Utero Academy</title>
  </head>
  <body style="margin:0;padding:32px 16px;background:#f1f5f9;color:#172033;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Satu langkah lagi untuk mengaktifkan akun Utero Academy Anda.</div>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
      <tr><td style="padding:28px 36px;background:#10243a;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px;">UTERO <span style="color:#48c6a9;">ACADEMY</span></td></tr>
      <tr><td style="padding:36px 36px 16px;"><p style="margin:0 0 12px;color:#0f766e;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Verifikasi akun</p><h1 style="margin:0;color:#10243a;font-size:26px;line-height:1.3;">Verifikasi email Anda</h1></td></tr>
      <tr><td style="padding:0 36px 28px;font-size:15px;line-height:1.7;"><p style="margin:0 0 16px;">Halo,</p><p style="margin:0 0 24px;color:#475569;">Terima kasih telah mendaftar di Utero Academy. Konfirmasi alamat email Anda untuk mengaktifkan akun dan melanjutkan pendaftaran.</p><p style="margin:0 0 28px;text-align:center;"><a href="${safeUrl}" style="display:inline-block;padding:14px 26px;border-radius:8px;background:#c9182b;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Verifikasi email</a></p><p style="margin:0 0 8px;color:#475569;font-size:13px;">Tombol tidak berfungsi? Salin tautan ini ke browser:</p><p style="margin:0 0 24px;overflow-wrap:anywhere;font-size:13px;"><a href="${safeUrl}" style="color:#0f766e;">${safeUrl}</a></p><div style="padding:16px 18px;border-radius:8px;background:#f8fafc;color:#475569;font-size:13px;"><strong style="color:#172033;">Tautan berlaku 1 jam</strong> dan hanya dapat digunakan satu kali.<br>Jika Anda tidak merasa mendaftar, abaikan email ini. Akun tidak akan diaktifkan.</div></td></tr>
      <tr><td style="padding:20px 36px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">Email otomatis dari Utero Academy. Mohon jangan membalas pesan ini.</td></tr>
    </table>
  </body>
</html>`,
  };
}
