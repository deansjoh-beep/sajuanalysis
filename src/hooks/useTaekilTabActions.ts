import { TaekilCategory } from '../utils/taekilEngine';
import { TaekilResultItem } from './useTaekilTabState';
import { TaekilFieldConfig } from '../constants/taekil';

interface UserDataForTaekil {
  name: string;
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour: string;
  birthMinute: string;
  calendarType: 'solar' | 'lunar' | 'leap';
  gender: 'M' | 'F';
  unknownTime: boolean;
}

interface UseTaekilTabActionsParams {
  userData: UserDataForTaekil;
  taekilActiveCategory: TaekilCategory;
  taekilActiveFields: TaekilFieldConfig[];
  taekilFormValues: Record<string, string>;
  marriagePeriodStart: string;
  marriagePeriodEnd: string;
  spouseName: string;
  spouseGender: 'M' | 'F';
  spouseBirthYear: string;
  spouseBirthMonth: string;
  spouseBirthDay: string;
  spouseBirthHour: string;
  spouseBirthMinute: string;
  spouseCalendarType: 'solar' | 'lunar';
  spouseUnknownTime: boolean;
  preferredWeekday1: string;
  preferredWeekday2: string;
  preferredWeekday3: string;
  avoidDateInputs: string[];
  moveCurrentAddress: string;
  moveTargetAddress: string;
  movePeriodStart: string;
  movePeriodEnd: string;
  movePreferredWeekday1: string;
  movePreferredWeekday2: string;
  movePreferredWeekday3: string;
  moveFamilyBirthDates: string[];
  movePriority: 'folklore' | 'saju' | 'balanced';
  moveOnlyWeekend: boolean;
  childFatherBirthDate: string;
  childFatherBirthTime: string;
  childMotherBirthDate: string;
  childMotherBirthTime: string;
  childFetusGender: '남' | '여';
  childbirthPeriodStart: string;
  childbirthPeriodEnd: string;
  generalPeriodStart: string;
  generalPeriodEnd: string;
  generalPreferredWeekday1: string;
  generalPreferredWeekday2: string;
  generalPreferredWeekday3: string;
  generalAvoidDateInputs: string[];
  taekilAdditionalInfo: string;
  setTaekilLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setTaekilError: React.Dispatch<React.SetStateAction<string | null>>;
  setTaekilNotice: React.Dispatch<React.SetStateAction<string | null>>;
  setTaekilResults: React.Dispatch<React.SetStateAction<TaekilResultItem[]>>;
  setSelectedTaekilDate: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useTaekilTabActions = ({
  userData,
  taekilActiveCategory,
  taekilActiveFields,
  taekilFormValues,
  marriagePeriodStart,
  marriagePeriodEnd,
  spouseName,
  spouseGender,
  spouseBirthYear,
  spouseBirthMonth,
  spouseBirthDay,
  spouseBirthHour,
  spouseBirthMinute,
  spouseCalendarType,
  spouseUnknownTime,
  preferredWeekday1,
  preferredWeekday2,
  preferredWeekday3,
  avoidDateInputs,
  moveCurrentAddress,
  moveTargetAddress,
  movePeriodStart,
  movePeriodEnd,
  movePreferredWeekday1,
  movePreferredWeekday2,
  movePreferredWeekday3,
  moveFamilyBirthDates,
  movePriority,
  moveOnlyWeekend,
  childFatherBirthDate,
  childFatherBirthTime,
  childMotherBirthDate,
  childMotherBirthTime,
  childFetusGender,
  childbirthPeriodStart,
  childbirthPeriodEnd,
  generalPeriodStart,
  generalPeriodEnd,
  generalPreferredWeekday1,
  generalPreferredWeekday2,
  generalPreferredWeekday3,
  generalAvoidDateInputs,
  taekilAdditionalInfo,
  setTaekilLoading,
  setTaekilError,
  setTaekilNotice,
  setTaekilResults,
  setSelectedTaekilDate
}: UseTaekilTabActionsParams) => {
  const handleGenerateTaekil = async () => {
    const padTwo = (value: string) => String(value).padStart(2, '0');
    const basePayload = {
      name: userData.name,
      gender: userData.gender,
      birthDate: `${userData.birthYear}-${padTwo(userData.birthMonth)}-${padTwo(userData.birthDay)}`,
      birthTime: `${padTwo(userData.birthHour)}:${padTwo(userData.birthMinute)}`,
      isLunar: userData.calendarType !== 'solar',
      isLeap: userData.calendarType === 'leap',
      unknownTime: userData.unknownTime
    };

    let payload: Record<string, any>;

    if (taekilActiveCategory === '결혼') {
      setTaekilNotice(null);
      if (!spouseName.trim() || !spouseBirthYear || !spouseBirthMonth || !spouseBirthDay) {
        setTaekilError('결혼 택일을 위해 배우자 이름과 생년월일을 입력해 주세요.');
        return;
      }

      if (!marriagePeriodStart || !marriagePeriodEnd) {
        setTaekilError('희망 결혼식 일정의 시작일과 종료일을 입력해 주세요.');
        return;
      }

      if (marriagePeriodEnd < marriagePeriodStart) {
        setTaekilError('희망 일정의 종료일이 시작일보다 빠를 수 없습니다.');
        return;
      }

      const preferredWeekdays = Array.from(new Set([
        Number(preferredWeekday1),
        Number(preferredWeekday2),
        Number(preferredWeekday3)
      ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

      const avoidDates = avoidDateInputs
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .slice(0, 5);

      payload = {
        ...basePayload,
        category: '결혼',
        periodStart: marriagePeriodStart,
        periodEnd: marriagePeriodEnd,
        spouseName: spouseName.trim(),
        spouseGender,
        spouseBirthDate: `${spouseBirthYear}-${padTwo(spouseBirthMonth)}-${padTwo(spouseBirthDay)}`,
        spouseBirthTime: `${padTwo(spouseBirthHour)}:${padTwo(spouseBirthMinute)}`,
        spouseIsLunar: spouseCalendarType === 'lunar',
        spouseIsLeap: false,
        spouseUnknownTime,
        preferredWeekdays,
        avoidDates
      };
    } else if (taekilActiveCategory === '이사') {
      if (!moveCurrentAddress.trim() || !moveTargetAddress.trim()) {
        setTaekilError('이사 택일을 위해 현재 주소와 이사 갈 주소를 입력해 주세요. (동 단위 입력 가능)');
        return;
      }

      if (!movePeriodStart || !movePeriodEnd) {
        setTaekilError('희망 이사 기간의 시작일과 종료일을 입력해 주세요.');
        return;
      }

      if (movePeriodEnd < movePeriodStart) {
        setTaekilError('희망 이사 기간의 종료일이 시작일보다 빠를 수 없습니다.');
        return;
      }

      const movePreferredWeekdays = Array.from(new Set([
        Number(movePreferredWeekday1),
        Number(movePreferredWeekday2),
        Number(movePreferredWeekday3)
      ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

      const familyBirthDates = moveFamilyBirthDates
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .slice(0, 5);

      const notices: string[] = [];
      if (familyBirthDates.length === 0) {
        notices.push('가족 생년월일 미입력으로 가구주 사주 기준으로 우선 계산합니다.');
      }
      const shortAddressMode = moveCurrentAddress.trim().includes('동') || moveTargetAddress.trim().includes('동');
      if (shortAddressMode) {
        notices.push('주소를 동 단위로 입력해도 조회 가능하며, 방향 분석은 입력 텍스트 기준으로 간략 적용됩니다.');
      }
      setTaekilNotice(notices.length > 0 ? notices.join(' ') : null);

      payload = {
        ...basePayload,
        category: '이사',
        periodStart: movePeriodStart,
        periodEnd: movePeriodEnd,
        preferredWeekdays: movePreferredWeekdays,
        moveCurrentAddress: moveCurrentAddress.trim(),
        moveTargetAddress: moveTargetAddress.trim(),
        moveFamilyBirthDates: familyBirthDates,
        movePriority,
        moveOnlyWeekend
      };
    } else if (taekilActiveCategory === '출산') {
      if (!childFatherBirthDate || !childMotherBirthDate) {
        setTaekilError('출산 택일을 위해 부/모 생년월일을 입력해 주세요.');
        return;
      }

      if (!childbirthPeriodStart || !childbirthPeriodEnd) {
        setTaekilError('분만 가능일 시작/종료일을 입력해 주세요.');
        return;
      }

      if (childbirthPeriodEnd < childbirthPeriodStart) {
        setTaekilError('분만 가능일 종료일이 시작일보다 빠를 수 없습니다.');
        return;
      }

      setTaekilNotice('출산 택일은 상위 3안을 핵심 후보로 해석해 활용해 주세요.');

      payload = {
        ...basePayload,
        category: '출산',
        periodStart: childbirthPeriodStart,
        periodEnd: childbirthPeriodEnd,
        categoryInputs: {
          fatherBirthDate: childFatherBirthDate,
          fatherBirthTime: childFatherBirthTime,
          motherBirthDate: childMotherBirthDate,
          motherBirthTime: childMotherBirthTime,
          fetusGender: childFetusGender,
          designPrompt: '1순위 오행 중화/조후, 2순위 초중년 대운 희신 방향, 3순위 부모와 원진/충 회피'
        },
        additionalInfo: '추천 날짜와 시진을 3안 중심으로 해석하고 성격/진로/건강운을 함께 요약'
      };
    } else {
      if (!generalPeriodStart || !generalPeriodEnd) {
        setTaekilError(`${taekilActiveCategory} 택일을 위해 시작일과 종료일을 입력해 주세요.`);
        return;
      }

      if (generalPeriodEnd < generalPeriodStart) {
        setTaekilError(`${taekilActiveCategory} 기간의 종료일이 시작일보다 빠를 수 없습니다.`);
        return;
      }

      const missingField = taekilActiveFields.find((field) => !(taekilFormValues[field.key] || '').trim());
      if (missingField) {
        setTaekilError(`${taekilActiveCategory} 택일을 위해 '${missingField.label}' 입력이 필요합니다.`);
        return;
      }

      const genericPreferredWeekdays = Array.from(new Set([
        Number(generalPreferredWeekday1),
        Number(generalPreferredWeekday2),
        Number(generalPreferredWeekday3)
      ].filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).slice(0, 3);

      const genericAvoidDates = generalAvoidDateInputs
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .slice(0, 5);

      setTaekilNotice('입력하신 카테고리 조건(우선순위/메모)을 반영해 상위 5개를 추천합니다.');

      payload = {
        ...basePayload,
        category: taekilActiveCategory,
        periodStart: generalPeriodStart,
        periodEnd: generalPeriodEnd,
        preferredWeekdays: genericPreferredWeekdays,
        avoidDates: genericAvoidDates,
        categoryInputs: taekilActiveFields.reduce((acc, field) => {
          acc[field.key] = (taekilFormValues[field.key] || '').trim();
          return acc;
        }, {} as Record<string, string>),
        additionalInfo: taekilAdditionalInfo.trim()
      };
    }

    setTaekilLoading(true);
    setTaekilError(null);

    try {
      const response = await fetch('/api/taekil/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || `${taekilActiveCategory} 택일 조회에 실패했습니다.`);
      }

      const results = Array.isArray(data?.results) ? (data.results as TaekilResultItem[]) : [];
      setTaekilResults(results);
      setSelectedTaekilDate(results[0]?.date ?? null);
    } catch (error: any) {
      setTaekilError(error?.message || `${taekilActiveCategory} 택일 조회 중 오류가 발생했습니다.`);
      setTaekilResults([]);
      setSelectedTaekilDate(null);
    } finally {
      setTaekilLoading(false);
    }
  };

  return {
    handleGenerateTaekil
  };
};
