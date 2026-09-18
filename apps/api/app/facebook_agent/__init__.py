"""The autonomous Facebook Page agent.

Separated by concern on purpose — observation, reasoning, decision, action,
verification, memory and learning are distinct steps, and the failure mode of
putting them in one function is that the agent stops being auditable.

    agent.py      the loop: wake, observe, decide, act, verify, remember
    observer.py   builds the state, cheaply, database first
    state.py      what the agent sees (and what it may never see: secrets)
    policies.py   the deterministic rules, limits and ceilings
    decision.py   the reasoning model and its structured output
    actions.py    execution, with idempotency in front of every Graph call
    memory.py     normalisation, hashing and duplicate rejection
    evaluator.py  measured performance, and learning from it
"""
