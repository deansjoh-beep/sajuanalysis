/**
 * Phase 2-1 데이터 계층 — Postgres 스키마 (drizzle-orm).
 *
 * 설계 원칙 (IMPLEMENTATION_PLAN 2-1 + docs/decisions D-0-2):
 * - 개인 식별 컬럼 절대 금지: name / email / phone / address / 생년월일시 원문 등은
 *   어떤 테이블에도 두지 않는다. 스키마 테스트(db/schema.test.ts)가 이를 상시 검증한다.
 * - 사주 코드(code) 기반 조회가 유일한 재열람 수단. 코드 분실 = 복구 불가가 정책이다.
 * - 리포트 본문은 expires_at(생성 후 72시간) 경과 시 크론이 물리 삭제한다.
 *   읽기 경로에서도 expires_at 초과분은 만료로 취급할 것(크론 주기 사이의 공백 방어).
 * - 호스팅 중립: 표준 Postgres 기능만 사용 (Neon/Supabase/Vercel Postgres 어디든 DATABASE_URL만 교체).
 */
import { relations, sql } from 'drizzle-orm';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/** 판매 상품 구분 — src/lib/premiumOrderStore.ts ProductType과 동일 리터럴 유지 */
export const productEnum = pgEnum('product', [
  'premium',
  'yearly2026',
  'jobCareer',
  'loveMarriage',
]);

/** 주문 상태 — paid(결제승인) → generated(리포트 생성됨) / refunded(환불) */
export const orderStatusEnum = pgEnum('order_status', [
  'paid',
  'generated',
  'refunded',
]);

/**
 * 명식 재생성용 최소 파라미터 (codes.myeongsik JSONB).
 *
 * 생년월일시 "원문"은 저장하지 않는다 — 간지 8자·대운 파라미터·연도만으로
 * SajuAnalysis(대운 시퀀스·세운·월운·신살 등)를 재조립할 수 있게 설계한다.
 * birthYear는 나이·세운 산출 기준으로 필요하며 연도 단독으로는 개인 식별이 불가하다.
 */
export interface MyeongsikParams {
  /** 간지 8자 — 시간 미상 시 hour는 null */
  pillars: {
    year: string;
    month: string;
    day: string;
    hour: string | null;
  };
  gender: 'male' | 'female';
  /** 대운수 (첫 대운 시작 나이) */
  daeunsu: number;
  /** 대운 순행/역행 */
  daeunDirection: 'forward' | 'backward';
  /** 출생 연도 (나이·세운 계산 기준 — 월·일·시 원문 저장 금지) */
  birthYear: number;
  timeUnknown: boolean;
}

/**
 * myeongsik JSONB에 개인 식별 키가 섞여 들어오는 것을 삽입 시점에 차단하는 런타임 가드.
 * (컬럼 금지는 스키마 테스트가, JSONB 내부는 이 가드가 담당)
 */
export const FORBIDDEN_MYEONGSIK_KEYS = [
  'name',
  'email',
  'phone',
  'tel',
  'address',
  'birthdate',
  'birth_date',
  'birthday',
  'birthtime',
  'birth_time',
  'ip',
  'userid',
  'user_id',
] as const;

/** 개인 식별 키 검출 오류 — API 계층에서 400으로 매핑한다 */
export class PersonalDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PersonalDataError';
  }
}

export function assertNoPersonalKeys(myeongsik: Record<string, unknown>): void {
  const walk = (obj: unknown, path: string): void => {
    if (obj === null || typeof obj !== 'object') return;
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const normalized = key.toLowerCase().replace(/[^a-z_]/g, '');
      if ((FORBIDDEN_MYEONGSIK_KEYS as readonly string[]).includes(normalized)) {
        throw new PersonalDataError(
          `개인 식별 키 저장 금지: myeongsik${path}.${key} — codes.myeongsik에는 명식 재생성 최소 파라미터만 허용됩니다.`,
        );
      }
      walk(value, `${path}.${key}`);
    }
  };
  walk(myeongsik, '');
}

/**
 * 사주 코드 — 재열람의 유일한 열쇠. code 형식: 접두 2자 + '-' + 6자 (예: HW-3F9K2A).
 * myeongsik이 null이면 "미사용 선물 코드" — 수령자가 코드 입력 + 생시 입력 시 채워진다.
 */
export const codes = pgTable(
  'codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 12 }).notNull().unique(),
    myeongsik: jsonb('myeongsik').$type<MyeongsikParams>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** 소프트 삭제 마커 — 즉시 파기(purge)는 하드 삭제이므로 이 컬럼을 쓰지 않는다 */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('codes_code_idx').on(table.code)],
);

/** 주문 — PG(토스페이먼츠) 주문번호와 코드의 연결. 금액 단위는 원(KRW 정수). */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderNo: text('order_no').notNull().unique(),
    /** 토스페이먼츠 paymentKey — 환불(cancel API) 호출에 필요 */
    paymentKey: text('payment_key').notNull(),
    codeId: uuid('code_id')
      .notNull()
      .references(() => codes.id, { onDelete: 'cascade' }),
    product: productEnum('product').notNull(),
    status: orderStatusEnum('status').notNull().default('paid'),
    amount: integer('amount').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('orders_code_id_idx').on(table.codeId)],
);

/** 리포트 본문 — 72시간 후 만료. 만료분은 크론(/api/purge GET)이 물리 삭제. */
export const REPORT_TTL_HOURS = 72;

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    codeId: uuid('code_id')
      .notNull()
      .references(() => codes.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    product: productEnum('product').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '72 hours'`),
  },
  (table) => [
    index('reports_expires_at_idx').on(table.expiresAt),
    index('reports_code_id_idx').on(table.codeId),
  ],
);

export const codesRelations = relations(codes, ({ many }) => ({
  orders: many(orders),
  reports: many(reports),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  code: one(codes, { fields: [orders.codeId], references: [codes.id] }),
  reports: many(reports),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  code: one(codes, { fields: [reports.codeId], references: [codes.id] }),
  order: one(orders, { fields: [reports.orderId], references: [orders.id] }),
}));
