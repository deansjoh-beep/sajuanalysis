import { useState } from 'react';

export const useReportTabState = () => {
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  return {
    reportContent,
    setReportContent,
    isPrinting,
    setIsPrinting
  };
};
