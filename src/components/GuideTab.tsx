import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { TAEKIL_SERVICE_GUIDE } from '../constants/taekilGuide';
import {
  ArrowLeft,
  User,
  Calendar,
  Clock,
  FileText,
  Compass,
  Database,
  Lock,
  Bot,
  BookOpen,
  Zap,
  Cpu,
  Waves,
} from 'lucide-react';

type GuideSubPage = 'main' | 'about' | 'terms' | 'privacy' | 'contact' | 'taekil';

interface GuideTabProps {
  guideSubPage: GuideSubPage;
  setGuideSubPage: React.Dispatch<React.SetStateAction<GuideSubPage>>;
}

const GuideTab: React.FC<GuideTabProps> = ({ guideSubPage, setGuideSubPage }) => {
  return (
    <motion.div
      key="guide"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 hide-scrollbar bg-white"
    >
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
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
            <div className="bg-white rounded-[3rem] overflow-hidden shadow-2xl border border-black/5 flex flex-col md:flex-row">
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
              <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col">
                <div className="bg-[#0047AB] p-10 text-center">
                  <h2 className="text-white text-3xl font-handwriting leading-tight">
                    유아이 앱이 다른 앱보다
                    <br />
                    좋은 세가지 이유
                  </h2>
                </div>
                <div className="p-10 space-y-10">
                  <div className="flex items-start gap-6">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <div className="relative">
                        <Database className="w-8 h-8 text-indigo-600 opacity-40" />
                        <Lock className="w-5 h-5 text-indigo-600 absolute -bottom-1 -right-1" />
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500 rotate-45 origin-center translate-y-4"></div>
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

              <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col">
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

              <div className="bg-white rounded-[3rem] overflow-hidden shadow-xl border border-black/5 flex flex-col md:col-span-2">
                <div className="bg-[#0047AB] p-10 text-center">
                  <h2 className="text-white text-3xl font-handwriting leading-tight">
                    유아이의 운세분석 과정과
                    <br />
                    운세에 대한 철학
                  </h2>
                </div>
                <div className="p-10 flex flex-col md:flex-row items-center justify-around gap-12">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                        <User className="w-8 h-8 text-zinc-500" />
                      </div>
                      <div className="w-12 h-px bg-zinc-200 border-t border-dashed"></div>
                      <div className="w-24 h-24 rounded-3xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Cpu className="w-12 h-12 text-white animate-pulse" />
                      </div>
                      <div className="w-12 h-px bg-zinc-200 border-t border-dashed"></div>
                      <div className="w-16 h-16 rounded-2xl bg-zinc-100 flex items-center justify-center border border-black/5">
                        <FileText className="w-8 h-8 text-indigo-500" />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 font-medium uppercase tracking-widest">분석 프로세스</p>
                  </div>

                  <div className="hidden md:block w-px h-40 bg-zinc-100"></div>

                  <div className="flex flex-col items-center text-center space-y-8 max-w-md">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <Waves className="w-full h-full text-indigo-500/20 absolute animate-pulse" />
                      <div className="relative z-10 p-6 bg-white rounded-full border-2 border-indigo-500 shadow-2xl">
                        <Compass className="w-14 h-14 text-indigo-600" />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <p className="text-xl font-bold text-zinc-800">
                        "운명은 정해진 결말이 아니라,
                        <br />
                        우리가 조종하는 돛의 방향입니다."
                      </p>
                      <p className="text-sm text-zinc-500 leading-relaxed">
                        만세력 기반의 정밀 분석과 AI의 전략적 해석으로,
                        <br />
                        당신의 삶을 능동적으로 이끌 최고의 대응 전략을 제시합니다.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setGuideSubPage('taekil')}
                className="px-5 py-3 rounded-2xl text-sm font-bold border bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 transition-colors"
              >
                택일 서비스 가이드 바로가기
              </button>
            </div>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl border border-black/5"
          >
            <div className="markdown-body prose max-w-none">
              {guideSubPage === 'about' && (
                <ReactMarkdown>{`
# 유아이사주(UI Saju) 소개

유아이(UI) 사주상담은 수천 년의 역사를 가진 동양의 명리학적 지혜와 현대의 최첨단 인공지능 기술을 결합하여, 현대인들에게 가장 정밀하고 실질적인 인생의 전략을 제시하는 프리미엄 사주 분석 플랫폼입니다.

## 우리의 미션
동양에서 예전부터 나라의 중요한 행정, 정치, 경제 운영에 광범위하게 활용되었던 사주명리학을 기반으로 현대의 첨단 인공지능 기술을 결합하여 각 개인이 더 나은 삶을 살아가는데 도움이 되는 것입니다. 삶의 중요한 결정의 순간에 최선의 선택을 할 수 있도록 돕겠습니다.

## 주요 서비스
- **정밀 만세력 분석**: 전통 명리학의 원칙에 충실한 8자 분석
- **AI 전략 도출**: 방대한 사주 데이터를 학습한 AI의 현대적 해석
- **실시간 상담**: 궁금한 점을 즉시 해소할 수 있는 대화형 인터페이스
- **운명 리포트**: 당신의 삶을 관통하는 거대한 흐름을 담은 종합 분석서

## 가치와 철학
우리는 운명이 고정된 것이 아니라, 자신의 기운을 이해하고 적절한 전략을 세움으로써 개선할 수 있는 것이라고 믿습니다. 유아이는 단순한 점술을 넘어, 데이터에 기반한 삶의 가이드라인을 제공합니다.

## 운영 정보
- **운영팀**: 유아이 사주 전략 연구소 (UI Saju Lab)
- **대표 디렉터**: 오세진
- **문의**: [dean.uitrading@gmail.com](mailto:dean.uitrading@gmail.com)
- **웹사이트**: [https://ais-pre-wuknjkjkvoeqlkc6y4jenr-502458168031.asia-east1.run.app](https://ais-pre-wuknjkjkvoeqlkc6y4jenr-502458168031.asia-east1.run.app)
                `}</ReactMarkdown>
              )}
              {guideSubPage === 'terms' && (
                <ReactMarkdown>{`
# 이용약관 (Terms of Service)

본 약관은 유아이 사주상담(이하 "서비스")이 제공하는 모든 서비스의 이용 조건 및 절차에 관한 사항을 규정합니다.

## 제1조 (목적)
본 서비스는 인공지능 기술을 활용한 사주 분석 및 상담을 제공하며, 사용자의 자기 이해와 삶의 참고 자료로 활용됨을 목적으로 합니다.

## 제2조 (서비스의 성격 및 책임의 한계)
1. 본 서비스에서 제공하는 모든 분석 결과는 인공지능의 명리학적 해석이며, 과학적 사실이나 절대적인 예언이 아닙니다.
2. 서비스의 결과는 사용자의 주관적인 판단에 도움을 주기 위한 참고 자료일 뿐이며, 의료, 법률, 금융 등 전문적인 조언을 대체할 수 없습니다.
3. 사용자가 서비스의 결과를 바탕으로 내린 모든 결정과 그로 인해 발생하는 결과에 대한 책임은 사용자 본인에게 있습니다.

## 제3조 (콘텐츠 저작권)
1. 서비스가 제공하는 분석 결과 및 리포트의 저작권은 서비스 운영자에게 있습니다.
2. 사용자는 개인적인 용도로만 결과를 활용할 수 있으며, 상업적 목적으로 무단 복제, 배포, 수정하는 행위는 금지됩니다.

## 제4조 (개인정보 보호)
서비스는 사용자의 사주 분석을 위해 입력된 정보를 분석 목적으로만 사용하며, 별도의 동의 없이 서버에 영구 저장하거나 제3자에게 제공하지 않습니다. 상세한 내용은 개인정보 처리방침을 따릅니다.

## 제5조 (광고 게재)
1. 서비스는 운영 유지를 위해 구글 애드센스 등 제3자 광고를 게재할 수 있습니다.
2. 광고 클릭 및 이용 과정에서 발생하는 제3자 서비스와의 상호작용은 해당 서비스의 약관을 따릅니다.

## 제6조 (이용 제한)
서비스의 정상적인 운영을 방해하거나, 부적절한 방법으로 시스템에 접근하는 경우 이용이 제한될 수 있습니다.
                `}</ReactMarkdown>
              )}
              {guideSubPage === 'privacy' && (
                <ReactMarkdown>{`
# 개인정보 처리방침 (Privacy Policy)

유아이 사주상담(이하 "서비스")은 사용자의 개인정보를 소중히 여기며, 관련 법령을 준수합니다. 본 방침은 구글 애드센스 광고 게재와 관련된 내용을 포함하고 있습니다.

## 1. 수집하는 개인정보 항목
서비스는 사주 분석 및 상담을 위해 다음과 같은 정보를 수집합니다.
- 필수 항목: 생년월일, 태어난 시간(선택), 성별, 양력/음력 구분
- 상담 항목: 사용자가 채팅창에 직접 입력한 질문 내용
- 자동 수집 항목: IP 주소, 쿠키, 서비스 이용 기록, 기기 정보 (광고 및 분석 목적)

## 2. 개인정보의 수집 및 이용 목적
수집된 정보는 오직 다음과 같은 목적에만 사용됩니다.
- 만세력 기반의 사주 분석 및 AI 상담 결과 도출
- 서비스 품질 개선 및 사용자 맞춤형 가이드 제공
- **광고 게재**: 구글 애드센스를 통한 맞춤형 광고 제공

## 3. 쿠키(Cookie) 및 제3자 광고
본 서비스는 광고 게재를 위해 쿠키를 사용합니다.
- **Google AdSense**: 구글을 포함한 제3자 업체는 사용자의 이전 방문 기록을 바탕으로 광고를 게재하기 위해 쿠키를 사용합니다.
- **광고 개인 정보 보호**: 구글의 광고 쿠키를 사용함으로써 구글 및 파트너 업체는 사용자의 본 사이트 및 기타 사이트 방문 기록을 바탕으로 사용자에게 적절한 광고를 게재할 수 있습니다.
- **거부 방법**: 사용자는 [구글 광고 설정](https://www.google.com/settings/ads)을 방문하여 개인 맞춤형 광고를 해제할 수 있습니다. 또는 [www.aboutads.info](http://www.aboutads.info)를 방문하여 제3자 업체의 쿠키 사용을 중단할 수 있습니다.

## 4. 개인정보의 보유 및 파기
**유아이는 사용자의 민감한 사주 데이터를 서버에 영구 저장하지 않는 것을 원칙으로 합니다.**
- 입력된 사주 정보는 세션 동안 분석을 위해서만 일시적으로 사용됩니다.
- 사용자가 브라우저를 종료하거나 세션이 만료되면 해당 정보는 즉시 파기됩니다.

## 5. 제3자 제공 및 위탁
서비스는 사용자의 동의 없이 개인정보를 외부에 제공하지 않습니다. 단, 서비스 운영을 위해 다음과 같은 외부 플랫폼을 활용합니다.
- **Google Firebase**: 데이터베이스 및 시스템 운영
- **Google AdSense**: 광고 게재 및 수익화

## 6. 사용자의 권리
사용자는 언제든지 자신의 정보 입력을 중단할 수 있으며, 브라우저의 캐시 및 쿠키 삭제를 통해 로컬 데이터를 관리할 수 있습니다.
                `}</ReactMarkdown>
              )}
              {guideSubPage === 'contact' && (
                <ReactMarkdown>{`
# 문의하기 (Contact Us)

유아이 사주상담 서비스 이용 중 궁금한 점이나 제안하고 싶은 내용이 있다면 언제든지 연락해 주세요.

## 연락처 정보
- **이메일**: [dean.uitrading@gmail.com](mailto:dean.uitrading@gmail.com)
- **운영 시간**: 언제든 가능

## 제휴 및 비즈니스 문의
유아이의 AI 사주 분석 기술을 활용한 제휴나 비즈니스 협업 제안도 환영합니다. 이메일로 상세 내용을 보내주시면 검토 후 연락드리겠습니다.

---
*보내주신 소중한 의견은 서비스 개선에 큰 힘이 됩니다.*
                `}</ReactMarkdown>
              )}
              {guideSubPage === 'taekil' && (
                <ReactMarkdown>{TAEKIL_SERVICE_GUIDE}</ReactMarkdown>
              )}
            </div>
          </motion.div>
        )}

        <div className="pt-12 border-t border-black/5">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
            <button onClick={() => setGuideSubPage('taekil')} className="hover:text-indigo-500 transition-colors">택일 서비스 가이드</button>
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

      <div className="p-10 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 text-center">
        <p className="text-sm font-bold text-indigo-400/70 leading-relaxed">유아이(UI)와 함께 당신의 운명을 디자인하세요.</p>
      </div>
    </motion.div>
  );
};

export default GuideTab;
