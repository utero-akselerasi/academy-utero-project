# School Portal - Implementation Guide

**Version:** 1.0  
**Status:** Ready for Development

---

## 1. Database Migrations

### Migration 1: Create Schools Table

File: `supabase/migrations/0015_create_schools_table.sql`

```sql
CREATE TABLE IF NOT EXISTS schools (
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
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index untuk performa
CREATE INDEX idx_schools_status ON schools(status);
CREATE INDEX idx_schools_city ON schools(city);

-- Enable RLS
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;

-- Policy: Admin dapat read semua sekolah
CREATE POLICY schools_read_for_admin ON schools
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role_id IN (
        SELECT id FROM roles WHERE code = 'admin'
      )
    )
  );

-- Policy: School contact hanya lihat sekolah mereka
CREATE POLICY schools_read_for_school ON schools
  FOR SELECT
  USING (
    id IN (
      SELECT school_id FROM school_contacts
      WHERE user_id = auth.uid()
    )
  );
```

### Migration 2: Create Intern_Schools Table

File: `supabase/migrations/0016_create_intern_schools_table.sql`

```sql
CREATE TABLE IF NOT EXISTS intern_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_id UUID NOT NULL REFERENCES intern_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id VARCHAR(50),
  major VARCHAR(255),
  batch VARCHAR(50),
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(intern_id, school_id)
);

-- Index untuk performa query
CREATE INDEX idx_intern_schools_school_id ON intern_schools(school_id);
CREATE INDEX idx_intern_schools_intern_id ON intern_schools(intern_id);

-- Enable RLS
ALTER TABLE intern_schools ENABLE ROW LEVEL SECURITY;

-- Policy: School contact hanya lihat siswa dari sekolah mereka
CREATE POLICY intern_schools_read_for_school ON intern_schools
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM school_contacts
      WHERE user_id = auth.uid()
    )
  );
```

### Migration 3: Create School_Reports Table

File: `supabase/migrations/0017_create_school_reports_table.sql`

```sql
CREATE TABLE IF NOT EXISTS school_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  report_type VARCHAR(50), -- 'weekly', 'monthly', 'semester'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_by UUID REFERENCES auth.users(id),
  file_url TEXT,
  file_size INTEGER,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'published', 'sent'
  total_students INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_school_reports_school_id ON school_reports(school_id);
CREATE INDEX idx_school_reports_created_at ON school_reports(created_at);

-- Enable RLS
ALTER TABLE school_reports ENABLE ROW LEVEL SECURITY;

-- Policy: School contact lihat laporan sekolah mereka
CREATE POLICY school_reports_read_for_school ON school_reports
  FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM school_contacts
      WHERE user_id = auth.uid()
    )
  );
```

### Migration 4: Alter school_contacts Table

File: `supabase/migrations/0018_alter_school_contacts.sql`

```sql
ALTER TABLE school_contacts 
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX IF NOT EXISTS idx_school_contacts_school_id ON school_contacts(school_id);
```

---

## 2. Component Architecture

### 2.1 Layout Structure

**File:** `app/dashboard/school/layout.tsx`

```typescript
// Sidebar menu items untuk school role
const SCHOOL_MENU_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard/school",
    icon: "BarChart3"
  },
  {
    label: "Daftar Siswa",
    href: "/dashboard/school/students",
    icon: "Users"
  },
  {
    label: "Laporan",
    href: "/dashboard/school/reports",
    icon: "FileText"
  },
  {
    label: "Pesan",
    href: "/dashboard/school/messages",
    icon: "MessageSquare"
  },
  {
    label: "Pengaturan",
    href: "/dashboard/school/settings",
    icon: "Settings"
  }
];
```

---

## 3. Key Components to Build

### Component List (Priority Order)

**Phase 1 - MVP:**
1. `SchoolDashboardPage.tsx` - Overview with stats cards
2. `SchoolStudentListPage.tsx` - Table siswa dengan filter
3. `SchoolStudentDetailPage.tsx` - Detail siswa dengan tabs
4. `SchoolAttendanceTab.tsx` - Tab kehadiran
5. `SchoolAssessmentTab.tsx` - Tab nilai akhir

**Phase 2:**
6. `SchoolReportsPage.tsx` - Laporan periodik
7. `SchoolMessagesPage.tsx` - Communication hub
8. `SchoolStatisticsCharts.tsx` - Dashboard charts

---

## 4. API Server Actions

### Query Functions

**File:** `features/school-portal/queries.ts`

Queries yang diperlukan:
- `getSchoolDashboardStats()` - Statistik overview
- `getSchoolStudents()` - List siswa dengan pagination
- `getStudentDetail()` - Detail siswa lengkap
- `getStudentAttendance()` - Riwayat kehadiran
- `getStudentDailyReports()` - List daily reports
- `getStudentAssessment()` - Nilai akhir
- `getSchoolReports()` - List laporan yang pernah dibuat

### Action Functions

**File:** `features/school-portal/actions.ts`

Actions yang diperlukan:
- `generateSchoolReport()` - Generate laporan baru
- `sendMessageToMentor()` - Kirim pesan
- `exportStudentAttendance()` - Export attendance Excel
- `exportSchoolReport()` - Download laporan PDF
- `downloadCertificate()` - Download sertifikat siswa

---

## 5. Database Queries Implementation

### 5.1 Dashboard Statistics

**Function:** `getSchoolDashboardStats(schoolId: string)`

```typescript
// features/school-portal/queries.ts

export async function getSchoolDashboardStats(schoolId: string) {
  const db = await createSupabaseServerClient();
  
  // Total siswa aktif
  const { count: totalActive } = await db
    .from("intern_schools")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .is("end_date", null);
  
  // Total alumni
  const { count: totalAlumni } = await db
    .from("intern_schools")
    .select("*", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .not("end_date", "is", null);
  
  // Rata-rata attendance rate
  const { data: attendanceData } = await db
    .from("attendances")
    .select(`
      intern_id,
      attendance_type,
      check_in_at
    `)
    .in(
      "intern_id",
      (await getActiveStudentsFromSchool(schoolId)).map(s => s.intern_id)
    )
    .gte("attendance_date", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  
  const avgAttendance = calculateAttendanceRate(attendanceData);
  
  // Rata-rata assessment
  const { data: assessmentData } = await db
    .from("assessments")
    .select("score")
    .in(
      "intern_id",
      (await getActiveStudentsFromSchool(schoolId)).map(s => s.intern_id)
    );
  
  const avgScore = assessmentData?.length > 0
    ? assessmentData.reduce((sum, a) => sum + a.score, 0) / assessmentData.length
    : 0;
  
  return {
    totalActive,
    totalAlumni,
    avgAttendance,
    avgScore,
    timestamp: new Date()
  };
}
```

### 5.2 Get Active Students from School

```typescript
async function getActiveStudentsFromSchool(schoolId: string) {
  const db = await createSupabaseServerClient();
  
  const { data } = await db
    .from("intern_schools")
    .select(`
      intern_id,
      student_id,
      major,
      intern_profiles!inner(
        id,
        full_name,
        email,
        phone
      )
    `)
    .eq("school_id", schoolId)
    .is("end_date", null)
    .order("created_at", { ascending: false });
  
  return data || [];
}
```

---

## 6. Server Actions

### 6.1 Generate School Report

**File:** `features/school-portal/actions.ts` (Part 1)

```typescript
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type GenerateReportFormState = {
  ok: boolean;
  message: string;
  reportId?: string;
};

export async function generateSchoolReportAction(
  _: GenerateReportFormState,
  formData: FormData
): Promise<GenerateReportFormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) redirect("/login");
  
  try {
    const schoolId = formData.get("schoolId") as string;
    const reportType = formData.get("reportType") as string;
    const periodStart = formData.get("periodStart") as string;
    const periodEnd = formData.get("periodEnd") as string;
    
    if (!schoolId || !reportType || !periodStart || !periodEnd) {
      return { ok: false, message: "Semua field wajib diisi" };
    }
    
    // Validasi: user adalah school contact untuk sekolah ini
    const { data: schoolContact } = await supabase
      .from("school_contacts")
      .select("id")
      .eq("user_id", user.id)
      .eq("school_id", schoolId)
      .single();
    
    if (!schoolContact) {
      return { ok: false, message: "Tidak authorized untuk sekolah ini" };
    }
    
    // Generate report akan implement di langkah berikutnya
    // Return success untuk sekarang
    return {
      ok: true,
      message: "Laporan berhasil dibuat",
      reportId: "temp-id"
    };
  } catch (error) {
    console.error("Error generating report:", error);
    return { ok: false, message: "Gagal membuat laporan" };
  }
}
```

---

## 7. TypeScript Types

**File:** `features/school-portal/types.ts`

```typescript
export type School = {
  id: string;
  name: string;
  type: "SMK" | "SMA" | "UNIVERSITAS" | "POLITEKNIK";
  address: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  website?: string;
  logo_url?: string;
  status: "active" | "inactive" | "suspended";
  created_at: string;
  updated_at: string;
};

export type InternSchool = {
  id: string;
  intern_id: string;
  school_id: string;
  student_id: string;
  major: string;
  batch: string;
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
};

export type SchoolStudent = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  student_id: string;
  major: string;
  batch: string;
  start_date: string;
  end_date?: string;
  attendance_rate: number;
  total_hours: number;
  assessment_score?: number;
  status: "active" | "completed" | "dropped";
};

export type SchoolDashboardStats = {
  totalActive: number;
  totalAlumni: number;
  avgAttendance: number;
  avgScore: number;
};

export type SchoolReport = {
  id: string;
  school_id: string;
  report_type: "weekly" | "monthly" | "semester";
  period_start: string;
  period_end: string;
  file_url: string;
  status: "draft" | "published" | "sent";
  total_students: number;
  created_at: string;
};

export type StudentAttendanceSummary = {
  total_days_present: number;
  total_hours: number;
  target_hours: number;
  attendance_rate: number;
  late_count: number;
  permit_count: number;
  sick_count: number;
};

export type StudentAssessment = {
  intern_id: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  feedback: string;
  certificate_number: string;
  evaluated_by: string;
  evaluated_at: string;
};
```

---

## 8. Component Examples

### 8.1 Dashboard Statistics Card

**File:** `features/school-portal/components/SchoolStatCard.tsx`

```typescript
"use client";

import { Card } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

type Props = {
  title: string;
  value: string | number;
  unit?: string;
  trend?: number;
  icon?: React.ReactNode;
  className?: string;
};

export function SchoolStatCard({
  title,
  value,
  unit = "",
  trend,
  icon,
  className = ""
}: Props) {
  const isTrendPositive = trend && trend > 0;
  
  return (
    <Card className={`p-6 ${className}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">
              {value}
            </span>
            {unit && <span className="text-sm text-slate-600">{unit}</span>}
          </div>
          {trend !== undefined && (
            <div className={`mt-2 flex items-center gap-1 text-sm ${
              isTrendPositive ? "text-green-600" : "text-red-600"
            }`}>
              <TrendingUp size={16} />
              <span>{Math.abs(trend)}% vs bulan lalu</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="text-slate-300">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
```

### 8.2 Student List Table

**File:** `features/school-portal/components/SchoolStudentTable.tsx`

```typescript
"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { SchoolStudent } from "../types";

type Props = {
  students: SchoolStudent[];
  isLoading?: boolean;
};

export function SchoolStudentTable({ students, isLoading }: Props) {
  if (isLoading) {
    return <div>Loading...</div>;
  }
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50">
            <TableHead>Nama Siswa</TableHead>
            <TableHead>NIS/NIM</TableHead>
            <TableHead>Jurusan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Kehadiran</TableHead>
            <TableHead>Total Jam</TableHead>
            <TableHead>Nilai Akhir</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {students.map((student) => (
            <TableRow key={student.id} className="hover:bg-slate-50">
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${student.full_name}`} />
                    <AvatarFallback>
                      {student.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-slate-900">
                      {student.full_name}
                    </p>
                    <p className="text-xs text-slate-600">{student.email}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm">{student.student_id}</TableCell>
              <TableCell className="text-sm">{student.major}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  student.status === "active"
                    ? "bg-green-100 text-green-800"
                    : student.status === "completed"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {student.status === "active" ? "Aktif" : 
                   student.status === "completed" ? "Selesai" : "Dropout"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full"
                      style={{ width: `${student.attendance_rate}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {student.attendance_rate}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-sm">{student.total_hours} jam</TableCell>
              <TableCell className="text-sm font-medium">
                {student.assessment_score ? `${student.assessment_score}/100` : "-"}
              </TableCell>
              <TableCell>
                <Link
                  href={`/dashboard/school/students/${student.id}`}
                  className="text-blue-600 hover:underline text-sm font-medium"
                >
                  Lihat Detail
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## 9. File Structure & Organization

```
features/school-portal/
├── components/
│   ├── SchoolStatCard.tsx
│   ├── SchoolStudentTable.tsx
│   ├── SchoolAttendanceCalendar.tsx
│   ├── SchoolReportCard.tsx
│   ├── SchoolMessageThread.tsx
│   └── SchoolFiltersBar.tsx
├── hooks/
│   ├── useSchoolDashboard.ts
│   ├── useSchoolStudents.ts
│   └── useSchoolReports.ts
├── queries.ts
├── actions.ts
├── types.ts
└── constants.ts

app/dashboard/school/
├── layout.tsx
├── page.tsx (Dashboard)
├── students/
│   ├── page.tsx (List siswa)
│   └── [studentId]/
│       ├── page.tsx (Detail siswa)
│       ├── attendance/
│       │   └── page.tsx
│       ├── daily-reports/
│       │   └── page.tsx
│       ├── tasks/
│       │   └── page.tsx
│       ├── lms/
│       │   └── page.tsx
│       └── assessment/
│           └── page.tsx
├── reports/
│   ├── page.tsx
│   └── generate/
│       └── page.tsx
├── messages/
│   └── page.tsx
└── settings/
    └── page.tsx
```

---

## 10. Implementation Checklist

### Phase 1: Database & Core (Week 1)
- [ ] Create migrations untuk schools, intern_schools, school_reports
- [ ] Setup RLS policies untuk data privacy
- [ ] Create database queries (getSchoolDashboardStats, getSchoolStudents, etc)
- [ ] Setup TypeScript types

### Phase 2: UI Components (Week 2)
- [ ] Build SchoolDashboardPage dengan stat cards
- [ ] Build SchoolStudentTable dengan filter & search
- [ ] Build SchoolStudentDetailPage dengan tabs
- [ ] Build AttendanceTab dengan kalender visual

### Phase 3: Reports & Export (Week 3)
- [ ] Build report generation logic
- [ ] Implement PDF export untuk laporan
- [ ] Implement Excel export untuk attendance
- [ ] Setup file storage di Supabase

### Phase 4: Advanced (Week 4+)
- [ ] Implement real-time notifications
- [ ] Build messaging/communication hub
- [ ] Add charts & analytics
- [ ] Performance optimization & testing

