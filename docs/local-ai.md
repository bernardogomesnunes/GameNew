# Battle strategies with LM Studio

The local development version can ask your LM Studio model to choose one of
three bounded rival strategies: pressure, guard or rebuild. Normal simulation
continues when the model is unavailable. The model cannot run tools or arbitrary
game commands, and model keys stay on the development server.

1. In LM Studio, load a chat model and start its server on `127.0.0.1:1234`.
2. Run `npm run dev` in this repository.
3. Create a Battle world and select **Use my LM Studio model for rival
   strategies**. That choice is saved with the world.

The verified model on this computer was Qwen3 14B, loaded as `duilt-local-ai`
with a 2,048-token context. The previously loaded Bonsai entry returned a model
metadata error. To reload the verified model using the installed CLI:

```powershell
lms server start --port 1234 --bind 127.0.0.1
lms load qwen/qwen3-14b --context-length 2048 --ttl 600 --identifier duilt-local-ai --yes
npm run dev
```

`BATTLE_AI_MODEL` optionally selects another model on the development server;
`BATTLE_AI_KEY` optionally supplies an LM Studio authentication token. Neither
uses a `VITE_` prefix or enters the browser bundle. No key was created or saved
by this task. Requests go through `/api/local-battle-ai`, stay on this computer,
are rate limited, time out, and validate every returned strategy.

The published static site does not connect to your computer automatically.
Using this model from a phone requires reaching the development server on the
computer running it. Internet hosting needs a separately configured, authenticated
server connection; do not expose the raw model API publicly.
