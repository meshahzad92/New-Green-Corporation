import api from './api';
import { Note } from '../types';

export interface NoteCreate {
  title: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  is_important?: boolean;
  priority?: 'low' | 'medium' | 'high';
  target_date?: string | null;
}

export interface NoteUpdate {
  title?: string;
  description?: string;
  status?: 'pending' | 'in_progress' | 'completed';
  is_important?: boolean;
  priority?: 'low' | 'medium' | 'high';
  target_date?: string | null;
}

export const noteService = {
  getNotes: async (params?: { status?: string; is_important?: boolean }): Promise<Note[]> => {
    const response = await api.get('/notes/', { params });
    return response.data;
  },

  getNote: async (id: string): Promise<Note> => {
    const response = await api.get(`/notes/${id}`);
    return response.data;
  },

  createNote: async (note: NoteCreate): Promise<Note> => {
    const response = await api.post('/notes/', note);
    return response.data;
  },

  updateNote: async (id: string, note: NoteUpdate): Promise<Note> => {
    const response = await api.put(`/notes/${id}`, note);
    return response.data;
  },

  deleteNote: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/notes/${id}`);
    return response.data;
  }
};
