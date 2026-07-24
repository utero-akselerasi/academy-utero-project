# Panduan Google OAuth untuk Supabase Self-Hosted (On-Premise)

## 📋 Perbedaan Supabase Cloud vs Self-Hosted

### **Supabase Cloud (supabase.co)**
- ✅ Dashboard GUI untuk konfigurasi OAuth
- ✅ Klik-klik saja di UI
- ✅ Otomatis tersimpan di infrastruktur mereka

### **Supabase Self-Hosted (On-Premise)**
- ⚠️ **TIDAK ADA DASHBOARD GUI untuk OAuth config**
- ⚠️ Harus konfigurasi manual via **environment variables**
- ⚠️ Harus restart Docker containers setelah konfigurasi

---

## 🏗️ Arsitektur Supabase Self-Hosted Anda

Berdasarkan environment variables Anda:

```
Domain Aplikasi: https://academy.carubra.com
Domain Supabase: https://supabase.carubra.com
```

**Stack Docker Containers:**
```
├── kong (API Gateway)          → Port 8000
├── auth (GoTrue Auth Server)   → Port 9999
├── rest (PostgREST API)        → Port 3000
├── db (PostgreSQL)             → Port 5432
├── storage (S3-compatible)     → Port 5000
└── studio (Dashboard UI)       → Port 3001
```

**OAuth Flow untuk Self-Hosted:**
```
User Browser
    ↓
Next.js App (academy.carubra.com)
    ↓
Kong Gateway (supabase.carubra.com:8000)
    ↓
GoTrue Auth Service (internal:9999)
    ↓
Google OAuth Server
```

---

## ⚙️ Konfigurasi Google OAuth di Self-Hosted

### **Langkah 1: Setup Google Cloud Console**

Sama seperti dokumentasi sebelumnya, tapi dengan **redirect URI khusus untuk self-hosted:**

1. **Buka Google Cloud Console**
   - URL: https://console.cloud.google.com/

2. **Buat OAuth 2.0 Credentials**
   - Application type: **Web application**
   - Name: `Utero Academy Self-Hosted`

3. **Authorized JavaScript origins:**
   ```
   https://academy.carubra.com
   https://supabase.carubra.com
   ```

4. **Authorized redirect URIs (PENTING!):**
   ```
   https://supabase.carubra.com/auth/v1/callback
   ```
   
   **Format untuk self-hosted:**
   ```
   https://[SUPABASE_DOMAIN]/auth/v1/callback
   ```

5. **Simpan Client ID dan Client Secret**
   ```
   Client ID: 1234567890-abc123def456.apps.googleusercontent.com
   Client Secret: GOCSPX-abc123def456ghi789
   ```

---

### **Langkah 2: Konfigurasi Docker Compose Supabase**

Karena Supabase self-hosted Anda sudah running, kita perlu menambahkan environment variables ke service **auth (GoTrue)**.

#### **A. Lokasi File Docker Compose**

Cari file `docker-compose.yml` atau `docker-compose.yaml` di server Supabase Anda:

```bash
# SSH ke server Supabase
ssh user@supabase-server

# Cari docker-compose file
cd /path/to/supabase
ls -la docker-compose.yml
```

#### **B. Edit Service Auth (GoTrue)**

Buka file `docker-compose.yml` dan cari service `auth`:

```yaml
services:
  auth:
    image: supabase/gotrue:v2.x.x
    depends_on:
      - db
    restart: unless-stopped
    environment:
      # Existing variables
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_DB_DATABASE_URL: postgres://postgres:your-password@db:5432/postgres
      GOTRUE_SITE_URL: https://academy.carubra.com
      GOTRUE_URI_ALLOW_LIST: https://academy.carubra.com
      GOTRUE_JWT_SECRET: your-jwt-secret
      GOTRUE_JWT_EXP: 3600
      
      # ====================================================
      # TAMBAHKAN KONFIGURASI GOOGLE OAUTH DI BAWAH INI
      # ====================================================
      
      # Enable Google OAuth Provider
      GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
      
      # Google Client ID dari Google Cloud Console
      GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: "1234567890-abc123def456.apps.googleusercontent.com"
      
      # Google Client Secret dari Google Cloud Console
      GOTRUE_EXTERNAL_GOOGLE_SECRET: "GOCSPX-abc123def456ghi789"
      
      # Redirect URL setelah login sukses di Google
      GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: "https://supabase.carubra.com/auth/v1/callback"
```

**Penjelasan Environment Variables:**

| Variable | Value | Keterangan |
|----------|-------|------------|
| `GOTRUE_EXTERNAL_GOOGLE_ENABLED` | `"true"` | Aktifkan provider Google |
| `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID` | `"your-client-id"` | Client ID dari Google Cloud Console |
| `GOTRUE_EXTERNAL_GOOGLE_SECRET` | `"your-client-secret"` | Client Secret dari Google Cloud Console |
| `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` | `"https://supabase.carubra.com/auth/v1/callback"` | Callback URL untuk OAuth flow |

#### **C. Verifikasi GOTRUE_SITE_URL**

Pastikan variable ini sudah benar:

```yaml
GOTRUE_SITE_URL: https://academy.carubra.com
```

Ini adalah URL aplikasi Next.js Anda (bukan URL Supabase).

#### **D. Verifikasi GOTRUE_URI_ALLOW_LIST**

```yaml
GOTRUE_URI_ALLOW_LIST: https://academy.carubra.com,https://supabase.carubra.com
```

List domain yang diizinkan untuk redirect setelah login.

---

### **Langkah 3: Restart Docker Containers**

Setelah edit `docker-compose.yml`, restart service auth:

```bash
# Restart hanya service auth
docker-compose restart auth

# Atau restart semua (lebih aman)
docker-compose down
docker-compose up -d

# Cek log untuk memastikan tidak ada error
docker-compose logs -f auth
```

**Log yang benar:**
```
auth_1  | time="2026-07-24T18:35:00Z" level=info msg="GoTrue API started on: 0.0.0.0:9999"
auth_1  | time="2026-07-24T18:35:00Z" level=info msg="External provider enabled: google"
```

**Jika ada error:**
```
auth_1  | time="2026-07-24T18:35:00Z" level=error msg="Invalid Google Client ID"
```
→ Cek kembali Client ID dan Secret

---

### **Langkah 4: Test Konfigurasi OAuth**

#### **A. Cek OAuth Endpoint**

Test apakah Google OAuth sudah enabled:

```bash
curl https://supabase.carubra.com/auth/v1/settings

# Atau dengan jq untuk format JSON
curl https://supabase.carubra.com/auth/v1/settings | jq
```

**Response yang benar:**
```json
{
  "external": {
    "google": true
  },
  "autoconfirm": false,
  "disable_signup": false
}
```

Jika `"google": true` muncul, berarti konfigurasi berhasil!

#### **B. Test OAuth Flow Manual**

Buka browser dan akses URL ini:

```
https://supabase.carubra.com/auth/v1/authorize?provider=google
```

**Yang seharusnya terjadi:**
1. Browser redirect ke halaman login Google
2. Pilih akun Google
3. Google redirect kembali ke `https://supabase.carubra.com/auth/v1/callback`
4. Supabase redirect ke `https://academy.carubra.com`

**Jika error 404 atau "Provider not found":**
→ Restart service auth belum jalan, atau variable belum disimpan

---

### **Langkah 5: Update Kode Next.js (TIDAK ADA PERUBAHAN!)**

Karena aplikasi Next.js Anda sudah menggunakan environment variables yang benar:

```env
NEXT_PUBLIC_SUPABASE_URL="https://supabase.carubra.com"
```

Maka kode yang sudah saya dokumentasikan sebelumnya **tetap bisa dipakai tanpa perubahan**:

**File:** `features/auth/actions.ts`
```typescript
export async function loginWithGoogleAction() {
  const supabase = await createSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://academy.carubra.com";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { ok: false, message: "Gagal menginisialisasi login Google." };
  }

  if (data.url) {
    redirect(data.url);
  }
}
```

**File:** `app/auth/callback/route.ts`
```typescript
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const dashboardPath = await getPrimaryDashboardPath(user.id);
      if (dashboardPath) {
        return NextResponse.redirect(`${origin}${dashboardPath}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login`);
}
```

---

## 🔄 Flow Lengkap untuk Self-Hosted

```
┌──────────────────────────────────────────────────────────────┐
│ 1. User klik "Login dengan Google" di academy.carubra.com   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. Next.js panggil Supabase Client SDK                      │
│    supabase.auth.signInWithOAuth({ provider: "google" })    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. SDK kirim request ke:                                     │
│    https://supabase.carubra.com/auth/v1/authorize           │
│    ?provider=google                                          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. Kong Gateway forward ke GoTrue Auth Service (port 9999)  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. GoTrue generate OAuth URL dengan Google Client ID        │
│    https://accounts.google.com/o/oauth2/v2/auth?            │
│    client_id=YOUR_CLIENT_ID&                                 │
│    redirect_uri=https://supabase.carubra.com/auth/v1/callback│
│    &scope=openid+email+profile                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 6. Browser redirect user ke Google login page               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 7. User login di Google & approve permissions                │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 8. Google redirect kembali dengan auth code:                │
│    https://supabase.carubra.com/auth/v1/callback?           │
│    code=4/0AX4XfWh...                                        │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 9. GoTrue exchange code dengan Google Token API             │
│    POST https://oauth2.googleapis.com/token                  │
│    code=...&client_id=...&client_secret=...                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 10. Google return access_token & id_token                    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 11. GoTrue ambil user info dari Google:                     │
│     GET https://www.googleapis.com/oauth2/v2/userinfo        │
│     Authorization: Bearer ACCESS_TOKEN                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 12. GoTrue simpan user ke PostgreSQL (auth.users)           │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 13. GoTrue generate Supabase session token (JWT)            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 14. GoTrue redirect user ke:                                │
│     https://academy.carubra.com/auth/callback?               │
│     code=SUPABASE_SESSION_CODE                               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 15. Next.js callback handler exchange session code          │
│     supabase.auth.exchangeCodeForSession(code)               │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 16. Supabase set session di cookie browser                  │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 17. Next.js cek role user di utero_academy.user_roles       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│ 18. Redirect ke dashboard sesuai role                       │
│     Admin   → /dashboard/admin                               │
│     Intern  → /dashboard/intern                              │
│     School  → /dashboard/school                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting Self-Hosted

### **Problem 1: "Provider not found" atau 404**

**Penyebab:**
- Environment variable belum di-set
- Service auth belum direstart

**Solusi:**
```bash
# Cek environment variables auth container
docker-compose exec auth env | grep GOOGLE

# Harus muncul:
# GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
# GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=...
# GOTRUE_EXTERNAL_GOOGLE_SECRET=...

# Jika tidak muncul, edit docker-compose.yml lagi dan restart
docker-compose restart auth
```

---

### **Problem 2: "redirect_uri_mismatch" dari Google**

**Penyebab:**
- Redirect URI di Google Cloud Console tidak match dengan yang di GoTrue

**Solusi:**
1. Cek di Google Cloud Console, pastikan ada:
   ```
   https://supabase.carubra.com/auth/v1/callback
   ```

2. Cek di `docker-compose.yml`, pastikan:
   ```yaml
   GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: "https://supabase.carubra.com/auth/v1/callback"
   ```

3. Kedua URL harus **PERSIS SAMA** (case-sensitive, dengan/tanpa trailing slash)

---

### **Problem 3: "Invalid client" dari Google**

**Penyebab:**
- Client ID atau Client Secret salah

**Solusi:**
```bash
# Cek nilai yang tersimpan di container
docker-compose exec auth env | grep GOTRUE_EXTERNAL_GOOGLE

# Bandingkan dengan nilai di Google Cloud Console
# Jika beda, edit docker-compose.yml dan restart
```

---

### **Problem 4: CORS Error di Browser**

**Penyebab:**
- Domain aplikasi tidak ada di `GOTRUE_URI_ALLOW_LIST`

**Solusi:**
```yaml
# Tambahkan semua domain yang mungkin diakses
GOTRUE_URI_ALLOW_LIST: "https://academy.carubra.com,https://supabase.carubra.com,http://localhost:3000"
```

Restart auth service.

---

### **Problem 5: Session tidak tersimpan**

**Penyebab:**
- Cookie domain tidak match
- HTTPS issue (mixed content)

**Solusi:**
```yaml
# Pastikan GOTRUE_SITE_URL menggunakan HTTPS
GOTRUE_SITE_URL: "https://academy.carubra.com"

# Pastikan Cookie Secure flag
GOTRUE_COOKIE_SECURE: "true"
```

---

### **Problem 6: User terdaftar tapi tidak punya role**

**Ini normal!** User baru dari Google OAuth tidak otomatis punya role.

**Solusi:**
1. Super Admin login ke `/dashboard/super-admin/users`
2. Cari user baru yang login via Google (cek email)
3. Klik dropdown **"..."** → **Ubah Role**
4. Assign role yang sesuai (admin/intern/school)

**Atau buat script auto-assign role** (advanced):

```sql
-- Trigger auto-assign role 'intern' untuk user baru
CREATE OR REPLACE FUNCTION auto_assign_intern_role()
RETURNS TRIGGER AS $$
DECLARE
  intern_role_id UUID;
BEGIN
  -- Ambil ID role 'intern'
  SELECT id INTO intern_role_id
  FROM utero_academy.roles
  WHERE code = 'intern'
  LIMIT 1;

  -- Assign role ke user baru
  IF intern_role_id IS NOT NULL THEN
    INSERT INTO utero_academy.user_roles (user_id, role_id)
    VALUES (NEW.id, intern_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger dipanggil saat user baru ditambahkan
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION auto_assign_intern_role();
```

---

## 📝 Checklist Setup Google OAuth Self-Hosted

### **☑️ Google Cloud Console**
- [ ] Buat project baru atau pilih existing
- [ ] Enable Google OAuth API
- [ ] Setup OAuth consent screen
- [ ] Buat OAuth 2.0 credentials
- [ ] Tambahkan Authorized JavaScript origins:
  - [ ] `https://academy.carubra.com`
  - [ ] `https://supabase.carubra.com`
- [ ] Tambahkan Authorized redirect URIs:
  - [ ] `https://supabase.carubra.com/auth/v1/callback`
- [ ] Simpan Client ID & Client Secret

### **☑️ Supabase Self-Hosted (docker-compose.yml)**
- [ ] Buka file `docker-compose.yml` di server Supabase
- [ ] Edit service `auth` (GoTrue)
- [ ] Tambahkan environment variables:
  - [ ] `GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"`
  - [ ] `GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: "..."`
  - [ ] `GOTRUE_EXTERNAL_GOOGLE_SECRET: "..."`
  - [ ] `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: "https://supabase.carubra.com/auth/v1/callback"`
- [ ] Verifikasi `GOTRUE_SITE_URL: "https://academy.carubra.com"`
- [ ] Verifikasi `GOTRUE_URI_ALLOW_LIST` include domain aplikasi
- [ ] Save file
- [ ] Restart containers: `docker-compose restart auth`
- [ ] Cek logs: `docker-compose logs -f auth`

### **☑️ Testing**
- [ ] Test endpoint: `curl https://supabase.carubra.com/auth/v1/settings`
- [ ] Verifikasi response: `"google": true`
- [ ] Test OAuth manual: `https://supabase.carubra.com/auth/v1/authorize?provider=google`
- [ ] Verifikasi redirect ke Google login
- [ ] Login dengan akun Google test
- [ ] Verifikasi redirect kembali ke aplikasi
- [ ] Cek user baru muncul di `auth.users`

### **☑️ Next.js Application**
- [ ] Kode sudah sesuai dokumentasi (tidak perlu ubah)
- [ ] Environment variables sudah benar:
  - [ ] `NEXT_PUBLIC_SUPABASE_URL="https://supabase.carubra.com"`
  - [ ] `NEXT_PUBLIC_APP_URL="https://academy.carubra.com"`
- [ ] Deploy aplikasi Next.js
- [ ] Test login Google dari UI aplikasi
- [ ] Verifikasi callback handler berjalan
- [ ] Verifikasi redirect ke dashboard

### **☑️ Post-Login (Manual Step)**
- [ ] Super Admin assign role ke user baru
- [ ] User bisa akses dashboard sesuai role

---

## 🎯 Kesimpulan untuk Self-Hosted

### **Perbedaan Utama dengan Cloud:**

| Aspek | Supabase Cloud | Supabase Self-Hosted |
|-------|----------------|----------------------|
| **Konfigurasi** | Via Dashboard GUI | Via `docker-compose.yml` |
| **OAuth Setup** | Klik-klik UI | Edit environment variables |
| **Restart** | Tidak perlu | Wajib restart container |
| **Monitoring** | Dashboard built-in | Manual via Docker logs |
| **Update Config** | Real-time | Butuh restart |

### **Yang Sama:**

✅ Alur OAuth flow tetap sama  
✅ Kode Next.js tidak berubah  
✅ Google OAuth API tetap sama  
✅ Database schema tetap sama  
✅ Security level tetap sama  

### **Keuntungan Self-Hosted:**

✅ Full control atas infrastruktur  
✅ Data tersimpan di server sendiri  
✅ Tidak tergantung vendor  
✅ Bisa customize lebih dalam  
✅ Tidak ada biaya bulanan Supabase  

### **Tantangan Self-Hosted:**

⚠️ Harus manage server sendiri  
⚠️ Harus update Docker images manual  
⚠️ Troubleshooting lebih teknis  
⚠️ Butuh akses SSH ke server  
⚠️ Monitoring manual via logs  

---

**Dokumentasi dibuat:** 24 Juli 2026  
**Versi:** 1.0.0 (Self-Hosted Edition)  
**Target:** Supabase Self-Hosted on-premise
