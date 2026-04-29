import React from 'react';
import { TaekilTab } from './TaekilTab';
import { TAEKIL_CATEGORIES, WEEKDAY_OPTIONS } from '../../constants/taekil';
import {
  TAEKIL_SECTION_CARD_CLASS,
  TAEKIL_Q_BADGE_CLASS,
  TAEKIL_LABEL_CLASS,
  TAEKIL_HELP_TEXT_CLASS,
  TAEKIL_FIELD_CLASS,
  TAEKIL_FIELD_PLACEHOLDER_CLASS,
  GLASS_TAB_BG_CLASS,
  TAB_TRANSITION,
} from '../../constants/styles';
import type { useTaekilTabState } from '../../hooks/useTaekilTabState';
import type { TaekilResultItem } from '../../types/app';

interface TaekilTabContentProps {
  taekil: ReturnType<typeof useTaekilTabState>;
  onGenerate: () => void | Promise<void>;
}

export const TaekilTabContent: React.FC<TaekilTabContentProps> = ({ taekil, onGenerate }) => {
  const {
    taekilActiveCategory,
    setTaekilActiveCategory,
    marriagePeriodStart,
    setMarriagePeriodStart,
    marriagePeriodEnd,
    setMarriagePeriodEnd,
    taekilLoading,
    taekilError,
    setTaekilError,
    taekilNotice,
    setTaekilNotice,
    taekilResults,
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
    setTaekilFormValue,
    taekilActiveFields,
  } = taekil;

  const selectedTaekilDetail = taekilResults.find((item) => item.date === selectedTaekilDate) ?? null;
  const taekilDisplayResults = taekilActiveCategory === '출산'
    ? taekilResults.slice(0, 3)
    : taekilResults;

  const getChildbirthProfileSummary = (item: TaekilResultItem) => {
    const mergedReason = item.reasons.join(' ');
    const topTime = item.topTimeSlots?.[0]?.time || '미정';

    const hasInsung = mergedReason.includes('인성');
    const hasGwansung = mergedReason.includes('관성');
    const hasSiksang = mergedReason.includes('식신') || mergedReason.includes('식상');
    const hasJaeseong = mergedReason.includes('재성');
    const hasYongshin = mergedReason.includes('용신');
    const hasConflictNote = mergedReason.includes('충') || mergedReason.includes('형') || mergedReason.includes('파') || mergedReason.includes('해');

    const month = Number(item.date.split('-')[1] || '0');
    const hour = Number(topTime.split(':')[0] || '12');
    const coolTime = hour <= 7 || hour >= 21;
    const warmSeason = month >= 5 && month <= 9;
    const seasonTag = warmSeason ? '화기 편중 구간' : '한습 구간';
    const jowhuTag = warmSeason
      ? (coolTime ? '수기 보완형 조후' : '화기 유지형 조후')
      : (coolTime ? '한습 보강형 조후' : '온기 보완형 조후');

    const personality = hasInsung && hasGwansung
      ? '성격: 관인상생 구조가 살아 있어 규범의식, 집중력, 학습 흡수력이 안정적으로 발현될 가능성이 큽니다.'
      : hasSiksang
        ? '성격: 식상 발현이 도와 표현력과 창의 반응성이 빠르며, 대인 소통에서 유연한 성향이 강화될 수 있습니다.'
        : '성격: 일간 균형이 과도하게 치우치지 않는 중화형 흐름으로, 정서 기복이 완만한 안정 성향이 예상됩니다.';

    const career = hasGwansung
      ? `진로: 관성 축이 견고해 제도·전문성 기반 트랙(의학/법학/공공/연구)과의 정합성이 좋습니다. (주요 시진 ${topTime})`
      : hasJaeseong
        ? `진로: 재성 운용력이 살아 실무·운영·기획 계열에서 성과 전환력이 유리한 편입니다. (주요 시진 ${topTime})`
        : hasInsung
          ? `진로: 인성 기반의 축적형 성장(학업-자격-전문직)으로 초년/중년 대운의 희신 활용 폭이 넓습니다. (주요 시진 ${topTime})`
          : `진로: 특정 십성 과잉 없이 균형 분포에 가까워, 초년에는 탐색형·중년에는 전문화형 경로가 무난합니다. (주요 시진 ${topTime})`;

    const health = hasYongshin
      ? `건강운: 용희신 보강 신호가 확인되며 ${seasonTag}에서 ${jowhuTag}가 성립해 성장기 체력 리듬이 안정될 가능성이 높습니다.`
      : `건강운: ${seasonTag} 기준 ${jowhuTag}를 목표로 한 시진 배치입니다. 생활 리듬 관리 시 체질 편중 리스크를 낮추는 데 유리합니다.`;

    const caution = hasConflictNote
      ? '보완 포인트: 부모 명식과의 충형 신호가 일부 언급되어 초년 환경(수면/양육 리듬)을 보수적으로 설계하는 것이 유리합니다.'
      : '보완 포인트: 부모 명식과의 강한 충형 신호가 두드러지지 않아, 가정 내 양육 리듬의 합치도를 확보하기 좋은 편입니다.';

    return { personality, career, health, caution };
  };

  return (
    <TaekilTab tabTransition={TAB_TRANSITION} glassTabBgClass={GLASS_TAB_BG_CLASS}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
        <div className="absolute -left-10 top-10 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl" />
        <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-indigo-300/25 blur-3xl" />
      </div>
      <div className="relative z-10 max-w-7xl mx-auto pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 items-start">
          <aside className={`rounded-[2rem] border border-white/60 p-4 md:p-5 lg:sticky lg:top-6 bg-white/55 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}>
            <div className="mb-4 px-2">
              <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-600`}>카테고리</p>
              <p className={TAEKIL_HELP_TEXT_CLASS}>10개 카테고리 모두 조회 가능합니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {TAEKIL_CATEGORIES.map((category) => {
                const enabled = true;
                const isActive = taekilActiveCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    disabled={!enabled}
                    onClick={() => {
                      if (!enabled) return;
                      setTaekilActiveCategory(category);
                      setTaekilError(null);
                      setTaekilNotice(null);
                    }}
                    className={`w-full min-h-[44px] rounded-2xl border px-4 py-3 text-left text-[13px] font-bold transition-all ${
                      isActive
                        ? 'bg-indigo-500/15 border-indigo-300 text-indigo-700 shadow-lg shadow-indigo-300/20'
                        : enabled
                          ? 'bg-white/60 border-white/65 text-zinc-700 hover:border-indigo-200 hover:text-indigo-600'
                          : 'bg-zinc-100/70 border-zinc-200 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className={`rounded-[2rem] border border-white/60 p-4 md:p-8 bg-white/55 backdrop-blur-xl shadow-2xl shadow-indigo-200/20`}>
            <div className="mb-6 md:mb-8">
              <p className={`text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500`}>
                {taekilActiveCategory === '이사' ? 'Moving Taekil' : 'Marriage Taekil'}
              </p>
              <h2 className="mt-2 text-2xl md:text-4xl font-bold tracking-tight">{taekilActiveCategory} 택일</h2>
              <p className={`mt-3 text-[13px] md:text-base text-zinc-600`}>
                프로세스 Q1-Q4를 입력한 뒤 {taekilActiveCategory} 길일 조회를 실행하세요.
              </p>
            </div>

            <div className="space-y-4 md:space-y-5">
              {taekilActiveCategory === '결혼' ? (
                <>
                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                      <h3 className="text-[16px] font-bold leading-tight">배우자의 생년월일시는 언제 입니까?</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>배우자 이름</span>
                        <input type="text" value={spouseName} onChange={(e) => setSpouseName(e.target.value)} placeholder="이름 입력" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>성별</span>
                        <select value={spouseGender} onChange={(e) => setSpouseGender(e.target.value as 'M' | 'F')} className={TAEKIL_FIELD_CLASS}>
                          <option value="M">남성</option>
                          <option value="F">여성</option>
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>출생 연도</span>
                        <input type="text" value={spouseBirthYear} onChange={(e) => setSpouseBirthYear(e.target.value)} placeholder="1990" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                      </label>
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <label className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>월</span>
                          <input type="text" value={spouseBirthMonth} onChange={(e) => setSpouseBirthMonth(e.target.value)} placeholder="1" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                        </label>
                        <label className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>일</span>
                          <input type="text" value={spouseBirthDay} onChange={(e) => setSpouseBirthDay(e.target.value)} placeholder="1" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <label className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>시</span>
                          <input type="text" value={spouseBirthHour} onChange={(e) => setSpouseBirthHour(e.target.value)} placeholder="12" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                        </label>
                        <label className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>분</span>
                          <input type="text" value={spouseBirthMinute} onChange={(e) => setSpouseBirthMinute(e.target.value)} placeholder="0" className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                        </label>
                      </div>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>달력 기준</span>
                        <select value={spouseCalendarType} onChange={(e) => setSpouseCalendarType(e.target.value as 'solar' | 'lunar')} className={TAEKIL_FIELD_CLASS}>
                          <option value="solar">양력</option>
                          <option value="lunar">음력</option>
                        </select>
                      </label>
                      <label className={`flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/65 px-4 py-3 cursor-pointer bg-white/70 text-zinc-700 backdrop-blur`}>
                        <input type="checkbox" checked={spouseUnknownTime} onChange={(e) => setSpouseUnknownTime(e.target.checked)} />
                        <span className="text-[13px] font-medium">생시 미상</span>
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                      <h3 className="text-[16px] font-bold leading-tight">희망하는 결혼식 일정은 언제부터 언제까지 인가요?</h3>
                    </div>
                    <p className={TAEKIL_HELP_TEXT_CLASS}>형식: YYYY-MM-DD</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                        <input type="date" value={marriagePeriodStart} onChange={(e) => setMarriagePeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                        <input type="date" value={marriagePeriodEnd} onChange={(e) => setMarriagePeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                      <h3 className="text-[16px] font-bold leading-tight">희망하는 요일은 언제 인가요? 3순위까지 입력하세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                        <select value={preferredWeekday1} onChange={(e) => setPreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`w1-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                        <select value={preferredWeekday2} onChange={(e) => setPreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`w2-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                        <select value={preferredWeekday3} onChange={(e) => setPreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`w3-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                      <h3 className="text-[16px] font-bold leading-tight">꼭 피해야 하는 날을 입력해 주세요. (최대 5개)</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {avoidDateInputs.map((value, idx) => (
                        <label key={`avoid-date-${idx}`} className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>회피일 {idx + 1}</span>
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setAvoidDateInputs((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                            className={TAEKIL_FIELD_CLASS}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : taekilActiveCategory === '이사' ? (
                <>
                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                      <h3 className="text-[16px] font-bold leading-tight">가구주 및 가족 생년월일을 입력해 주세요.</h3>
                    </div>
                    <p className={TAEKIL_HELP_TEXT_CLASS}>가구주 정보는 상단 기본 사주를 사용하며, 가족은 양력 YYYY-MM-DD 기준으로 입력합니다. 가족 정보는 비워도 조회 가능합니다.</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {moveFamilyBirthDates.map((value, idx) => (
                        <label key={`move-family-${idx}`} className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>가족 구성원 {idx + 1}</span>
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setMoveFamilyBirthDates((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                            className={TAEKIL_FIELD_CLASS}
                          />
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                      <h3 className="text-[16px] font-bold leading-tight">현재 거주지와 이사 갈 주소를 입력해 주세요.</h3>
                    </div>
                    <p className={TAEKIL_HELP_TEXT_CLASS}>예: 역삼동, 정자동처럼 동 단위까지만 입력해도 조회 가능합니다.</p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>현재 주소</span>
                        <input type="text" value={moveCurrentAddress} onChange={(e) => setMoveCurrentAddress(e.target.value)} placeholder="예: 서울시 강남구 ..." className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>이사 갈 주소</span>
                        <input type="text" value={moveTargetAddress} onChange={(e) => setMoveTargetAddress(e.target.value)} placeholder="예: 경기도 성남시 ..." className={TAEKIL_FIELD_PLACEHOLDER_CLASS} />
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                      <h3 className="text-[16px] font-bold leading-tight">희망 이사 기간과 선호 요일을 입력해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                        <input type="date" value={movePeriodStart} onChange={(e) => setMovePeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                        <input type="date" value={movePeriodEnd} onChange={(e) => setMovePeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                        <select value={movePreferredWeekday1} onChange={(e) => setMovePreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`mw1-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                        <select value={movePreferredWeekday2} onChange={(e) => setMovePreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`mw2-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                        <select value={movePreferredWeekday3} onChange={(e) => setMovePreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`mw3-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                      <h3 className="text-[16px] font-bold leading-tight">무엇을 더 중시할지 선택해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>중요도 설정</span>
                        <select value={movePriority} onChange={(e) => setMovePriority(e.target.value as 'folklore' | 'saju' | 'balanced')} className={TAEKIL_FIELD_CLASS}>
                          <option value="balanced">균형형(민속+사주)</option>
                          <option value="folklore">손없는날/민속 우선</option>
                          <option value="saju">사주 맞춤 우선</option>
                        </select>
                      </label>
                      <label className={`flex min-h-[44px] items-center gap-3 rounded-2xl border border-white/65 px-4 py-3 mt-6 md:mt-0 cursor-pointer bg-white/70 text-zinc-700 backdrop-blur`}>
                        <input type="checkbox" checked={moveOnlyWeekend} onChange={(e) => setMoveOnlyWeekend(e.target.checked)} />
                        <span className="text-[13px] font-medium">주말만 가능</span>
                      </label>
                    </div>
                  </div>
                </>
              ) : taekilActiveCategory === '출산' ? (
                <>
                  <div className={`rounded-3xl border border-indigo-300/40 p-4 md:p-6 bg-white/60 backdrop-blur-xl shadow-xl shadow-indigo-200/20`}>
                    <p className={`text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-700`}>출산 택일 프롬프트</p>
                    <p className={`mt-2 text-[13px] leading-relaxed text-zinc-700`}>
                      "당신은 사주팔자를 설계하는 명리학 대가입니다. 아래 조건에 맞는 최상의 출산 택일을 수행하세요."
                    </p>
                    <ul className={`mt-3 text-[11px] space-y-1 text-zinc-600`}>
                      <li>1순위: 오행 중화 및 조후 적합</li>
                      <li>2순위: 초년/중년 대운 희신 방향</li>
                      <li>3순위: 부모와 원진/충 회피</li>
                    </ul>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                      <h3 className="text-[16px] font-bold leading-tight">부모 데이터 (생년월일시)</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>부 생년월일</span>
                        <input type="date" value={childFatherBirthDate} onChange={(e) => setChildFatherBirthDate(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>부 출생시각 (HH:mm)</span>
                        <input type="time" value={childFatherBirthTime} onChange={(e) => setChildFatherBirthTime(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>모 생년월일</span>
                        <input type="date" value={childMotherBirthDate} onChange={(e) => setChildMotherBirthDate(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>모 출생시각 (HH:mm)</span>
                        <input type="time" value={childMotherBirthTime} onChange={(e) => setChildMotherBirthTime(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                      <h3 className="text-[16px] font-bold leading-tight">태아 데이터</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>태아 성별</span>
                        <select value={childFetusGender} onChange={(e) => setChildFetusGender(e.target.value as '남' | '여')} className={TAEKIL_FIELD_CLASS}>
                          <option value="남">남</option>
                          <option value="여">여</option>
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                      <h3 className="text-[16px] font-bold leading-tight">분만 가능일</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                        <input type="date" value={childbirthPeriodStart} onChange={(e) => setChildbirthPeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                        <input type="date" value={childbirthPeriodEnd} onChange={(e) => setChildbirthPeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                      <h3 className="text-[16px] font-bold leading-tight">결과 형식</h3>
                    </div>
                    <p className={`mt-2 text-[13px] leading-relaxed text-zinc-600`}>
                      추천 날짜/시진 3안, 각 안의 성격·진로·건강운 요약을 기준으로 해석합니다.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q1</p>
                      <h3 className="text-[16px] font-bold leading-tight">희망 기간을 입력해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>시작일</span>
                        <input type="date" value={generalPeriodStart} onChange={(e) => setGeneralPeriodStart(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>종료일</span>
                        <input type="date" value={generalPeriodEnd} onChange={(e) => setGeneralPeriodEnd(e.target.value)} className={TAEKIL_FIELD_CLASS} />
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q2</p>
                      <h3 className="text-[16px] font-bold leading-tight">{taekilActiveCategory}에 필요한 핵심 정보를 입력해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {taekilActiveFields.map((field) => (
                        <label key={`${taekilActiveCategory}-${field.key}`} className={`space-y-2 ${field.key.endsWith('Priority') ? 'md:col-span-2' : ''}`}>
                          <span className={TAEKIL_LABEL_CLASS}>{field.label}</span>
                          {field.type === 'select' ? (
                            <select
                              value={taekilFormValues[field.key] ?? ''}
                              onChange={(e) => setTaekilFormValue(field.key, e.target.value)}
                              className={TAEKIL_FIELD_CLASS}
                            >
                              <option value="">선택하세요</option>
                              {field.options?.map((option) => (
                                <option key={`${field.key}-${option.value}`} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={taekilFormValues[field.key] ?? ''}
                              onChange={(e) => setTaekilFormValue(field.key, e.target.value)}
                              placeholder={field.placeholder}
                              className={TAEKIL_FIELD_PLACEHOLDER_CLASS}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q3</p>
                      <h3 className="text-[16px] font-bold leading-tight">희망 요일 우선순위를 입력해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>1순위</span>
                        <select value={generalPreferredWeekday1} onChange={(e) => setGeneralPreferredWeekday1(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`gw1-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>2순위</span>
                        <select value={generalPreferredWeekday2} onChange={(e) => setGeneralPreferredWeekday2(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`gw2-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className={TAEKIL_LABEL_CLASS}>3순위</span>
                        <select value={generalPreferredWeekday3} onChange={(e) => setGeneralPreferredWeekday3(e.target.value)} className={TAEKIL_FIELD_CLASS}>
                          {WEEKDAY_OPTIONS.map((option) => <option key={`gw3-${option.value}`} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={TAEKIL_SECTION_CARD_CLASS}>
                    <div className="flex items-center gap-2 min-h-[28px]">
                      <p className={TAEKIL_Q_BADGE_CLASS}>Q4</p>
                      <h3 className="text-[16px] font-bold leading-tight">피해야 할 날(선택)과 추가 메모를 입력해 주세요.</h3>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      {generalAvoidDateInputs.map((value, idx) => (
                        <label key={`generic-avoid-date-${idx}`} className="space-y-2">
                          <span className={TAEKIL_LABEL_CLASS}>회피일 {idx + 1}</span>
                          <input
                            type="date"
                            value={value}
                            onChange={(e) => setGeneralAvoidDateInputs((prev) => prev.map((item, i) => (i === idx ? e.target.value : item)))}
                            className={TAEKIL_FIELD_CLASS}
                          />
                        </label>
                      ))}
                    </div>
                    <label className="space-y-2 block mt-4">
                      <span className={TAEKIL_LABEL_CLASS}>추가 메모 (선택)</span>
                      <textarea
                        value={taekilAdditionalInfo}
                        onChange={(e) => setTaekilAdditionalInfo(e.target.value)}
                        rows={3}
                        placeholder="예: 오전 일정 선호, 서류 확인이 중요한 날 선호, 가족 이동 동선 최소화"
                        className={`${TAEKIL_FIELD_PLACEHOLDER_CLASS} resize-none`}
                      />
                    </label>
                  </div>
                </>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={onGenerate}
                  disabled={taekilLoading}
                  className={`w-full md:w-auto min-h-[44px] px-6 py-3 rounded-2xl text-white text-[13px] font-bold transition-all bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 ${taekilLoading ? 'opacity-60 cursor-wait' : ''}`}
                >
                  {taekilLoading ? '계산 중...' : `${taekilActiveCategory} 길일 조회`}
                </button>
              </div>

              {taekilNotice && (
                <div className={`rounded-2xl border border-sky-300/45 px-4 py-3 text-[13px] bg-sky-100/55 backdrop-blur text-sky-700`}>
                  {taekilNotice}
                </div>
              )}

              {taekilError && (
                <div className={`rounded-2xl border border-rose-300/45 px-4 py-3 text-[13px] bg-rose-100/55 backdrop-blur text-rose-700`}>
                  {taekilError}
                </div>
              )}

              {taekilDisplayResults.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base md:text-[16px] font-bold">
                      {taekilActiveCategory === '출산' ? '출산 택일 추천 3안' : `${taekilActiveCategory} 택일 추천`}
                    </h4>
                    <span className={`text-[11px] font-bold px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-700 border border-indigo-300/50`}>
                      {taekilDisplayResults.length}개
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    {taekilDisplayResults.map((item, index) => (
                      (() => {
                        const profileSummary = taekilActiveCategory === '출산'
                          ? getChildbirthProfileSummary(item)
                          : null;

                        return (
                          <button
                            key={`${item.date}-${index}`}
                            type="button"
                            onClick={() => setSelectedTaekilDate(item.date)}
                            className={`rounded-2xl border p-4 text-left transition-all backdrop-blur ${selectedTaekilDate === item.date ? ('bg-indigo-500/15 border-indigo-300 shadow-lg shadow-indigo-200/20') : ('bg-white/65 border-white/65 hover:border-indigo-200')}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-[13px] font-bold">{index + 1}안 · {item.date}</p>
                                <p className={TAEKIL_HELP_TEXT_CLASS}>
                                  추천 시진: {item.topTimeSlots?.[0]?.time || '산출 없음'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 space-y-1.5">
                              {item.reasons.slice(0, 2).map((reason, reasonIdx) => (
                                <p key={`${item.date}-reason-${reasonIdx}`} className={`text-[11px] leading-relaxed text-zinc-600`}>
                                  {reason}
                                </p>
                              ))}
                              {profileSummary && (
                                <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-white/65 bg-white/70 backdrop-blur`}>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.personality}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.career}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-700`}>{profileSummary.health}</p>
                                  <p className={`text-[11px] leading-relaxed text-zinc-600`}>{profileSummary.caution}</p>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })()
                    ))}
                  </div>

                  {selectedTaekilDetail && (
                    (() => {
                      const detailProfileSummary = taekilActiveCategory === '출산'
                        ? getChildbirthProfileSummary(selectedTaekilDetail)
                        : null;

                      return (
                        <div className={`rounded-2xl border border-white/65 p-4 bg-white/65 backdrop-blur-xl shadow-lg shadow-indigo-200/20`}>
                          <p className="text-[13px] font-bold">선택 후보: {selectedTaekilDetail.date}</p>
                          <div className="mt-2 space-y-1.5">
                            {selectedTaekilDetail.reasons.slice(0, 4).map((reason, idx) => (
                              <p key={`detail-reason-${idx}`} className={`text-[11px] leading-relaxed text-zinc-600`}>
                                {reason}
                              </p>
                            ))}
                            {detailProfileSummary && (
                              <div className={`mt-2 rounded-xl border px-3 py-2 space-y-1 border-white/65 bg-white/75 backdrop-blur`}>
                                <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.personality}</p>
                                <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.career}</p>
                                <p className={`text-[11px] leading-relaxed text-zinc-700`}>{detailProfileSummary.health}</p>
                                <p className={`text-[11px] leading-relaxed text-zinc-600`}>{detailProfileSummary.caution}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </TaekilTab>
  );
};
