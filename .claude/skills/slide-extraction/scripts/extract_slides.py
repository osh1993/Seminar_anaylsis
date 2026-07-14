# -*- coding: utf-8 -*-
"""세미나 폴더의 PDF에서 슬라이드별 이미지/텍스트/URL을 추출한다.

사용법:
  python -X utf8 extract_slides.py <세미나폴더> [PDF파일명 ...] [--doc N] [--limit N] [--out DIR]

  <세미나폴더>   : 세미나 자료가 든 폴더 (프로젝트 루트 기준 상대 또는 절대 경로)
  [PDF파일명]    : 처리할 PDF를 순서대로 지정. 생략하면 폴더 내 *.pdf를 이름순으로 자동 발견.
                   지정/발견 순서가 doc 번호(1, 2, ...)가 된다.
  --doc N        : 해당 doc 번호만 재추출 (PDF 목록은 동일하게 주어야 번호가 유지됨)
  --limit N      : 각 PDF의 앞 N페이지만 처리 (스모크 테스트용)
  --out DIR      : 출력 위치 재지정 (기본: <세미나폴더>/_workspace)

출력:
  <out>/slides/day{N}/{page:03d}.png  - 슬라이드 렌더링 이미지 (1.5배)
  <out>/01_extract_day{N}.json        - 슬라이드별 텍스트/URL 메타데이터
  <out>/00_sources.json               - doc 번호 <-> PDF 파일명 매핑 (감사 추적)
"""
import fitz
import json
import re
import sys
from pathlib import Path

URL_RE = re.compile(r"https?://[^\s\)\]\}>\"']+")


def extract(folder: Path, out: Path, doc: int, pdf_name: str, limit: int | None) -> int:
    doc_pdf = fitz.open(folder / pdf_name)
    img_dir = out / "slides" / f"day{doc}"
    img_dir.mkdir(parents=True, exist_ok=True)

    slides = []
    total = doc_pdf.page_count if limit is None else min(limit, doc_pdf.page_count)
    for i in range(total):
        page = doc_pdf[i]
        num = i + 1
        text = page.get_text()

        # URL 수집: 하이퍼링크 + 본문 텍스트 정규식
        urls = set()
        for link in page.get_links():
            uri = link.get("uri")
            if uri:
                urls.add(uri.rstrip(".,"))
        for m in URL_RE.findall(text):
            urls.add(m.rstrip(".,"))

        # 슬라이드 이미지 렌더링 (1.5배 확대)
        pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5))
        pix.save(img_dir / f"{num:03d}.png")

        slides.append({
            "day": doc,
            "page": num,
            "text": text,
            "urls": sorted(urls),
            "image": f"slides/day{doc}/{num:03d}.png",
        })
        if num % 50 == 0:
            print(f"doc{doc}: {num}/{total}")

    out_file = out / f"01_extract_day{doc}.json"
    out_file.write_text(json.dumps(slides, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"doc{doc} 완료: {total} 슬라이드 -> {out_file}")
    return total


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit("사용법: extract_slides.py <세미나폴더> [PDF ...] [--doc N] [--limit N] [--out DIR]")

    only_doc = None
    limit = None
    out_override = None
    rest = []
    i = 0
    while i < len(args):
        if args[i] == "--doc":
            only_doc = int(args[i + 1]); i += 2
        elif args[i] == "--limit":
            limit = int(args[i + 1]); i += 2
        elif args[i] == "--out":
            out_override = Path(args[i + 1]); i += 2
        else:
            rest.append(args[i]); i += 1

    folder = Path(rest[0]).resolve()
    if not folder.is_dir():
        sys.exit(f"폴더 없음: {folder}")

    pdf_names = rest[1:]
    if not pdf_names:
        pdf_names = sorted(p.name for p in folder.glob("*.pdf"))
    if not pdf_names:
        sys.exit(f"PDF 없음: {folder}")

    out = out_override.resolve() if out_override else folder / "_workspace"
    out.mkdir(parents=True, exist_ok=True)

    sources = [{"doc": d, "pdf": name} for d, name in enumerate(pdf_names, start=1)]
    (out / "00_sources.json").write_text(
        json.dumps(sources, ensure_ascii=False, indent=1), encoding="utf-8")

    for src in sources:
        if only_doc is None or src["doc"] == only_doc:
            extract(folder, out, src["doc"], src["pdf"], limit)
    print("추출 완료")


if __name__ == "__main__":
    main()
