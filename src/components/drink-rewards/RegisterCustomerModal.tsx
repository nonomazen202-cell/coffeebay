"use client";

import React from "react";
import { GlossyNeonButton } from "./GlossyNeonButton";

interface RegisterCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  customerName: string;
  setCustomerName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  branchName: string;
  loading: boolean;
}

export function RegisterCustomerModal({
  isOpen,
  onClose,
  onSubmit,
  customerName,
  setCustomerName,
  phone,
  setPhone,
  branchName,
  loading,
}: RegisterCustomerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xl animate-fadeIn">
      <div
        dir="rtl"
        className="relative w-full max-w-md rounded-3xl p-6 sm:p-8 bg-[#0D083A]/95 border-2 border-sky-400/40 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_35px_rgba(56,189,248,0.25)] text-white"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 left-4 text-slate-400 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10 cursor-pointer"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-sky-400/20 to-blue-600/30 border-2 border-sky-400 flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.45)] mb-3">
            <svg
              className="w-7 h-7 text-sky-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2m0-8H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2V4a2 2 0 00-2-2h-8zM4 14h16v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7z"
              />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-white">
            احصل على مشروبك المجاني
          </h3>
          <p className="text-xs text-sky-200/80 mt-1">
            سجل بياناتك لاستلام كود التحقق الفوري عبر SMS
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Customer Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              الاسم الكريم
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="أدخل اسمك الكريم"
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl bg-[#070424]/80 border border-sky-400/30 text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 text-sm transition-all shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              رقم الهاتف (المحمول)
            </label>
            <div className="relative">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                dir="ltr"
                className="w-full pr-11 pl-4 py-3.5 rounded-2xl bg-[#070424]/80 border border-sky-400/30 text-white placeholder-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/25 text-sm font-mono text-left transition-all shadow-inner"
              />
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sky-400 pointer-events-none">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
            </div>
            <span className="block text-[11px] text-slate-400 mt-1">
              يحق لكل رقم هاتف الاستفادة مرة واحدة فقط في هذا العرض.
            </span>
          </div>

          {/* Branch */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              فرع الاستلام
            </label>
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#070424]/80 border border-sky-400/20 text-xs text-sky-200">
              <svg
                className="w-5 h-5 text-sky-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              <span className="font-semibold text-white">{branchName}</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <GlossyNeonButton
              type="submit"
              disabled={loading}
              loading={loading}
              loadingText="جاري إرسال الرمز..."
              fullWidth
              size="md"
              glowIntensity="vibrant"
            >
              تأكيد ومتابعة (إرسال رمز SMS)
            </GlossyNeonButton>
          </div>
        </form>
      </div>
    </div>
  );
}
