import React from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import {
  DEFAULT_GUIDE_ABOUT,
  DEFAULT_GUIDE_TERMS,
  DEFAULT_GUIDE_PRIVACY,
  DEFAULT_GUIDE_CONTACT,
} from '../../constants/guideDefaults';

interface GuideTabContentProps {
  tabTransition: any;
  glassTabBgClass: string;
  glassPanelClass: string;
  glassPanelStrongClass: string;
  guideSubPage: 'main' | 'privacy' | 'terms' | 'about' | 'contact' | 'taekil';
  setGuideSubPage: React.Dispatch<
    React.SetStateAction<'main' | 'privacy' | 'terms' | 'about' | 'contact' | 'taekil'>
  >;
  guideAboutContent?: string;
  guideTermsContent?: string;
  guidePrivacyContent?: string;
  guideContactContent?: string;
}

interface GuideSection {
  heading: React.ReactNode;
  body: React.ReactNode;
}

const SECTIONS: GuideSection[] = [
  {
    heading: (
      <>
        유아이 사주상담을<br />
        이렇게 <span className="text-seal">활용하면 좋습니다.</span>
      </>
    ),
    body: (
      <ul className="space-y-5">
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            01
          </span>
          <span>
            <strong className="text-ink-900 font-bold">사주정보 입력</strong> — 홈에서 생년월일시를 입력합니다.
          </span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            02
          </span>
          <span>
            <strong className="text-ink-900 font-bold">만세력 페이지</strong>에서 본인의 기질, 인생 흐름, 직업, 재물, 건강, 사람관계 흐름 등 사주를 확인합니다.
          </span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            03
          </span>
          <span>
            <strong className="text-ink-900 font-bold">상담 페이지</strong>에서 구체적인 질문을 통해 인생 컨설팅을 받습니다.
          </span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            04
          </span>
          <span>
            <strong className="text-ink-900 font-bold">프리미엄 인생가이드북·1년 운세</strong> 등 유료 상품을 구매하면 가장 궁금한 사항에 대한 솔루션 제시와 함께 더욱 심화되고 정밀한 인생 상담을 받을 수 있습니다.
          </span>
        </li>
      </ul>
    ),
  },
  {
    heading: (
      <>
        <span className="text-seal">개인정보를 소중히</span><br />
        여깁니다.
      </>
    ),
    body: (
      <ul className="space-y-5">
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            01
          </span>
          <span>로그인이 필요 없도록 사이트를 구현하여 개인정보가 사이트에 남지 않도록 합니다.</span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            02
          </span>
          <span>분석과 상담을 위해 사용자가 제공한 개인정보와 프라이버시는 사용 후 서버에서 삭제됩니다.</span>
        </li>
      </ul>
    ),
  },
  {
    heading: (
      <>
        <span className="text-seal">맞춤형 인생가이드</span>를<br />
        제공합니다.
      </>
    ),
    body: (
      <p>사용자의 고유한 상황을 고려해서 실질적인 솔루션을 제시합니다.</p>
    ),
  },
  {
    heading: (
      <>
        사주명리 분야에서<br />
        <span className="text-seal">최고의 Agent AI</span>를 지향합니다.
      </>
    ),
    body: (
      <ul className="space-y-5">
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            01
          </span>
          <span>제대로 된 만세력 데이터를 생성하고</span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            02
          </span>
          <span>현대 사주 명리 간명법을 AI에게 학습시켜</span>
        </li>
        <li className="flex gap-4">
          <span className="font-serif text-[18px] md:text-[20px] text-brush-gold/70 font-bold leading-none pt-1 shrink-0">
            03
          </span>
          <span>최고의 인생 솔루션을 제시합니다.</span>
        </li>
      </ul>
    ),
  },
];

export const GuideTabContent: React.FC<GuideTabContentProps> = ({
  tabTransition,
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
      className="flex-1 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      <div className="relative max-w-5xl mx-auto px-4 py-16 md:py-24 space-y-20 md:space-y-28">
        {guideSubPage !== 'main' && (
          <button
            onClick={() => setGuideSubPage('main')}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-ink-500 hover:text-ink-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            가이드 메인으로 돌아가기
          </button>
        )}

        {guideSubPage === 'main' ? (
          <>
            {SECTIONS.map((section, idx) => (
              <motion.section
                key={idx}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-6 md:space-y-8 max-w-3xl"
              >
                <p className="font-serif text-[22px] md:text-[28px] leading-[1.5] text-ink-900 font-bold">
                  {section.heading}
                </p>
                <div className="text-[14px] leading-[1.9] text-ink-700">
                  {section.body}
                </div>
              </motion.section>
            ))}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-3xl border border-ink-300/30 bg-paper-50/70 p-8 md:p-14"
            style={{
              boxShadow:
                '0 1px 0 rgba(168, 138, 74, 0.1), 0 12px 28px -12px rgba(58, 53, 48, 0.1)',
            }}
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

        <div className="pt-12 border-t border-ink-300/30">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-[12px] font-bold uppercase tracking-widest text-ink-500">
            <button
              onClick={() => setGuideSubPage('about')}
              className="hover:text-ink-900 transition-colors"
            >
              소개
            </button>
            <button
              onClick={() => setGuideSubPage('terms')}
              className="hover:text-ink-900 transition-colors"
            >
              이용약관
            </button>
            <button
              onClick={() => setGuideSubPage('privacy')}
              className="hover:text-ink-900 transition-colors"
            >
              개인정보 처리방침
            </button>
            <button
              onClick={() => setGuideSubPage('contact')}
              className="hover:text-ink-900 transition-colors"
            >
              문의하기
            </button>
          </div>
          <div className="mt-8 text-center space-y-2">
            <p className="text-[12px] text-ink-500/70">© 2024 UI Saju Consulting. All rights reserved.</p>
            <p className="text-[12px] text-ink-500/60 max-w-2xl mx-auto leading-relaxed">
              유아이 사주상담은 인공지능 기술을 활용한 명리학 가이드 서비스입니다. 모든 분석 결과는 참고용이며, 삶의 최종 결정은 본인의 판단하에 이루어져야 합니다.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
