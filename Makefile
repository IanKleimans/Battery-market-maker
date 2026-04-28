# IE 590 final project Makefile.
#
# Targets:
#   make test        — run pytest with coverage
#   make figures     — regenerate all five figures from synthetic or real data
#   make report      — build report PDF via pandoc
#   make slides      — build slides PDF via Marp
#   make all         — figures + report + slides
#   make clean       — remove generated PDFs and figures

PY ?= uv run python

.PHONY: test figures report slides all clean

test:
	uv run pytest --cov=src --cov-report=term-missing

figures:
	$(PY) -m src.eval.plots

report: figures
	pandoc report/IE590_final_report.md \
	    -o report/IE590_final_report.pdf \
	    --pdf-engine=xelatex \
	    --toc \
	    -V geometry:margin=1in \
	    -V mainfont="DejaVu Serif" \
	    -V monofont="DejaVu Sans Mono" \
	    -V fontsize=11pt \
	    --metadata title="Stochastic Dynamic Programming for Grid-Scale Battery Co-Optimization" \
	    --metadata author="Ian Kleimans" \
	    --metadata date="$(shell date +%Y-%m-%d)"

slides: figures
	marp slides/IE590_final.md -o slides/IE590_final.pdf --allow-local-files

all: figures report slides

clean:
	rm -f figures/*.png figures/*.pdf
	rm -f report/*.pdf
	rm -f slides/*.pdf slides/*.html
