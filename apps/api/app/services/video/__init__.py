"""Short vertical video, made on this machine.

    tts.py       Piper narration, offline
    hook.py      the optional paid opening clip (Wan, via fal.ai)
    captions.py  burned-in subtitles as an ASS script
    compose.py   ffmpeg: stills with motion, the hook, captions, audio
    reel.py      the whole thing, from a script to an .mp4

Everything here except hook.py is free to run, and hook.py is optional: a reel
without a hook opens on a moving still instead, and is still a reel.

Windows note: the worker runs on a SelectorEventLoop (psycopg needs it), and
that loop cannot spawn subprocesses. So ffmpeg and Piper run in threads via
asyncio.to_thread — never asyncio.create_subprocess_exec, which raises
NotImplementedError there.
"""
