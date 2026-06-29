import { RegistrationForm } from "@/features/registration/RegistrationForm";

export default function RegistrationPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase text-teal-700">
          Pendaftaran Magang
        </p>
        <h1 className="mt-2 text-4xl font-bold text-slate-950">
          Daftar ke Utero Academy
        </h1>
        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
          Data ini masuk ke tabel `utero_academy.internship_applications` dan
          akan direview oleh Admin Academy.
        </p>
      </div>

      <RegistrationForm />
    </main>
  );
}
