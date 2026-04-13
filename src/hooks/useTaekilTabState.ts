import { useMemo, useState } from 'react';
import { TaekilCategory } from '../utils/taekilEngine';
import { TaekilFieldConfig } from '../constants/taekil';
import { getSeoulMonthEndYmdOffset, getSeoulTodayYmd, getSeoulYmOffset } from '../lib/seoulDateGanji';

interface TaekilTimeSlot {
  time: string;
  score: number;
  reason: string;
}

interface TaekilScoreFactor {
  label: string;
  weight: number;
  type: 'plus' | 'minus' | 'info';
}

export interface TaekilResultItem {
  date: string;
  rating: number;
  reasons: string[];
  topTimeSlots: TaekilTimeSlot[];
  factors: TaekilScoreFactor[];
}

export const useTaekilTabState = (
  categoryFormFields: Record<Exclude<TaekilCategory, '결혼'>, TaekilFieldConfig[]>
) => {
  const [taekilActiveCategory, setTaekilActiveCategory] = useState<TaekilCategory>('결혼');
  const [taekilStartMonth, setTaekilStartMonth] = useState(() => getSeoulYmOffset(0));
  const [taekilEndMonth, setTaekilEndMonth] = useState(() => getSeoulYmOffset(3));
  const [marriagePeriodStart, setMarriagePeriodStart] = useState(() => getSeoulTodayYmd());
  const [marriagePeriodEnd, setMarriagePeriodEnd] = useState(() => getSeoulMonthEndYmdOffset(3));
  const [taekilLoading, setTaekilLoading] = useState(false);
  const [taekilError, setTaekilError] = useState<string | null>(null);
  const [taekilNotice, setTaekilNotice] = useState<string | null>(null);
  const [taekilResults, setTaekilResults] = useState<TaekilResultItem[]>([]);
  const [selectedTaekilDate, setSelectedTaekilDate] = useState<string | null>(null);

  const [spouseName, setSpouseName] = useState('');
  const [spouseGender, setSpouseGender] = useState<'M' | 'F'>('M');
  const [spouseBirthYear, setSpouseBirthYear] = useState('');
  const [spouseBirthMonth, setSpouseBirthMonth] = useState('');
  const [spouseBirthDay, setSpouseBirthDay] = useState('');
  const [spouseBirthHour, setSpouseBirthHour] = useState('12');
  const [spouseBirthMinute, setSpouseBirthMinute] = useState('0');
  const [spouseCalendarType, setSpouseCalendarType] = useState<'solar' | 'lunar'>('lunar');
  const [spouseUnknownTime, setSpouseUnknownTime] = useState(false);

  const [preferredWeekday1, setPreferredWeekday1] = useState('6');
  const [preferredWeekday2, setPreferredWeekday2] = useState('0');
  const [preferredWeekday3, setPreferredWeekday3] = useState('5');
  const [avoidDateInputs, setAvoidDateInputs] = useState<string[]>(['', '', '', '', '']);

  const [moveFamilyBirthDates, setMoveFamilyBirthDates] = useState<string[]>(['', '', '', '', '']);
  const [moveCurrentAddress, setMoveCurrentAddress] = useState('');
  const [moveTargetAddress, setMoveTargetAddress] = useState('');
  const [movePeriodStart, setMovePeriodStart] = useState(() => getSeoulTodayYmd());
  const [movePeriodEnd, setMovePeriodEnd] = useState(() => getSeoulMonthEndYmdOffset(2));
  const [movePreferredWeekday1, setMovePreferredWeekday1] = useState('6');
  const [movePreferredWeekday2, setMovePreferredWeekday2] = useState('0');
  const [movePreferredWeekday3, setMovePreferredWeekday3] = useState('5');
  const [movePriority, setMovePriority] = useState<'folklore' | 'saju' | 'balanced'>('balanced');
  const [moveOnlyWeekend, setMoveOnlyWeekend] = useState(false);

  const [childFatherBirthDate, setChildFatherBirthDate] = useState('');
  const [childFatherBirthTime, setChildFatherBirthTime] = useState('12:00');
  const [childMotherBirthDate, setChildMotherBirthDate] = useState('');
  const [childMotherBirthTime, setChildMotherBirthTime] = useState('12:00');
  const [childFetusGender, setChildFetusGender] = useState<'남' | '여'>('남');
  const [childbirthPeriodStart, setChildbirthPeriodStart] = useState(() => getSeoulTodayYmd());
  const [childbirthPeriodEnd, setChildbirthPeriodEnd] = useState(() => getSeoulMonthEndYmdOffset(1));

  const [generalPeriodStart, setGeneralPeriodStart] = useState(() => getSeoulTodayYmd());
  const [generalPeriodEnd, setGeneralPeriodEnd] = useState(() => getSeoulMonthEndYmdOffset(2));
  const [generalPreferredWeekday1, setGeneralPreferredWeekday1] = useState('6');
  const [generalPreferredWeekday2, setGeneralPreferredWeekday2] = useState('0');
  const [generalPreferredWeekday3, setGeneralPreferredWeekday3] = useState('5');
  const [generalAvoidDateInputs, setGeneralAvoidDateInputs] = useState<string[]>(['', '', '', '', '']);
  const [taekilAdditionalInfo, setTaekilAdditionalInfo] = useState('');
  const [taekilFormValues, setTaekilFormValues] = useState<Record<string, string>>({});

  const setTaekilFormValue = (key: string, value: string) => {
    setTaekilFormValues((prev) => ({ ...prev, [key]: value }));
  };

  const taekilActiveFields = useMemo(() => {
    return taekilActiveCategory === '결혼'
      ? []
      : categoryFormFields[taekilActiveCategory as Exclude<TaekilCategory, '결혼'>];
  }, [taekilActiveCategory, categoryFormFields]);

  const taekilPreviewItems = useMemo(() => {
    return taekilActiveCategory === '결혼'
      ? [
          spouseName ? `배우자: ${spouseName}` : '',
          spouseBirthYear ? `출생: ${spouseBirthYear}-${spouseBirthMonth || 'MM'}-${spouseBirthDay || 'DD'}` : '',
          spouseUnknownTime ? '생시 미상' : `출생시각: ${spouseBirthHour}:${String(spouseBirthMinute).padStart(2, '0')}`
        ].filter(Boolean)
      : taekilActiveFields
          .map((field) => taekilFormValues[field.key] ? `${field.label}: ${taekilFormValues[field.key]}` : '')
          .filter(Boolean)
          .slice(0, 3);
  }, [
    taekilActiveCategory,
    spouseName,
    spouseBirthYear,
    spouseBirthMonth,
    spouseBirthDay,
    spouseUnknownTime,
    spouseBirthHour,
    spouseBirthMinute,
    taekilActiveFields,
    taekilFormValues
  ]);

  return {
    taekilActiveCategory,
    setTaekilActiveCategory,
    taekilStartMonth,
    setTaekilStartMonth,
    taekilEndMonth,
    setTaekilEndMonth,
    marriagePeriodStart,
    setMarriagePeriodStart,
    marriagePeriodEnd,
    setMarriagePeriodEnd,
    taekilLoading,
    setTaekilLoading,
    taekilError,
    setTaekilError,
    taekilNotice,
    setTaekilNotice,
    taekilResults,
    setTaekilResults,
    selectedTaekilDate,
    setSelectedTaekilDate,
    spouseName,
    setSpouseName,
    spouseGender,
    setSpouseGender,
    spouseBirthYear,
    setSpouseBirthYear,
    spouseBirthMonth,
    setSpouseBirthMonth,
    spouseBirthDay,
    setSpouseBirthDay,
    spouseBirthHour,
    setSpouseBirthHour,
    spouseBirthMinute,
    setSpouseBirthMinute,
    spouseCalendarType,
    setSpouseCalendarType,
    spouseUnknownTime,
    setSpouseUnknownTime,
    preferredWeekday1,
    setPreferredWeekday1,
    preferredWeekday2,
    setPreferredWeekday2,
    preferredWeekday3,
    setPreferredWeekday3,
    avoidDateInputs,
    setAvoidDateInputs,
    moveFamilyBirthDates,
    setMoveFamilyBirthDates,
    moveCurrentAddress,
    setMoveCurrentAddress,
    moveTargetAddress,
    setMoveTargetAddress,
    movePeriodStart,
    setMovePeriodStart,
    movePeriodEnd,
    setMovePeriodEnd,
    movePreferredWeekday1,
    setMovePreferredWeekday1,
    movePreferredWeekday2,
    setMovePreferredWeekday2,
    movePreferredWeekday3,
    setMovePreferredWeekday3,
    movePriority,
    setMovePriority,
    moveOnlyWeekend,
    setMoveOnlyWeekend,
    childFatherBirthDate,
    setChildFatherBirthDate,
    childFatherBirthTime,
    setChildFatherBirthTime,
    childMotherBirthDate,
    setChildMotherBirthDate,
    childMotherBirthTime,
    setChildMotherBirthTime,
    childFetusGender,
    setChildFetusGender,
    childbirthPeriodStart,
    setChildbirthPeriodStart,
    childbirthPeriodEnd,
    setChildbirthPeriodEnd,
    generalPeriodStart,
    setGeneralPeriodStart,
    generalPeriodEnd,
    setGeneralPeriodEnd,
    generalPreferredWeekday1,
    setGeneralPreferredWeekday1,
    generalPreferredWeekday2,
    setGeneralPreferredWeekday2,
    generalPreferredWeekday3,
    setGeneralPreferredWeekday3,
    generalAvoidDateInputs,
    setGeneralAvoidDateInputs,
    taekilAdditionalInfo,
    setTaekilAdditionalInfo,
    taekilFormValues,
    setTaekilFormValues,
    setTaekilFormValue,
    taekilActiveFields,
    taekilPreviewItems
  };
};
