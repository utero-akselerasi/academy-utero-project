"use client";

import { useCallback, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Modal } from "@/components/ui/modal";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Code
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Satu tombol bilah alat, dideklarasikan sebagai data.
 *
 * Bilah alat ini dulunya sebelas blok `<button>` yang ditulis satu per satu.
 * Bentuknya diubah jadi data karena `role="toolbar"` mewajibkan **roving
 * tabindex**: tepat satu tombol yang punya `tabIndex={0}`, sisanya `-1`.
 * Dengan JSX yang ditulis manual, indeks tiap tombol harus di-hardcode — dan
 * satu penyisipan tombol di tengah akan menggeser semuanya secara senyap.
 * Sebagai data, indeksnya datang dari posisi di array.
 */
type ToolbarItem = {
  key: string;
  /** Nama terakses. Wajib — ikon dan teks "H2" sama-sama bukan nama yang cukup. */
  label: string;
  /** Petunjuk pintasan untuk pengguna tetikus; masuk ke `title`, bukan ke nama. */
  hint?: string;
  icon?: React.ReactNode;
  text?: string;
  /**
   * Ada hanya untuk tombol yang benar-benar **menyala/mati** (bold, heading,
   * daftar). Nilainya jadi `aria-pressed`. Tombol aksi (undo, sisip gambar)
   * TIDAK boleh punya ini — `aria-pressed` pada tombol sekali-jalan
   * mengumumkan keadaan yang tak pernah berubah.
   */
  pressed?: boolean;
  /**
   * Dinonaktifkan secara ARIA, bukan lewat atribut `disabled`. Tombol
   * ber-`disabled` dikeluarkan dari urutan fokus, dan di dalam bilah alat
   * ber-roving-tabindex itu berarti panah kanan/kiri melewatinya tanpa jejak —
   * pengguna pembaca layar tidak pernah tahu Undo ada. `aria-disabled`
   * menyisakan tombolnya bisa difokus dan diumumkan sebagai "dimmed".
   */
  ariaDisabled?: boolean;
  /** `true` menaruh pemisah visual sebelum tombol ini. */
  separatorBefore?: boolean;
  run: () => void;
};

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Tulis konten materi di sini...",
  editable = true
}: RichTextEditorProps) {
  /**
   * Indeks tombol bilah alat yang memegang `tabIndex={0}`.
   *
   * Bilah alat hanya menempati SATU perhentian Tab, dan perpindahan di
   * dalamnya pakai panah — itulah inti pola `role="toolbar"`. Tanpa ini,
   * sebelas tombol format menyumbat jalur Tab menuju badan editor.
   */
  const [activeItem, setActiveItem] = useState(0);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Form sisip gambar. Dulunya dua hal yang mustahil: `window.prompt` hanya
  // bisa menanyakan satu nilai, jadi gambar yang disisipkan selalu tanpa `alt`
  // (temuan #12) — dan tak ada tempat untuk menyatakan bahwa sebuah gambar
  // memang dekoratif.
  const [isImageFormOpen, setIsImageFormOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageDecorative, setImageDecorative] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4]
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-teal-600 underline hover:text-teal-700"
        }
      }),
      Image.configure({
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg"
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // `rich-text-body` menggantikan `focus:outline-none` sebagai penekan
        // cincin fokus bawaan. Alasannya di `app/globals.css`: cincin global
        // pada div contenteditable ini akan terpotong pembungkus
        // ber-`overflow-hidden`, jadi cincinnya dipindah ke pembungkus.
        class: "prose prose-slate max-w-none rich-text-body min-h-[300px] p-4"
      }
    }
  });

  const closeImageForm = useCallback(() => {
    setIsImageFormOpen(false);
    setImageUrl("");
    setImageAlt("");
    setImageDecorative(false);
  }, []);

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Masukkan URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const submitImage = (event: React.FormEvent) => {
    event.preventDefault();
    if (!imageUrl.trim()) return;
    editor
      .chain()
      .focus()
      // `alt: ""` untuk gambar dekoratif, bukan `alt` yang dihilangkan:
      // atribut yang tak ada membuat pembaca layar membacakan nama berkasnya,
      // sedangkan `alt` kosong menyuruhnya melewati gambar itu sama sekali.
      .setImage({ src: imageUrl.trim(), alt: imageDecorative ? "" : imageAlt.trim() })
      .run();
    closeImageForm();
  };

  const iconButton = "p-2 rounded hover:bg-slate-200 transition-colors";
  const textButton = "px-3 py-2 rounded hover:bg-slate-200 transition-colors text-sm font-bold";

  const items: ToolbarItem[] = [
    {
      key: "bold",
      label: "Tebal",
      hint: "Bold (Ctrl+B)",
      icon: <Bold size={18} aria-hidden="true" />,
      pressed: editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run()
    },
    {
      key: "italic",
      label: "Miring",
      hint: "Italic (Ctrl+I)",
      icon: <Italic size={18} aria-hidden="true" />,
      pressed: editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run()
    },
    {
      key: "code",
      label: "Kode sebaris",
      hint: "Inline Code",
      icon: <Code size={18} aria-hidden="true" />,
      pressed: editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run()
    },
    {
      key: "h2",
      label: "Judul tingkat 2",
      hint: "Heading 2",
      text: "H2",
      separatorBefore: true,
      pressed: editor.isActive("heading", { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run()
    },
    {
      key: "h3",
      label: "Judul tingkat 3",
      hint: "Heading 3",
      text: "H3",
      pressed: editor.isActive("heading", { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run()
    },
    {
      key: "bulletList",
      label: "Daftar berpoin",
      hint: "Bullet List",
      icon: <List size={18} aria-hidden="true" />,
      separatorBefore: true,
      pressed: editor.isActive("bulletList"),
      run: () => editor.chain().focus().toggleBulletList().run()
    },
    {
      key: "orderedList",
      label: "Daftar bernomor",
      hint: "Numbered List",
      icon: <ListOrdered size={18} aria-hidden="true" />,
      pressed: editor.isActive("orderedList"),
      run: () => editor.chain().focus().toggleOrderedList().run()
    },
    {
      key: "link",
      label: "Tambah tautan",
      hint: "Tambah Link",
      icon: <LinkIcon size={18} aria-hidden="true" />,
      separatorBefore: true,
      pressed: editor.isActive("link"),
      run: addLink
    },
    {
      key: "image",
      label: "Tambah gambar",
      hint: "Tambah Gambar",
      icon: <ImageIcon size={18} aria-hidden="true" />,
      run: () => setIsImageFormOpen(true)
    },
    {
      key: "undo",
      label: "Batalkan",
      hint: "Undo (Ctrl+Z)",
      icon: <Undo size={18} aria-hidden="true" />,
      separatorBefore: true,
      ariaDisabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run()
    },
    {
      key: "redo",
      label: "Ulangi",
      hint: "Redo (Ctrl+Y)",
      icon: <Redo size={18} aria-hidden="true" />,
      ariaDisabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run()
    }
  ];

  function focusItem(index: number) {
    setActiveItem(index);
    toolbarRef.current
      ?.querySelectorAll<HTMLButtonElement>("[data-toolbar-item]")
      ?.[index]?.focus();
  }

  function handleToolbarKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    // `preventDefault` supaya panah tidak ikut menggulirkan halaman.
    event.preventDefault();

    if (event.key === "Home") return focusItem(0);
    if (event.key === "End") return focusItem(items.length - 1);

    const step = event.key === "ArrowRight" ? 1 : -1;
    // Melingkar, dan `+ items.length` supaya modulo dari -1 tidak negatif.
    focusItem((activeItem + step + items.length) % items.length);
  }

  return (
    // `rich-text-shell` memindahkan cincin fokus badan editor ke pembungkus ini
    // (temuan #7); lihat `app/globals.css`.
    <div className="rich-text-shell border border-slate-300 rounded-lg overflow-hidden bg-white">
      {editable && (
        // `role="toolbar"` + `aria-label`: dulunya `<div>` generik tanpa nama,
        // jadi pembaca layar mengumumkan sebelas tombol tanpa konteks bahwa
        // kesemuanya adalah alat pemformatan editor di bawahnya (temuan #12).
        <div
          ref={toolbarRef}
          role="toolbar"
          aria-label="Alat pemformatan teks"
          aria-orientation="horizontal"
          onKeyDown={handleToolbarKeyDown}
          className="bg-slate-50 border-b border-slate-300 p-2 flex flex-wrap gap-1"
        >
          {items.map((item, index) => (
            <span key={item.key} className="contents">
              {item.separatorBefore && <span aria-hidden="true" className="w-px bg-slate-300 mx-1" />}
              <button
                type="button"
                data-toolbar-item
                // Roving tabindex: satu perhentian Tab untuk seluruh bilah.
                tabIndex={index === activeItem ? 0 : -1}
                // Klik tetikus juga memindahkan perhentian Tab ke tombol yang
                // baru diklik; tanpa ini, Tab berikutnya melompat ke tombol
                // lama dan terasa seperti fokus yang pindah sendiri.
                onFocus={() => setActiveItem(index)}
                onClick={() => {
                  if (item.ariaDisabled) return;
                  item.run();
                }}
                aria-pressed={item.pressed}
                aria-disabled={item.ariaDisabled}
                aria-label={item.label}
                title={item.hint ?? item.label}
                className={
                  (item.text ? textButton : iconButton) +
                  " " +
                  (item.pressed ? "bg-slate-200 text-teal-700" : "text-slate-700") +
                  (item.ariaDisabled ? " opacity-30 cursor-not-allowed" : "")
                }
              >
                {item.icon}
                {item.text}
              </button>
            </span>
          ))}
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Form sisip gambar — menggantikan `window.prompt` yang cuma bisa
          menanyakan URL. `Modal` yang menyediakan `role="dialog"`, Escape,
          jebakan fokus, dan pengembalian fokus. */}
      <Modal
        open={isImageFormOpen}
        onClose={closeImageForm}
        title="Sisipkan gambar"
        closeLabel="Tutup form sisip gambar"
        panelClassName="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col"
      >
        <form onSubmit={submitImage} className="p-5 space-y-4">
          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="rteImageUrl">
              URL gambar *
            </label>
            <input
              className="form-input text-sm"
              id="rteImageUrl"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label text-xs font-bold text-slate-700" htmlFor="rteImageAlt">
              Teks alternatif {imageDecorative ? "(tidak dipakai)" : "*"}
            </label>
            <input
              className="form-input text-sm"
              id="rteImageAlt"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              placeholder="Jelaskan isi gambar bagi yang tak bisa melihatnya"
              disabled={imageDecorative}
              // Wajib kecuali gambarnya dinyatakan dekoratif. Inilah yang
              // membuat gambar tanpa `alt` tidak bisa lagi masuk ke materi
              // secara diam-diam.
              required={!imageDecorative}
              aria-describedby="rteImageAltHelp"
            />
            <p id="rteImageAltHelp" className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Peserta yang memakai pembaca layar hanya mendapat teks ini. Tulis
              informasi yang dibawa gambar, bukan &quot;gambar&quot; atau nama berkasnya.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="rteImageDecorative"
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              checked={imageDecorative}
              onChange={(e) => setImageDecorative(e.target.checked)}
            />
            <label className="text-xs leading-relaxed text-slate-700" htmlFor="rteImageDecorative">
              Gambar ini dekoratif — tidak membawa informasi apa pun, jadi pembaca
              layar boleh melewatinya.
            </label>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <button type="button" onClick={closeImageForm} className="button-secondary text-sm font-semibold">
              Batal
            </button>
            <button type="submit" className="button-primary text-sm font-bold">
              Sisipkan Gambar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
