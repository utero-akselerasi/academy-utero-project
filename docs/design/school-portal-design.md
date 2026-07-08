# School Portal - Product Design Document

**Versi:** 1.0
**Tanggal:** 9 Juli 2026
**Status:** Draft - Perancangan

---

## 1. Executive Summary

School Portal adalah dashboard khusus untuk perwakilan instansi pendidikan (sekolah/kampus) yang mengirimkan siswa/mahasiswa mereka untuk magang di Utero Academy. Portal ini memberikan visibilitas penuh kepada pihak sekolah terhadap performa, kehadiran, dan perkembangan siswa mereka tanpa harus menghubungi admin/mentor secara manual.

**Tujuan Utama:**

- Transparansi penuh untuk institusi pendidikan partner
- Monitoring real-time siswa magang dari sekolah tersebut
- Laporan periodik otomatis untuk evaluasi akademik
- Kolaborasi lebih efisien antara Utero Academy dan institusi partner

---

## 2. User Persona

### Persona 1: Kepala Program Magang Sekolah

- **Nama:** Pak Budi (45 tahun)
- **Posisi:** Koordinator PKL/Magang SMK
- **Kebutuhan:**
  - Memantau 20-30 siswa yang sedang magang
  - Laporan berkala untuk diserahkan ke Kepala Sekolah
  - Verifikasi kehadiran dan performa siswa
  - Koordinasi dengan mentor jika ada masalah

### Persona 2: Dosen Pembimbing Lapangan

- **Nama:** Ibu Siti (38 tahun)
- **Posisi:** Dosen pembimbing praktik kerja kampus
- **Kebutuhan:**
  - Tracking progress mahasiswa bimbingannya
  - Unduh laporan untuk keperluan penilaian akhir
  - Komunikasi dengan mentor industri
  - Validasi sertifikat dan nilai akhir

---

## 3. Functional Requirements

### 3.1 Dashboard Overview (Halaman Utama)

**Komponen Statistik Cards:**

- Total siswa aktif magang dari sekolah ini
- Total siswa alumni (yang sudah selesai)
- Rata-rata attendance rate (%)
- Rata-rata nilai akhir assessment
- Siswa dengan performa terbaik bulan ini
- Alert: siswa yang butuh perhatian (attendance < 80%)

**Visualisasi Chart:**

- Line chart: Trend kehadiran bulanan (6 bulan terakhir)
- Bar chart: Distribusi nilai akhir siswa (A, B, C, dst)
- Pie chart: Status siswa (Aktif, Lulus, Dropout)
- Progress chart: Penyelesaian target jam magang

### 3.2 Daftar Siswa Magang

**Tabel dengan kolom:**

- Foto profil
- Nama lengkap
- NIS/NIM
- Jurusan/Program studi
- Tanggal mulai magang
- Status (Aktif/Selesai/Cuti)
- Attendance rate (%)
- Total jam magang
- Nilai akhir (jika sudah dinilai)
- Aksi (Lihat Detail)

**Filter & Search:**

- Filter by status (Semua/Aktif/Alumni)
- Filter by jurusan
- Filter by periode (batch)
- Search by nama/NIS/NIM
- Sort by attendance rate, nilai, dll

### 3.3 Detail Siswa

**Informasi Profil:**

- Data pribadi lengkap
- Kontak (email, phone)
- Periode magang (mulai - selesai)
- Mentor pembimbing

**Tab Navigation:**

#### Tab 1: Attendance (Kehadiran)

- Kalender visual kehadiran (hijau=hadir, kuning=izin, merah=sakit, abu=absent)
- Statistik:
  - Total hari hadir
  - Total jam terakumulasi
  - Progress vs target jam
  - Total keterlambatan (count & menit)
  - Izin/Sakit breakdown
- Tabel riwayat absensi detail
- Tombol: Export Rekap Kehadiran (Excel)

#### Tab 2: Daily Reports (Laporan Harian)

- List laporan harian yang sudah disubmit
- Status review mentor (Approved/Revision/Pending)
- Preview singkat aktivitas & hasil kerja
- Tombol: Lihat Detail Laporan
- Filter by tanggal/minggu/bulan
- Tombol: Export Rekap Laporan (PDF)

#### Tab 3: Tasks & Projects (Tugas & Proyek)

- Daftar tugas yang diberikan mentor
- Status: Belum Dikerjakan, In Progress, Selesai
- Deadline & ketepatan waktu pengumpulan
- Kualitas hasil kerja (rating mentor)
- Total tugas selesai vs total tugas diberikan
- Tombol: Lihat Detail Tugas

#### Tab 4: LMS Progress (Pembelajaran)

- Modul/materi yang sudah dipelajari
- Kuis/ujian yang sudah dikerjakan + nilai
- Progress penyelesaian course (%)
- Rata-rata nilai kuis
- Sertifikat micro-learning (jika ada)

#### Tab 5: Assessment (Penilaian Akhir)

- Nilai akhir dari mentor (jika sudah dinilai)
- Breakdown kriteria penilaian:
  - Kehadiran (30%)
  - Kedisiplinan (20%)
  - Kualitas kerja (30%)
  - Attitude & teamwork (20%)
- Feedback/catatan mentor
- Nomor sertifikat
- Tombol: Unduh Sertifikat (PDF)
- Tombol: Unduh Transkrip Nilai (PDF)

### 3.4 Laporan Periodik

**Generate Laporan Otomatis:**

- Laporan Mingguan: Ringkasan kehadiran & aktivitas
- Laporan Bulanan: Comprehensive report semua siswa
- Laporan Akhir Semester: Evaluasi lengkap + nilai

**Format Export:**

- PDF (untuk print & arsip formal)
- Excel (untuk olah data lebih lanjut)

**Komponen Laporan:**

- Header: Logo sekolah + logo Utero Academy
- Periode laporan
- Daftar siswa dengan metrik kunci
- Summary statistics
- Rekomendasi/catatan khusus
- TTD digital: Mentor + Koordinator Program

### 3.5 Notifications & Alerts

**Real-time Notification:**

- Siswa tidak hadir 3 hari berturut-turut
- Siswa terlambat > 5x dalam sebulan
- Daily report belum disubmit 2 hari berturut-turut
- Nilai assessment siswa sudah keluar
- Sertifikat siswa sudah tersedia

**Notifikasi Channel:**

- In-app notification (bell icon)
- Email digest (harian/mingguan)
- WhatsApp (opsional, untuk alert penting)

### 3.6 Communication Hub

**Fitur Komunikasi:**

- Kirim pesan langsung ke mentor pembimbing siswa
- Thread diskusi per siswa
- Request meeting/konsultasi
- Share dokumen pendukung

**Use Case:**

- Sekolah menanyakan progress siswa tertentu
- Koordinasi jadwal kunjungan industri
- Konfirmasi data untuk keperluan administrasi
- Eskalasi jika ada masalah dengan siswa

---

## 4. Technical Architecture

### 4.1 Database Schema

**Tabel Baru:**

```sql
-- Tabel untuk menyimpan institusi pendidikan
CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50), -- 'SMK', 'SMA', 'UNIVERSITAS', 'POLITEKNIK'
  address TEXT,
  city VARCHAR(100),
  province VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  website VARCHAR(255),
  logo_url TEXT,
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'inactive', 'suspended'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel untuk perwakilan/kontak sekolah (sudah ada: school_contacts)
-- Tambahkan kolom school_id reference

ALTER TABLE school_contacts 
ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Tabel untuk mapping siswa ke sekolah asal
CREATE TABLE intern_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_id UUID NOT NULL REFERENCES intern_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id VARCHAR(50), -- NIS/NIM
  major VARCHAR(255), -- Jurusan
  batch VARCHAR(50), -- Angkatan/batch
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(intern_id, school_id)
);

-- Tabel untuk laporan periodik
CREATE TABLE school_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  report_type VARCHAR(50), -- 'weekly', 'monthly', 'semester'
  period_start DATE,
  period_end DATE,
  generated_by UUID REFERENCES auth.users(id),
  file_url TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'sent'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 API Endpoints

**Dashboard Sekolah:**

- `GET /api/school/dashboard` - Overview statistics
- `GET /api/school/students` - List siswa dari sekolah ini
- `GET /api/school/students/:id` - Detail siswa
- `GET /api/school/students/:id/attendance` - Riwayat kehadiran siswa
- `GET /api/school/students/:id/daily-reports` - Laporan harian siswa
- `GET /api/school/students/:id/tasks` - Tugas siswa
- `GET /api/school/students/:id/lms` - Progress pembelajaran siswa
- `GET /api/school/students/:id/assessment` - Nilai akhir siswa

**Laporan:**

- `POST /api/school/reports/generate` - Generate laporan periodik
- `GET /api/school/reports` - List laporan yang pernah dibuat
- `GET /api/school/reports/:id/download` - Download laporan

**Komunikasi:**

- `GET /api/school/messages` - List pesan
- `POST /api/school/messages` - Kirim pesan baru
- `GET /api/school/messages/:threadId` - Detail thread

### 4.3 File Structure

```
app/
  dashboard/
    school/
      layout.tsx                    # Layout dengan sidebar sekolah
      page.tsx                      # Dashboard overview
      students/
        page.tsx                    # List siswa
        [studentId]/
          page.tsx                  # Detail siswa (tabs)
          attendance/
            page.tsx                # Tab kehadiran detail
          daily-reports/
            page.tsx                # Tab laporan harian
          tasks/
            page.tsx                # Tab tugas
          lms/
            page.tsx                # Tab pembelajaran
          assessment/
            page.tsx                # Tab nilai akhir
      reports/
        page.tsx                    # Laporan periodik
        generate/
          page.tsx                  # Form generate laporan
      messages/
        page.tsx                    # Communication hub
      settings/
        page.tsx                    # Pengaturan profil sekolah

features/
  school-portal/
    components/
      SchoolDashboardStats.tsx      # Statistik cards
      SchoolStudentTable.tsx        # Tabel siswa
      SchoolAttendanceCalendar.tsx  # Kalender kehadiran
      SchoolReportGenerator.tsx     # Form generate laporan
      SchoolMessageThread.tsx       # Thread komunikasi
    actions.ts                      # Server actions
    queries.ts                      # Database queries
    types.ts                        # TypeScript types

lib/
  pdf/
    school-report-generator.ts     # PDF generator laporan sekolah
```

---

## 5. UI/UX Design Guidelines

### 5.1 Color Scheme

- Primary: Biru profesional (#2563EB) - trust & authority
- Success: Hijau (#10B981) - kehadiran & performa baik
- Warning: Kuning (#F59E0B) - perlu perhatian
- Danger: Merah (#EF4444) - alert & masalah
- Neutral: Abu-abu (#6B7280) - informasi sekunder

### 5.2 Layout

- Sidebar kiri: Navigasi utama
- Top bar: School name, notification bell, profile dropdown
- Main content: Dashboard dengan grid cards + charts
- Responsive: Mobile-friendly untuk akses di HP

### 5.3 Key Interactions

- Click student row → Open detail modal/page
- Hover stat card → Show tooltip dengan info detail
- Click chart data point → Filter/drill down
- Export button → Loading state → Download file

---

## 6. Access Control & Security

### 6.1 RBAC (Role-Based Access Control)

**Role: `school`**

**Permissions:**

- ✅ READ: Siswa dari sekolahnya sendiri saja
- ✅ READ: Attendance, daily reports, tasks, assessment siswa mereka
- ✅ WRITE: Kirim pesan/komunikasi ke mentor
- ✅ EXPORT: Laporan & dokumen siswa mereka
- ❌ WRITE: Tidak bisa ubah data siswa
- ❌ WRITE: Tidak bisa ubah nilai/assessment
- ❌ READ: Tidak bisa lihat siswa dari sekolah lain

**RLS Policies:**

```sql
-- Policy: School hanya bisa lihat siswa dari sekolahnya
CREATE POLICY school_read_own_students ON intern_profiles
  FOR SELECT
  USING (
    id IN (
      SELECT intern_id FROM intern_schools
      WHERE school_id = (
        SELECT school_id FROM school_contacts
        WHERE user_id = auth.uid()
      )
    )
  );
```

### 6.2 Data Privacy

- School contact hanya bisa akses data siswa yang terhubung ke sekolah mereka
- Data sensitif (alamat rumah, nomor pribadi) di-mask sebagian
- Audit log: Catat siapa akses data siswa kapan
- Session timeout: 2 jam inaktivitas

---

## 7. Implementation Phases

### Phase 1: MVP Core (Week 1-2)

- [X] Database schema & migration
- [ ] Dashboard overview dengan statistik cards
- [ ] List siswa dengan filter & search
- [ ] Detail siswa dengan tab attendance

### Phase 2: Detail & Reports (Week 3-4)

- [ ] Tab daily reports, tasks, LMS, assessment
- [ ] Kalender visual kehadiran
- [ ] Export attendance ke Excel
- [ ] Generate laporan PDF sederhana

### Phase 3: Advanced Features (Week 5-6)

- [ ] Real-time notifications
- [ ] Communication hub (messaging)
- [ ] Advanced charts & analytics
- [ ] Email/WhatsApp integration

### Phase 4: Polish & Testing (Week 7)

- [ ] UI/UX refinement
- [ ] Performance optimization
- [ ] Security audit
- [ ] User acceptance testing dengan sekolah partner

---

## 8. Success Metrics

**Quantitative:**

- Adoption rate: 80% sekolah partner aktif menggunakan portal dalam 3 bulan
- Login frequency: Rata-rata 3x per minggu per school contact
- Report download: Minimal 2 laporan di-download per bulan per sekolah
- Time saved: Reduce koordinasi email/WA sebanyak 60%

**Qualitative:**

- Survey kepuasan sekolah: Target 4/5 stars
- Feedback positif tentang transparansi & kemudahan monitoring
- Reduction in complaint/eskalasi manual

---

## 9. Future Enhancements (Post-Launch)

- **Multi-language support:** Bahasa Inggris untuk universitas internasional
- **Mobile app:** Native iOS/Android untuk school contacts
- **AI Insights:** Prediksi risiko dropout siswa berdasarkan pola attendance
- **Bulk operations:** Sekolah bisa register banyak siswa sekaligus via CSV upload
- **Integration:** API untuk sync dengan sistem akademik sekolah (SIM)
- **Video call:** Built-in meeting room untuk konsultasi dengan mentor

---

## 10. Open Questions & Decisions Needed

1. **Apakah school contact bisa invite/register siswa baru langsung?**

   - Atau tetap harus via admin Utero dulu?
2. **Berapa level akses untuk school?**

   - Apakah ada hierarki (Kepala Sekolah vs Guru Pembimbing)?
3. **Bagaimana handle siswa yang pindah sekolah?**

   - Update school_id atau buat riwayat?
4. **Apakah sekolah bisa request custom report template?**

   - Atau pakai template standard saja?
5. **Notification preferences:**

   - Apakah school contact bisa customize jenis notifikasi yang mereka terima?

---

**Prepared by:** Kiro AI
**Review by:** Mas Kharisman
**Approved by:** Mas Kharisman

---
