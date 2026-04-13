import React, { useState } from 'react';
import { Shield, LogOut, AlertCircle, Loader2, BookOpen } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { ReportInputData, ReportSection } from '../../lib/premiumOrderStore';
import { PremiumReportInputPanel } from './PremiumReportInputPanel';
import { PremiumReportPreview } from './PremiumReportPreview';

interface PremiumReportMakerPageProps {
  user: FirebaseUser | null;
  isAdmin: boolean;
  isLoggingIn: boolean;
  allowedAdminEmails: string[];
  onLogin: () => void;
  onLogout: () => void;
  onBack?: () => void;
}

type Step = 'input' | 'preview';

const GLASS_BG = 'bg-gradient-to-br from-slate-100 via-cyan-50/60 to-indigo-100/70';

export const PremiumReportMakerPage: React.FC<PremiumReportMakerPageProps> = ({
  user,
  isAdmin,
  isLoggingIn,
  onLogin,
  onLogout,
  onBack,
}) => {
  const [step, setStep] = useState<Step>('input');
  const [inputData, setInputData] = useState<ReportInputData | null>(null);
  const [reportSections, setReportSections] = useState<ReportSection[]>([]);
  const [sajuRawData, setSajuRawData] = useState<any>(null);
  const [daeunRawData, setDaeunRawData] = useState<any>(null);
  const [yongshinRawData, setYongshinRawData] = useState<any>(null);

  // ── Auth Guard ────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className={`h-full ${GLASS_BG} flex items-center justify-center`}>
        <div className="rounded-3xl border border-white/60 bg-white/60 backdrop-blur-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-700 flex items-center justify-center mx-auto shadow-lg">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">인생 네비게이션</h1>
            <p className="text-sm text-zinc-500 mt-1">프리미엄 리포트 제작 시스템</p>
            <p className="text-sm text-zinc-400 mt-3">관리자 계정으로 로그인하세요.</p>
          </div>
          <button
            onClick={onLogin}
            disabled={isLoggingIn}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-orange-700 text-white font-bold shadow-xl shadow-amber-500/25 hover:from-amber-700 hover:to-orange-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoggingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            {isLoggingIn ? '로그인 중...' : 'Google로 관리자 로그인'}
          </button>
          <p className="text-xs text-zinc-400">승인된 관리자 계정만 접근할 수 있습니다.</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={`h-full ${GLASS_BG} flex items-center justify-center`}>
        <div className="rounded-3xl border border-rose-200 bg-rose-50/80 backdrop-blur-2xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-500 flex items-center justify-center mx-auto shadow-lg">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-rose-800">접근 권한이 없습니다</h1>
            <p className="text-sm text-rose-600 mt-2">
              현재 계정 <span className="font-bold">{user.email}</span>은 관리자 권한이 없습니다.
            </p>
          </div>
          <button
            onClick={onLogout}
            className="w-full py-3 rounded-2xl bg-rose-600 text-white font-bold transition-all hover:bg-rose-700 flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Preview ─────────────────────────────────────────────────────────
  if (step === 'preview' && inputData) {
    return (
      <PremiumReportPreview
        inputData={inputData}
        sections={reportSections}
        sajuData={sajuRawData}
        daeunData={daeunRawData}
        yongshinData={yongshinRawData}
        onBack={() => setStep('input')}
        user={user}
        onLogout={onLogout}
      />
    );
  }

  // ── Step: Input ───────────────────────────────────────────────────────────
  return (
    <PremiumReportInputPanel
      user={user}
      onLogout={onLogout}      onBack={onBack}      onGenerated={(data: ReportInputData, sections: ReportSection[], saju: any, daeun: any, yongshin: any) => {
        setInputData(data);
        setReportSections(sections);
        setSajuRawData(saju);
        setDaeunRawData(daeun);
        setYongshinRawData(yongshin);
        setStep('preview');
      }}
    />
  );
};
