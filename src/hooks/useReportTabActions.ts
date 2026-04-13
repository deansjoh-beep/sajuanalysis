import React from 'react';

interface UseReportTabActionsParams {
  reportRef: React.RefObject<HTMLDivElement>;
  reportContent: string | null;
  isPrinting: boolean;
  userName: string;
  consultationModeRef: React.MutableRefObject<'basic' | 'advanced'>;
  setIsPrinting: React.Dispatch<React.SetStateAction<boolean>>;
  setConsultationMode: React.Dispatch<React.SetStateAction<'basic' | 'advanced'>>;
  setReportContent: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useReportTabActions = ({
  reportRef,
  reportContent,
  isPrinting,
  userName,
  consultationModeRef,
  setIsPrinting,
  setConsultationMode,
  setReportContent
}: UseReportTabActionsParams) => {
  const switchReportMode = (mode: 'basic' | 'advanced') => {
    consultationModeRef.current = mode;
    setConsultationMode(mode);
    setReportContent(null);
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current || !reportContent || isPrinting) return;

    setIsPrinting(true);

    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      const outerMarginMm = 10;
      const capturePaddingPx = 24;
      const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#f9fafb',
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          clonedDoc.querySelectorAll('style').forEach((s) => {
            if (!s.textContent) return;
            s.textContent = s.textContent
              .replace(/color-mix\([^;{}]+\)/g, 'transparent')
              .replace(/oklch\([^;{}()]+\)/g, 'transparent')
              .replace(/oklab\([^;{}()]+\)/g, 'transparent');
          });
        },
      });
      const dataUrl = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(dataUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const contentWidth = pageWidth - outerMarginMm * 2;
      const contentHeight = pageHeight - outerMarginMm * 2;
      const scaledImageHeight = (imgProps.height * contentWidth) / imgProps.width;

      let heightLeft = scaledImageHeight - contentHeight;
      let position = outerMarginMm;

      pdf.addImage(dataUrl, 'PNG', outerMarginMm, position, contentWidth, scaledImageHeight);

      while (heightLeft > 0.01) {
        position = outerMarginMm - (scaledImageHeight - heightLeft);
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', outerMarginMm, position, contentWidth, scaledImageHeight);
        heightLeft -= contentHeight;
      }

      pdf.save(`유아이_운세리포트_${userName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setIsPrinting(false);
    }
  };

  return {
    switchReportMode,
    handleDownloadPDF
  };
};
