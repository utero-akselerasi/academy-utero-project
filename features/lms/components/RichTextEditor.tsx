"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading2, 
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

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = "Tulis konten materi di sini...",
  editable = true 
}: RichTextEditorProps) {
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
        class: "prose prose-slate max-w-none focus:outline-none min-h-[300px] p-4"
      }
    }
  });

  if (!editor) return null;

  const addLink = () => {
    const url = window.prompt("Masukkan URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt("Masukkan URL gambar:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      {editable && (
        <div className="bg-slate-50 border-b border-slate-300 p-2 flex flex-wrap gap-1">
          {/* Text Formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("bold") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold size={18} />
          </button>
          
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("italic") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic size={18} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("code") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Inline Code"
          >
            <Code size={18} />
          </button>

          <div className="w-px bg-slate-300 mx-1" />

          {/* Headings */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-2 rounded hover:bg-slate-200 transition-colors text-sm font-bold ${
              editor.isActive("heading", { level: 2 }) ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Heading 2"
          >
            H2
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-3 py-2 rounded hover:bg-slate-200 transition-colors text-sm font-bold ${
              editor.isActive("heading", { level: 3 }) ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Heading 3"
          >
            H3
          </button>

          <div className="w-px bg-slate-300 mx-1" />

          {/* Lists */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("bulletList") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Bullet List"
          >
            <List size={18} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("orderedList") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Numbered List"
          >
            <ListOrdered size={18} />
          </button>

          <div className="w-px bg-slate-300 mx-1" />

          {/* Link & Image */}
          <button
            type="button"
            onClick={addLink}
            className={`p-2 rounded hover:bg-slate-200 transition-colors ${
              editor.isActive("link") ? "bg-slate-200 text-teal-700" : "text-slate-700"
            }`}
            title="Tambah Link"
          >
            <LinkIcon size={18} />
          </button>

          <button
            type="button"
            onClick={addImage}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-700"
            title="Tambah Gambar"
          >
            <ImageIcon size={18} />
          </button>

          <div className="w-px bg-slate-300 mx-1" />

          {/* Undo/Redo */}
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={18} />
          </button>

          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-2 rounded hover:bg-slate-200 transition-colors text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Y)"
          >
            <Redo size={18} />
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
