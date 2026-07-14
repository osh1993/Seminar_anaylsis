---
name: web-publish
description: 세미나 해설 웹페이지를 GitHub Pages(osh1993/Seminar_anaylsis)에 게시하는 절차 — git 커밋/푸시, Pages 설정, 허브 갱신, 게시 확인. "웹에 게시", "올려줘", "배포", "퍼블리시", "GitHub Pages", "사이트 갱신", "게시 다시" 요청 시 반드시 이 스킬을 사용할 것.
---

# 웹 게시 (GitHub Pages)

## 대상
- 원격: `https://github.com/osh1993/Seminar_anaylsis` (PUBLIC)
- 게시 URL: `https://osh1993.github.io/Seminar_anaylsis/`
- 방식: `main` 브랜치 루트를 Pages 소스로 사용. 루트 `index.html`이 허브(세미나 목록), 각 세미나는 `{폴더}/webpage/index.html`(01은 단일 `index.html`).

## 게시 범위 (.gitignore가 강제)
**원본 자료는 게시하지 않는다** — 발표자 저작물(PDF/PPTX/zip)과 중간 산출물(`_workspace*/`)은 .gitignore에 있다. 커밋 대상은: 루트 허브 index.html, 각 세미나의 webpage/(또는 단일 html), .claude/ 하네스, CLAUDE.md. 저장소가 PUBLIC이므로 새 파일 유형을 추가할 때 공개 여부를 먼저 판단하고, 원본 자료로 보이면 .gitignore에 추가한다.

## 절차
1. **게시 전 QA**: 처음 게시하는 세미나면 qa-verifier의 "검사 7(게시 전 점검)"을 먼저 통과시킨다 — 절대 경로·대소문자 불일치는 Pages에서 치명적이다.
2. **상태 확인**: `git status`로 커밋 대상을 확인한다. .gitignore가 원본 PDF/zip/_workspace를 제외하는지 본다.
3. **커밋**: 한국어 커밋 메시지, 세미나 단위로 커밋한다 (예: `03 PE&Vibe Coding 해설 웹 게시`).
4. **푸시**: `git push origin main`. 슬라이드 PNG가 수백 장이라 수 분 걸릴 수 있다 — 타임아웃을 600000ms로.
5. **Pages 확인/활성화**:
   ```
   gh api repos/osh1993/Seminar_anaylsis/pages 2>&1
   ```
   404면 활성화:
   ```
   gh api repos/osh1993/Seminar_anaylsis/pages -X POST -f "source[branch]=main" -f "source[path]=/"
   ```
6. **빌드 대기 및 검증**: 1~2분 후 `gh api repos/osh1993/Seminar_anaylsis/pages/builds/latest`로 status가 `built`인지 확인하고, 허브와 새 세미나 페이지 URL을 WebFetch로 열어 200 + 제목 렌더를 확인한다. 한글 폴더명은 URL 인코딩된 주소로 접근된다(브라우저가 자동 처리).
7. **보고**: 사용자에게 게시 URL(허브 + 새 세미나 직링크)을 전달한다.

## 주의
- **강제 푸시 금지**. 충돌 시 pull --rebase 후 재푸시.
- 100MB 이상 단일 파일은 GitHub이 거부한다 — data.js가 커지면 doc별 분할(webpage-build 스킬 참조).
- Pages 반영 지연(캐시)은 최대 10분 — 즉시 안 보여도 결함으로 단정하지 않는다.
