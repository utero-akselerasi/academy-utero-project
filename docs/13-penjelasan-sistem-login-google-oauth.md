# Penjelasan Sistem Login Google OAuth di Utero Academy

## Arsitektur & Alur Kerja Login Google

### 🎯 Konsep Dasar

**TIDAK PERLU BACKEND TERPISAH!** 

Sistem login Google di Utero Academy menggunakan **Supabase Auth sebagai backend OAuth provider**. Supabase sudah menyediakan semua infrastruktur OAuth yang diperlukan, jadi Anda tidak perlu membuat server OAuth sendiri.

---

## 📊 Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                    UTERO ACADEMY PLATFORM                        │
│                     (Next.js Frontend)                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (1) User klik "Login dengan Google"
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH SERVER                          │
│              (Backend OAuth Provider Built-in)                   │
│                                                                   │
│  • Menyimpan OAuth config (Client ID, Client Secret)            │
│  • Mengelola OAuth flow                                          │
│  • Generate & validate session token                             │
│  • Menyimpan user data ke auth.users                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (2) Redirect ke Google untuk autentikasi
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                  GOOGLE OAUTH SERVER                             │
│                                                                   │
│  • User pilih akun Google                                        │
│  • User approve permissions                                      │
│  • Google generate authorization code                            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (3) Redirect kembali dengan auth code
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE AUTH SERVER                          │
│                                                                   │
│  • Exchange code dengan Google untuk access token                │
│  • Ambil user info dari Google (email, name, avatar)            │
│  • Buat/update record di auth.users                             │
│  • Generate Supabase session token                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       │ (4) Redirect ke aplikasi dengan session
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                 UTERO ACADEMY CALLBACK                           │
│                  (app/auth/callback)                             │
│                                                                   │
│  • Terima session dari Supabase                                  │
│  • Cek role user di utero_academy.user_roles                    │
│  • Redirect ke dashboard sesuai role                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Alur Login Google Step-by-Step

### **FASE 1: User Klik Tombol Google**

**File:** `features/auth/LoginForm.tsx`

```tsx
<form action={loginWithGoogleAction}>
  <button type="submit">
    Masuk dengan Google
  </button>
</form>
```

**Yang Terjadi:**
1. User klik tombol "Masuk dengan Google"
2. Browser memanggil server action `loginWithGoogleAction()`

---

### **FASE 2: Inisialisasi OAuth Flow**

**File:** `features/auth/actions.ts`

```typescript
export async function loginWithGoogleAction() {
  const supabase = await createSupabaseServerClient();
  
  // Minta Supabase untuk memulai OAuth flow dengan Google
  const { data } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  // Redirect user ke Google OAuth page
  if (data.url) {
    redirect(data.url); // → https://accounts.google.com/o/oauth2/v2/auth?...
  }
}
```

**Yang Terjadi:**
1. Next.js server memanggil **Supabase Auth API**
2. Supabase mengenerate URL OAuth Google dengan parameter:
   - `client_id` (dari config Supabase)
   - `redirect_uri` (callback URL Supabase)
   - `scope` (email, profile)
   - `state` (security token)
3. User di-redirect ke halaman login Google

**URL Redirect Contoh:**
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id=YOUR_GOOGLE_CLIENT_ID&
  redirect_uri=https://your-supabase.supabase.co/auth/v1/callback&
  response_type=code&
  scope=openid+email+profile&
  state=RANDOM_STATE_TOKEN
```

---

### **FASE 3: User Login di Google**

**Platform:** Google OAuth Server

1. User melihat halaman "Sign in with Google"
2. User memilih akun Google yang ingin digunakan
3. Google menampilkan consent screen: "Utero Academy ingin akses email & profil Anda"
4. User klik **"Allow"**

**Yang Terjadi:**
1. Google memvalidasi user credentials
2. Google generate **authorization code** (satu kali pakai)
3. Google redirect user kembali ke **Supabase callback URL**

**URL Redirect Contoh:**
```
https://your-supabase.supabase.co/auth/v1/callback?
  code=4/0AX4XfWh...authorization_code_here...&
  state=RANDOM_STATE_TOKEN
```

---

### **FASE 4: Supabase Exchange Code dengan Token**

**Platform:** Supabase Auth Server (Backend)

**Yang Terjadi (OTOMATIS oleh Supabase):**

1. **Supabase menerima authorization code dari Google**
2. **Supabase memanggil Google Token API:**
   ```http
   POST https://oauth2.googleapis.com/token
   Content-Type: application/x-www-form-urlencoded
   
   code=4/0AX4XfWh...&
   client_id=YOUR_CLIENT_ID&
   client_secret=YOUR_CLIENT_SECRET&
   redirect_uri=https://your-supabase.supabase.co/auth/v1/callback&
   grant_type=authorization_code
   ```

3. **Google merespons dengan access token:**
   ```json
   {
     "access_token": "ya29.a0AfH6SMB...",
     "expires_in": 3599,
     "token_type": "Bearer",
     "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjY..."
   }
   ```

4. **Supabase menggunakan access token untuk ambil user info dari Google:**
   ```http
   GET https://www.googleapis.com/oauth2/v2/userinfo
   Authorization: Bearer ya29.a0AfH6SMB...
   ```

5. **Google merespons dengan user profile:**
   ```json
   {
     "id": "1234567890",
     "email": "user@gmail.com",
     "verified_email": true,
     "name": "John Doe",
     "given_name": "John",
     "family_name": "Doe",
     "picture": "https://lh3.googleusercontent.com/..."
   }
   ```

6. **Supabase menyimpan/update user di database:**
   - Tabel: `auth.users`
   - Kolom yang diisi:
     ```sql
     INSERT INTO auth.users (
       id,              -- UUID auto-generate
       email,           -- user@gmail.com
       provider,        -- 'google'
       provider_id,     -- Google User ID
       raw_user_meta_data, -- JSON: {name, avatar_url, etc}
       created_at,
       updated_at
     )
     ```

7. **Supabase generate session token (JWT):**
   ```json
   {
     "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
     "token_type": "bearer",
     "expires_in": 3600,
     "refresh_token": "v1.MR_..."
   }
   ```

8. **Supabase redirect user ke aplikasi Next.js:**
   ```
   https://your-app.com/auth/callback?
     code=supabase_session_code
   ```

---

### **FASE 5: Next.js Callback Handler**

**File:** `app/auth/callback/route.ts`

```typescript
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    
    // Exchange Supabase session code dengan session
    await supabase.auth.exchangeCodeForSession(code);

    // Ambil user yang sudah login
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Cek role user di database Utero Academy
      const dashboardPath = await getPrimaryDashboardPath(user.id);
      
      // Redirect ke dashboard sesuai role
      if (dashboardPath) {
        return NextResponse.redirect(`${origin}${dashboardPath}`);
      }
    }
  }

  // Jika gagal, redirect ke login
  return NextResponse.redirect(`${origin}/login`);
}
```

**Yang Terjadi:**
1. Next.js terima session code dari Supabase
2. Exchange code dengan Supabase untuk dapat session lengkap
3. Supabase set cookie dengan session token
4. Next.js cek role user di `utero_academy.user_roles`
5. Redirect ke dashboard sesuai role:
   - Admin → `/dashboard/admin`
   - Intern → `/dashboard/intern`
   - School → `/dashboard/school`

---

## 🗄️ Database Schema yang Terlibat

### **1. Tabel auth.users (Supabase Built-in)**

```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  encrypted_password TEXT,  -- NULL untuk OAuth users
  provider TEXT,            -- 'email' atau 'google'
  provider_id TEXT,         -- Google User ID
  raw_user_meta_data JSONB, -- Data dari Google
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ
);
```

**Contoh Data untuk User Google:**
```json
{
  "id": "a1b2c3d4-...",
  "email": "john.doe@gmail.com",
  "encrypted_password": null,
  "provider": "google",
  "provider_id": "1234567890",
  "raw_user_meta_data": {
    "email": "john.doe@gmail.com",
    "name": "John Doe",
    "avatar_url": "https://lh3.googleusercontent.com/...",
    "sub": "1234567890",
    "email_verified": true
  }
}
```

### **2. Tabel utero_academy.user_profiles**

```sql
CREATE TABLE utero_academy.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  full_name TEXT,
  phone TEXT,
  avatar_path TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Auto-sync dengan trigger:**
Saat user baru login dengan Google, trigger otomatis membuat profile:
```sql
-- File: supabase/migrations/0008_sync_user_profiles.sql
CREATE OR REPLACE FUNCTION sync_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO utero_academy.user_profiles (id, full_name, avatar_path)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(utero_academy.user_profiles.full_name, EXCLUDED.full_name),
    avatar_path = COALESCE(utero_academy.user_profiles.avatar_path, EXCLUDED.avatar_path);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### **3. Tabel utero_academy.user_roles**

```sql
CREATE TABLE utero_academy.user_roles (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role_id UUID REFERENCES utero_academy.roles(id),
  created_at TIMESTAMPTZ
);
```

**Catatan Penting:**
- User yang login dengan Google **TIDAK OTOMATIS PUNYA ROLE**
- Super Admin harus **manual assign role** di halaman User & Role
- Tanpa role, user tidak bisa akses dashboard manapun

---

## 🔐 Session Management

### **Cookie yang Di-set oleh Supabase:**

Setelah login sukses, Supabase menyimpan session di browser cookie:

```
sb-<project-ref>-auth-token = {
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "v1.MR_...",
  "user": {
    "id": "a1b2c3d4-...",
    "email": "john.doe@gmail.com",
    "app_metadata": {},
    "user_metadata": {
      "name": "John Doe",
      "avatar_url": "https://..."
    }
  }
}
```

**Cara Next.js Baca Session:**

```typescript
// Di server component atau API route
const supabase = await createSupabaseServerClient();
const { data: { user } } = await supabase.auth.getUser();

// user.id → UUID
// user.email → john.doe@gmail.com
// user.user_metadata.name → John Doe
```

**Auto Refresh Token:**
Supabase SDK otomatis refresh token sebelum expired (setiap ~55 menit).

---

## ⚙️ Setup yang Diperlukan

### **1. Konfigurasi Google Cloud Console**

**Anda Perlu:**
- ✅ Client ID
- ✅ Client Secret

**Google yang Handle:**
- User authentication
- Email verification
- OAuth consent screen
- Security & fraud detection

### **2. Konfigurasi Supabase Dashboard**

**Anda Perlu:**
- ✅ Enable Google provider
- ✅ Input Client ID & Client Secret

**Supabase yang Handle:**
- OAuth flow management
- Token exchange dengan Google
- User data storage di auth.users
- Session token generation
- Auto refresh token
- Cookie management
- Database triggers untuk sync profile

### **3. Konfigurasi Next.js (Code)**

**Anda Perlu:**
- ✅ Tambahkan tombol "Login dengan Google" di LoginForm
- ✅ Buat server action `loginWithGoogleAction()`
- ✅ Buat callback route `/auth/callback`

**Next.js yang Handle:**
- Redirect user flow
- Role-based routing
- Protected route middleware
- Dashboard access control

---

## 🔒 Keamanan

### **Data yang Disimpan Google:**
- User credentials (password)
- 2FA settings
- Account recovery options

### **Data yang Disimpan Supabase:**
- User email, name, avatar
- Session tokens
- Role & permissions
- Aplikasi data (daily report, tasks, etc)

### **Tidak Ada Password di Supabase:**
User yang login dengan Google **TIDAK PUNYA PASSWORD** di Supabase.
Kolom `encrypted_password` di `auth.users` = **NULL**

---

## 📝 Kesimpulan

### **Yang Anda Setup:**
1. Google Cloud Console (Client ID & Secret)
2. Supabase Dashboard (Enable Google provider)
3. Next.js Code (UI button + callback handler)

### **Yang Automatic (No Code Needed):**
1. ✅ OAuth flow management → **Supabase**
2. ✅ Token exchange → **Supabase**
3. ✅ User data storage → **Supabase**
4. ✅ Session management → **Supabase**
5. ✅ Cookie handling → **Supabase SDK**
6. ✅ Token refresh → **Supabase SDK**
7. ✅ Profile sync → **Database Trigger**

### **Backend OAuth Server = Supabase Auth (Built-in)**

**TIDAK PERLU:**
- ❌ Bikin server OAuth sendiri
- ❌ Handle token exchange manual
- ❌ Manage session storage
- ❌ Implement refresh token logic
- ❌ Setup database untuk auth

**Supabase Auth sudah lengkap sebagai OAuth backend!**

---

## 🎯 Analogi Sederhana

**Bayangkan seperti ini:**

```
User:        "Saya mau login pakai Google"
Next.js:     "Ok, saya kirim ke Supabase"
Supabase:    "Ok, saya kirim user ke Google"
Google:      "Silakan login" → User login → "Ok, ini kodenya"
Supabase:    "Terima kode, saya tukar dengan data user ke Google"
Google:      "Ini data usernya: email, nama, foto"
Supabase:    "Saya simpan di database, ini session tokennya"
Next.js:     "Terima token, user sudah login, redirect ke dashboard"
```

**Anda hanya perlu:**
1. Setup Google (beri kunci ke Supabase)
2. Setup Supabase (aktifkan fitur Google)
3. Setup Next.js (buat tombol + handler)

**Sisanya otomatis!** 🎉

---

**Dokumentasi dibuat:** 24 Juli 2026  
**Versi:** 1.0.0
