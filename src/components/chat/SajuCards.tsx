import React from 'react';
import type {
  SajuCardPayload,
  MyeongsikCardPayload,
  WealthCardPayload,
  DaeunCardPayload,
  PeriodCardPayload,
  CareerCardPayload,
  LoveCardPayload,
  HealthCardPayload,
  RelationsCardPayload,
  DeityPlacement,
} from '../../lib/chatDataSelectors';
import type { ChatOption } from '../../hooks/useChatTabState';

/**
 * 챗봇 카드 렌더러.
 * 만세력 엔진이 계산한 값(payload)을 그대로 표시한다 — LLM 출력을 파싱하지 않으므로
 * 간지·수치가 틀릴 수 없다. 디자인 원칙: 본문 14px / 보조 12px, 장식 최소.
 */

const CARD_SHELL =
  'w-full max-w-[96%] md:max-w-[92%] rounded-2xl rounded-tl-none border border-ink-300/30 bg-paper-50/80 p-4 md:p-5 shadow-sm';
const CARD_TITLE = 'text-[12px] font-bold text-ink-500 mb-3';

/** 십성 배치 목록(관성/인성/재성/비겁 등)을 공통 렌더. */
const PlacementList: React.FC<{ label: string; items: DeityPlacement[]; emptyText?: string }> = ({
  label,
  items,
  emptyText = '드러난 자리 없음',
}) => (
  <div>
    <div className="text-[12px] text-ink-500 mb-1">{label}</div>
    {items.length > 0 ? (
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-baseline gap-2 text-[14px] text-ink-800">
            <span className="font-bold text-ink-900">{s.label}</span>
            <span className="text-[12px] text-ink-500">{s.position}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-[14px] text-ink-700">{emptyText}</p>
    )}
  </div>
);

const MyeongsikCard: React.FC<{ card: MyeongsikCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>명식</div>
    <div className="grid grid-cols-4 gap-2 text-center">
      {card.pillars.map((p) => (
        <div key={p.title} className="space-y-1">
          <div className="text-[12px] text-ink-400">{p.title}</div>
          <div className="text-[14px] font-bold text-ink-900 leading-tight">
            {p.stemHangul}
            <span className="text-ink-400">({p.stemHanja})</span>
          </div>
          <div className="text-[14px] font-bold text-ink-900 leading-tight">
            {p.branchHangul}
            <span className="text-ink-400">({p.branchHanja})</span>
          </div>
          <div className="text-[12px] text-ink-500 leading-tight">
            {p.stemDeity || '—'} / {p.branchDeity || '—'}
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 pt-3 border-t border-ink-300/25 text-[14px] text-ink-700">
      일간 {card.dayMasterHangul}
      {card.dayMasterHanja ? `(${card.dayMasterHanja})` : ''}
      {card.yongshin ? ` · 용신 ${card.yongshin}` : ''}
      {card.strength ? ` · ${card.strength}` : ''}
    </div>
  </div>
);

const WealthCard: React.FC<{ card: WealthCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>재물 구조</div>
    {card.stars.length > 0 ? (
      <ul className="space-y-1.5">
        {card.stars.map((s, i) => (
          <li key={`${s.label}-${i}`} className="flex items-baseline gap-2 text-[14px] text-ink-800">
            <span className="font-bold text-ink-900">{s.label}</span>
            <span className="text-[12px] text-ink-500">{s.position}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-[14px] text-ink-700">
        천간·지지에 드러난 재성(정재·편재)은 없습니다. 지장간에 잠복해 있을 수 있어요.
      </p>
    )}
    {card.yongshin && (
      <div className="mt-3 pt-3 border-t border-ink-300/25 text-[12px] text-ink-500">
        용신 {card.yongshin}
      </div>
    )}
  </div>
);

const DaeunCard: React.FC<{ card: DaeunCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>대운 흐름</div>
    <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
      {card.steps.map((s) => (
        <div
          key={s.startAge}
          className={`shrink-0 w-[72px] rounded-xl border px-2 py-2 text-center ${
            s.isCurrent ? 'border-ink-700/50 bg-paper-100/80' : 'border-ink-300/30 bg-transparent'
          }`}
        >
          <div className="text-[12px] text-ink-400">{s.startAge}세</div>
          <div className="text-[14px] font-bold text-ink-900 leading-tight">{s.ganjiHangul}</div>
          <div className="text-[12px] text-ink-500 leading-tight mt-0.5">
            {s.stemDeity || '—'}
            <br />
            {s.branchDeity || '—'}
          </div>
          {s.isCurrent && <div className="text-[12px] font-bold text-ink-700 mt-1">현재</div>}
        </div>
      ))}
    </div>
  </div>
);

const PeriodCard: React.FC<{ card: PeriodCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>{card.periodLabel}</div>
    <div className="text-[14px] font-bold text-ink-900">
      {card.ganjiHangul}
      <span className="text-ink-400">({card.ganjiHanja})</span>
    </div>
    <dl className="mt-2 space-y-1 text-[14px] text-ink-800">
      <div className="flex gap-2">
        <dt className="text-[12px] text-ink-500 w-16 shrink-0">천간십성</dt>
        <dd>{card.stemDeity || '—'}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-[12px] text-ink-500 w-16 shrink-0">지지십성</dt>
        <dd>{card.branchDeity || '—'}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="text-[12px] text-ink-500 w-16 shrink-0">지지운성</dt>
        <dd>{card.branchUnseong || '—'}</dd>
      </div>
    </dl>
  </div>
);

const CareerCard: React.FC<{ card: CareerCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>직업 구조</div>
    <div className="text-[14px] text-ink-800">
      격국 <span className="font-bold text-ink-900">{card.gyeok || '미상'}</span>
    </div>
    {card.composition && (
      <div className="mt-1 text-[12px] text-ink-500">십성 분포 · {card.composition}</div>
    )}
    <div className="mt-3 pt-3 border-t border-ink-300/25 space-y-2.5">
      <PlacementList label="관성 (직업·조직)" items={card.officers} />
      <PlacementList label="인성 (자격·학문)" items={card.seals} />
    </div>
  </div>
);

const LoveCard: React.FC<{ card: LoveCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>연애·결혼</div>
    <div className="text-[14px] text-ink-800">
      배우자궁(일지){' '}
      <span className="font-bold text-ink-900">
        {card.spousePalaceHangul}
        {card.spousePalaceHanja ? `(${card.spousePalaceHanja})` : ''}
      </span>
      {card.spouseDeity ? <span className="text-[12px] text-ink-500"> · {card.spouseDeity}</span> : null}
    </div>
    {card.hiddenStems && (
      <div className="mt-1 text-[12px] text-ink-500">지장간 · {card.hiddenStems}</div>
    )}
    <div className="mt-3 pt-3 border-t border-ink-300/25">
      <PlacementList label="관계 신살 (도화·홍염)" items={card.romanceStars} emptyText="드러난 도화·홍염 없음" />
    </div>
  </div>
);

const HealthCard: React.FC<{ card: HealthCardPayload }> = ({ card }) => {
  const max = Math.max(1, ...card.elements.map((e) => e.count));
  return (
    <div className={CARD_SHELL}>
      <div className={CARD_TITLE}>건강 · 오행 분포</div>
      <div className="space-y-1.5">
        {card.elements.map((e) => (
          <div key={e.label} className="flex items-center gap-2">
            <span className="text-[12px] text-ink-500 w-12 shrink-0">{e.label}</span>
            <span className="flex-1 h-2 rounded-full bg-ink-300/20 overflow-hidden">
              <span
                className="block h-full bg-ink-700/60 rounded-full"
                style={{ width: `${(e.count / max) * 100}%` }}
              />
            </span>
            <span className="text-[12px] text-ink-600 w-5 text-right">{e.count}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-ink-300/25 text-[14px] text-ink-700">
        {card.lacking.length > 0 ? `부족한 오행 ${card.lacking.join('·')}` : '오행 분포 비교적 고름'}
        {card.johooStatus ? ` · 조후 ${card.johooStatus}` : ''}
      </div>
    </div>
  );
};

const RelationsCard: React.FC<{ card: RelationsCardPayload }> = ({ card }) => (
  <div className={CARD_SHELL}>
    <div className={CARD_TITLE}>대인관계</div>
    <div className="space-y-2.5">
      <PlacementList label="비겁 (형제·동료·경쟁)" items={card.peers} />
      <PlacementList label="관성 (윗사람·조직)" items={card.authorities} />
      <PlacementList label="인성 (조력자·어른)" items={card.supporters} />
    </div>
  </div>
);

export const SajuCard: React.FC<{ card: SajuCardPayload }> = ({ card }) => {
  switch (card.kind) {
    case 'myeongsik':
      return <MyeongsikCard card={card} />;
    case 'wealth':
      return <WealthCard card={card} />;
    case 'daeun':
      return <DaeunCard card={card} />;
    case 'period':
      return <PeriodCard card={card} />;
    case 'career':
      return <CareerCard card={card} />;
    case 'love':
      return <LoveCard card={card} />;
    case 'health':
      return <HealthCard card={card} />;
    case 'relations':
      return <RelationsCard card={card} />;
    default:
      return null;
  }
};

/** 후속 선택지 버튼 묶음. scenarioId면 시나리오 진입, query면 자유질문 전송. */
export const ChatOptionsBlock: React.FC<{
  title?: string;
  options: ChatOption[];
  disabled?: boolean;
  onSelectScenario: (scenarioId: string) => void;
  onSelectQuery: (query: string) => void;
}> = ({ title, options, disabled, onSelectScenario, onSelectQuery }) => (
  <div className="w-full max-w-[96%] md:max-w-[92%] space-y-2">
    {title && <div className="text-[12px] text-ink-500 px-1">{title}</div>}
    <div className="flex flex-wrap gap-2">
      {options.map((opt, i) => (
        <button
          key={`chat-option-${i}`}
          disabled={disabled}
          onClick={() => {
            if (opt.scenarioId) onSelectScenario(opt.scenarioId);
            else if (opt.query) onSelectQuery(opt.query);
          }}
          className="px-3 py-2 min-h-[40px] rounded-xl text-[13px] font-semibold border transition-all disabled:opacity-50 bg-paper-50/75 border-ink-300/35 text-ink-700 hover:border-ink-500/50 hover:text-ink-900"
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);
