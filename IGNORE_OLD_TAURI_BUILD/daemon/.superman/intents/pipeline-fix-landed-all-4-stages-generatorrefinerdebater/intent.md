# Intent

Pipeline fix landed: all 4 stages (Generator/Refiner/Debater/Tagger) now parse result["result"] inner JSON before extracting fields. Next proposals should have real title/body/summary. Needs daemon restart to take effect.
