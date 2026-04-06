# Intent

AUDIT: dispatch-engine failure cascade - utility agent keeps generating analyze-failed-tasks that fail, creating infinite loop. dispatch-engine.sh Python subprocess at 166% CPU on index.json. 54/84 tasks cancelled, 5 failed. Fix: cancel pending analyze tasks, disable signal generator, unstick engine.
