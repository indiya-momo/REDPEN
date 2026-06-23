# 마이페이지 · 프로젝트 라이브러리 와이어 스펙

**상태:** 목업 1차 (2026-06-23)  
**목적:** `projectCardViewModel` 계약·세 화면(Port) UX를 눈으로 고정  
**범위:** 클릭 목업 (`?window=mypage-mock`, DEV 전용). 저장·Firebase 없음.

## 세 화면 (Port)

| 화면 | 역할 | 목업 |
|------|------|------|
| **Library** | 목록·메타 편집·복제·삭제·작업 시작 | 기본 화면 |
| **Workbench** | 규칙 on/off·추가 (무거운 편집) | 상단 활성 프로젝트 바만 |
| **Share Preview** | 수신자가 보는 읽기 전용 | 모달 (`readOnly`) |

## Library — 상단

- 슬롯 게이지: `2/3` (목업 고정)
- 태그 필터 칩: `전체` + 프로젝트 tags union
- (placeholder) 섹션 접기 — 2차

## 카드 — 접힘

1. **명함:** 태그 칩 + `《프로젝트명》` (+ `isActive` 뱃지, `dirty` 뱃지)
2. **목차:** `headline` 한 줄 (Presenter 문장)
3. **메타:** `lastWork.date` · 원고 `manuscriptPages`p · `savedDate`
4. **액션 3:** 이름 변경 · 메모·태그 · 이 기준으로 작업
5. **더보기:** 펼치기 · 복제 · 공유 미리보기 · (placeholder) 삭제

건수(`counts`)는 접힘에서 숨김.

## 카드 — 펼침

- `highlights[]`: 카테고리 라벨 + 대표 규칙 + `(count건)`
- 맞춤법 검수 / 일관성 검수 / 본용언+보조용언

## Workbench (목업)

- 상단 바: 프로젝트명, dirty/저장 상태, 「라이브러리로」
- 본문: 「규칙 편집 UI는 기존 검수 화면」 placeholder

## Share Preview

- `ProjectCardViewModel` + `readOnly: true`
- PDF·검수 결과 **미포함** 고정 카피
- B-0: 동일 레이아웃 + URL 토큰 (미구현)

## ViewModel 계약

```ts
ProjectCardViewModel {
  id: string
  title: string
  tags: string[]
  memo?: string
  headline: string
  highlights: { category, label, count }[]
  counts: { editorReview, spelling, find, commonString, auxiliary }
  lastWork?: { date: string, manuscriptPages?: number }
  savedDate: string
  isActive: boolean
  dirty?: boolean
  shareScope?: 'project' | 'folder'
}
```

## 상태 표

| 상태 | Library | 카드 |
|------|---------|------|
| 로딩 | 스켈레ton (2차) | — |
| 빈 목록 | empty + CTA | — |
| 슬롯 꽉 참 | 게이지 + Pro CTA (placeholder) | — |
| dirty | — | 「변경됨」 뱃지 |
| readOnly | — | Share Preview 모달 |

## 목업 시나리오 (클릭)

1. 카드 펼침 / 접음  
2. 태그 필터  
3. 이름 인라인 편집  
4. 메모·태그 패널  
5. 「이 기준으로 작업」 → Workbench  
6. 복제 → 새 카드  
7. 공유 미리보기 모달  

## 비범위 (1차)

- Firestore·localStorage 연동  
- Folder 엔티티·드래그 그룹  
- 실제 삭제·슬롯 가드  
- 모바일 (`welcome-mo`)
