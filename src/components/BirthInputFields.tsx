import type { UserData } from '../types/app';

/**
 * 생년월일시 공용 입력 필드 — 랜딩 무료운세 입력 폼(WelcomeTab)에서 추출.
 * 랜딩과 리포트 구매(CheckoutTab)가 동일한 UI·데이터 모델(UserData)을 공유한다.
 * 한 번 입력한 생년월일시는 App의 userData 단일 소스로 상담·만세력·구매 전반에 재사용된다.
 *
 * 이름·개인정보 동의는 여기 포함하지 않는다(맥락별로 다름 — 호출부 책임).
 */
export function BirthInputFields({
  value,
  onChange,
  disabled = false,
  currentSeoulYear,
}: {
  value: UserData;
  onChange: (u: UserData) => void;
  disabled?: boolean;
  currentSeoulYear: number;
}) {
  const set = (patch: Partial<UserData>) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-bold ml-1 text-ink-500">년도</label>
            <select
              value={value.birthYear}
              disabled={disabled}
              onChange={(e) => set({ birthYear: e.target.value })}
              className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
            >
              {Array.from({ length: 100 }, (_, i) => currentSeoulYear - i).map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold ml-1 text-ink-500">월</label>
            <select
              value={value.birthMonth}
              disabled={disabled}
              onChange={(e) => set({ birthMonth: e.target.value })}
              className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}월
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold ml-1 text-ink-500">일</label>
            <select
              value={value.birthDay}
              disabled={disabled}
              onChange={(e) => set({ birthDay: e.target.value })}
              className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}일
                </option>
              ))}
            </select>
          </div>
        </div>

        {!value.unknownTime && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold ml-1 text-ink-500">시</label>
              <select
                value={value.birthHour}
                disabled={disabled}
                onChange={(e) => set({ birthHour: e.target.value })}
                className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
              >
                {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                  <option key={h} value={h}>
                    {h}시
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold ml-1 text-ink-500">분</label>
              <select
                value={value.birthMinute}
                disabled={disabled}
                onChange={(e) => set({ birthMinute: e.target.value })}
                className="w-full px-2 py-2.5 min-h-[44px] rounded-xl border border-ink-300/40 bg-paper-50/80 text-[13px] outline-none text-ink-900"
              >
                {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                  <option key={m} value={m}>
                    {m}분
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 ml-1">
          <input
            type="checkbox"
            id="birthFieldsUnknownTime"
            disabled={disabled}
            checked={value.unknownTime}
            onChange={(e) => set({ unknownTime: e.target.checked })}
            className="w-4 h-4 rounded border-ink-500 text-ink-900 focus:ring-ink-500"
          />
          <label htmlFor="birthFieldsUnknownTime" className="text-[13px] font-medium text-ink-500">
            생시를 몰라요
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between p-2 rounded-2xl bg-paper-100/60 border border-ink-300/30">
          <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
            <button
              onClick={() => set({ calendarType: 'solar' })}
              disabled={disabled}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                value.calendarType === 'solar' ? 'bg-ink-900 text-paper-50 shadow-md' : 'text-ink-500'
              }`}
            >
              양력
            </button>
            <button
              onClick={() => set({ calendarType: 'lunar' })}
              disabled={disabled}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                value.calendarType === 'lunar' ? 'bg-ink-900 text-paper-50 shadow-md' : 'text-ink-500'
              }`}
            >
              음력(평)
            </button>
            <button
              onClick={() => set({ calendarType: 'leap' })}
              disabled={disabled}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                value.calendarType === 'leap' ? 'bg-ink-900 text-paper-50 shadow-md' : 'text-ink-500'
              }`}
            >
              음력(윤)
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between p-2 rounded-2xl bg-paper-100/60 border border-ink-300/30">
          <div className="flex items-center gap-1.5 p-1 rounded-xl w-full">
            <button
              onClick={() => set({ gender: 'M' })}
              disabled={disabled}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                value.gender === 'M' ? 'bg-ink-900 text-paper-50 shadow-md' : 'text-ink-500'
              }`}
            >
              남자
            </button>
            <button
              onClick={() => set({ gender: 'F' })}
              disabled={disabled}
              className={`flex-1 py-2 min-h-[44px] rounded-lg text-[11px] font-bold transition-all ${
                value.gender === 'F' ? 'bg-ink-900 text-paper-50 shadow-md' : 'text-ink-500'
              }`}
            >
              여자
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** UserData → 생성 파이프(BirthFormInput) 변환에 쓰는 날짜/시각 문자열. */
export function userDataToBirthStrings(u: UserData): { dateStr: string; timeStr: string } {
  const p = (s: string) => s.padStart(2, '0');
  return {
    dateStr: `${u.birthYear}-${p(u.birthMonth)}-${p(u.birthDay)}`,
    timeStr: `${p(u.birthHour)}:${p(u.birthMinute)}`,
  };
}
