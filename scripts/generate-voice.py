#!/usr/bin/env python3
"""Generate the English female PRTS narration used by the startup sequence.

The generated MP3s are committed under assets/voice so the plugin does not need
a TTS runtime. Re-run this script only when the narration text or voice changes.

Requires `edge-tts` (pip install edge-tts) and network access to Microsoft's
Edge speech service.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "voice"

VOICE = "en-GB-SoniaNeural"
PRIESTESS_VOICE = "en-US-AvaNeural"

LINES: dict[str, str] = {
    "boot": "PRTS core online. Archive signal detected.",
    "archive": "Archive integrity: three point seven percent.",
    "handshake": "Neural handshake required.",
    "link": "Neural link established.",
    "fragments": "Select a memory fragment.",
    "originium": "The stone that ate the sky. We called it salvation.",
    "sarcophagus": "You slept through the end of the world.",
    "priestess": "She stayed behind. You were not supposed to wake alone.",
    "identity": "Subject confirmed. Prophet. Doctor. Omega clearance.",
    "forget": "Do not forget me.",
    "welcome_doctor": "Welcome home, Doctor.",
    "welcome_prophet": "Prophet.",
    "error_rewrite": "Error. Identity rewrite in progress.",
    "thank_you_prophet": "Thank you, Prophet.",
}


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for key, text in LINES.items():
        if key == "forget":
            rate, pitch = "-12%", "-12Hz"
            voice = PRIESTESS_VOICE
        elif key == "welcome_prophet":
            rate, pitch = "-14%", "-6Hz"
        elif key == "priestess":
            rate, pitch = "-10%", "-4Hz"
        elif key == "welcome_doctor":
            rate, pitch = "-10%", "-4Hz"
        elif key == "error_rewrite":
            rate, pitch = "-4%", "-1Hz"
        elif key == "thank_you_prophet":
            rate, pitch = "-8%", "-3Hz"
        else:
            rate, pitch = "-6%", "-3Hz"
        target = OUT / f"{key}.mp3"
        voice = PRIESTESS_VOICE if key == "forget" else VOICE
        tts = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume="+0%")
        await tts.save(str(target))
        print(f"{key:12s} {target.stat().st_size:7d} bytes  {text[:60]}")
        await asyncio.sleep(0.15)


if __name__ == "__main__":
    asyncio.run(main())
