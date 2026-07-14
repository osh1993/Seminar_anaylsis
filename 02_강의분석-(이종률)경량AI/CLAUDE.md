# 프로젝트: 모델경량화 세미나 해설 웹페이지

## 하네스: 세미나 자료 해설 웹

**목표:** 이종률 교수 모델경량화 세미나 PDF(2일차, 467슬라이드 — day1 갱신본 221 + day2 갱신본 246)를 출처 슬라이드·참조 문헌이 정밀 표기된 인터랙티브 해설 웹페이지로 변환한다.

**트리거:** 세미나 자료 해설/웹페이지/검색/Q&A/인용 관련 작업 요청 시 `seminar-web-orchestrator` 스킬을 사용하라. 단순 질문은 직접 응답 가능.

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-07-02 | 초기 구성 (에이전트 4, 스킬 5) | 전체 | - |
| 2026-07-02 | day1 PDF 갱신본(213→221p) 반영 — 변경 93장만 재해설, 128장 태그 재매핑 재사용. 페이지 수 하드코딩 제거 | skills/slide-extraction, slide-interpretation, citation-qa, webpage-build, seminar-web-orchestrator | 원본 자료 업데이트 |
| 2026-07-02 | 뷰어 크기 조절(드래그 스플리터) + 슬라이드별 메모(localStorage, .md 내보내기) 기능 명세 추가 | skills/webpage-build, webpage/ | 사용자 기능 요청 |
| 2026-07-02 | 서지 문자열이 깨진 링크로 렌더링되는 버그 수정(비-http url 정규화, ref_id 매칭 248건). ref-090(Kim et al. Tucker, ICLR2016)에 arXiv 검증 URL 수동 등재 — MANUAL_URLS/verified_manual 체계 도입 | skills/citation-qa, _workspace/curate_refs.py, build_data.py, webpage/ | p55 링크 깨짐 사용자 보고 |
| 2026-07-02 | 나머지 서지-only 8건 전부 웹 검증 후 URL 등재 (arXiv 5, CVF 1, NeurIPS 1 — Deep Compression 서지 2건은 동일 논문). 서지-only 0건 | _workspace/curate_refs.py, 03_references.json, webpage/data.js | 사용자 승인 |
| 2026-07-02 | 메모 내보내기/가져오기 왕복 기능 추가 (.md 헤딩 키 파싱, 이스케이프 규칙, 덮어쓰기 일괄 확인) — 브라우저 간 메모 이동 지원 | skills/webpage-build, webpage/ | 다른 브라우저에서 메모 복원 문의 |
| 2026-07-02 | 강의 녹취록 반영 능력 추가(하네스 확장). Day1 녹취록 2건(경량화1/2.md)을 비파괴 오버레이(`05_lecture_day{N}_*.json`)로 슬라이드에 덧입힘 — 강사 구술 서사·직관·업계 사례·강의 중 Q&A를 `lecture_note`+`qa.from_lecture`로. 6구간 팬아웃, 98슬라이드 반영(강의문답 1). 웹에 "🎙️ 강의 실황" 앰버 블록 렌더+검색 대상 포함. Day2는 파일 추가만 하면 자동 반영 | skills/slide-interpretation, webpage-build, seminar-web-orchestrator, _workspace/build_data.py, webpage/(app.js,style.css,data.js) | 발표자료+강의내용 통합 설명 요청 |
| 2026-07-02 | 두 종합 뷰 추가: ⭐강조(`06_highlights_day{N}.json`, 29항목·5카테고리 필터)와 🧭연구 흐름(`07_flow_day{N}.json`, 9갈래·44단계 타임라인). 큐레이션 에이전트 2종(slide-interpreter 종합 모드) 팬아웃. build_data가 `highlights`/`flow`로 병합, app.js에 두 탭·렌더러 추가. Day2는 파일 추가만 하면 반영 | skills/webpage-build, _workspace/build_data.py, webpage/(index.html,app.js,style.css,data.js) | 강조 모아보기·연구 흐름 섹션 요청 |
| 2026-07-02 | 연구 흐름을 인터랙티브 개념 탐색으로 재구성. 07_flow 데이터에 step별 `concept`(한 줄 개념)·`transition`(다음 기법 등장 이유) 보강(44 concept/35 transition). UI: 갈래 탭 선택 → 세로 타임라인, step 클릭 펼침, 전환 다리(한계→다음), "다음 개념 ▶/◀ 이전" 단계별 따라가기+모두펼치기 | _workspace/07_flow_day1.json, skills/webpage-build, webpage/(index.html,app.js,style.css,data.js) | 연구 흐름 인터랙티브 개념 이해 요청 |
| 2026-07-03 | Day2 PDF 갱신본(모델경량화_20260703_updated.pdf, 227→246p, +19장) 반영. 텍스트 대조(update_day2/compare.py)로 재사용 223장·재해설 23장(변경·신규) 분류 → 재사용분은 [D2-pX] 태그·related_slides를 old→new 페이지로 재매핑, 재해설분만 2구간 팬아웃(그룹A 10장·그룹B 13장 "Beyond Learning Theory" 신규 섹션). p108을 Time-series Foundation Model 독립 섹션으로 분리, arXiv 2211.16327 참고문헌 등재(ref-098). 총 467슬라이드, 인용 태그 1994, 참고문헌 96 | skills/slide-extraction(extract_slides.py), slide-interpretation, webpage-build, _workspace/(build_data.py,02_interpret_day2_*,03_references.json,update_day2/*), webpage/(data.js,slides/day2) | Day2 원본 PDF 업데이트 |
