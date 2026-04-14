import { PremiumOrder } from './premiumOrderStore';

const callServerEmailApi = async (payload: { to: string; subject: string; html: string }) => {
  const response = await fetch('/api/premium-report/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    try {
      const parsed = JSON.parse(raw);
      throw new Error(parsed?.message || parsed?.error || 'Failed to send email');
    } catch {
      throw new Error(raw || 'Failed to send email');
    }
  }

  try {
    return JSON.parse(raw);
  } catch {
    return { success: true };
  }
};

export const sendPremiumReportEmail = async (
  order: PremiumOrder,
  pdfUrl: string
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    const isYearly = order.productType === 'yearly2026';
    const productTitle = isYearly ? '📅 프리미엄 일년운세 2026' : '📊 프리미엄 사주 리포트';
    const productSubTitle = isYearly
      ? `${order.name}님의 2026년 한 해 상세 분석`
      : `${order.name}님의 운세 종합 분석`;
    const introLine = isYearly
      ? '요청하신 프리미엄 일년운세 2026 리포트가 완성되었습니다.'
      : '요청하신 프리미엄 사주 리포트가 완성되었습니다.';
    const contentListHtml = isYearly
      ? `
            <ul>
              <li>가장 알고 싶은 것에 대한 맞춤 답변</li>
              <li>가장 큰 고민에 대한 구체적 조언</li>
              <li>2026년 한 해 종합 운세</li>
              <li>2026년 월별 상세 흐름 (1~12월)</li>
              <li>2026년 행동 체크리스트</li>
            </ul>
            `
      : `
            <ul>
              <li>사주 원국 상세 분석</li>
              <li>현재의 대운&세운 흐름</li>
              <li>생애 주기별 운세</li>
              <li>오행 밸런스 진단</li>
              <li>용신 기반 지혜의 길</li>
              <li>재물·연애·직업·건강 운 분석</li>
            </ul>
            `;
    const emailSubject = isYearly
      ? `[프리미엄 일년운세 2026] ${order.name}님의 한 해 분석이 도착했습니다`
      : `[프리미엄 사주 리포트] ${order.name}님의 운세 분석 완료`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0047AB 0%, #003580 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border: 1px solid #e0e0e0;
            border-radius: 0 0 0 0;
          }
          .greeting {
            font-size: 16px;
            margin-bottom: 20px;
          }
          .cta-button {
            display: inline-block;
            background: #0047AB;
            color: white;
            padding: 12px 30px;
            border-radius: 5px;
            text-decoration: none;
            margin: 20px 0;
            font-weight: bold;
          }
          .footer {
            background: #f0f0f0;
            padding: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
            border-radius: 0 0 8px 8px;
          }
          .link {
            color: #0047AB;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${productTitle}</h1>
            <p>${productSubTitle}</p>
          </div>

          <div class="content">
            <div class="greeting">
              <p>안녕하세요, ${order.name}님!</p>
              <p>${introLine}</p>
              <p>첨부파일을 통해 자세한 분석 결과를 확인하실 수 있습니다.</p>
            </div>

            <h2 style="color: #0047AB;">📋 리포트 내용</h2>${contentListHtml}
            
            <p style="text-align: center;">
              <a href="${pdfUrl}" class="cta-button">📥 PDF 다운로드</a>
            </p>
            
            <p style="color: #666; font-size: 14px;">
              <strong>더 궁금한 점이 있으신가요?</strong><br>
              일대일 전문 상담을 통해 더 깊이 있는 이야기를 나눌 수 있습니다.
            </p>
          </div>
          
          <div class="footer">
            <p>이 리포트는 AI 기반 명리 분석 시스템으로 생성되었습니다.</p>
            <p>더 구체적인 판단이 필요한 경우 전문가 상담을 권장합니다.</p>
            <p style="margin-top: 15px; color: #999;">
              © 2026 UI 사주상담. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    const data = await callServerEmailApi({
      to: order.email,
      subject: emailSubject,
      html: emailHtml,
    });

    return {
      success: true,
      messageId: data?.messageId || data?.id,
    };
  } catch (error) {
    console.error('Error sending premium report email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const sendOrderConfirmationEmail = async (
  email: string,
  name: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background: linear-gradient(135deg, #0047AB 0%, #003580 100%);
            color: white;
            padding: 30px;
            border-radius: 8px 8px 0 0;
            text-align: center;
          }
          .content {
            background: #f9f9f9;
            padding: 30px;
            border: 1px solid #e0e0e0;
          }
          .footer {
            background: #f0f0f0;
            padding: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
            border-radius: 0 0 8px 8px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ 주문 접수 완료</h1>
          </div>
          
          <div class="content">
            <p>안녕하세요, ${name}님!</p>
            <p>프리미엄 사주 리포트 주문이 접수되었습니다.</p>
            <p>현재 분석 중이며, <strong>24시간 이내</strong>에 이메일로 완성된 리포트를 보내드릴 예정입니다.</p>
            
            <h3 style="color: #0047AB;">📅 예상 일정</h3>
            <ul>
              <li>접수: 방금</li>
              <li>분석: 1~4시간</li>
              <li>완성 및 발송: 24시간 이내</li>
            </ul>
            
            <p style="color: #666; margin-top: 20px;">
              기다려주셔서 감사합니다!
            </p>
          </div>
          
          <div class="footer">
            <p>문의사항이 있으시면 언제든 연락주세요.</p>
            <p style="margin-top: 15px; color: #999;">
              © 2026 UI 사주상담. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    await callServerEmailApi({
      to: email,
      subject: `[프리미엄 사주 리포트] 주문 접수 완료`,
      html: emailHtml,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};
