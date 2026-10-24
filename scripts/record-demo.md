# Recording the HookRelay demo

## Prepare

1. Start MongoDB, Redis, and the API. Start the dashboard and the local receiver:

   ```sh
   npm run dev:api
   npm run dev:dashboard
   npm run demo:server
   ```

2. Seed the demo account and events in another terminal:

   ```sh
   npm run seed
   ```

   The seed prints the demo login and a newly created API key once. Set that key in your terminal as `DEMO_API_KEY` before running the sender. If the key already existed, create a fresh key in the dashboard and use its one-time value.

3. Queue the live examples:

   ```sh
   npm run demo:send
   ```

   This sends three successful events, a permanently failing event, an intermittent event, and a slow event. The retry schedule is 10 seconds, 1 minute, then 5 minutes. The intermittent receiver fails twice and succeeds on its third attempt; the permanent failure reaches dead letter after the full retry schedule. Seeded events also provide ready-made success, failure, pending, and dead-letter records for a short recording.

4. Log in at <http://localhost:5173/login> using the seed credentials. Open Events and keep the dashboard filtered to the recent events. Expand the browser window to a clean desktop-sized view and close unrelated tabs/notifications.

## Suggested recording tools

- **OBS Studio:** record a 1920×1080 display or a cropped application window; capture the screen and microphone separately.
- **Loom:** choose a browser/tab capture with microphone, then trim pauses after recording.

Record at 1080p if possible. Hide API keys, terminal environment variables, and any personal data. The demo receiver is bound to `127.0.0.1` and is intended only for local demonstrations.

## 60-second sequence

| Time      | Show                                                                                                   | Talking point                                                                                                          |
| --------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 0–7 sec   | Landing page, then the Events dashboard                                                                | “HookRelay makes webhook delivery reliable without building a queue and replay system from scratch.”                   |
| 7–17 sec  | Run `npm run demo:send` with the seeded API key already configured; show accepted event IDs            | “A single API call queues the event and returns immediately. Delivery happens in the background.”                      |
| 17–28 sec | Refresh Events and open a successful event                                                             | “Every delivery is logged with its destination, response time, payload, and attempt history.”                          |
| 28–40 sec | Open the intermittent event after its third attempt, showing the two 500 responses followed by success | “Temporary failures are retried automatically with backoff, then delivery continues as soon as the receiver recovers.” |
| 40–52 sec | Open a seeded dead-letter event or the permanent-failure event after its retries finish                | “If the endpoint keeps failing, the event is preserved in dead letter instead of disappearing.”                        |
| 52–60 sec | Click Replay on a failed event and return to the event list                                            | “Inspect the response, fix the issue, and replay with one click. Start free with 10,000 webhooks a month.”             |

For a true 60-second edit, prepare the intermittent attempt history and dead-letter event before recording. The live retries intentionally take time: the permanent-failure path takes about 6 minutes after the initial request to exhaust all retries.
