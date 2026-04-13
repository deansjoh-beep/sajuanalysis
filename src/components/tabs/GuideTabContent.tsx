import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { DEFAULT_GUIDE_ABOUT, DEFAULT_GUIDE_TERMS, DEFAULT_GUIDE_PRIVACY, DEFAULT_GUIDE_CONTACT } from '../../constants/guideDefaults';
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Calendar,
  Clock,
  Compass,
  Cpu,
  Database,
  FileText,
  Lock,
  User,
  Waves,
  Zap
} from 'lucide-react';

interface GuideTabContentProps {
  tabTransition: any;
  glassTabBgClass: string;
  glassPanelClass: string;
  glassPanelStrongClass: string;
  guideSubPage: 'main' | 'privacy' | 'terms' | 'about' | 'contact' | 'taekil';
  setGuideSubPage: React.Dispatch<React.SetStateAction<'main' | 'privacy' | 'terms' | 'about' | 'contact' | 'taekil'>>;
  guideAboutContent?: string;
  guideTermsContent?: string;
  guidePrivacyContent?: string;
  guideContactContent?: string;
}

export const GuideTabContent: React.FC<GuideTabContentProps> = ({
  tabTransition,
  glassTabBgClass,
  glassPanelClass,
  glassPanelStrongClass,
  guideSubPage,
  setGuideSubPage,
  guideAboutContent,
  guideTermsContent,
  guidePrivacyContent,
  guideContactContent,
}) => {
  return (
    <motion.div
      key="guide"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={tabTransition}
      className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-8 hide-scrollbar ${glassTabBgClass}`}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
        <div className="absolute -left-10 top-8 h-56 w-56 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-0 top-16 h-64 w-64 rounded-full bg-indigo-300/25 blur-3xl" />
      </div>
      <div className="relative z-10 max-w-6xl mx-auto space-y-12 pb-20">
        {guideSubPage !== 'main' && (
          <button
            onClick={() => setGuideSubPage('main')}
            className="flex items-center gap-2 text-indigo-600 font-bold text-sm mb-8 hover:underline transition-all group"
          >
            <div className="p-2 rounded-full bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </div>
            가이드 메인으로 돌아가기
          </button>
        )}

        {guideSubPage === 'main' ? (
          <>
            <div className={`${glassPanelStrongClass} rounded-[3rem] p-8 md:p-10`}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <Compass className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-zinc-900">사이트맵</h2>
                  <p className="text-sm text-zinc-500">원하는 메뉴를 빠르게 찾을 수 있도록 핵심 흐름을 정리했어요.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-2xl border border-indigo-100 bg-white/70 p-5 space-y-3">
                  <p className="text-sm font-bold text-indigo-700">추천 이용 순서</p>
                  <p className="text-sm text-zinc-700 leading-relaxed">HOME → 만세력 → 리포트 → 상담</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">먼저 만세력을 만든 뒤 리포트와 상담으로 들어가면 더 정확하게 볼 수 있습니다.</p>
                </div>

                <div className="rounded-2xl border border-indigo-100 bg-white/70 p-5 space-y-3">
                  <p className="text-sm font-bold text-indigo-700">메인 탭 사이트맵</p>
                  <ul className="space-y-1.5 text-sm text-zinc-700 leading-relaxed">
                    <li>• HOME: 시작 화면, 사주 입력, 추천 콘텐츠</li>
                    <li>• 만세력: 사주·오행·대운 분석 결과 확인</li>
                    <li>• 택일: 결혼/이사/개업/출산 등 일정 추천</li>
                    <li>• 상담: AI 일대일 질의응답 + 음성 입력</li>
                    <li>• 리포트: 운세 리포트 생성 및 PDF 저장</li>
                    <li>• 블로그: 사주 해설/팁 콘텐츠 열람</li>
                    <li>• 가이드: 서비스 소개·약관·개인정보·문의</li>
                  </ul>
                </div>

              </div>
            </div>

            <div className={`${glassPanelStrongClass} rounded-[3rem] overflow-hidden flex flex-col md:flex-row`}>
              <div className="md:w-1/3 bg-indigo-600 p-10 text-center relative overflow-hidden flex flex-col items-center justify-center">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="100" cy="0" r="80" fill="none" stroke="white" strokeWidth="0.5" />
                    <circle cx="100" cy="0" r="60" fill="none" stroke="white" strokeWidth="0.5" />
                  </svg>
                </div>
                <div className="relative z-10 space-y-4">
                  <h2 className="text-white text-3xl font-serif font-bold leading-tight">CEO 인사말</h2>
                  <p className="text-indigo-100 text-xs font-serif opacity-70">당신의 삶을 비추는 고요한 등불</p>
                </div>
              </div>
              <div className="flex-1 p-10 md:p-14 space-y-8">
                <div className="space-y-6 text-base md:text-lg leading-relaxed font-serif text-zinc-700">
                  <p className="font-bold text-zinc-900 text-xl">안녕하세요. 삶의 소중한 길목에서 유아이를 찾아주신 귀하께 깊은 감사의 인사를 전합니다.</p>
                  <div className="space-y-4">
                    <p>
                      유아이는 단순히 정해진 운명을 말하는 곳이 아닙니다.
                      우리는 수천 년을 이어온 명리학의 깊은 지혜를 가장 정밀한 AI 기술과 결합하여,
                      당신만을 위한 <strong>'삶의 전략'</strong>을 도출해 내는 전문 사주 상담 플랫폼입니다.
                    </p>
                    <p>
                      <strong>최고의 전문성을 지향합니다:</strong> 유아이는 AI에게 방대하고 정교한 사주 전문 소스를 학습시켜,
                      그 어떤 곳보다 깊이 있고 체계적인 분석 결과를 제공합니다. 단순한 키워드 나열이 아닌,
                      당신의 삶을 관통하는 거대한 흐름을 읽어드립니다.
                    </p>
                    <p>
                      <strong>당신의 평온을 최우선으로 합니다:</strong> 고민의 무게를 누구보다 잘 알기에,
                      유아이는 상담자의 프라이버시를 철저히 보장합니다. 로그인 없이도 당신의 속 깊은 이야기를 나눌 수 있으며,
                      모든 상담은 오직 당신만을 위한 맞춤형 공간에서 안전하게 진행됩니다.
                    </p>
                    <p>
                      누구에게도 꺼내놓지 못한 고민이 있다면, 이제 유아이의 지혜를 빌려보십시오.
                      당신의 내일이 오늘보다 더 명료해질 수 있도록 정성을 다해 돕겠습니다.
                    </p>
                  </div>
                </div>
                <div className="pt-8 border-t border-black/5 text-right">
                  <p className="text-sm font-serif opacity-60 italic">유아이사주상담 디렉터 배상</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className={`${glassPanelClass} rounded-[3rem] overflow-hidden flex flex-col`}>
                <div className="bg-[#0047AB] p-10 text-center">
                  <h2 className="text-white text-3xl font-handwriting leading-tight">유아이 앱이 다른 앱보다<br />좋은 세가지 이유</h2>
                </div>
                <div className="p-10 space-y-10">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <div className="relative">
                        <Database className="w-8 h-8 text-indigo-600 opacity-40" />
                        <Lock className="w-5 h-5 text-indigo-600 absolute -bottom-1 -right-1" />
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 rotate-45 origin-center translate-y-4" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-zinc-800">철저한 프라이버시 보호</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        사용자의 개인정보와 프라이버시를 철저히 보호합니다. 분석과 상담을 위해 사용자가 제공한 개인정보와 프라이버시는 서버에 저장되지 않습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Zap className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-zinc-800">정밀한 사주 데이터 학습</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        AI 모델에 만세력에서 추출한 정밀한 사주데이타를 학습시켜 확실한 사주 감명이 되도록 시스템을 만들었습니다.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <div className="relative">
                        <Bot className="w-8 h-8 text-indigo-600" />
                        <BookOpen className="w-4 h-4 text-indigo-600 absolute -top-1 -right-1" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-zinc-800">맞춤형 인생 가이드 제공</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        사용자의 고유한 상황을 고려해서 실질적인 인생의 가이드가 되도록 맞춤 상담을 제공합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${glassPanelClass} rounded-[3rem] overflow-hidden flex flex-col`}>
                <div className="bg-[#0047AB] p-10 text-center">
                  <h2 className="text-white text-3xl font-handwriting leading-tight">사용자 정보 입력 방법</h2>
                </div>
                <div className="p-10 space-y-10">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Clock className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-zinc-800">생시 미입력 가능</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">모르면 비워두세요. 6개의 글자로도 충분합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Calendar className="w-8 h-8 text-indigo-500" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-zinc-800">양력/음력 자동 인식</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">별도 선택이 없으면 기본 양력으로 분석합니다.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                      <Zap className="w-8 h-8 text-white fill-white" />
                    </div>
                    <div className="space-y-2">
                      <p className="text-lg font-bold text-indigo-600">분석 시작</p>
                      <p className="text-sm text-zinc-500 leading-relaxed">버튼을 누르면 당신의 운세 분석이 시작됩니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`${glassPanelClass} rounded-[3rem] overflow-hidden flex flex-col md:col-span-2`}>
                <div className="bg-[#0047AB] p-10 text-center">
                  <h2 className="text-white text-3xl font-handwriting leading-tight">유아이의 운세분석 과정과<br />운세에 대한 철학</h2>
                </div>
                <div className="p-10 flex flex-col md:flex-row items-center justify-around gap-12">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                        <User className="w-8 h-8 text-zinc-500" />
                      </div>
                      <div className="w-12 h-px bg-zinc-200 border-t border-dashed" />
                      <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Cpu className="w-12 h-12 text-white animate-pulse" />
                      </div>
                      <div className="w-12 h-px bg-zinc-200 border-t border-dashed" />
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                        <FileText className="w-8 h-8 text-indigo-500" />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">분석 프로세스</p>
                  </div>

                  <div className="hidden md:block w-px h-40 bg-zinc-100" />

                  <div className="flex flex-col items-center text-center space-y-8 max-w-md">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <Waves className="w-full h-full text-indigo-500/20 absolute animate-pulse" />
                      <div className="relative z-10 p-6 bg-white rounded-full border-2 border-indigo-500 shadow-2xl">
                        <Compass className="w-14 h-14 text-indigo-600" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xl font-bold text-zinc-800">
                        "운명은 정해진 결말이 아니라,<br />우리가 조종하는 돛의 방향입니다."
                      </p>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        만세력 기반의 정밀 분석과 AI의 전략적 해석으로,<br />
                        당신의 삶을 능동적으로 이끌 최고의 대응 전략을 제시합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${glassPanelStrongClass} rounded-[3rem] p-8 md:p-16`}
          >
            <div className="markdown-body prose max-w-none">
              {guideSubPage === 'about' && (
                <ReactMarkdown>{guideAboutContent || DEFAULT_GUIDE_ABOUT}</ReactMarkdown>
              )}
              {guideSubPage === 'terms' && (
                <ReactMarkdown>{guideTermsContent || DEFAULT_GUIDE_TERMS}</ReactMarkdown>
              )}
              {guideSubPage === 'privacy' && (
                <ReactMarkdown>{guidePrivacyContent || DEFAULT_GUIDE_PRIVACY}</ReactMarkdown>
              )}
              {guideSubPage === 'contact' && (
                <ReactMarkdown>{guideContactContent || DEFAULT_GUIDE_CONTACT}</ReactMarkdown>
              )}
            </div>
          </motion.div>
        )}

        <div className="pt-12 border-t border-white/60">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            <button onClick={() => setGuideSubPage('about')} className="hover:text-indigo-500 transition-colors">소개 (About)</button>
            <button onClick={() => setGuideSubPage('terms')} className="hover:text-indigo-500 transition-colors">이용약관 (Terms)</button>
            <button onClick={() => setGuideSubPage('privacy')} className="hover:text-indigo-500 transition-colors">개인정보 처리방침 (Privacy)</button>
            <button onClick={() => setGuideSubPage('contact')} className="hover:text-indigo-500 transition-colors">문의하기 (Contact)</button>
          </div>
          <div className="mt-8 text-center space-y-2">
            <p className="text-[10px] text-zinc-500 opacity-60">© 2024 UI Saju Consulting. All rights reserved.</p>
            <p className="text-[9px] text-zinc-500 opacity-40 max-w-2xl mx-auto leading-relaxed">
              유아이 사주상담은 인공지능 기술을 활용한 명리학 가이드 서비스입니다. 모든 분석 결과는 참고용이며, 삶의 최종 결정은 본인의 판단하에 이루어져야 합니다.
            </p>
          </div>
        </div>
      </div>

      <div className="p-10 rounded-[2rem] bg-white/55 backdrop-blur-xl border border-white/60 shadow-xl shadow-indigo-200/20 text-center">
        <p className="text-sm font-bold text-indigo-400/70 leading-relaxed">유아이(UI)와 함께 당신의 운명을 디자인하세요.</p>
      </div>
    </motion.div>
  );
};
