import React from 'react';
import { motion } from 'motion/react';

interface ReportTabProps {
  tabTransition: any;
  glassTabBgClass: string;
  children: React.ReactNode;
}

export const ReportTab: React.FC<ReportTabProps> = ({ tabTransition, glassTabBgClass, children }) => {
  return (
    <motion.div
      key="report"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tabTransition}
      className={`flex-1 overflow-y-auto p-4 md:p-10 hide-scrollbar ${glassTabBgClass}`}
    >
      {children}
    </motion.div>
  );
};
