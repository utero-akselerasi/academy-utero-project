type Props = {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
};

export function RoleDashboardHome({ eyebrow, title, description, items }: Props) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <p className="text-sm font-bold uppercase text-teal-700">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-600">{description}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <div className="surface p-5" key={item}>
            <h2 className="font-bold text-slate-950">{item}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Modul ini disiapkan untuk fase implementasi berikutnya.
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}

