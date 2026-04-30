import React from 'react';
import { motion } from 'motion/react';
import { PaperBackground } from '../welcome/PaperBackground';

interface ChatTabProps {
  tabTransition: any;
  glassTabBgClass: string;
  children: React.ReactNode;
}

export const ChatTab: React.FC<ChatTabProps> = ({ tabTransition, children }) => {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={tabTransition}
      className="absolute inset-0 flex flex-col overflow-hidden bg-paper-50"
      data-theme="light"
    >
      <div className="absolute inset-0 pointer-events-none">
        <PaperBackground />
      </div>
      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </motion.div>
  );
};
