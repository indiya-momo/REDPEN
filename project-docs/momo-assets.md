# 모모 이미지 — 제작·전달 가이드

> 작업 회고·에이전트 요청 방법: [momo-animation-workflow.md](./momo-animation-workflow.md)

## 대문 애니메이션 (`MomoHero.jsx`)

| 파일 | 용도 |
|------|------|
| `momo_front2.mp4` | 환영 화면 루프 영상 |
| `hero-open.png` | poster · 동작 줄이기 시 정지 화면 |

`MomoHero`는 `<video autoplay loop muted playsInline>`로 재생합니다. `prefers-reduced-motion: reduce`이면 poster만 표시합니다.

## 눈 깜박임

| 파일 | 내용 |
|------|------|
| `hero-open.png` | 눈 뜸 |
| `hero-closed.png` | 눈 감음 |

같은 크기·같은 위치. `hero-closed.png` 없으면 `3.png` 스프라이트 사용.

## 펜

| 파일 | 내용 |
|------|------|
| `6.png` | 빨간 펜 (투명 PNG) |

## 전달 위치

```
public/momo/
  momo_front2.mp4
  hero-open.png
  hero-closed.png   (예비)
  6.png             (예비)
```
