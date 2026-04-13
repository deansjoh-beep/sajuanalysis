import React from 'react';
import { motion } from 'motion/react';

interface ChatTabProps {
  tabTransition: any;
  glassTabBgClass: string;
  children: React.ReactNode;
}

export const ChatTab: React.FC<ChatTabProps> = ({ tabTransition, glassTabBgClass, children }) => {
  return (
    <motion.div
      key="chat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={tabTransition}
      className={`absolute inset-0 flex flex-col overflow-hidden ${glassTabBgClass}`}
    >
      {children}
    </motion.div>
  );
};
