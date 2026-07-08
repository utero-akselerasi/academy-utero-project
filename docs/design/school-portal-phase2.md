# School Portal Phase 2 - Laporan Periodik & Export

## Scope Phase 2

### Fitur Utama
1. **Generate Laporan Periodik** (Mingguan, Bulanan, Semester)
   - Query agregasi data siswa per instansi
   - Generate PDF resmi dengan header/footer
   - Generate Excel untuk olah data lebih lanjut

2. **Halaman Laporan Sekolah**
   - Daftar laporan yang pernah di-generate
   - Filter by tanggal/jenis laporan
   - Download laporan PDF/Excel
   - Preview laporan sebelum download

3. **Template Laporan Standar**
   - Header: Logo sekolah + Utero Academy
   - Ringkasan: Total siswa, attendance rate, nilai rata-rata
   - Detail: Tabel siswa dengan metrik kunci
   - Footer: Tanggal cetak, TTD digital

### Data yang Dimasukkan ke Laporan
- Nama siswa, NIS, Jurusan, Status
- Attendance rate (%), total jam magang
- Total daily report, status review
- Nilai akhir (jika sudah dinilai)
- Catatan khusus per siswa

### Database Changes
- Tabel `school_reports` sudah ada dari migration 0016
- Tambah kolom jika perlu: file_format, generated_by, sent_to_email

### UI/UX Flow
1. Super Admin / School Portal → tab "Laporan"
2. Form filter: Jenis laporan, tanggal mulai/selesai
3. Klik "Generate Laporan"
4. Sistem generate PDF + Excel
5. Download atau preview langsung

## Implementation Plan

### Step 1: Action & Query (Backend)
- `getSchoolReportMetrics()` - agregasi data untuk laporan
- `generateSchoolReportAction()` - generate PDF + save ke storage
- `getSchoolReports()` - list laporan yang sudah di-generate

### Step 2: PDF Generation
- Gunakan library: `pdfkit` atau `jsPDF`
- Layout standar A4 Portrait
- Header, body (tabel), footer

### Step 3: Excel Generation
- Gunakan `exceljs` library
- Format: header, data rows, summary
- Styling: border, alignment, font

### Step 4: UI Halaman Laporan
- `app/dashboard/school/reports/page.tsx`
- Form generate dengan date picker
- Tabel daftar laporan

### Step 5: Preview & Download
- Modal preview PDF
- Link download file

## Estimated Timeline
- Step 1-2 (Backend + PDF): 2-3 jam
- Step 3 (Excel): 1-2 jam
- Step 4-5 (UI): 2-3 jam

## Decision Points
1. **PDF Library**: pdfkit (simpler) vs jsPDF (browser-based)?
   - Saran: pdfkit (generate server-side, faster)

2. **Storage**: Simpan PDF ke Supabase Storage atau hanya temp file?
   - Saran: Simpan ke storage agar bisa didownload ulang nanti

3. **Preview**: Modal preview atau halaman terpisah?
   - Saran: Modal preview supaya UX flow lebih lancar
