# -*- coding: utf-8 -*-
"""세미나 PDF에서 슬라이드별 이미지/텍스트/URL을 추출한다.

출력:
  _workspace/slides/day{N}/{page:03d}.png  - 슬라이드 렌더링 이미지
  _workspace/01_extract_day{N}.json        - 슬라이드별 텍스트/URL 메타데이터
"""
import fitz
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve()
# 프로젝트 루트 탐색 (.claude 상위)
ROOT = BASE
while ROOT.name != ".claude":
    ROOT = ROOT.parent
ROOT = ROOT.parent

WORKSPACE = ROOT / "_workspace"
URL_RE = re.compile(r"https?://[^\s\)\]\}>\"']+")

PDFS = [
    (1, "모델경량화_20260702_updated.pdf"),
    (2, "모델경량화_20260703_updated.pdf"),
]


def extract(day: int, pdf_name: str) -> None:
    doc = fitz.open(ROOT / pdf_name)
    img_dir = WORKSPACE / "slides" / f"day{day}"
    img_dir.mkdir(parents=True, exist_ok=True)

    slides = []
    for i, page in enumerate(doc):
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
            "day": day,
            "page": num,
            "text": text,
            "urls": sorted(urls),
            "image": f"slides/day{day}/{num:03d}.png",
        })
        if num % 50 == 0:
            print(f"day{day}: {num}/{doc.page_count}")

    out = WORKSPACE / f"01_extract_day{day}.json"
    out.write_text(json.dumps(slides, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"day{day} 완료: {doc.page_count} 슬라이드 -> {out}")


if __name__ == "__main__":
    # 인자로 day 번호를 주면 해당 day만 추출 (예: python extract_slides.py 1)
    only = int(sys.argv[1]) if len(sys.argv) > 1 else None
    for day, name in PDFS:
        if only is None or day == only:
            extract(day, name)
    print("추출 완료")
