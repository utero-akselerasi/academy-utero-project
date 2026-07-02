"use client";

import { useState } from "react";
import { Plus, Trash2, HelpCircle, Save } from "lucide-react";
import { createQuizAction } from "./actions";

type Question = {
  id: number;
  question: string;
  options: string[];
  answer: number; // 0-based index of correct option
};

type Props = {
  courseId: string;
};

export function QuizFormBuilder({ courseId }: Props) {
  const [title, setTitle] = useState("");
  const [passingScore, setPassingScore] = useState(70);
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 1,
      question: "",
      options: ["", "", "", ""],
      answer: 0
    }
  ]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        question: "",
        options: ["", "", "", ""],
        answer: 0
      }
    ]);
  };

  const removeQuestion = (id: number) => {
    if (questions.length === 1) {
      alert("Kuis minimal harus memiliki 1 pertanyaan.");
      return;
    }
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestionText = (index: number, text: string) => {
    const updated = [...questions];
    updated[index].question = text;
    setQuestions(updated);
  };

  const updateOptionText = (qIndex: number, oIndex: number, text: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = text;
    setQuestions(updated);
  };

  const updateAnswer = (qIndex: number, answerIndex: number) => {
    const updated = [...questions];
    updated[qIndex].answer = answerIndex;
    setQuestions(updated);
  };

  return (
    <form action={createQuizAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="questionsJson" value={JSON.stringify(questions)} />

      <div className="form-field">
        <label className="form-label text-xs font-bold text-slate-700" htmlFor="qBuilderTitle">Judul Kuis *</label>
        <input
          className="form-input text-sm"
          id="qBuilderTitle"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Contoh: Kuis Evaluasi Dasar HTML"
          required
        />
      </div>

      <div className="form-field">
        <label className="form-label text-xs font-bold text-slate-700" htmlFor="qBuilderPassing">Nilai Kelulusan Minimal (KKM) *</label>
        <input
          type="number"
          className="form-input text-sm"
          id="qBuilderPassing"
          name="passingScore"
          value={passingScore}
          onChange={(e) => setPassingScore(Number(e.target.value))}
          required
        />
      </div>

      <div className="space-y-4 pt-4 border-t border-slate-200">
        <div className="flex justify-between items-center">
          <label className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1">
            <HelpCircle size={15} className="text-teal-700" />
            <span>Pertanyaan Kuis ({questions.length})</span>
          </label>
          <button
            type="button"
            onClick={addQuestion}
            className="button-secondary text-[10px] py-1 px-2.5 min-h-0 flex items-center gap-1 font-bold border-teal-200 text-teal-800 hover:bg-teal-50"
          >
            <Plus size={12} />
            <span>Tambah Pertanyaan</span>
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, qIdx) => (
            <div key={q.id} className="p-4 border border-slate-200 rounded-xl bg-white space-y-3 relative">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Pertanyaan #{qIdx + 1}</span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(q.id)}
                    className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-all"
                    title="Hapus Pertanyaan"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Teks Pertanyaan */}
              <div className="form-field">
                <input
                  className="form-input text-xs"
                  placeholder="Ketik pertanyaan di sini..."
                  value={q.question}
                  onChange={(e) => updateQuestionText(qIdx, e.target.value)}
                  required
                />
              </div>

              {/* Pilihan Jawaban */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Pilihan Jawaban (Ketik Opsi):</span>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oIdx) => (
                    <div key={oIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-ans-${q.id}`}
                        checked={q.answer === oIdx}
                        onChange={() => updateAnswer(qIdx, oIdx)}
                        className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300"
                        title="Tandai sebagai jawaban benar"
                      />
                      <input
                        className="form-input text-xs py-1 px-2"
                        placeholder={`Opsi ${oIdx + 1}`}
                        value={opt}
                        onChange={(e) => updateOptionText(qIdx, oIdx, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="text-[9px] text-slate-400 font-semibold italic flex items-center gap-1">
                <span>* Tandai tombol bulat pada opsi yang merupakan jawaban yang benar.</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="button-primary text-xs py-2 w-full min-h-0 font-bold mt-4 flex items-center justify-center gap-1">
        <Save size={14} />
        <span>Simpan Kuis</span>
      </button>
    </form>
  );
}
