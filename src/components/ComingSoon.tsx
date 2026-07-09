import { motion } from 'motion/react';
import { TAB_TRANSITION } from '../constants/styles';
import { PaperBackground } from './welcome/PaperBackground';

/**
 * 정식 오픈 전 "준비 중" 안내 화면.
 * 리포트 구매·조회 탭은 본격 오픈 전까지 이 화면으로 대체한다(App.tsx REPORTS_COMING_SOON).
 */
export default function ComingSoon({ title }: { title: string }) {
  return (
    <motion.div
      key={`coming-soon-${title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={TAB_TRANSITION}
      className="absolute inset-0 overflow-y-auto hide-scrollbar bg-paper-50"
      data-theme="light"
    >
      <div className="sticky top-0 left-0 w-full h-screen pointer-events-none -mb-[100vh]">
        <PaperBackground />
      </div>
      <div className="relative min-h-full flex items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <h2 className="font-serif text-[28px] md:text-[36px] font-bold text-ink-900">{title}</h2>
          <p className="text-[14px] text-ink-700 leading-relaxed">준비 중입니다.</p>
          <p className="text-[12px] text-ink-500 leading-relaxed">
            정식 오픈 시 이용하실 수 있습니다. 조금만 기다려 주세요.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
