import React from 'react';
import { motion } from 'motion/react';

interface TaekilTabProps {
  tabTransition: any;
  glassTabBgClass: string;
  children: React.ReactNode;
}

export const TaekilTab: React.FC<TaekilTabProps> = ({ tabTransition, glassTabBgClass, children }) => {
  return (
    <motion.div
      key="taekil"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={tabTransition}
      className={`absolute inset-0 overflow-y-auto p-4 md:p-8 hide-scrollbar ${glassTabBgClass}`}
    >
      {children}
    </motion.div>
  );
};
