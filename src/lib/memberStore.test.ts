import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 코드 보관(옵트인) 저장 동작 검증 — Firestore SDK는 모킹한다.
 * 핵심 계약: (1) 코드는 대문자·trim 정규화, (2) merge 저장이라 프로필이 없어도 실패하지 않음,
 * (3) 보관되는 값은 코드 문자열뿐(명식·리포트 미포함).
 */

const setDocMock = vi.fn().mockResolvedValue(undefined);
const arrayUnionMock = vi.fn((v: string) => ({ __op: 'union', v }));
const arrayRemoveMock = vi.fn((v: string) => ({ __op: 'remove', v }));
const getDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, col: string, uid: string) => ({ col, uid }),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: vi.fn(),
  serverTimestamp: () => '__ts__',
  arrayUnion: (v: string) => arrayUnionMock(v),
  arrayRemove: (v: string) => arrayRemoveMock(v),
}));

vi.mock('../firebase', () => ({ db: {} }));

const { addSavedCode, getSavedCodes, removeSavedCode } = await import('./memberStore');

describe('코드 보관 (members.savedCodes)', () => {
  beforeEach(() => {
    setDocMock.mockClear();
    arrayUnionMock.mockClear();
    arrayRemoveMock.mockClear();
    getDocMock.mockReset();
  });

  it('addSavedCode: 코드를 정규화해 arrayUnion으로 merge 저장한다', async () => {
    await addSavedCode('uid-1', ' hw-3f9k2a ');

    expect(arrayUnionMock).toHaveBeenCalledWith('HW-3F9K2A');
    const [ref, payload, options] = setDocMock.mock.calls[0];
    expect(ref).toMatchObject({ col: 'members', uid: 'uid-1' });
    expect(options).toEqual({ merge: true });
    // 보관되는 것은 코드뿐 — 명식·리포트 관련 키가 섞이면 안 된다.
    expect(Object.keys(payload).sort()).toEqual(['savedCodes', 'uid', 'updatedAt'].sort());
  });

  it('removeSavedCode: arrayRemove로 연결만 끊는다', async () => {
    await removeSavedCode('uid-1', 'hw-3f9k2a');
    expect(arrayRemoveMock).toHaveBeenCalledWith('HW-3F9K2A');
    expect(setDocMock.mock.calls[0][2]).toEqual({ merge: true });
  });

  it('getSavedCodes: 프로필이 없으면 빈 배열', async () => {
    getDocMock.mockResolvedValue({ exists: () => false });
    expect(await getSavedCodes('uid-none')).toEqual([]);
  });

  it('getSavedCodes: 저장된 목록을 반환한다', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ savedCodes: ['AA-111111'] }) });
    expect(await getSavedCodes('uid-1')).toEqual(['AA-111111']);
  });

  it('getSavedCodes: savedCodes 필드가 없는 기존 회원도 빈 배열', async () => {
    getDocMock.mockResolvedValue({ exists: () => true, data: () => ({ uid: 'uid-1' }) });
    expect(await getSavedCodes('uid-1')).toEqual([]);
  });
});
