import React, { useState, useEffect } from 'react';
import { 
  Plus, Calendar, Trash2, Edit2, CheckCircle2, Circle, 
  Star, Clock, AlertCircle, Search, Loader2, X
} from 'lucide-react';
import { Note } from '../types';
import { noteService, NoteCreate, NoteUpdate } from '../utils/noteApi';
import CustomDatePicker from '../components/CustomDatePicker';
import ConfirmDialog from '../components/ConfirmDialog';

const NotesPage: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'important'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    status: 'pending' | 'in_progress' | 'completed';
    is_important: boolean;
    priority: 'low' | 'medium' | 'high';
    target_date: Date | null;
  }>({
    title: '',
    description: '',
    status: 'pending',
    is_important: false,
    priority: 'medium',
    target_date: null
  });

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    noteId: string;
    noteTitle: string;
  }>({
    isOpen: false,
    noteId: '',
    noteTitle: ''
  });

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      setIsLoading(true);
      const data = await noteService.getNotes();
      setNotes(data);
    } catch (err) {
      console.error('Failed to load notes:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingNote(null);
    setFormData({
      title: '',
      description: '',
      status: 'pending',
      is_important: false,
      priority: 'medium',
      target_date: new Date()
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      description: note.description || '',
      status: note.status,
      is_important: note.is_important,
      priority: note.priority,
      target_date: note.target_date ? new Date(note.target_date) : null
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.title.trim()) {
      alert('Please enter a note title.');
      return;
    }

    try {
      setIsSubmitting(true);
      const targetIso = formData.target_date ? formData.target_date.toISOString() : null;

      if (editingNote) {
        const updatePayload: NoteUpdate = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          status: formData.status,
          is_important: formData.is_important,
          priority: formData.priority,
          target_date: targetIso
        };
        const updated = await noteService.updateNote(editingNote.id, updatePayload);
        setNotes(prev => prev.map(n => n.id === updated.id ? updated : n));
      } else {
        const createPayload: NoteCreate = {
          title: formData.title.trim(),
          description: formData.description.trim() || undefined,
          status: formData.status,
          is_important: formData.is_important,
          priority: formData.priority,
          target_date: targetIso
        };
        const created = await noteService.createNote(createPayload);
        setNotes(prev => [created, ...prev.filter(n => n.id !== created.id)]);
      }

      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save note:', err);
      alert('Failed to save note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (note: Note) => {
    const nextStatus: 'pending' | 'in_progress' | 'completed' = 
      note.status === 'completed' ? 'pending' : 
      note.status === 'pending' ? 'in_progress' : 'completed';

    try {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, status: nextStatus } : n));
      await noteService.updateNote(note.id, { status: nextStatus });
    } catch (err) {
      console.error('Failed to toggle note status:', err);
      loadNotes();
    }
  };

  const handleToggleImportant = async (note: Note) => {
    const newImportant = !note.is_important;
    try {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, is_important: newImportant } : n));
      await noteService.updateNote(note.id, { is_important: newImportant });
    } catch (err) {
      console.error('Failed to toggle important pin:', err);
      loadNotes();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.noteId) return;
    try {
      await noteService.deleteNote(deleteDialog.noteId);
      setNotes(prev => prev.filter(n => n.id !== deleteDialog.noteId));
      setDeleteDialog({ isOpen: false, noteId: '', noteTitle: '' });
    } catch (err) {
      console.error('Failed to delete note:', err);
      alert('Failed to delete note.');
    }
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filteredNotes = notes.filter(note => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchDesc = note.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }

    if (statusFilter === 'important') return note.is_important;
    if (statusFilter !== 'all') return note.status === statusFilter;
    return true;
  });

  const importantNotes = notes.filter(n => n.is_important && n.status !== 'completed');

  const overdueNotes: Note[] = [];
  const todayNotes: Note[] = [];
  const tomorrowNotes: Note[] = [];
  const upcomingNotes: Note[] = [];
  const noDateNotes: Note[] = [];
  const completedNotes: Note[] = [];

  filteredNotes.forEach(note => {
    if (note.status === 'completed') {
      completedNotes.push(note);
      return;
    }

    if (!note.target_date) {
      noDateNotes.push(note);
      return;
    }

    const tDate = new Date(note.target_date);
    tDate.setHours(0, 0, 0, 0);

    if (tDate < today) {
      overdueNotes.push(note);
    } else if (isSameDay(tDate, today)) {
      todayNotes.push(note);
    } else if (isSameDay(tDate, tomorrow)) {
      tomorrowNotes.push(note);
    } else {
      upcomingNotes.push(note);
    }
  });

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const getPriorityBadge = (priority: 'low' | 'medium' | 'high') => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">High</span>;
      case 'medium':
        return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Medium</span>;
      case 'low':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Low</span>;
    }
  };

  const renderNoteCard = (note: Note) => {
    const isCompleted = note.status === 'completed';
    const isInProgress = note.status === 'in_progress';

    return (
      <div
        key={note.id}
        className={`group relative p-4 rounded-2xl border transition-all duration-200 ${
          isCompleted 
            ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
            : note.is_important
            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/50 shadow-sm hover:shadow-md'
            : 'bg-white dark:bg-slate-800/90 border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md'
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => handleToggleStatus(note)}
            title={`Status: ${note.status} (Click to toggle)`}
            className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex-shrink-0"
          >
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : isInProgress ? (
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className={`text-base font-bold text-slate-900 dark:text-white leading-snug ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                {note.title}
              </h4>
              {getPriorityBadge(note.priority)}
              {note.is_important && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" /> Important
                </span>
              )}
            </div>

            {note.description && (
              <p className={`text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line mb-2 ${isCompleted ? 'line-through opacity-60' : ''}`}>
                {note.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              {note.target_date && (
                <span className="flex items-center gap-1 font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  Target: {formatDateDisplay(note.target_date)}
                </span>
              )}
              <span className="capitalize px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60">
                {note.status.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleToggleImportant(note)}
              title={note.is_important ? 'Unpin Important' : 'Mark as Important'}
              className={`p-1.5 rounded-lg transition-colors ${
                note.is_important
                  ? 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Star className={`w-4 h-4 ${note.is_important ? 'fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => handleOpenEditModal(note)}
              title="Edit Note"
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteDialog({ isOpen: true, noteId: note.id, noteTitle: note.title })}
              title="Delete Note"
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (title: string, icon: React.ReactNode, items: Note[], badgeColor: string) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {title}
          </h3>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${badgeColor}`}>
            {items.length}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map(renderNoteCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            Notes & To-Do Tasks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Organize daily tasks, schedule future targets, and keep key milestones pinned.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Note / Task
        </button>
      </div>

      {/* 🌟 Prominent "Most Important / Targets" Bar */}
      {importantNotes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-transparent border border-amber-300/60 dark:border-amber-600/40 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
              <h2 className="text-base font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider">
                Most Important / Target Achieving Bar
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-black rounded-full bg-amber-500 text-white">
                {importantNotes.length} Pinned
              </span>
            </div>
            <span className="text-xs text-amber-700 dark:text-amber-300 hidden sm:inline">
              Always visible targets & priority reminders
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {importantNotes.map(renderNoteCard)}
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes and tasks..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'important', label: '⭐ Important' },
            { id: 'completed', label: 'Completed' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mb-2" />
          <p className="text-sm">Loading tasks...</p>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-700 space-y-3">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No tasks found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {searchQuery ? 'No tasks match your search query.' : 'You do not have any tasks scheduled. Click below to add one!'}
          </p>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {renderSection(
            'Overdue', 
            <AlertCircle className="w-4 h-4 text-red-500" />, 
            overdueNotes, 
            'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
          )}

          {renderSection(
            'Today', 
            <Clock className="w-4 h-4 text-emerald-500" />, 
            todayNotes, 
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
          )}

          {renderSection(
            'Tomorrow', 
            <Calendar className="w-4 h-4 text-blue-500" />, 
            tomorrowNotes, 
            'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
          )}

          {renderSection(
            'Upcoming & Next Month', 
            <Calendar className="w-4 h-4 text-purple-500" />, 
            upcomingNotes, 
            'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
          )}

          {renderSection(
            'General / No Target Date', 
            <Calendar className="w-4 h-4 text-slate-400" />, 
            noDateNotes, 
            'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
          )}

          {renderSection(
            'Completed', 
            <CheckCircle2 className="w-4 h-4 text-slate-400" />, 
            completedNotes, 
            'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          )}
        </div>
      )}

      {/* Add / Edit Note Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/80 flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-900 dark:text-white">
                {editingNote ? 'Edit Task / Note' : 'Add New Task / Note'}
              </h2>
              <button
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Target achieving: 50 Bags Urea, Call Supplier"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Details / Description (Optional)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Add specifics, target quantities, contact details..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Target / Due Date
                  </label>
                  <CustomDatePicker
                    selected={formData.target_date}
                    onChange={d => setFormData({ ...formData, target_date: d })}
                    placeholderText="Select due date"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pending', label: 'Pending' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'completed', label: 'Completed' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, status: s.id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        formData.status === s.id
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div 
                onClick={() => setFormData({ ...formData, is_important: !formData.is_important })}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-colors ${
                  formData.is_important
                    ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                    : 'bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Star className={`w-5 h-5 ${formData.is_important ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Pin to "Most Important" Bar
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Stays prominently visible at top of page for key targets
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.is_important}
                  onChange={() => {}}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingNote ? 'Update Task' : 'Create Task'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Task"
        message={`Are you sure you want to delete "${deleteDialog.noteTitle}"?`}
        confirmText="Yes, Delete"
        cancelText="Cancel"
        isDangerous={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteDialog({ isOpen: false, noteId: '', noteTitle: '' })}
      />
    </div>
  );
};

export default NotesPage;
