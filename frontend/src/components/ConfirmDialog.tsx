import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    isDangerous?: boolean;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Yes, Delete',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    isDangerous = true,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">
                {/* Header */}
                <div className={`${isDangerous ? 'bg-red-600' : 'bg-emerald-600'} p-6 text-white flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-black">{title}</h2>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed">
                        {message}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-6 py-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onCancel();
                            }}
                            className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all active:scale-95 shadow-lg ${isDangerous
                                    ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/30'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
