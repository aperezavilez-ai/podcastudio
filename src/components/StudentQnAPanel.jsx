import React, { useState } from 'react';
import { HelpCircle, Send, Tv, CheckCircle2, Trash2, User, Sparkles } from 'lucide-react';

const INITIAL_QUESTIONS = [
  { id: 1, student: 'Ana Martínez', question: '¿Cuál es la diferencia entre el corte CUT y la disolvencia AUTO en producción?', answered: false },
  { id: 2, student: 'Carlos Gómez', question: '¿Cómo afecta el Auto-Ducking a la música de fondo cuando hablo?', answered: false },
  { id: 3, student: 'Mariana Soto', question: '¿Se pueden conectar cámaras de iPad y teléfono a la vez?', answered: false },
];

export default function StudentQnAPanel({ onBroadcastQuestion, onClearQuestion, activeQuestionId }) {
  const [questions, setQuestions] = useState(INITIAL_QUESTIONS);
  const [newStudent, setNewStudent] = useState('');
  const [newQuestion, setNewQuestion] = useState('');

  const handleAddQuestion = (e) => {
    e.preventDefault();
    if (!newQuestion.trim()) return;

    const item = {
      id: Date.now(),
      student: newStudent.trim() || 'Estudiante',
      question: newQuestion.trim(),
      answered: false
    };

    setQuestions(prev => [item, ...prev]);
    setNewStudent('');
    setNewQuestion('');
  };

  const handleToggleAnswered = (id) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, answered: !q.answered } : q));
  };

  const handleDelete = (id) => {
    if (activeQuestionId === id && onClearQuestion) onClearQuestion();
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  return (
    <div className="flex flex-col h-full bg-[#0e0f14] text-gray-200">
      {/* Cabecera */}
      <div className="p-3 border-b border-[#20222e] bg-[#14151d] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HelpCircle size={15} className="text-purple-400" />
          <span className="text-xs font-black uppercase tracking-wider text-gray-200">
            Preguntas de la Clase (Q&A)
          </span>
        </div>
        <span className="text-[10px] bg-purple-950/80 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded font-bold">
          {questions.filter(q => !q.answered).length} pendientes
        </span>
      </div>

      {/* Formulario para añadir pregunta */}
      <form onSubmit={handleAddQuestion} className="p-3 border-b border-[#1f212c] bg-[#111218] space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Nombre del alumno (opcional)"
            value={newStudent}
            onChange={(e) => setNewStudent(e.target.value)}
            className="flex-1 bg-[#181924] border border-[#282a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
          />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Escribe la duda o pregunta..."
            value={newQuestion}
            onChange={(e) => setNewQuestion(e.target.value)}
            className="flex-1 bg-[#181924] border border-[#282a3a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!newQuestion.trim()}
            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
          >
            <Send size={12} /> Añadir
          </button>
        </div>
      </form>

      {/* Lista de preguntas */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        {questions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            No hay preguntas en la cola. Añade una para responderla al aire.
          </div>
        ) : (
          questions.map(q => {
            const isLive = activeQuestionId === q.id;

            return (
              <div
                key={q.id}
                className={`p-3 rounded-xl border transition-all ${
                  isLive
                    ? 'bg-purple-950/40 border-purple-500/80 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : q.answered
                    ? 'bg-[#12131a]/60 border-[#222430] opacity-60'
                    : 'bg-[#151620] border-[#252736] hover:border-[#323548]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-purple-300">
                    <User size={12} className="text-purple-400" />
                    <span>{q.student}</span>
                  </div>
                  {isLive && (
                    <span className="flex items-center gap-1 text-[9px] font-extrabold uppercase bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse">
                      ● AL AIRE
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-200 leading-relaxed mb-3">
                  "{q.question}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[#20222e]">
                  <button
                    type="button"
                    onClick={() => {
                      if (isLive) {
                        onClearQuestion();
                      } else {
                        onBroadcastQuestion(q);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      isLive
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white'
                    }`}
                  >
                    <Tv size={12} />
                    <span>{isLive ? 'Quitar de Pantalla' : 'Poner al Aire (Cintillo)'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleAnswered(q.id)}
                      className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                        q.answered ? 'text-emerald-400 bg-emerald-950/40' : 'text-gray-400 hover:text-white'
                      }`}
                      title={q.answered ? 'Marcar como pendiente' : 'Marcar como respondida'}
                    >
                      <CheckCircle2 size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 rounded-md text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Eliminar pregunta"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
